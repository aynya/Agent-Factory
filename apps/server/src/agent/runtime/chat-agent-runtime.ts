import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { query } from '../../config/db.js';

const DEFAULT_SYSTEM_PROMPT = '你是一个有用的AI助手';

function resolveHistoryLimit(): number {
  const raw = process.env.CHAT_HISTORY_MAX_MESSAGES;
  const parsed = raw == null ? Number.NaN : Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }

  // 防止配置过大导致上下文成本失控。
  return Math.min(parsed, 200);
}

const MAX_HISTORY_MESSAGES = resolveHistoryLimit();

type JsonLike = Record<string, unknown> | unknown[] | string | number | boolean;

interface ChatRuntimeInput {
  threadId: string;
  agentId: string;
  agentVersion: number;
  abortSignal: AbortSignal;
  onToken: (token: string) => void;
}

interface ChatRuntimeResult {
  fullContent: string;
  totalTokens: number;
}

interface RuntimeState {
  threadId: string;
  agentId: string;
  agentVersion: number;
  systemPrompt: string;
  summary: string | null;
  ragConfig: JsonLike | null;
  mcpConfig: JsonLike | null;
  historyMessages: BaseMessage[];
  retrievedContext: string | null;
  mcpHint: string | null;
  modelMessages: BaseMessage[];
}

const RuntimeStateAnnotation = Annotation.Root({
  threadId: Annotation<string>({
    reducer: (_, right) => right,
  }),
  agentId: Annotation<string>({
    reducer: (_, right) => right,
  }),
  agentVersion: Annotation<number>({
    reducer: (_, right) => right,
  }),
  systemPrompt: Annotation<string>({
    reducer: (_, right) => right,
    default: () => DEFAULT_SYSTEM_PROMPT,
  }),
  summary: Annotation<string | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  ragConfig: Annotation<JsonLike | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  mcpConfig: Annotation<JsonLike | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  historyMessages: Annotation<BaseMessage[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  retrievedContext: Annotation<string | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  mcpHint: Annotation<string | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  modelMessages: Annotation<BaseMessage[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
});

export class ChatRuntimeError extends Error {
  constructor(
    message: string,
    public readonly code: number
  ) {
    super(message);
    this.name = 'ChatRuntimeError';
  }
}

function parseMaybeJson(value: unknown): JsonLike | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as JsonLike;
    } catch {
      return trimmed;
    }
  }
  if (
    typeof value === 'object' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value as JsonLike;
  }
  return null;
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'string') return item;
        if (
          item &&
          typeof item === 'object' &&
          'text' in item &&
          typeof (item as { text?: unknown }).text === 'string'
        ) {
          return (item as { text: string }).text;
        }
        return '';
      })
      .join('');
  }

  return '';
}

function toBaseMessages(
  rows: Array<{ role: 'user' | 'assistant'; content: string }>
): BaseMessage[] {
  return rows.map(row => {
    if (row.role === 'user') {
      return new HumanMessage(row.content);
    }
    return new AIMessage(row.content);
  });
}

async function loadContext(
  state: RuntimeState
): Promise<Partial<RuntimeState>> {
  const versionRows = await query<{
    system_prompt: string | null;
    rag_config: unknown;
    mcp_config: unknown;
  }>(
    'SELECT system_prompt, rag_config, mcp_config FROM agent_versions WHERE agent_id = ? AND version = ?',
    [state.agentId, state.agentVersion]
  );

  if (versionRows.length === 0) {
    throw new ChatRuntimeError('Agent version not found', 404);
  }

  const threadRows = await query<{ summary: string | null }>(
    'SELECT summary FROM threads WHERE id = ? LIMIT 1',
    [state.threadId]
  );
  const summary = threadRows[0]?.summary ?? null;

  const rawHistory = await query<{
    role: 'user' | 'assistant';
    content: string;
  }>(
    `SELECT role, content FROM messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT ${MAX_HISTORY_MESSAGES}`,
    [state.threadId]
  );
  const historyMessages = toBaseMessages(rawHistory.reverse());

  const v = versionRows[0]!;
  return {
    systemPrompt:
      (typeof v.system_prompt === 'string' && v.system_prompt.trim()) ||
      DEFAULT_SYSTEM_PROMPT,
    summary,
    ragConfig: parseMaybeJson(v.rag_config),
    mcpConfig: parseMaybeJson(v.mcp_config),
    historyMessages,
  };
}

async function ragPlaceholder(
  state: RuntimeState
): Promise<Partial<RuntimeState>> {
  if (!state.ragConfig) {
    return {};
  }

  // 预留 RAG 节点：后续接入向量检索后，将检索内容写入 retrievedContext。
  return {
    retrievedContext: null,
  };
}

async function mcpPlaceholder(
  state: RuntimeState
): Promise<Partial<RuntimeState>> {
  if (!state.mcpConfig) {
    return {};
  }

  // 预留 MCP 节点：后续接入工具服务后，将工具约束或结果写入 mcpHint。
  return {
    mcpHint: null,
  };
}

async function buildModelMessages(
  state: RuntimeState
): Promise<Partial<RuntimeState>> {
  const systemBlocks = [state.systemPrompt];

  if (state.summary && state.summary.trim()) {
    systemBlocks.push(`历史摘要：\n${state.summary.trim()}`);
  }
  if (state.retrievedContext && state.retrievedContext.trim()) {
    systemBlocks.push(`检索上下文：\n${state.retrievedContext.trim()}`);
  }
  if (state.mcpHint && state.mcpHint.trim()) {
    systemBlocks.push(`工具执行上下文：\n${state.mcpHint.trim()}`);
  }

  return {
    modelMessages: [
      new SystemMessage(systemBlocks.join('\n\n')),
      ...state.historyMessages,
    ],
  };
}

function createRuntimeGraph() {
  return new StateGraph(RuntimeStateAnnotation)
    .addNode('loadContext', loadContext)
    .addNode('ragPlaceholder', ragPlaceholder)
    .addNode('mcpPlaceholder', mcpPlaceholder)
    .addNode('buildModelMessages', buildModelMessages)
    .addEdge(START, 'loadContext')
    .addEdge('loadContext', 'ragPlaceholder')
    .addEdge('ragPlaceholder', 'mcpPlaceholder')
    .addEdge('mcpPlaceholder', 'buildModelMessages')
    .addEdge('buildModelMessages', END)
    .compile();
}

class ChatAgentRuntime {
  private readonly graph = createRuntimeGraph();

  private readonly model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    },
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    temperature: 0.7,
    streaming: true,
  });

  async streamAssistantReply(
    input: ChatRuntimeInput
  ): Promise<ChatRuntimeResult> {
    const state = await this.graph.invoke({
      threadId: input.threadId,
      agentId: input.agentId,
      agentVersion: input.agentVersion,
    });

    const stream = await this.model.stream(state.modelMessages, {
      signal: input.abortSignal,
    });

    let fullContent = '';
    let totalTokens = 0;

    for await (const chunk of stream) {
      if (input.abortSignal.aborted) {
        break;
      }

      const token = contentToText(chunk.content);
      if (token) {
        fullContent += token;
        input.onToken(token);
      }

      const usageMetadata = (
        chunk as unknown as { usage_metadata?: { total_tokens?: number } }
      ).usage_metadata;
      if (typeof usageMetadata?.total_tokens === 'number') {
        totalTokens = usageMetadata.total_tokens;
      }
    }

    if (totalTokens <= 0 && fullContent) {
      totalTokens = Math.ceil(fullContent.length / 4);
    }

    return {
      fullContent,
      totalTokens,
    };
  }
}

export const chatAgentRuntime = new ChatAgentRuntime();
