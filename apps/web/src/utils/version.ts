/**
 * 版本展示相关工具
 */

/**
 * 将内部版本号 n 换算为 v{major}.{minor} 展示
 * 规则：1->1.0, 2->1.1, 10->1.9, 11->2.0
 * @param n 整数版本号（内部计数 1、2、3…）
 * @returns 展示用字符串，如 "v1.0"、"v1.1"、"v1.9"、"v2.0"
 */
export function formatVersion(n: number): string {
  const v = Math.floor(Number(n)) || 0
  if (v < 1) return 'v0.0'
  const major = Math.floor((v - 1) / 10) + 1
  const minor = (v - 1) % 10
  return `v${major}.${minor}`
}
