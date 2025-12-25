import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 基础中间件 [cite: 1530]
app.use(cors());
app.use(express.json());

// 健康检查接口 [cite: 1531]
app.get('/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'UP' } });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
