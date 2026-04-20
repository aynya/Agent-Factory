# 本次更新操作说明（LangGraph/LangChain 接入与记忆能力落地）

> 生成时间：2026-04-21 00:38:27  
> 说明范围：本次会话中已修改/新增的核心文件与验证结果

---

## 1. 本次目标

本次更新的目标是：

1. 在现有对话链路中引入 `LangGraph + LangChain` 编排能力。
2. 保持现有 SSE 协议（`start/token/end/error`）不变。
3. 让对话具备基于数据库历史的记忆能力。
4. 为未来接入 RAG 与 MCP 预留图节点和配置读取位。
5. 修复接入后出现的 MySQL 参数错误（`ER_WRONG_ARGUMENTS`）。

---

## 2. 变更文件清单

### 2.1 新增文件

- `apps/server/src/agent/runtime/chat-agent-runtime.ts`  
  新增智能体运行时，承载 LangGraph 图编排、上下文构建、流式模型调用。
- `apps/server/docs/langgraph-langchain接入与记忆改造-2026-04-21-003827.md`  
  本说明文档。

### 2.2 修改文件

- `apps/server/src/routes/chat.ts`  
  将生产聊天接口改为调用新的 Runtime。
- `apps/web/src/utils/api.ts`  
  前端聊天请求地址由测试接口切换为正式接口。
- `apps/server/package.json`  
  增加 LangChain/LangGraph 依赖。
- `pnpm-lock.yaml`  
  依赖安装后的锁文件更新。

---

## 3. 逐文件详细讲解

## 3.1 `apps/server/src/agent/runtime/chat-agent-runtime.ts`

这个文件是本次改造的核心。它把原来在路由里“直接拼 messages + 调模型”的逻辑抽离成统一运行时。

### 3.1.1 核心职责

- 从数据库读取对话上下文（历史消息 + thread 摘要 + agent 版本配置）。
- 通过 LangGraph 把上下文加工流程组织成可扩展节点链。
- 使用 LangChain 的 `ChatOpenAI` 进行流式生成。
- 通过回调把 token 回传给路由层，保持 SSE 输出行为一致。

### 3.1.2 图状态设计（`RuntimeState`）

状态字段包括：

- 基础定位：`threadId`、`agentId`、`agentVersion`
- 记忆相关：`summary`、`historyMessages`
- 配置相关：`systemPrompt`、`ragConfig`、`mcpConfig`
- 预留扩展：`retrievedContext`、`mcpHint`
- 模型输入：`modelMessages`

这一设计的意义是：后续扩展 RAG/MCP 时，只需要填充状态并调整节点逻辑，不需要推翻当前主流程。

### 3.1.3 图节点流程（LangGraph）

当前图是线性结构：

`START -> loadContext -> ragPlaceholder -> mcpPlaceholder -> buildModelMessages -> END`

- `loadContext`：读取 agent 版本配置、thread summary、历史消息并组装到状态。
- `ragPlaceholder`：RAG 占位节点（目前不做检索，仅预留数据位）。
- `mcpPlaceholder`：MCP 占位节点（目前不调工具，仅预留数据位）。
- `buildModelMessages`：统一构建模型输入（system + summary + 预留上下文 + 历史消息）。

### 3.1.4 模型调用与流式输出

运行时使用 `ChatOpenAI.stream(...)`，循环读取 chunk：

- 将 token 文本提取并回调给 `onToken`。
- 累加 `fullContent` 供最终入库。
- 尝试读取 `usage_metadata.total_tokens`；缺失时用字符估算兜底。

### 3.1.5 记忆来源

当前“记忆”来自数据库：

- `messages`：按 thread 拉历史消息（上限由配置控制）。
- `threads.summary`：作为长会话摘要入口位（当前读取，后续可自动更新）。

### 3.1.6 配置安全修复（本次关键问题修复）

原实现可能将环境变量错误值解析为 `NaN`，再传入 SQL 的 `LIMIT ?`，导致 MySQL 报：

- `ER_WRONG_ARGUMENTS`
- `Incorrect arguments to mysqld_stmt_execute`

本次已修复为：

1. 新增 `resolveHistoryLimit()`，严格校验配置。
2. 非法值回退 50，且最大限制 200。
3. SQL 改为安全数字字面量：`LIMIT ${MAX_HISTORY_MESSAGES}`，避免把异常参数绑定到预编译语句。

---

## 3.2 `apps/server/src/routes/chat.ts`

这是把 Runtime 接到现有聊天接口上的改造点。

### 3.2.1 主要变化

- 移除路由内直接调用 `openai.chat.completions.create(...)` 的逻辑。
- 引入 `chatAgentRuntime.streamAssistantReply(...)`。
- 路由保留以下职责：
  - 用户与 thread 鉴权/校验
  - 用户消息先落库
  - SSE 事件发送（start/token/end/error）
  - 流式中断控制（AbortController）
  - assistant 回复落库

### 3.2.2 与前端协议兼容性

SSE 事件结构未变化，前端无需改事件解析逻辑。

### 3.2.3 错误映射

新增 `ChatRuntimeError` 区分业务错误（如 agent version 不存在）与系统错误，避免统一 500。

---

## 3.3 `apps/web/src/utils/api.ts`

### 3.3.1 变更内容

聊天流式请求地址从：

- `/api/chat/stream-test`

切换到：

- `/api/chat/stream`

### 3.3.2 变更原因

`stream-test` 是模拟输出，不走真实模型与历史上下文；切换到正式接口后，前端才能体验到真正的“记忆对话”。

---

## 3.4 `apps/server/package.json`

新增依赖：

- `@langchain/core`
- `@langchain/langgraph`
- `@langchain/openai`

意义：分别提供消息抽象、图编排能力、OpenAI 模型适配。

---

## 3.5 `pnpm-lock.yaml`

随依赖安装自动更新，无业务逻辑变更。用于确保团队环境与 CI 依赖一致。

---

## 4. 问题排查记录（错误定位与修复）

## 4.1 报错现象

服务端日志报错：

- `ER_WRONG_ARGUMENTS`
- SQL: `SELECT role, content FROM messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT ?`

## 4.2 根因

`LIMIT` 的绑定值来自环境变量解析，存在非法值（如 `NaN`）进入 prepared statement，导致 MySQL 执行阶段参数校验失败。

## 4.3 修复策略

1. 对环境变量做严格解析与范围限制。
2. 仅在值经过验证后用于 SQL 语句。
3. 避免把潜在非法值作为 `LIMIT ?` 的绑定参数传入驱动。

## 4.4 修复结果

- 编译通过：`pnpm build`（`apps/server`）
- 相关文件无 lints 报错。

---

## 5. 当前能力边界与后续建议

## 5.1 已具备

- 对话编排层（LangGraph）已接入。
- 历史记忆（DB 历史消息）已接入。
- RAG/MCP 扩展位已落地到图结构与配置读取层。

## 5.2 暂未实现（预留）

- RAG 真正检索节点（向量检索、重排、上下文注入策略）。
- MCP 工具执行节点（工具发现、调用循环、结果回注）。
- `threads.summary` 自动更新策略（滚动摘要）。

## 5.3 下一步建议

1. 加入 `updateSummary` 节点，按阈值滚动更新 thread 摘要。
2. 把历史裁剪从“条数限制”升级为“token 预算限制”。
3. 增加 Runtime 单元测试（节点级）和 chat 接口 E2E（流式场景）。
4. 增加关键日志字段：`threadId`、`agentVersion`、`historyLimit`、`graphNodeDuration`。

---

## 6. 快速回归建议

1. 启动服务后发起同一 `threadId` 连续两轮对话，确认第二轮可引用第一轮内容。
2. 执行中断操作，确认 SSE 流可被及时终止。
3. 把 `CHAT_HISTORY_MAX_MESSAGES` 设为非法值（如 `abc`），确认服务不再抛 SQL 参数错误。
4. 确认前端请求路径走 `/api/chat/stream`，而非 `/stream-test`。
