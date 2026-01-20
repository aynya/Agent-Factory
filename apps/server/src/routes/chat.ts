import { Router } from 'express';
import type { Request, Response } from 'express';
import OpenAI from 'openai';
import { query, getConnection } from '../config/db.js';
import { generateUUID } from '../utils/uuid.js';
import { authenticateToken } from '../middleware/auth.js';
import type {
  ChatStreamRequest,
  ChatAbortRequest,
  ChatAbortResponse,
  ApiResponse,
  Thread,
  Message,
} from '@monorepo/types';

const router: Router = Router();

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

// 存储正在进行的流式请求，用于中断功能
const activeStreams = new Map<string, AbortController>();
// 存储测试接口的流式请求
const testActiveStreams = new Map<string, AbortController>();

/**
 * SSE 流式聊天接口
 * POST /api/chat/stream
 */
router.post(
  '/stream',
  authenticateToken,
  async (req: Request, res: Response) => {
    const user = (
      req as Request & { user: { user_id: string; username: string } }
    ).user;
    const { agent_id, thread_id, content }: ChatStreamRequest = req.body;

    // 验证请求参数
    if (!agent_id || !thread_id || !content) {
      res.write(`event: error\n`);
      res.write(
        `data: ${JSON.stringify({
          code: 400,
          message: 'agent_id, thread_id, and content are required',
        })}\n\n`
      );
      res.end();
      return;
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲

    const connection = await getConnection();
    const abortController = new AbortController();
    const streamKey = `${user.user_id}_${thread_id}`;
    activeStreams.set(streamKey, abortController);

    try {
      // 1. 检查或创建 thread
      const existingThreads = await query<{ id: string }>(
        'SELECT id FROM threads WHERE id = ? AND user_id = ?',
        [thread_id, user.user_id]
      );

      if (existingThreads.length === 0) {
        // 创建新 thread
        await query(
          'INSERT INTO threads (id, user_id, agent_id, title) VALUES (?, ?, ?, ?)',
          [thread_id, user.user_id, agent_id, content.substring(0, 255)]
        );
      } else {
        // 更新 thread 的更新时间
        await query(
          'UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [thread_id]
        );
      }

      // 2. 保存用户消息到数据库
      const userMessageId = generateUUID();
      await query(
        'INSERT INTO messages (id, thread_id, role, content, token) VALUES (?, ?, ?, ?, ?)',
        [userMessageId, thread_id, 'user', content, 0]
      );

      // 3. 获取历史消息（用于构建上下文，不包括刚插入的用户消息）
      const historyMessages = await query<{
        role: 'user' | 'assistant';
        content: string;
      }>(
        'SELECT role, content FROM messages WHERE thread_id = ? AND id != ? ORDER BY created_at ASC LIMIT 20',
        [thread_id, userMessageId]
      );

      // 4. 获取 Agent 配置（config 为 JSON，内含 system_prompt 等）
      const agents = await query<{ config: { system_prompt?: string } | null }>(
        'SELECT config FROM agents WHERE id = ?',
        [agent_id]
      );

      const agent = agents[0];
      if (!agent) {
        res.write(`event: error\n`);
        res.write(
          `data: ${JSON.stringify({ code: 404, message: 'Agent not found' })}\n\n`
        );
        res.end();
        return;
      }

      const raw =
        agent.config && typeof agent.config === 'object'
          ? (agent.config as Record<string, unknown>).system_prompt
          : null;
      const systemPrompt =
        (typeof raw === 'string' ? raw : null) || '你是一个有用的AI助手';

      // 5. 构建 OpenAI 消息格式
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...historyMessages.map(msg => ({
          role: (msg.role === 'user' ? 'user' : 'assistant') as
            | 'user'
            | 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: content }, // 包含当前用户消息
      ];

      // 6. 生成 assistant 消息 ID
      const assistantMessageId = generateUUID();
      const createdAt = new Date().toISOString();

      // 7. 发送 start 事件
      res.write(`event: start\n`);
      res.write(
        `data: ${JSON.stringify({
          messageId: assistantMessageId,
          role: 'assistant',
          createdAt,
        })}\n\n`
      );

      // 8. 调用 OpenAI API（流式）
      const stream = await openai.chat.completions.create(
        {
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          messages,
          stream: true,
          temperature: 0.7,
        },
        {
          signal: abortController.signal,
        }
      );

      let fullContent = '';
      let totalTokens = 0;

      // 9. 处理流式响应
      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          break;
        }

        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          // 发送 token 事件
          res.write(`event: token\n`);
          res.write(
            `data: ${JSON.stringify({
              messageId: assistantMessageId,
              content: delta,
            })}\n\n`
          );
        }

        // 记录 token 使用情况（通常在最后一个 chunk 中）
        if (chunk.usage?.total_tokens) {
          totalTokens = chunk.usage.total_tokens;
        }
      }

      // 10. 保存 assistant 回复到数据库（包括中断的情况）
      if (fullContent) {
        const isAborted = abortController.signal.aborted;

        await query(
          'INSERT INTO messages (id, thread_id, role, content, token) VALUES (?, ?, ?, ?, ?)',
          [assistantMessageId, thread_id, 'assistant', fullContent, totalTokens]
        );

        // 11. 发送 end 事件
        res.write(`event: end\n`);
        res.write(
          `data: ${JSON.stringify({
            messageId: assistantMessageId,
            role: 'assistant',
            status: isAborted ? 'aborted' : 'usage',
            totalTokens,
          })}\n\n`
        );
      }

      res.end();
    } catch (error: unknown) {
      console.error('Chat stream error:', error);

      // 如果是中断错误，不发送错误事件
      if (error instanceof Error && error.name === 'AbortError') {
        res.end();
        return;
      }

      // 发送错误事件
      res.write(`event: error\n`);
      res.write(
        `data: ${JSON.stringify({
          code: 500,
          message: error instanceof Error ? error.message : '服务器内部错误',
        })}\n\n`
      );
      res.end();
    } finally {
      // 清理资源
      activeStreams.delete(streamKey);
      connection.release();
    }
  }
);

/**
 * SSE 流式聊天测试接口（模拟响应，不调用大模型）
 * POST /api/chat/stream-test
 */
router.post(
  '/stream-test',
  authenticateToken,
  async (req: Request, res: Response) => {
    const user = (
      req as Request & { user: { user_id: string; username: string } }
    ).user;
    const { agent_id, thread_id, content }: ChatStreamRequest = req.body;

    // 验证请求参数
    if (!agent_id || !thread_id || !content) {
      res.write(`event: error\n`);
      res.write(
        `data: ${JSON.stringify({
          code: 400,
          message: 'agent_id, thread_id, and content are required',
        })}\n\n`
      );
      res.end();
      return;
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲

    const connection = await getConnection();
    const abortController = new AbortController();
    const streamKey = `test_${user.user_id}_${thread_id}`;
    testActiveStreams.set(streamKey, abortController);

    try {
      // 1. 检查或创建 thread
      const existingThreads = await query<{ id: string }>(
        'SELECT id FROM threads WHERE id = ? AND user_id = ?',
        [thread_id, user.user_id]
      );

      if (existingThreads.length === 0) {
        // 创建新 thread
        await query(
          'INSERT INTO threads (id, user_id, agent_id, title) VALUES (?, ?, ?, ?)',
          [thread_id, user.user_id, agent_id, content.substring(0, 255)]
        );
      } else {
        // 更新 thread 的更新时间
        await query(
          'UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [thread_id]
        );
      }

      // 2. 保存用户消息到数据库
      const userMessageId = generateUUID();
      await query(
        'INSERT INTO messages (id, thread_id, role, content, token) VALUES (?, ?, ?, ?, ?)',
        [userMessageId, thread_id, 'user', content, 0]
      );

      // 3. 获取 Agent 配置（可选，用于测试；config 为 JSON，内含 system_prompt 等）
      const agents = await query<{ config: { system_prompt?: string } | null }>(
        'SELECT config FROM agents WHERE id = ?',
        [agent_id]
      );

      const agent = agents[0];
      if (!agent) {
        res.write(`event: error\n`);
        res.write(
          `data: ${JSON.stringify({ code: 404, message: 'Agent not found' })}\n\n`
        );
        res.end();
        return;
      }

      // 4. 生成 assistant 消息 ID
      const assistantMessageId = generateUUID();
      const createdAt = new Date().toISOString();

      // 5. 发送 start 事件
      res.write(`event: start\n`);
      res.write(
        `data: ${JSON.stringify({
          messageId: assistantMessageId,
          role: 'assistant',
          createdAt,
        })}\n\n`
      );

      // 6. 模拟 AI 回复内容（硬编码）
      const mockResponse = `你好！我收到了你的消息："${content}"。\n\n这是一个测试接口，用于模拟 AI 回复。我可以帮你测试流式响应功能，包括：\n\n1. **流式输出**：逐字符显示回复内容\n2. **Markdown 渲染**：支持代码块、列表等格式\n3. **中断功能**：可以随时停止生成\n\n如果你有任何问题，随时告诉我！你好！我收到了你的消息："${content}"。\n\n这是一个测试接口，用于模拟 AI 回复。我可以帮你测试流式响应功能，包括：\n\n1. **流式输出**：逐字符显示回复内容\n2. **Markdown 渲染**：支持代码块、列表等格式\n3. **中断功能**：可以随时停止生成\n\n如果你有任何问题，随时告诉我！你好！我收到了你的消息："${content}"。\n\n这是一个测试接口，用于模拟 AI 回复。我可以帮你测试流式响应功能，包括：\n\n1. **流式输出**：逐字符显示回复内容\n2. **Markdown 渲染**：支持代码块、列表等格式\n3. **中断功能**：可以随时停止生成\n\n如果你有任何问题，随时告诉我！你好！我收到了你的消息："${content}"。\n\n这是一个测试接口，用于模拟 AI 回复。我可以帮你测试流式响应功能，包括：\n\n1. **流式输出**：逐字符显示回复内容\n2. **Markdown 渲染**：支持代码块、列表等格式\n3. **中断功能**：可以随时停止生成\n\n如果你有任何问题，随时告诉我！你好！我收到了你的消息："${content}"。\n\n这是一个测试接口，用于模拟 AI 回复。我可以帮你测试流式响应功能，包括：\n\n1. **流式输出**：逐字符显示回复内容\n2. **Markdown 渲染**：支持代码块、列表等格式\n3. **中断功能**：可以随时停止生成\n\n如果你有任何问题，随时告诉我！`;

      // 7. 模拟流式输出（逐字符发送）
      const delay = (ms: number) =>
        new Promise(resolve => setTimeout(resolve, ms));

      let fullContent = '';

      for (let i = 0; i < mockResponse.length; i++) {
        if (abortController.signal.aborted) {
          break;
        }

        const char = mockResponse[i];
        fullContent += char;

        // 发送 token 事件
        res.write(`event: token\n`);
        res.write(
          `data: ${JSON.stringify({
            messageId: assistantMessageId,
            content: char,
          })}\n\n`
        );

        // 模拟网络延迟（每 20-50ms 发送一个字符）
        await delay(Math.random() * 30 + 20);
      }

      // 8. 保存 assistant 回复到数据库（包括中断的情况）
      if (fullContent) {
        const isAborted = abortController.signal.aborted;
        // 模拟 token 使用量（根据内容长度估算）
        const estimatedTokens = Math.ceil(fullContent.length / 4);

        await query(
          'INSERT INTO messages (id, thread_id, role, content, token) VALUES (?, ?, ?, ?, ?)',
          [
            assistantMessageId,
            thread_id,
            'assistant',
            fullContent,
            estimatedTokens,
          ]
        );

        // 9. 发送 end 事件
        res.write(`event: end\n`);
        res.write(
          `data: ${JSON.stringify({
            messageId: assistantMessageId,
            role: 'assistant',
            status: isAborted ? 'aborted' : 'usage',
            totalTokens: estimatedTokens,
          })}\n\n`
        );
      }

      res.end();
    } catch (error: unknown) {
      console.error('Test chat stream error:', error);

      // 如果是中断错误，不发送错误事件
      if (error instanceof Error && error.name === 'AbortError') {
        res.end();
        return;
      }

      // 发送错误事件
      res.write(`event: error\n`);
      res.write(
        `data: ${JSON.stringify({
          code: 500,
          message: error instanceof Error ? error.message : '服务器内部错误',
        })}\n\n`
      );
      res.end();
    } finally {
      // 清理资源
      testActiveStreams.delete(streamKey);
      connection.release();
    }
  }
);

/**
 * 获取用户会话列表
 * GET /api/chat/threads
 */
router.get(
  '/threads',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<Thread[]>>) => {
    const user = (
      req as Request & { user: { user_id: string; username: string } }
    ).user;

    try {
      // 查询该用户的所有会话，按更新时间降序排列
      const threads = await query<{
        id: string;
        title: string;
        agent_id: string;
        updated_at: string;
      }>(
        'SELECT id, title, agent_id, updated_at FROM threads WHERE user_id = ? ORDER BY updated_at DESC',
        [user.user_id]
      );

      // 转换为前端需要的格式
      const threadList: Thread[] = threads.map(thread => ({
        threadId: thread.id,
        title: thread.title || '未命名会话',
        agentId: thread.agent_id,
        updatedAt: thread.updated_at,
      }));

      res.json({
        code: 0,
        message: 'ok',
        data: threadList,
      });
    } catch (error: unknown) {
      console.error('Get threads error:', error);
      res.status(500).json({
        code: 500,
        message: error instanceof Error ? error.message : '服务器内部错误',
        data: null,
      });
    }
  }
);

/**
 * 获取历史消息接口
 * GET /api/chat/message/:thread_id
 */
router.get(
  '/message/:thread_id',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<Message[]>>) => {
    const user = (
      req as Request & { user: { user_id: string; username: string } }
    ).user;
    const { thread_id } = req.params;

    try {
      // 验证 thread_id 是否属于当前用户
      const threads = await query<{ id: string }>(
        'SELECT id FROM threads WHERE id = ? AND user_id = ?',
        [thread_id, user.user_id]
      );

      if (threads.length === 0) {
        res.status(404).json({
          code: 404,
          message: 'Thread not found or access denied',
          data: null,
        });
        return;
      }

      // 查询该会话的所有消息，按创建时间升序排列
      const messages = await query<{
        id: string;
        thread_id: string;
        role: 'user' | 'assistant';
        content: string;
        created_at: string;
      }>(
        'SELECT id, thread_id, role, content, created_at FROM messages WHERE thread_id = ? ORDER BY created_at ASC',
        [thread_id]
      );

      // 转换为前端需要的格式
      const messageList: Message[] = messages.map(message => ({
        id: message.id,
        thread_id: message.thread_id,
        role: message.role,
        content: message.content,
        created_at: message.created_at,
      }));

      res.json({
        code: 0,
        message: 'ok',
        data: messageList,
      });
    } catch (error: unknown) {
      console.error('Get messages error:', error);
      res.status(500).json({
        code: 500,
        message: error instanceof Error ? error.message : '服务器内部错误',
        data: null,
      });
    }
  }
);

/**
 * 删除会话接口
 * DELETE /api/chat/thread/:thread_id
 */
router.delete(
  '/thread/:thread_id',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<null>>) => {
    const user = (
      req as Request & { user: { user_id: string; username: string } }
    ).user;
    const { thread_id } = req.params;

    try {
      // 验证 thread_id 是否属于当前用户
      const threads = await query<{ id: string }>(
        'SELECT id FROM threads WHERE id = ? AND user_id = ?',
        [thread_id, user.user_id]
      );

      if (threads.length === 0) {
        res.status(404).json({
          code: 404,
          message: 'Thread not found or access denied',
          data: null,
        });
        return;
      }

      // 删除会话（由于外键约束 ON DELETE CASCADE，关联的消息会自动删除）
      await query('DELETE FROM threads WHERE id = ? AND user_id = ?', [
        thread_id,
        user.user_id,
      ]);

      // 清理可能存在的流式请求
      const streamKey = `${user.user_id}_${thread_id}`;
      const testStreamKey = `test_${user.user_id}_${thread_id}`;
      activeStreams.delete(streamKey);
      testActiveStreams.delete(testStreamKey);

      res.json({
        code: 0,
        message: 'ok',
        data: null,
      });
    } catch (error: unknown) {
      console.error('Delete thread error:', error);
      res.status(500).json({
        code: 500,
        message: error instanceof Error ? error.message : '服务器内部错误',
        data: null,
      });
    }
  }
);

/**
 * 中断聊天接口
 * POST /api/chat/abort
 */
router.post(
  '/abort',
  authenticateToken,
  async (
    req: Request,
    res: Response<ApiResponse<ChatAbortResponse | null>>
  ) => {
    const user = (
      req as Request & { user: { user_id: string; username: string } }
    ).user;
    const { agent_id, thread_id }: ChatAbortRequest = req.body;

    // 验证请求参数
    if (!agent_id || !thread_id) {
      res.status(400).json({
        code: 1,
        message: 'agent_id and thread_id are required',
        data: null,
      });
      return;
    }

    const streamKey = `${user.user_id}_${thread_id}`;
    const testStreamKey = `test_${user.user_id}_${thread_id}`;

    // 尝试中断正常流式请求
    const abortController = activeStreams.get(streamKey);
    // 尝试中断测试流式请求
    const testAbortController = testActiveStreams.get(testStreamKey);

    if (abortController) {
      abortController.abort();
      activeStreams.delete(streamKey);

      res.json({
        code: 0,
        message: 'interrupt success',
        data: {
          thread_id: thread_id,
        },
      });
    } else if (testAbortController) {
      testAbortController.abort();
      testActiveStreams.delete(testStreamKey);

      res.json({
        code: 0,
        message: 'interrupt success (test)',
        data: {
          thread_id: thread_id,
        },
      });
    } else {
      res.json({
        code: 0,
        message: 'no active stream to interrupt',
        data: {
          thread_id: thread_id,
        },
      });
    }
  }
);

export default router;
