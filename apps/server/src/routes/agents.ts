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
  AgentDetail,
  AgentConfig,
  UpdateAgentRequest,
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
 * 获取 Agent 配置
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

      // 查询 agent 信息，包括 config 和 creator_id
      const rows = await query<AgentInDB & { config: unknown; creator_id: string | null }>(
        'SELECT id, name, description, avatar, tag, status, config, creator_id, created_at, updated_at FROM agents WHERE id = ?',
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

      // TypeScript 无法从 rows.length > 0 推断出 rows[0] 一定存在
      // 使用类型断言，因为我们已经检查了数组不为空
      const agent = rows[0] as AgentInDB & { config: unknown; creator_id: string | null };

      // 检查权限：只有创建者可以访问
      if (!agent.creator_id || agent.creator_id !== userId) {
        res.status(403).json({
          code: 403,
          message: 'forbidden: only the agent creator can access',
          data: null,
        });
        return;
      }

      // 解析 config JSON
      let config: AgentConfig;
      try {
        const rawConfig =
          agent.config && typeof agent.config === 'object'
            ? (agent.config as Record<string, unknown>)
            : {};

        config = {
          systemPrompt:
            typeof rawConfig.system_prompt === 'string' ? rawConfig.system_prompt : '',
          ragConfig: rawConfig.rag_config ?? null,
          mcpConfig: rawConfig.mcp_config ?? null,
        };
      } catch (error) {
        console.error('Failed to parse agent config:', error);
        // 如果解析失败，使用默认配置
        config = {
          systemPrompt: '',
          ragConfig: null,
          mcpConfig: null,
        };
      }

      const agentDetail: AgentDetail = {
        agentId: agent.id,
        name: agent.name,
        description: agent.description,
        avatar: agent.avatar,
        tag: agent.tag,
        status: agent.status,
        config,
        createdAt: new Date(agent.created_at).toISOString(),
        updatedAt: new Date(agent.updated_at).toISOString(),
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
 * 更新 Agent 配置
 * PUT /api/agents/:agentId
 * 仅 Agent 创建者可以更新，非创建者返回 403
 * Config 更新后立即生效，Phase 2 中仅 systemPrompt 生效，其余字段预留
 */
router.put(
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

      const updateData: UpdateAgentRequest = req.body;

      // 查询 agent 信息，检查是否存在和权限
      const rows = await query<AgentInDB & { config: unknown; creator_id: string | null }>(
        'SELECT id, name, description, avatar, tag, status, config, creator_id FROM agents WHERE id = ?',
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

      const agent = rows[0] as AgentInDB & { config: unknown; creator_id: string | null };

      // 检查权限：只有创建者可以更新
      if (!agent.creator_id || agent.creator_id !== userId) {
        res.status(403).json({
          code: 403,
          message: 'forbidden: only the agent creator can update',
          data: null,
        });
        return;
      }

      // 构建更新字段
      const updateFields: string[] = [];
      const updateValues: unknown[] = [];

      // 更新 name
      if (updateData.name !== undefined) {
        const trimmedName = String(updateData.name).trim();
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
        updateFields.push('name = ?');
        updateValues.push(trimmedName);
      }

      // 更新 description
      if (updateData.description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(
          updateData.description != null ? String(updateData.description).trim() || null : null
        );
      }

      // 更新 avatar
      if (updateData.avatar !== undefined) {
        updateFields.push('avatar = ?');
        updateValues.push(
          updateData.avatar != null ? String(updateData.avatar).trim() || null : null
        );
      }

      // 更新 tag
      if (updateData.tag !== undefined) {
        if (updateData.tag != null && String(updateData.tag).trim() !== '') {
          const tagStr = String(updateData.tag).trim();
          if (!VALID_TAGS.includes(tagStr as (typeof VALID_TAGS)[number])) {
            res.status(400).json({
              code: 4001,
              message: `Invalid tag. Supported: ${VALID_TAGS.join(', ')}`,
              data: null,
            });
            return;
          }
          updateFields.push('tag = ?');
          updateValues.push(tagStr);
        } else {
          updateFields.push('tag = ?');
          updateValues.push(null);
        }
      }

      // 更新 config
      if (updateData.config !== undefined) {
        try {
          // 验证 config 是否为对象
          if (typeof updateData.config !== 'object' || updateData.config === null) {
            res.status(400).json({
              code: 4001,
              message: 'config must be an object',
              data: null,
            });
            return;
          }

          // 获取现有 config
          const existingConfig =
            agent.config && typeof agent.config === 'object' && agent.config !== null
              ? (agent.config as Record<string, unknown>)
              : {};

          // 合并配置（Phase 2 中仅 systemPrompt 生效，其余字段预留）
          const newConfig: Record<string, unknown> = {
            ...existingConfig,
          };

          // 处理 systemPrompt：确保是字符串类型，null/undefined 转换为空字符串
          if (updateData.config.systemPrompt !== undefined) {
            // 如果为 null，转换为空字符串；否则确保是字符串类型
            if (updateData.config.systemPrompt === null) {
              newConfig.system_prompt = '';
            } else if (typeof updateData.config.systemPrompt === 'string') {
              newConfig.system_prompt = updateData.config.systemPrompt;
            } else {
              // 如果不是字符串也不是 null，转换为字符串（防御性处理）
              newConfig.system_prompt = String(updateData.config.systemPrompt);
            }
          } else {
            // 如果未提供 systemPrompt，保留现有值或使用默认空字符串
            newConfig.system_prompt = existingConfig.system_prompt ?? '';
          }

          // 预留字段（Phase 2 中不生效，但保留在数据库中）
          if (updateData.config.ragConfig !== undefined) {
            newConfig.rag_config = updateData.config.ragConfig;
          }
          if (updateData.config.mcpConfig !== undefined) {
            newConfig.mcp_config = updateData.config.mcpConfig;
          }

          updateFields.push('config = ?');
          updateValues.push(JSON.stringify(newConfig));
        } catch (error) {
          console.error('Failed to parse config:', error);
          res.status(400).json({
            code: 4001,
            message: 'Invalid config format',
            data: null,
          });
          return;
        }
      }

      // 如果没有要更新的字段，直接返回成功
      if (updateFields.length === 0) {
        res.json({
          code: 0,
          message: 'update agent success',
          data: null,
        });
        return;
      }

      // 执行更新
      updateValues.push(agentId);
      const sql = `UPDATE agents SET ${updateFields.join(', ')} WHERE id = ?`;

      await query(sql, updateValues);

      res.json({
        code: 0,
        message: 'update agent success',
        data: null,
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
