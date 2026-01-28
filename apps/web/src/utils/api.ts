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
  Thread,
  ThreadAgentDisplay,
  Message,
  DebugThread,
  AgentListItem,
  CreateAgentRequest,
  CreateAgentResponse,
  AgentDetail,
  UpdateAgentRequest,
  UpdateAgentResponse,
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
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // 必须携带 credentials: 'include'，因为 refresh_token 存储在 HttpOnly Cookie 中
      credentials: 'include',
    })

    const result: ApiResponse<RefreshResponse> = await response.json()

    // 刷新成功，更新本地存储的 access_token
    if (result.code === 0 && result.data?.access_token) {
      localStorage.setItem('access_token', result.data.access_token)
    } else {
      // 如果后端返回 code != 0（比如 refresh_token 过期），视为刷新失败
      throw new Error(result.message || 'Refresh failed')
    }

    return result
  } catch (error) {
    // 捕获网络错误或上面抛出的业务错误
    console.error('RefreshToken Error:', error)

    // 彻底清除 Token 并标记失败，让外部调用者处理跳转逻辑
    localStorage.removeItem('access_token')
    window.location.href = '/login'
    return {
      code: 401,
      message: '登录已过期',
      data: null,
    } as ApiResponse<RefreshResponse>
  }
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
  const abortController = new AbortController()
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

  /**
   * 执行 SSE 请求
   */
  async function executeRequest(accessToken: string | null) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(data),
        signal: abortController.signal,
      })

      // 处理 403 错误（token 过期）
      if (response.status === 403 && accessToken) {
        try {
          // 尝试刷新 token
          const refreshResult = await refreshToken()
          if (refreshResult.code === 0 && refreshResult.data?.access_token) {
            // 使用新 token 重新请求
            return executeRequest(refreshResult.data.access_token)
          }
        } catch {
          // 刷新失败，清除 token 并跳转到登录页
          localStorage.removeItem('access_token')
          callbacks.onError?.({ code: 403, message: '登录已过期，请重新登录' })
          window.location.href = '/login'
          return
        }
      }

      if (!response.ok) {
        // 尝试解析错误响应
        try {
          const errorText = await response.text()
          const errorData = JSON.parse(errorText)
          callbacks.onError?.(errorData)
        } catch {
          callbacks.onError?.({
            code: response.status,
            message: `HTTP error! status: ${response.status}`,
          })
        }
        return
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

        if (abortController.signal.aborted) {
          reader.cancel()
          break
        }

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
            const eventData = JSON.parse(dataStr)

            switch (eventType) {
              case 'start':
                callbacks.onStart?.(eventData)
                break
              case 'token':
                callbacks.onToken?.(eventData)
                break
              case 'end':
                callbacks.onEnd?.(eventData)
                break
              case 'error':
                callbacks.onError?.(eventData)
                break
            }
          } catch (error) {
            console.error('Failed to parse SSE data:', error, { eventType, dataStr })
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 用户主动中断，不触发错误回调
        return
      }
      callbacks.onError?.({
        code: 500,
        message: error instanceof Error ? error.message : '连接失败',
      })
    }
  }

  // 开始执行请求
  const token = localStorage.getItem('access_token')
  executeRequest(token)

  return abortController
}

/**
 * 中断聊天
 */
export async function abortChat(data: ChatAbortRequest): Promise<ApiResponse<ChatAbortResponse>> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  const token = localStorage.getItem('access_token')

  const makeRequest = async (accessToken: string | null) => {
    const response = await fetch(`${API_BASE_URL}/api/chat/abort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(data),
    })

    // 处理 403 错误（token 过期）
    if (response.status === 403 && accessToken) {
      try {
        // 尝试刷新 token
        const refreshResult = await refreshToken()
        if (refreshResult.code === 0 && refreshResult.data?.access_token) {
          // 使用新 token 重新请求
          return makeRequest(refreshResult.data.access_token)
        }
      } catch (error) {
        // 刷新失败，清除 token 并跳转到登录页
        localStorage.removeItem('access_token')
        window.location.href = '/login'
        throw error
      }
    }

    return await response.json()
  }

  return makeRequest(token)
}

/**
 * 获取会话列表
 */
export async function getThreads(): Promise<ApiResponse<Thread[]>> {
  return request<Thread[]>('/api/chat/threads', {
    method: 'GET',
  })
}

/**
 * 通过 Thread 获取当前对话所使用 Agent 的展示信息
 * GET /api/threads/:threadId/agent
 * 用于：对话页侧边栏展示、确认当前使用的 Agent 身份与能力
 */
export async function getThreadAgent(threadId: string): Promise<ApiResponse<ThreadAgentDisplay>> {
  return request<ThreadAgentDisplay>(`/api/threads/${encodeURIComponent(threadId)}/agent`, {
    method: 'GET',
  })
}

/**
 * 获取历史消息
 */
export async function getMessages(threadId: string): Promise<ApiResponse<Message[]>> {
  return request<Message[]>(`/api/chat/message/${threadId}`, {
    method: 'GET',
  })
}

/**
 * 删除会话
 */
export async function deleteThread(threadId: string): Promise<ApiResponse<null>> {
  return request<null>(`/api/chat/thread/${threadId}`, {
    method: 'DELETE',
  })
}

/**
 * 获取所有公开智能体
 * GET /api/agents?status=public[&tag=xxx]
 */
export async function getPublicAgents(tag?: string): Promise<ApiResponse<AgentListItem[]>> {
  const params = new URLSearchParams({ status: 'public' })
  if (tag) params.set('tag', tag)
  return request<AgentListItem[]>(`/api/agents?${params}`)
}

/**
 * 获取当前用户的智能体列表
 * GET /api/agents/me[?tag=xxx]
 */
export async function getMyAgents(tag?: string): Promise<ApiResponse<AgentListItem[]>> {
  const url = tag ? `/api/agents/me?tag=${encodeURIComponent(tag)}` : '/api/agents/me'
  return request<AgentListItem[]>(url)
}

/**
 * 创建智能体
 * POST /api/agents
 */
export async function createAgent(
  data: CreateAgentRequest
): Promise<ApiResponse<CreateAgentResponse>> {
  return request<CreateAgentResponse>('/api/agents', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 删除智能体
 * DELETE /api/agents/:agentId
 */
export async function deleteAgent(agentId: string): Promise<ApiResponse<null>> {
  return request<null>(`/api/agents/${agentId}`, {
    method: 'DELETE',
  })
}

/**
 * 获取智能体详情
 * GET /api/agents/:agentId
 */
export async function getAgentDetail(agentId: string): Promise<ApiResponse<AgentDetail>> {
  return request<AgentDetail>(`/api/agents/${agentId}`, {
    method: 'GET',
  })
}

/**
 * 获取 Agent 的调试会话（有则复用，无则创建）
 * GET /api/agents/:agentId/debug-thread
 */
export async function getAgentDebugThread(agentId: string): Promise<ApiResponse<DebugThread>> {
  return request<DebugThread>(`/api/agents/${agentId}/debug-thread`, {
    method: 'GET',
  })
}

/**
 * 更新智能体配置并发布新版本
 * PUT /api/agents/:agentId
 */
export async function updateAgent(
  agentId: string,
  data: UpdateAgentRequest
): Promise<ApiResponse<UpdateAgentResponse>> {
  return request<UpdateAgentResponse>(`/api/agents/${agentId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
