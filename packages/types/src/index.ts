// API response types
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
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
  id: number;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
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
