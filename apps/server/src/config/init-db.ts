import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 初始化数据库表结构（幂等）
 * - 如果数据库不存在则创建
 * - 在指定数据库下执行 schema.sql 中的建表和初始化语句
 */
export const initDatabase = async (): Promise<void> => {
  const dbName = process.env.DB_NAME;
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';

  if (!dbName) {
    console.error('DB_NAME is not set, skip database initialization.');
    return;
  }

  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // 创建一个临时连接，用于初始化数据库（允许多语句）
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
      timezone: '+00:00', // 设置为 UTC 时区
    });

    // 确保数据库存在
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);

    // 切换到目标数据库
    await connection.changeUser({ database: dbName });

    // 设置会话时区为 UTC
    await connection.query("SET time_zone = '+00:00';");

    // 执行 schema 中的所有 SQL 语句
    await connection.query(schema);

    await connection.end();

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};
