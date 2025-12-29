import type {
  ApiResponse,
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  User,
} from '@monorepo/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

/**
 * 通用请求函数
 */
async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('access_token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include', // 允许携带 cookie（用于 refreshToken）
  })

  // 检查响应状态
  if (!response.ok && response.status !== 403) {
    // 非 403 错误，直接返回错误响应
    try {
      const errorData = await response.json()
      return errorData
    } catch {
      return {
        code: response.status,
        message: `请求失败: ${response.statusText}`,
        data: null,
      } as ApiResponse<T>
    }
  }

  const data = await response.json()

  // 如果 access_token 过期，尝试刷新
  if (response.status === 403 && token) {
    try {
      const refreshResult = await refreshToken()
      if (refreshResult.code === 0 && refreshResult.data) {
        // 重新请求原接口
        const retryHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string>),
          Authorization: `Bearer ${refreshResult.data.access_token}`,
        }
        const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
          ...options,
          headers: retryHeaders,
          credentials: 'include',
        })
        return await retryResponse.json()
      }
    } catch (error) {
      // 刷新失败，清除 token 并跳转到登录页
      localStorage.removeItem('access_token')
      window.location.href = '/login'
      throw error
    }
  }

  return data
}

/**
 * 用户注册
 */
export async function register(data: RegisterRequest): Promise<ApiResponse<RegisterResponse>> {
  return request<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 用户登录
 */
export async function login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  const response = await request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  // 登录成功，保存 access_token
  if (response.code === 0 && response.data?.access_token) {
    localStorage.setItem('access_token', response.data.access_token)
  }

  return response
}

/**
 * 刷新 Token
 */
export async function refreshToken(): Promise<ApiResponse<RefreshResponse>> {
  const response = await request<RefreshResponse>('/api/auth/refresh', {
    method: 'POST',
  })

  // 刷新成功，更新 access_token
  if (response.code === 0 && response.data?.access_token) {
    localStorage.setItem('access_token', response.data.access_token)
  }

  return response
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<ApiResponse<User>> {
  return request<User>('/api/auth/me', {
    method: 'GET',
  })
}

/**
 * 退出登录
 */
export function logout(): void {
  localStorage.removeItem('access_token')
  window.location.href = '/login'
}
