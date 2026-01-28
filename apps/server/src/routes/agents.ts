import { Router } from 'express';
import type { Request, Response } from 'express';
import { query } from '../config/db.js';
import { generateUUID } from '../utils/uuid.js';
import { authenticateToken } from '../middleware/auth.js';
import { saveAvatarFromBase64, deleteAvatarFile, isBase64Image } from '../utils/avatar.js';
import type {
  ApiResponse,
  AgentListItem,
  CreateAgentRequest,
  CreateAgentResponse,
  AgentDetail,
  AgentConfig,
  UpdateAgentRequest,
  UpdateAgentResponse,
  DebugThread,
  CreateThreadByAgentResponse,
} from '@monorepo/types';

const router: Router = Router();

const VALID_TAGS = [
  'assistant',
  'expert',
  'creative',
  'companion',
  'explore',
] as const;

/** 列表项行：agents + agent_versions（最新版本）JOIN 后的字段 */
interface AgentListRow {
  id: string;
  name: string;
  avatar: string | null;
  tag: string | null;
  status: 'private' | 'public';
  latest_version: number;
  created_at: string;
  updated_at: string;
  description: string | null;
}

function toAgentListItem(row: AgentListRow): AgentListItem {
  return {
    agentId: row.id,
    name: row.name,
    description: row.description ?? null,
    avatar: row.avatar,
    tag: row.tag,
    status: row.status,
    latestVersion: row.latest_version,
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

      let sql = `SELECT a.id, a.name, a.avatar, a.tag, a.status, a.latest_version, a.created_at, a.updated_at, av.description
        FROM agents a
        LEFT JOIN agent_versions av ON av.agent_id = a.id AND av.version = a.latest_version
        WHERE a.creator_id = ?`;
      const params: (string | undefined)[] = [userId];

      if (tag) {
        sql += ' AND a.tag = ?';
        params.push(tag);
      }

      sql += ' ORDER BY a.updated_at DESC';

      const rows = await query<AgentListRow>(sql, params);

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
      const versionId = generateUUID();

      // 处理头像：如果是 base64，保存为文件并获取相对路径
      let avatarUrl: string | null = null;
      if (avatar != null && avatar !== '') {
        const avatarStr = String(avatar).trim();
        if (isBase64Image(avatarStr)) {
          try {
            avatarUrl = saveAvatarFromBase64(avatarStr);
          } catch (error) {
            console.error('Save avatar error:', error);
            res.status(400).json({
              code: 4001,
              message: error instanceof Error ? error.message : '图片处理失败',
              data: null,
            });
            return;
          }
        } else {
          avatarUrl = avatarStr || null;
        }
      }

      const tagVal =
        tag != null && String(tag).trim() !== '' ? String(tag).trim() : null;
      const descVal =
        description != null ? String(description).trim() || null : null;

      await query(
        `INSERT INTO agents (id, name, avatar, tag, status, creator_id, latest_version)
         VALUES (?, ?, ?, ?, 'private', ?, 1)`,
        [agentId, trimmedName, avatarUrl, tagVal, userId]
      );

      await query(
        `INSERT INTO agent_versions (id, agent_id, version, description, system_prompt, rag_config, mcp_config)
         VALUES (?, ?, 1, ?, '', NULL, NULL)`,
        [versionId, agentId, descVal]
      );

      // 创建 Agent 时自动创建调试 thread（is_debug=1），一个 agent 只对应一个调试 thread
      const debugThreadId = generateUUID();
      await query(
        `INSERT INTO threads (id, user_id, agent_id, agent_version, title, is_debug)
         VALUES (?, ?, ?, 1, '调试会话', 1)`,
        [debugThreadId, userId, agentId]
      );

      res.status(201).json({
        code: 0,
        message: 'create agent success',
        data: { agentId, latestVersion: 1 },
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

      const rows = await query<{ id: string; creator_id: string | null; avatar: string | null }>(
        'SELECT id, creator_id, avatar FROM agents WHERE id = ?',
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
      const agent = rows[0]!;
      const creatorId = agent.creator_id;
      if (!creatorId || creatorId !== userId) {
        res.status(403).json({
          code: 403,
          message: 'forbidden: you can only delete your own agents',
          data: null,
        });
        return;
      }

      // 删除关联的 threads
      await query('DELETE FROM threads WHERE agent_id = ?', [agentId]);

      // 删除头像文件（如果存在）
      if (agent.avatar) {
        deleteAvatarFile(agent.avatar);
      }

      // 删除 agent 记录
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
 * 获取 Agent 的调试会话
 * GET /api/agents/:agentId/debug-thread
 * - 获取指定 Agent 调试用的 Thread
 * - 若该 Agent 尚未存在 debug thread 则自动创建一个并返回该 Thread
 * - 仅 Agent 创建者可访问
 */
router.get(
  '/:agentId/debug-thread',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<DebugThread>>) => {
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

      const agentRows = await query<{ id: string; creator_id: string | null; latest_version: number }>(
        'SELECT id, creator_id, latest_version FROM agents WHERE id = ?',
        [agentId]
      );
      if (agentRows.length === 0) {
        res.status(404).json({
          code: 404,
          message: 'agent not found',
          data: null,
        });
        return;
      }
      const agent = agentRows[0]!;
      if (!agent.creator_id || agent.creator_id !== userId) {
        res.status(403).json({
          code: 403,
          message: 'forbidden: only the agent creator can access',
          data: null,
        });
        return;
      }

      const existing = await query<{
        id: string;
        agent_id: string;
        agent_version: number;
        updated_at: string;
      }>(
        'SELECT id, agent_id, agent_version, updated_at FROM threads WHERE agent_id = ? AND is_debug = 1 LIMIT 1',
        [agentId]
      );

      if (existing.length > 0) {
        const t = existing[0]!;
        const updatedAt = new Date(t.updated_at).toISOString();
        res.json({
          code: 0,
          message: 'ok',
          data: {
            threadId: t.id,
            agentId: t.agent_id,
            agentVersion: t.agent_version,
            isDebug: true as const,
            createdAt: updatedAt,
            updatedAt,
          },
        });
        return;
      }

      const threadId = generateUUID();
      const agentVersion = agent.latest_version;
      await query(
        'INSERT INTO threads (id, user_id, agent_id, agent_version, title, is_debug) VALUES (?, ?, ?, ?, ?, 1)',
        [threadId, userId, agentId, agentVersion, '调试会话']
      );

      const inserted = await query<{ updated_at: string }>(
        'SELECT updated_at FROM threads WHERE id = ?',
        [threadId]
      );
      const updatedAt = inserted[0]?.updated_at
        ? new Date(inserted[0].updated_at).toISOString()
        : new Date().toISOString();

      res.json({
        code: 0,
        message: 'ok',
        data: {
          threadId,
          agentId,
          agentVersion,
          isDebug: true as const,
          createdAt: updatedAt,
          updatedAt,
        },
      });
    } catch (error) {
      console.error('Get debug thread error:', error);
      res.status(500).json({
        code: 5000,
        message: 'Internal server error',
        data: null,
      });
    }
  }
);

/**
 * 通过 Agent 创建 Thread
 * POST /api/agents/:agentId/threads
 * 默认使用该 agent 的最新版本创建，用于「开始使用」后跳转到新会话
 * Authorization: Bearer <access_token>
 */
router.post(
  '/:agentId/threads',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<CreateThreadByAgentResponse>>) => {
    try {
      const userId = (
        req as Request & { user: { user_id: string; username: string } }
      ).user.user_id;
      const agentId = req.params.agentId?.trim();

      if (!agentId) {
        res.status(400).json({
          code: 400,
          message: 'agentId is required',
          data: null,
        });
        return;
      }

      const agentRows = await query<{ id: string; latest_version: number }>(
        'SELECT id, latest_version FROM agents WHERE id = ?',
        [agentId]
      );
      if (agentRows.length === 0) {
        res.status(404).json({
          code: 404,
          message: 'agent not found',
          data: null,
        });
        return;
      }

      const agentVersion = agentRows[0]!.latest_version;
      const threadId = generateUUID();

      await query(
        'INSERT INTO threads (id, user_id, agent_id, agent_version, title, is_debug) VALUES (?, ?, ?, ?, ?, 0)',
        [threadId, userId, agentId, agentVersion, '']
      );

      const inserted = await query<{ updated_at: string }>(
        'SELECT updated_at FROM threads WHERE id = ?',
        [threadId]
      );
      const createdAt =
        inserted[0]?.updated_at != null
          ? new Date(inserted[0].updated_at).toISOString()
          : new Date().toISOString();

      res.status(201).json({
        code: 0,
        message: 'ok',
        data: {
          threadId,
          agentId,
          agentVersion,
          isDebug: false as const,
          createdAt,
        },
      });
    } catch (error: unknown) {
      console.error('Create thread by agent error:', error);
      res.status(500).json({
        code: 500,
        message: error instanceof Error ? error.message : '服务器内部错误',
        data: null,
      });
    }
  }
);

/**
 * 获取 Agent 当前最新版本的配置
 * GET /api/agents/:agentId
 * 仅 Agent 创建者可以访问，非创建者返回 403
 */
router.get(
  '/:agentId',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<AgentDetail>>) => {
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

      const rows = await query<{
        id: string;
        name: string;
        avatar: string | null;
        tag: string | null;
        status: 'private' | 'public';
        creator_id: string | null;
        created_at: string;
        updated_at: string;
        version: number;
        description: string | null;
        system_prompt: string | null;
        rag_config: unknown;
        mcp_config: unknown;
      }>(
        `SELECT a.id, a.name, a.avatar, a.tag, a.status, a.creator_id, a.created_at, a.updated_at,
         av.version, av.description, av.system_prompt, av.rag_config, av.mcp_config
         FROM agents a
         JOIN agent_versions av ON av.agent_id = a.id AND av.version = a.latest_version
         WHERE a.id = ?`,
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

      const row = rows[0]!;

      if (!row.creator_id || row.creator_id !== userId) {
        res.status(403).json({
          code: 403,
          message: 'forbidden: only the agent creator can access',
          data: null,
        });
        return;
      }

      const config: AgentConfig = {
        systemPrompt: typeof row.system_prompt === 'string' ? row.system_prompt : '',
        ragConfig: row.rag_config ?? null,
        mcpConfig: row.mcp_config ?? null,
      };

      const agentDetail: AgentDetail = {
        agentId: row.id,
        name: row.name,
        description: row.description ?? null,
        avatar: row.avatar,
        tag: row.tag,
        status: row.status,
        version: row.version,
        config,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      };

      res.json({
        code: 0,
        message: 'ok',
        data: agentDetail,
      });
    } catch (error) {
      console.error('Get agent detail error:', error);
      res.status(500).json({
        code: 5000,
        message: 'Internal server error',
        data: null,
      });
    }
  }
);

/**
 * 修改 Agent 能力配置并发布新版本
 * PUT /api/agents/:agentId
 * 仅创建者可调用。新增一条 agent_versions（version+1），更新 agents.latest_version，不影响已有 Thread。
 */
router.put(
  '/:agentId',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<UpdateAgentResponse>>) => {
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

      const updateData: UpdateAgentRequest = req.body;

      const rows = await query<{ id: string; latest_version: number; creator_id: string | null }>(
        'SELECT id, latest_version, creator_id FROM agents WHERE id = ?',
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

      const agent = rows[0]!;
      if (!agent.creator_id || agent.creator_id !== userId) {
        res.status(403).json({
          code: 403,
          message: 'forbidden: only the agent creator can update',
          data: null,
        });
        return;
      }

      const newVersion = agent.latest_version + 1;
      const versionId = generateUUID();

      const description =
        updateData.description != null
          ? String(updateData.description).trim() || null
          : null;

      let systemPrompt = '';
      let ragConfig: unknown = null;
      let mcpConfig: unknown = null;
      if (updateData.config != null && typeof updateData.config === 'object') {
        const c = updateData.config;
        systemPrompt =
          c.systemPrompt != null ? String(c.systemPrompt) : '';
        ragConfig = c.ragConfig ?? null;
        mcpConfig = c.mcpConfig ?? null;
      }

      await query(
        `INSERT INTO agent_versions (id, agent_id, version, description, system_prompt, rag_config, mcp_config)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          versionId,
          agentId,
          newVersion,
          description,
          systemPrompt,
          ragConfig == null ? null : JSON.stringify(ragConfig),
          mcpConfig == null ? null : JSON.stringify(mcpConfig),
        ]
      );

      await query('UPDATE agents SET latest_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        newVersion,
        agentId,
      ]);

      // 将该 agent 的调试 thread 绑定到最新版本，便于调试始终使用最新配置
      await query(
        'UPDATE threads SET agent_version = ?, updated_at = CURRENT_TIMESTAMP WHERE agent_id = ? AND is_debug = 1',
        [newVersion, agentId]
      );

      res.json({
        code: 0,
        message: 'publish new agent version success',
        data: { agentId, version: newVersion },
      });
    } catch (error) {
      console.error('Update agent error:', error);
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

      let sql = `SELECT a.id, a.name, a.avatar, a.tag, a.status, a.latest_version, a.created_at, a.updated_at, av.description
        FROM agents a
        LEFT JOIN agent_versions av ON av.agent_id = a.id AND av.version = a.latest_version
        WHERE a.status = 'public'`;
      const params: string[] = [];

      if (tag) {
        sql += ' AND a.tag = ?';
        params.push(tag);
      }

      sql += ' ORDER BY a.updated_at DESC';

      const rows = await query<AgentListRow>(sql, params.length > 0 ? params : []);

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
