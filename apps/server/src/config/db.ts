import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const query = async <T>(
  sql: string,
  params?: unknown[]
): Promise<T[]> => {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
};

export const getConnection = async () => {
  const connection = await pool.getConnection();
  try {
    return connection;
  } finally {
    connection.release();
  }
};

export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    const connection = await getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch {
    return false;
  }
};

export default pool;
