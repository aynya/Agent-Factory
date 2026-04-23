import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import { query } from '../../config/db.js';

const DEFAULT_SYSTEM_PROMPT = '你是一个有用的AI助手';

function resolveHistoryLimit(): number {
  const raw = process.env.CHAT_HISTORY_MAX_MESSAGES;
  const parsed = raw == null ? Number.NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 200);
}

const MAX_HISTORY_MESSAGES = resolveHistoryLimit();

type JsonLike = Record<string, unknown> | unknown[] | string | number | boolean;

interface ChatRuntimeInput {
  threadId: string;
  agentId: string;
  agentVersion: number;
  abortSignal: AbortSignal;
  onToken: (token: string) => void;
}

interface ChatRuntimeResult {
  fullContent: string;
  totalTokens: number;
}

interface RuntimeTool {
  name: string;
  description?: string;
  invoke: (input: Record<string, unknown>) => Promise<unknown>;
}

interface RuntimeToolCall {
  id?: string;
  name: string;
  args?: unknown;
}

interface ModelToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  type?: 'tool_call';
}

interface RuntimeState {
  threadId: string;
  agentId: string;
  agentVersion: number;
  systemPrompt: string;
  summary: string | null;
  ragConfig: JsonLike | null;
  mcpConfig: JsonLike | null;
  tools: RuntimeTool[];
  messages: BaseMessage[];
}

interface McpToolDefinition {
  name: string;
  description?: string;
}

/** 单个 MCP 接入点（可从 mcpServers 中解析多条） */
interface McpEndpoint {
  serverKey: string;
  url: string;
  /** 用户自定义请求头；Content-Type / Accept 由后端固定追加，忽略用户传入的同名头 */
  extraHeaders: Record<string, string>;
}

const RuntimeStateAnnotation = Annotation.Root({
  threadId: Annotation<string>({ reducer: (_, right) => right }),
  agentId: Annotation<string>({ reducer: (_, right) => right }),
  agentVersion: Annotation<number>({ reducer: (_, right) => right }),
  systemPrompt: Annotation<string>({
    reducer: (_, right) => right,
    default: () => DEFAULT_SYSTEM_PROMPT,
  }),
  summary: Annotation<string | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  ragConfig: Annotation<JsonLike | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  mcpConfig: Annotation<JsonLike | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  tools: Annotation<RuntimeTool[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
});

export class ChatRuntimeError extends Error {
  constructor(
    message: string,
    public readonly code: number
  ) {
    super(message);
    this.name = 'ChatRuntimeError';
  }
}

function parseMaybeJson(value: unknown): JsonLike | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as JsonLike;
    } catch {
      return trimmed;
    }
  }
  if (
    typeof value === 'object' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value as JsonLike;
  }
  return null;
}

function normalizeHeaderRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== 'string' || !v.trim()) continue;
    const key = k.trim();
    if (!key) continue;
    const lower = key.toLowerCase();
    if (lower === 'content-type' || lower === 'accept') continue;
    out[key] = v.trim();
  }
  return out;
}

/**
 * 支持：
 * 1) { "mcpServers": { "amap": { "url": "...", "headers": { ... } } } }
 * 2) 兼容旧版 { "url": "...", "headers"? }
 * 3) 纯字符串 URL
 */
function parseMcpEndpoints(raw: JsonLike | null): McpEndpoint[] {
  if (raw == null) return [];

  let root: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      root = JSON.parse(trimmed) as unknown;
    } catch {
      return [{ serverKey: 'default', url: trimmed, extraHeaders: {} }];
    }
  }

  if (typeof root !== 'object' || root === null || Array.isArray(root))
    return [];
  const record = root as Record<string, unknown>;

  if (
    record.mcpServers &&
    typeof record.mcpServers === 'object' &&
    !Array.isArray(record.mcpServers)
  ) {
    const servers = record.mcpServers as Record<string, unknown>;
    const out: McpEndpoint[] = [];
    for (const [key, val] of Object.entries(servers)) {
      const serverKey = key.trim();
      if (!serverKey) continue;
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
      const s = val as { url?: unknown; headers?: unknown };
      if (typeof s.url !== 'string' || !s.url.trim()) continue;
      out.push({
        serverKey,
        url: s.url.trim(),
        extraHeaders: normalizeHeaderRecord(s.headers),
      });
    }
    return out;
  }

  if (typeof record.url === 'string' && record.url.trim()) {
    return [
      {
        serverKey: 'default',
        url: record.url.trim(),
        extraHeaders: normalizeHeaderRecord(record.headers),
      },
    ];
  }

  return [];
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map(item => {
      if (typeof item === 'string') return item;
      if (
        item &&
        typeof item === 'object' &&
        'text' in item &&
        typeof (item as { text?: unknown }).text === 'string'
      ) {
        return (item as { text: string }).text;
      }
      return '';
    })
    .join('');
}

function toBaseMessages(
  rows: Array<{ role: 'user' | 'assistant'; content: string }>
): BaseMessage[] {
  return rows.map(row =>
    row.role === 'user'
      ? new HumanMessage(row.content)
      : new AIMessage(row.content)
  );
}

async function mcpRequest(
  endpoint: McpEndpoint,
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const payload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  };

  console.log('[MCP] JSON-RPC →', {
    server: endpoint.serverKey,
    method,
    url: endpoint.url,
    params,
  });

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        ...endpoint.extraHeaders,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as unknown;
    console.log('[MCP] JSON-RPC ←', {
      server: endpoint.serverKey,
      method,
      status: response.status,
      ok: response.ok,
      bodyPreview:
        typeof body === 'object' && body !== null
          ? JSON.stringify(body).slice(0, 500)
          : String(body).slice(0, 500),
    });
    return body;
  } catch (error) {
    console.error('[MCP] JSON-RPC error', endpoint.serverKey, method, error);
    throw error;
  }
}

function sanitizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

async function createMcpTools(endpoint: McpEndpoint): Promise<RuntimeTool[]> {
  const listResult = (await mcpRequest(endpoint, 'tools/list')) as {
    result?: { tools?: McpToolDefinition[] };
  };
  const mcpTools = listResult.result?.tools ?? [];
  const toolNamePrefix = `${sanitizeToolName(endpoint.serverKey)}_`;
  console.log('[MCP] tools/list 完成', {
    server: endpoint.serverKey,
    count: mcpTools.length,
    remoteNames: mcpTools.map(t => t.name),
    boundNames: mcpTools.map(
      t => `${toolNamePrefix}${sanitizeToolName(t.name)}`
    ),
  });

  return mcpTools.map(mcpTool =>
    tool(
      async (args: Record<string, unknown>) => {
        console.log('[MCP] 工具执行开始', {
          server: endpoint.serverKey,
          remoteName: mcpTool.name,
          langchainName: `${toolNamePrefix}${sanitizeToolName(mcpTool.name)}`,
          arguments: args,
        });
        const callResult = (await mcpRequest(endpoint, 'tools/call', {
          name: mcpTool.name,
          arguments: args,
        })) as {
          result?: { content?: unknown };
          error?: { message?: string };
        };

        if (callResult.error?.message) {
          console.warn('[MCP] 工具返回 error 字段', {
            server: endpoint.serverKey,
            name: mcpTool.name,
            message: callResult.error.message,
          });
          return `MCP 工具调用失败: ${callResult.error.message}`;
        }
        const content = callResult.result?.content ?? callResult.result;
        const out =
          typeof content === 'string' ? content : JSON.stringify(content);
        console.log('[MCP] 工具执行结束', {
          server: endpoint.serverKey,
          name: mcpTool.name,
          resultPreview: out.slice(0, 400),
        });
        return out;
      },
      {
        name: `${toolNamePrefix}${sanitizeToolName(mcpTool.name)}`,
        description: mcpTool.description ?? `MCP 工具：${mcpTool.name}`,
        schema: z.record(z.string(), z.unknown()),
      }
    )
  );
}

async function resolveRuntimeTools(
  _ragConfig: JsonLike | null,
  mcpConfigRaw: JsonLike | null
): Promise<RuntimeTool[]> {
  const endpoints = parseMcpEndpoints(mcpConfigRaw);
  if (endpoints.length === 0) {
    console.log('[ChatRuntime] MCP：无可用 endpoint，跳过工具加载');
    return [];
  }
  console.log('[ChatRuntime] MCP：解析到 endpoint', {
    count: endpoints.length,
    servers: endpoints.map(e => ({
      key: e.serverKey,
      url: e.url,
      headerKeys: Object.keys(e.extraHeaders),
    })),
  });
  const tools: RuntimeTool[] = [];
  for (const ep of endpoints) {
    tools.push(...(await createMcpTools(ep)));
  }
  console.log('[ChatRuntime] MCP：本轮共绑定 LangChain 工具', tools.length, {
    names: tools.map(t => t.name),
  });
  return tools;
}

async function loadContext(
  state: RuntimeState
): Promise<Partial<RuntimeState>> {
  const versionRows = await query<{
    system_prompt: string | null;
    rag_config: unknown;
    mcp_config: unknown;
  }>(
    'SELECT system_prompt, rag_config, mcp_config FROM agent_versions WHERE agent_id = ? AND version = ?',
    [state.agentId, state.agentVersion]
  );
  if (versionRows.length === 0) {
    throw new ChatRuntimeError('Agent version not found', 404);
  }

  const threadRows = await query<{ summary: string | null }>(
    'SELECT summary FROM threads WHERE id = ? LIMIT 1',
    [state.threadId]
  );
  const summary = threadRows[0]?.summary ?? null;

  const rawHistory = await query<{
    role: 'user' | 'assistant';
    content: string;
  }>(
    `SELECT role, content FROM messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT ${MAX_HISTORY_MESSAGES}`,
    [state.threadId]
  );
  const historyMessages = toBaseMessages(rawHistory.reverse());

  const version = versionRows[0]!;
  const ragConfig = parseMaybeJson(version.rag_config);
  const mcpConfig = parseMaybeJson(version.mcp_config);
  const runtimeTools = await resolveRuntimeTools(ragConfig, mcpConfig);

  const systemBlocks = [
    (typeof version.system_prompt === 'string' &&
      version.system_prompt.trim()) ||
      DEFAULT_SYSTEM_PROMPT,
  ];
  if (summary && summary.trim()) {
    systemBlocks.push(`历史摘要：\n${summary.trim()}`);
  }
  if (ragConfig) {
    systemBlocks.push(
      '注意：该 Agent 未来会支持 RAG（上传文件），当前版本暂未启用。'
    );
  }
  if (runtimeTools.length > 0) {
    systemBlocks.push('已启用 MCP：可在对话中按需调用配置的远程工具。');
  }

  return {
    systemPrompt: systemBlocks[0] ?? DEFAULT_SYSTEM_PROMPT,
    summary,
    ragConfig,
    mcpConfig,
    tools: runtimeTools,
    messages: [
      new SystemMessage(systemBlocks.join('\n\n')),
      ...historyMessages,
    ],
  };
}

function readToolCalls(state: RuntimeState): RuntimeToolCall[] {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!(lastMessage instanceof AIMessage)) return [];
  const maybeCalls = lastMessage.tool_calls;
  return Array.isArray(maybeCalls) ? (maybeCalls as RuntimeToolCall[]) : [];
}

function shouldContinue(state: RuntimeState): 'callTools' | typeof END {
  const calls = readToolCalls(state);
  if (calls.length > 0) {
    console.log('[ChatRuntime] 图路由 agent → callTools', {
      count: calls.length,
      calls: calls.map(c => ({
        name: c.name,
        args: normalizeToolInput(c.args),
      })),
    });
    return 'callTools';
  }
  return END;
}

function normalizeToolInput(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object'
    ? (input as Record<string, unknown>)
    : {};
}

function normalizeToolCallsForAIMessage(
  toolCalls: RuntimeToolCall[]
): ModelToolCall[] {
  return toolCalls
    .filter(
      call => typeof call.name === 'string' && call.name.trim().length > 0
    )
    .map(call => {
      const base: ModelToolCall = {
        name: call.name,
        args: normalizeToolInput(call.args),
        type: 'tool_call',
      };
      if (typeof call.id === 'string' && call.id.length > 0) {
        base.id = call.id;
      }
      return base;
    });
}

async function callTools(state: RuntimeState): Promise<Partial<RuntimeState>> {
  const toolCalls = readToolCalls(state);
  if (toolCalls.length === 0) return {};

  console.log('[ChatRuntime] callTools 节点开始', {
    threadId: state.threadId,
    toolCallCount: toolCalls.length,
  });
  const toolMessages: ToolMessage[] = [];
  for (const toolCall of toolCalls) {
    const args = normalizeToolInput(toolCall.args);
    const tool = state.tools.find(item => item.name === toolCall.name);
    if (!tool) {
      console.warn('[ChatRuntime] 未找到绑定工具', {
        requested: toolCall.name,
        available: state.tools.map(t => t.name),
      });
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCall.id ?? toolCall.name,
          content: `工具 "${toolCall.name}" 不存在或未启用。`,
        })
      );
      continue;
    }

    try {
      console.log('[ChatRuntime] invoke LangChain 工具', {
        name: toolCall.name,
        args,
      });
      const result = await tool.invoke(args);
      const text = typeof result === 'string' ? result : JSON.stringify(result);
      console.log('[ChatRuntime] 工具返回（写入 ToolMessage）', {
        name: toolCall.name,
        preview: text.slice(0, 400),
      });
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCall.id ?? toolCall.name,
          content: text,
        })
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : '未知错误';
      console.error('[ChatRuntime] 工具 invoke 异常', toolCall.name, reason);
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCall.id ?? toolCall.name,
          content: `工具 "${toolCall.name}" 执行失败：${reason}`,
        })
      );
    }
  }

  console.log('[ChatRuntime] callTools 节点结束', {
    toolMessageCount: toolMessages.length,
  });
  return { messages: toolMessages };
}

function createRuntimeGraph(model: ChatOpenAI) {
  const runAgent = async (
    state: RuntimeState,
    runtime?: unknown
  ): Promise<Partial<RuntimeState>> => {
    const runnable =
      state.tools.length > 0 ? model.bindTools(state.tools) : model;
    // 与参考示例一致：bindTools 后用 invoke 才能得到完整的 tool_calls（含 arguments）。
    // stream 时 chunk.tool_calls 往往只有片段，容易导致 MCP 收到 arguments: {}。
    if (state.tools.length > 0) {
      const response = await runnable.invoke(state.messages, runtime as never);
      if (response instanceof AIMessage) {
        const tc = response.tool_calls;
        if (Array.isArray(tc) && tc.length > 0) {
          console.log('[ChatRuntime] agent 轮次结束（含 tool_calls）', {
            contentPreview: contentToText(response.content).slice(0, 200),
            toolCalls: tc.map(c => ({
              name: c.name,
              args:
                c.args && typeof c.args === 'object'
                  ? c.args
                  : normalizeToolInput(c.args),
            })),
          });
        } else {
          console.log('[ChatRuntime] agent 轮次结束（纯文本，无 tool_calls）', {
            contentPreview: contentToText(response.content).slice(0, 300),
          });
        }
        return { messages: [response] };
      }
      return {
        messages: [
          new AIMessage({
            content: contentToText((response as { content?: unknown }).content),
            tool_calls: normalizeToolCallsForAIMessage(
              ((response as { tool_calls?: RuntimeToolCall[] }).tool_calls ??
                []) as RuntimeToolCall[]
            ),
          }),
        ],
      };
    }

    const stream = await runnable.stream(state.messages, runtime as never);
    let turnContent = '';
    let turnToolCalls: RuntimeToolCall[] = [];
    for await (const chunk of stream) {
      turnContent += contentToText(chunk.content);
      const chunkToolCalls = (
        chunk as unknown as { tool_calls?: RuntimeToolCall[] }
      ).tool_calls;
      if (Array.isArray(chunkToolCalls) && chunkToolCalls.length > 0) {
        turnToolCalls = chunkToolCalls;
      }
    }
    return {
      messages: [
        new AIMessage({
          content: turnContent,
          tool_calls: normalizeToolCallsForAIMessage(turnToolCalls),
        }),
      ],
    };
  };

  return new StateGraph(RuntimeStateAnnotation)
    .addNode('loadContext', loadContext)
    .addNode('agent', runAgent)
    .addNode('callTools', callTools)
    .addEdge(START, 'loadContext')
    .addEdge('loadContext', 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('callTools', 'agent')
    .compile();
}

class ChatAgentRuntime {
  private readonly model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    },
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    temperature: 0.7,
    streaming: true,
  });

  private readonly graph = createRuntimeGraph(this.model);

  async streamAssistantReply(
    input: ChatRuntimeInput
  ): Promise<ChatRuntimeResult> {
    let fullContent = '';
    let totalTokens = 0;
    const eventStream = this.graph.streamEvents(
      {
        threadId: input.threadId,
        agentId: input.agentId,
        agentVersion: input.agentVersion,
      },
      {
        version: 'v2',
        signal: input.abortSignal,
      }
    );

    for await (const event of eventStream) {
      if (input.abortSignal.aborted) break;
      if (event.event === 'on_chat_model_stream') {
        const token = contentToText(
          (event.data as { chunk?: { content?: unknown } })?.chunk?.content
        );
        if (token) {
          fullContent += token;
          input.onToken(token);
        }
        continue;
      }

      if (event.event === 'on_chat_model_end') {
        const output = (
          event.data as {
            output?: { usage_metadata?: { total_tokens?: number } };
          }
        )?.output;
        if (typeof output?.usage_metadata?.total_tokens === 'number') {
          totalTokens = Math.max(
            totalTokens,
            output.usage_metadata.total_tokens
          );
        }
      }
    }

    return {
      fullContent,
      totalTokens:
        totalTokens > 0 ? totalTokens : Math.ceil(fullContent.length / 4),
    };
  }
}

export const chatAgentRuntime = new ChatAgentRuntime();
