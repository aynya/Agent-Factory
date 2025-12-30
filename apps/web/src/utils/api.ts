import type {
  ApiResponse,
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  User,
  ChatStreamRequest,
  ChatAbortRequest,
  ChatAbortResponse,
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

/**
 * 创建 SSE 连接进行流式聊天
 */
export function createChatStream(
  data: ChatStreamRequest,
  callbacks: {
    onStart?: (event: { messageId: string; role: 'assistant'; createdAt: string }) => void
    onToken?: (event: { messageId: string; content: string }) => void
    onEnd?: (event: {
      messageId: string
      role: 'assistant'
      status: 'usage'
      totalTokens: number
    }) => void
    onError?: (event: { code: number; message: string }) => void
  }
): AbortController {
  const token = localStorage.getItem('access_token')
  const abortController = new AbortController()

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

  fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(data),
    signal: abortController.signal,
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      if (!reader) {
        throw new Error('No reader available')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          if (!event.trim()) continue

          let eventType = ''
          let dataStr = ''

          // 解析 SSE 事件
          const lines = event.split('\n')
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.substring(6).trim()
            } else if (line.startsWith('data:')) {
              dataStr = line.substring(5).trim()
            }
          }

          if (!eventType || !dataStr) continue

          try {
            const data = JSON.parse(dataStr)

            switch (eventType) {
              case 'start':
                callbacks.onStart?.(data)
                break
              case 'token':
                callbacks.onToken?.(data)
                break
              case 'end':
                callbacks.onEnd?.(data)
                break
              case 'error':
                callbacks.onError?.(data)
                break
            }
          } catch (error) {
            console.error('Failed to parse SSE data:', error, { eventType, dataStr })
          }
        }
      }
    })
    .catch(error => {
      if (error.name !== 'AbortError') {
        callbacks.onError?.({ code: 500, message: error.message || '连接失败' })
      }
    })

  return abortController
}

/**
 * 中断聊天
 */
export async function abortChat(data: ChatAbortRequest): Promise<ApiResponse<ChatAbortResponse>> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  const token = localStorage.getItem('access_token')

  const response = await fetch(`${API_BASE_URL}/api/chat/abort`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(data),
  })

  return await response.json()
}
