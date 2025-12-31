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

// Message types
export interface Message {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
