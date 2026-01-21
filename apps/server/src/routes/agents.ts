import { Router } from 'express';
import type { Request, Response } from 'express';
import { query } from '../config/db.js';
import { generateUUID } from '../utils/uuid.js';
import { authenticateToken } from '../middleware/auth.js';
import type {
  ApiResponse,
  AgentInDB,
  AgentListItem,
  CreateAgentRequest,
  CreateAgentResponse,
} from '@monorepo/types';

const router: Router = Router();

const VALID_TAGS = [
  'assistant',
  'expert',
  'creative',
  'companion',
  'explore',
] as const;

function toAgentListItem(row: AgentInDB): AgentListItem {
  return {
    agentId: row.id,
    name: row.name,
    description: row.description,
    avatar: row.avatar,
    tag: row.tag,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * 获取我的智能体
 * GET /api/agents/me
 * GET /api/agents/me?tag=assistant
 * 按标签过滤（可选）: assistant | expert | creative | companion | explore
 */
router.get(
  '/me',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<AgentListItem[]>>) => {
    try {
      const userId = (
        req as Request & { user: { user_id: string; username: string } }
      ).user.user_id;
      const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : undefined;

      if (tag !== undefined && tag !== '') {
        if (!VALID_TAGS.includes(tag as (typeof VALID_TAGS)[number])) {
          res.status(400).json({
            code: 4001,
            message: `Invalid tag. Supported: ${VALID_TAGS.join(', ')}`,
            data: null,
          });
          return;
        }
      }

      let sql =
        'SELECT id, name, description, avatar, tag, status, created_at, updated_at FROM agents WHERE creator_id = ?';
      const params: (string | undefined)[] = [userId];

      if (tag) {
        sql += ' AND FIND_IN_SET(?, tag)';
        params.push(tag);
      }

      sql += ' ORDER BY updated_at DESC';

      const rows = await query<AgentInDB>(sql, params);

      res.json({
        code: 0,
        message: 'ok',
        data: rows.map(toAgentListItem),
      });
    } catch (error) {
      console.error('Get my agents error:', error);
      res.status(500).json({
        code: 5000,
        message: 'Internal server error',
        data: null,
      });
    }
  }
);

/**
 * 创建 Agent
 * POST /api/agents
 * 请求体: { name, description?, tag?, avatar? }
 * agentId 由后端生成 (UUID)，初始 status 为 private，config 初始为 { system_prompt: "" }
 */
router.post(
  '/',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<CreateAgentResponse>>) => {
    try {
      const userId = (
        req as Request & { user: { user_id: string; username: string } }
      ).user.user_id;
      const { name, description, tag, avatar }: CreateAgentRequest = req.body;

      if (!name || typeof name !== 'string') {
        res.status(400).json({
          code: 4001,
          message: 'name is required',
          data: null,
        });
        return;
      }

      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        res.status(400).json({
          code: 4001,
          message: 'name cannot be empty',
          data: null,
        });
        return;
      }

      if (trimmedName.length > 100) {
        res.status(400).json({
          code: 4001,
          message: 'name must not exceed 100 characters',
          data: null,
        });
        return;
      }

      if (tag !== undefined && tag !== null && String(tag).trim() !== '') {
        const tagStr = String(tag).trim();
        if (!VALID_TAGS.includes(tagStr as (typeof VALID_TAGS)[number])) {
          res.status(400).json({
            code: 4001,
            message: `Invalid tag. Supported: ${VALID_TAGS.join(', ')}`,
            data: null,
          });
          return;
        }
      }

      const agentId = generateUUID();
      const initialConfig = JSON.stringify({ system_prompt: '' });

      await query(
        `INSERT INTO agents (id, name, description, avatar, tag, status, config, creator_id)
         VALUES (?, ?, ?, ?, ?, 'private', ?, ?)`,
        [
          agentId,
          trimmedName,
          description != null ? String(description).trim() || null : null,
          avatar != null ? String(avatar).trim() || null : null,
          tag != null && String(tag).trim() !== '' ? String(tag).trim() : null,
          initialConfig,
          userId,
        ]
      );

      res.status(201).json({
        code: 0,
        message: 'create agent success',
        data: { agentId },
      });
    } catch (error) {
      console.error('Create agent error:', error);
      res.status(500).json({
        code: 5000,
        message: 'Internal server error',
        data: null,
      });
    }
  }
);

/**
 * 删除当前用户的 Agent
 * DELETE /api/agents/:agentId
 * 仅允许删除自己创建的 agent（creator_id 须为当前用户）
 */
router.delete(
  '/:agentId',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<null>>) => {
    try {
      const userId = (
        req as Request & { user: { user_id: string; username: string } }
      ).user.user_id;
      const agentId = req.params.agentId?.trim();
      if (!agentId) {
        res.status(400).json({
          code: 4001,
          message: 'agentId is required',
          data: null,
        });
        return;
      }

      const rows = await query<{ id: string; creator_id: string | null }>(
        'SELECT id, creator_id FROM agents WHERE id = ?',
        [agentId]
      );
      if (rows.length === 0) {
        res.status(404).json({
          code: 404,
          message: 'agent not found',
          data: null,
        });
        return;
      }
      const creatorId = rows[0]?.creator_id;
      if (!creatorId || creatorId !== userId) {
        res.status(403).json({
          code: 403,
          message: 'forbidden: you can only delete your own agents',
          data: null,
        });
        return;
      }

      await query('DELETE FROM threads WHERE agent_id = ?', [agentId]);
      await query('DELETE FROM agents WHERE id = ?', [agentId]);

      res.json({
        code: 0,
        message: 'delete agent success',
        data: null,
      });
    } catch (error) {
      console.error('Delete agent error:', error);
      res.status(500).json({
        code: 5000,
        message: 'Internal server error',
        data: null,
      });
    }
  }
);

/**
 * 获取所有公开智能体
 * GET /api/agents?status=public
 * GET /api/agents?status=public&tag=assistant
 * 必须传 status=public；按标签过滤（可选）: assistant | expert | creative | companion | explore
 */
router.get(
  '/',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<AgentListItem[]>>) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : undefined;

      if (status !== 'public') {
        res.status(400).json({
          code: 4001,
          message: 'status=public is required to list all agents',
          data: null,
        });
        return;
      }

      if (tag !== undefined && tag !== '') {
        if (!VALID_TAGS.includes(tag as (typeof VALID_TAGS)[number])) {
          res.status(400).json({
            code: 4001,
            message: `Invalid tag. Supported: ${VALID_TAGS.join(', ')}`,
            data: null,
          });
          return;
        }
      }

      let sql =
        "SELECT id, name, description, avatar, tag, status, created_at, updated_at FROM agents WHERE status = 'public'";
      const params: string[] = [];

      if (tag) {
        sql += ' AND FIND_IN_SET(?, tag)';
        params.push(tag);
      }

      sql += ' ORDER BY updated_at DESC';

      const rows = await query<AgentInDB>(sql, params.length > 0 ? params : []);

      res.json({
        code: 0,
        message: 'ok',
        data: rows.map(toAgentListItem),
      });
    } catch (error) {
      console.error('Get public agents error:', error);
      res.status(500).json({
        code: 5000,
        message: 'Internal server error',
        data: null,
      });
    }
  }
);

export default router;
