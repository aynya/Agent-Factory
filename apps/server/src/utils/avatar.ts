import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateUUID } from './uuid.js';

// 获取当前文件的目录路径（ESM 模块）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 上传目录
export const UPLOAD_DIR = path.join(__dirname, '../../uploads/avatars');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * 保存 base64 图片到文件系统
 * @param base64 base64 编码的图片数据
 * @returns 相对路径 URL，如 /uploads/avatars/uuid.png
 */
export function saveAvatarFromBase64(base64: string): string {
  // 解析 base64 数据
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  // 验证文件大小（限制 2MB）
  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error('图片大小不能超过 2MB');
  }

  // 检测图片格式
  let fileExtension = 'png';
  const mimeMatch = base64.match(/data:image\/(\w+);base64/);
  if (mimeMatch && mimeMatch[1]) {
    const ext = mimeMatch[1].toLowerCase();
    // 只允许常见图片格式
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      fileExtension = ext === 'jpeg' ? 'jpg' : ext;
    }
  }

  // 生成文件名
  const fileId = generateUUID();
  const fileName = `${fileId}.${fileExtension}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  // 保存文件
  fs.writeFileSync(filePath, buffer);

  // 返回相对路径
  return `/uploads/avatars/${fileName}`;
}

/**
 * 删除头像文件
 * @param avatarUrl 头像的相对路径 URL，如 /uploads/avatars/uuid.png
 */
export function deleteAvatarFile(avatarUrl: string | null | undefined): void {
  if (!avatarUrl || typeof avatarUrl !== 'string') {
    return;
  }

  // 只处理相对路径，不处理 base64 或完整 URL
  if (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return;
  }

  try {
    // 提取文件名
    const fileName = path.basename(avatarUrl);
    const filePath = path.join(UPLOAD_DIR, fileName);
    
    // 检查文件是否存在并删除
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // 删除失败不影响主流程，只记录错误
    console.error('Failed to delete avatar file:', avatarUrl, error);
  }
}

/**
 * 检查是否为 base64 图片
 */
export function isBase64Image(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }
  return str.startsWith('data:image/');
}
