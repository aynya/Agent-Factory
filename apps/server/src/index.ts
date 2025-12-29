import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { checkDatabaseConnection } from './config/db.js';
import { initDatabase } from './config/init-db.js';
import authRoutes from './routes/auth.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 基础中间件
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true, // 允许携带cookie
  })
);
app.use(express.json());
app.use(cookieParser());

// 路由注册
app.use('/api/auth', authRoutes);

// 健康检查接口
app.get('/health', async (req, res) => {
  const dbConnected = await checkDatabaseConnection();
  if (dbConnected) {
    res.json({
      code: 0,
      message: 'ok',
      data: { status: 'UP', database: 'CONNECTED' },
    });
  } else {
    res.status(503).json({
      code: -1,
      message: 'database disconnected',
      data: { status: 'DOWN', database: 'DISCONNECTED' },
    });
  }
});

// 启动服务并在启动时初始化数据库
app.listen(PORT, async () => {
  console.log(`Server is running at http://localhost:${PORT}`);

  const dbConnected = await checkDatabaseConnection();
  console.log(`Database connection: ${dbConnected ? 'SUCCESS' : 'FAILED'}`);

  if (dbConnected) {
    try {
      await initDatabase();
    } catch (error) {
      console.error('Database initialization failed on server start:', error);
    }
  }
});
