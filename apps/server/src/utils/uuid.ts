import { randomUUID } from 'crypto';

/**
 * 生成UUID
 */
export const generateUUID = (): string => {
  return randomUUID();
};
