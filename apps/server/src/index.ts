import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { checkDatabaseConnection } from './config/db.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 基础中间件 [cite: 1530]
app.use(cors());
app.use(express.json());

// 健康检查接口 [cite: 1531]
app.get('/health', async (req, res) => {
  const dbConnected = await checkDatabaseConnection();
  if (dbConnected) {
    res.json({code: 0,
      message: 'ok',
      data: { status: 'UP', database: 'CONNECTED' },
    });
  } else {
    res
      .status(503)
      .json({
        code: -1,
        message: 'database disconnected',
        data: { status: 'DOWN', database: 'DISCONNECTED' },
      });
  }
});

app.listen(PORT, async () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  const dbConnected = await checkDatabaseConnection();
  console.log(`Database connection: ${dbConnected ? 'SUCCESS' : 'FAILED'}`);
});
