// API response types
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

// Health check types
export interface HealthStatus {
  status: 'UP' | 'DOWN';
  timestamp: string;
  services?: {
    [key: string]: 'UP' | 'DOWN';
  };
}

// User types
export interface User {
  id: string; // UUID
  username: string;
  avatar: string;
  createdAt: string;
}

export interface UserInDB {
  id: string;
  username: string;
  password: string;
  avatar: string;
  created_at: string;
}

// Auth types
export interface RegisterRequest {
  username: string;
  password: string;
  avatar?: string;
}

export interface RegisterResponse {
  user_id: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface RefreshResponse {
  access_token: string;
}

export interface JwtPayload {
  user_id: string;
  username: string;
}

// Common pagination types
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Chat types
export interface ChatStreamRequest {
  agent_id: string;
  thread_id: string;
  content: string;
}

export interface ChatAbortRequest {
  agent_id: string;
  thread_id: string;
}

export interface ChatAbortResponse {
  thread_id: string;
}

// SSE Event types
export interface SSEStartEvent {
  messageId: string;
  role: 'assistant';
  createdAt: string;
}

export interface SSEInfoEvent {
  status: string;
  content?: string;
}

export interface SSETokenEvent {
  messageId: string;
  content: string;
}

export interface SSEEndEvent {
  messageId: string;
  role: 'assistant';
  status: 'usage';
  totalTokens: number;
}

export interface SSEErrorEvent {
  code: number;
  message: string;
}

// Thread types
export interface Thread {
  threadId: string;
  title: string;
  agentId: string;
  updatedAt: string;
}

export interface ThreadListResponse {
  threads: Thread[];
}

/**
 * 通过 Thread 获取当前对话所使用 Agent 的展示信息
 * GET /api/threads/:threadId/agent 的返回 data 结构
 * 用于：对话页侧边栏展示、确认当前使用的 Agent 身份与能力
 */
export interface ThreadAgentDisplay {
  agentId: string;
  agentVersion: number;
  name: string;
  description: string | null;
  avatar: string | null;
  tag: string | null;
  systemPrompt: string | null;
  isLatestVersion: boolean;
  latestVersion: number;
}

/** 调试会话（GET /api/agents/:agentId/debug-thread 的返回结构） */
export interface DebugThread {
  threadId: string;
  agentId: string;
  agentVersion: number;
  isDebug: true;
  createdAt: string;
  updatedAt: string;
}

// Message types
export interface Message {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// Agent types (Phase 2 - 列表接口不包含 config)
export const AGENT_TAGS = [
  'assistant',
  'expert',
  'creative',
  'companion',
  'explore',
] as const;
export type AgentTag = (typeof AGENT_TAGS)[number];

export interface AgentListItem {
  agentId: string;
  name: string;
  description: string | null;
  avatar: string | null;
  tag: string | null;
  status: 'private' | 'public';
  latestVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** agents 表行（版本架构下无 description/config，以 latest_version 指向最新版本） */
export interface AgentInDB {
  id: string;
  name: string;
  avatar: string | null;
  tag: string | null;
  status: 'private' | 'public';
  creator_id: string | null;
  latest_version: number;
  created_at: string;
  updated_at: string;
}

// 创建 Agent
export interface CreateAgentRequest {
  name: string;
  description?: string;
  tag?: string;
  avatar?: string;
}

export interface CreateAgentResponse {
  agentId: string;
  latestVersion: number;
}

// Agent 配置类型
export interface AgentConfig {
  systemPrompt: string;
  ragConfig: unknown | null;
  mcpConfig: unknown | null;
}

// Agent 详情（包含「当前最新版本」的配置）
export interface AgentDetail {
  agentId: string;
  name: string;
  description: string | null;
  avatar: string | null;
  tag: string | null;
  status: 'private' | 'public';
  version: number;
  config: AgentConfig;
  createdAt: string;
  updatedAt: string;
}

// 更新/发布接口的响应
export interface UpdateAgentResponse {
  agentId: string;
  version: number;
}

// 更新 Agent
export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  avatar?: string;
  tag?: string;
  config?: AgentConfig;
}
