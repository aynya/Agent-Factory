import { Router } from 'express';
import type { Request, Response } from 'express';
import { query } from '../config/db.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { generateUUID } from '../utils/uuid.js';
import { authenticateToken } from '../middleware/auth.js';
import type {
  ApiResponse,
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  UserInDB,
  User,
} from '@monorepo/types';

const router: Router = Router();

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post(
  '/register',
  async (req: Request, res: Response<ApiResponse<RegisterResponse | null>>) => {
    try {
      const {
        username,
        password,
        avatar = 'default_url',
      }: RegisterRequest = req.body;

      // 验证输入
      if (!username || !password) {
        res.status(400).json({
          code: 1,
          message: 'Username and password are required',
          data: null,
        });
        return;
      }

      // 检查用户名是否已存在
      const existingUsers = await query<UserInDB>(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );

      if (existingUsers.length > 0) {
        res.status(400).json({
          code: 1,
          message: 'Username already exists',
          data: null,
        });
        return;
      }

      // 加密密码
      const hashedPassword = await hashPassword(password);

      // 生成用户ID
      const userId = generateUUID();

      // 插入用户
      await query(
        'INSERT INTO users (id, username, password, avatar) VALUES (?, ?, ?, ?)',
        [userId, username, hashedPassword, avatar]
      );

      res.json({
        code: 0,
        message: 'register success',
        data: {
          user_id: userId,
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        code: 1,
        message: 'Internal server error',
        data: null,
      });
    }
  }
);

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post(
  '/login',
  async (req: Request, res: Response<ApiResponse<LoginResponse | null>>) => {
    try {
      const { username, password }: LoginRequest = req.body;

      // 验证输入
      if (!username || !password) {
        res.status(400).json({
          code: 1,
          message: 'Username and password are required',
          data: null,
        });
        return;
      }

      // 查询用户
      const users = await query<UserInDB>(
        'SELECT id, username, password, avatar, created_at FROM users WHERE username = ?',
        [username]
      );

      if (users.length === 0) {
        res.status(401).json({
          code: 1,
          message: 'Invalid username or password',
          data: null,
        });
        return;
      }

      const user = users[0];
      if (!user) {
        res.status(401).json({
          code: 1,
          message: 'Invalid username or password',
          data: null,
        });
        return;
      }

      // 验证密码
      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        res.status(401).json({
          code: 1,
          message: 'Invalid username or password',
          data: null,
        });
        return;
      }

      // 生成tokens
      const accessToken = generateAccessToken({
        user_id: user.id,
        username: user.username,
      });

      const refreshToken = generateRefreshToken({
        user_id: user.id,
        username: user.username,
      });

      // 设置refreshToken到HttpOnly Cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
      });

      res.json({
        code: 0,
        message: 'login success',
        data: {
          access_token: accessToken,
          user: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            createdAt: user.created_at,
          },
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        code: 1,
        message: 'Internal server error',
        data: null,
      });
    }
  }
);

/**
 * 刷新Token
 * POST /api/auth/refresh
 */
router.post(
  '/refresh',
  async (req: Request, res: Response<ApiResponse<RefreshResponse | null>>) => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        res.status(401).json({
          code: 1,
          message: 'Refresh token is required',
          data: null,
        });
        return;
      }

      // 验证refreshToken
      let payload;
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        res.status(403).json({
          code: 1,
          message: 'Invalid or expired refresh token',
          data: null,
        });
        return;
      }

      // 生成新的accessToken
      const accessToken = generateAccessToken({
        user_id: payload.user_id,
        username: payload.username,
      });

      res.json({
        code: 0,
        message: 'refresh success',
        data: {
          access_token: accessToken,
        },
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        code: 1,
        message: 'Internal server error',
        data: null,
      });
    }
  }
);

/**
 * 获取当前用户信息
 * GET /api/auth/me
 * 需要认证：使用 authenticateToken 中间件
 */
router.get(
  '/me',
  authenticateToken,
  async (req: Request, res: Response<ApiResponse<User | null>>) => {
    try {
      // authenticateToken 中间件已经将用户信息附加到 req.user
      const userId = (
        req as Request & { user: { user_id: string; username: string } }
      ).user.user_id;

      // 查询用户信息
      const users = await query<UserInDB>(
        'SELECT id, username, avatar, created_at FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0 || !users[0]) {
        res.status(404).json({
          code: 1,
          message: 'User not found',
          data: null,
        });
        return;
      }

      const user = users[0];

      res.json({
        code: 0,
        message: 'ok',
        data: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          createdAt: user.created_at,
        },
      });
    } catch (error) {
      console.error('Get user info error:', error);
      res.status(500).json({
        code: 1,
        message: 'Internal server error',
        data: null,
      });
    }
  }
);

export default router;
