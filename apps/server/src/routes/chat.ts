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
} from '@monorepo/types';

const router: Router = Router();

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

// 存储正在进行的流式请求，用于中断功能
const activeStreams = new Map<string, AbortController>();

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

      // 4. 获取 Agent 配置
      const agents = await query<{ system_prompt: string }>(
        'SELECT system_prompt FROM agents WHERE id = ?',
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

      const systemPrompt = agent.system_prompt || '你是一个有用的AI助手';

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

      // 10. 保存 assistant 回复到数据库
      if (fullContent && !abortController.signal.aborted) {
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
            status: 'usage',
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
    const abortController = activeStreams.get(streamKey);

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
