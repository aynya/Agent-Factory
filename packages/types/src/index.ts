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
