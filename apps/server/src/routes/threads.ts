import { Router, type Request, type Response } from 'express';
import { query } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import type { ApiResponse, ThreadAgentDisplay } from '@monorepo/types';

const router: Router = Router();

/**
 * 通过 Thread 获取当前对话所使用 Agent 的展示信息
 * GET /api/threads/:threadId/agent
 * 用于：对话页侧边栏展示、确认当前使用的 Agent 身份与能力
 * 不要求该 thread 属于当前用户，也不要求 agent 为当前用户创建；仅根据 threadId 返回该会话绑定的 agent 展示信息
 * Authorization: Bearer <access_token>
 */
router.get(
  '/:threadId/agent',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<ThreadAgentDisplay>>) => {
    try {
      const threadId = req.params.threadId?.trim();

      if (!threadId) {
        res.status(400).json({
          code: 400,
          message: 'threadId is required',
          data: null,
        });
        return;
      }

      const threads = await query<{ agent_id: string; agent_version: number }>(
        'SELECT agent_id, agent_version FROM threads WHERE id = ? AND (is_debug = 0 OR is_debug IS NULL)',
        [threadId]
      );

      if (threads.length === 0) {
        res.status(404).json({
          code: 404,
          message: 'Thread not found',
          data: null,
        });
        return;
      }

      const { agent_id: agentId, agent_version: agentVersion } = threads[0]!;

      const rows = await query<{
        id: string;
        name: string;
        avatar: string | null;
        tag: string | null;
        latest_version: number;
        description: string | null;
        system_prompt: string | null;
      }>(
        `SELECT a.id, a.name, a.avatar, a.tag, a.latest_version, av.description, av.system_prompt
         FROM agents a
         JOIN agent_versions av ON av.agent_id = a.id AND av.version = ?
         WHERE a.id = ?`,
        [agentVersion, agentId]
      );

      if (rows.length === 0) {
        res.status(404).json({
          code: 404,
          message: 'Agent or agent version not found',
          data: null,
        });
        return;
      }

      const row = rows[0]!;
      const data: ThreadAgentDisplay = {
        agentId: row.id,
        agentVersion,
        name: row.name,
        description: row.description ?? null,
        avatar: row.avatar,
        tag: row.tag,
        systemPrompt: row.system_prompt ?? null,
        isLatestVersion: agentVersion === row.latest_version,
        latestVersion: row.latest_version,
      };

      res.json({
        code: 0,
        message: 'ok',
        data,
      });
    } catch (error: unknown) {
      console.error('Get thread agent error:', error);
      res.status(500).json({
        code: 500,
        message: error instanceof Error ? error.message : '服务器内部错误',
        data: null,
      });
    }
  }
);

export default router;
