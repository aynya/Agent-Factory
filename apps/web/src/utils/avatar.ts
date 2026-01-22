/**
 * 头像相关工具函数
 */

/**
 * 获取头像 URL（处理相对路径、完整 URL 和 base64）
 * @param avatar 头像值，可能是：
 *   - base64 字符串（data:image/...）
 *   - 完整 URL（http://... 或 https://...）
 *   - 相对路径（/uploads/avatars/...）
 *   - null 或空字符串
 * @returns 可用于 img src 的完整 URL
 */
export function getAvatarUrl(avatar: string | null | undefined): string {
  if (!avatar) return ''

  // 如果是 base64 或完整 URL，直接返回
  if (avatar.startsWith('data:') || avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar
  }

  // 如果是相对路径，加上 API 基础 URL
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  return `${API_BASE_URL}${avatar.startsWith('/') ? avatar : '/' + avatar}`
}

/**
 * 检查是否为 base64 图片
 */
export function isBase64Image(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') {
    return false
  }
  return str.startsWith('data:image/')
}

/**
 * 检查是否为完整 URL（http/https）
 */
export function isFullUrl(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') {
    return false
  }
  return str.startsWith('http://') || str.startsWith('https://')
}

/**
 * 检查是否为相对路径
 */
export function isRelativePath(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') {
    return false
  }
  return !isBase64Image(str) && !isFullUrl(str)
}
