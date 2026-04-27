import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 与静态资源 /uploads 目录一致：apps/server/uploads/rag */
export const RAG_UPLOADS_ROOT = path.join(__dirname, '../../uploads/rag');

export const RAG_ALLOWED_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.pdf',
  '.html',
  '.htm',
  '.csv',
  '.json',
]);

/**
 * 将 rag_config 中的 documentUrl 解析为绝对路径（并校验属于该 agent）
 */
export function resolveRagDocumentAbsolutePath(
  agentId: string,
  documentUrl: string
): string | null {
  const prefix = `/uploads/rag/${agentId}/`;
  if (!documentUrl.startsWith(prefix)) return null;
  const fileName = documentUrl.slice(prefix.length);
  if (!fileName || fileName.includes('..') || path.isAbsolute(fileName)) {
    return null;
  }
  const abs = path.join(RAG_UPLOADS_ROOT, agentId, fileName);
  const agentDir = path.join(RAG_UPLOADS_ROOT, agentId);
  const normalizedAgent = path.normalize(agentDir + path.sep);
  const normalizedAbs = path.normalize(abs);
  if (!normalizedAbs.startsWith(normalizedAgent)) return null;
  return normalizedAbs;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractTextFromRagFile(
  absolutePath: string
): Promise<string> {
  const ext = path.extname(absolutePath).toLowerCase();

  if (ext === '.pdf') {
    const buf = await readFile(absolutePath);
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try {
      const textResult = await parser.getText();
      return textResult.text?.trim() ?? '';
    } finally {
      await parser.destroy();
    }
  }

  const raw = await readFile(absolutePath, 'utf-8');
  if (ext === '.html' || ext === '.htm') {
    return stripHtml(raw);
  }
  return raw;
}
