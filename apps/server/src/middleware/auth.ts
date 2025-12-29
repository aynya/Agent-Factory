import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import type { ApiResponse } from '@monorepo/types';

/**
 * 认证中间件 - 验证Access Token
 */
export const authenticateToken = (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    res.status(401).json({
      code: 401,
      message: 'Unauthorized: Access token is required',
      data: null,
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    // 将用户信息附加到请求对象上
    (req as Request & { user: { user_id: string; username: string } }).user = {
      user_id: payload.user_id,
      username: payload.username,
    };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(403).json({
      code: 403,
      message: 'Forbidden: Invalid or expired token',
      data: null,
    });
  }
};
