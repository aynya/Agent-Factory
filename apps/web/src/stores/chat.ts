import { ref } from 'vue'
import { defineStore } from 'pinia'
import { createChatStream, abortChat, getThreads, getMessages, deleteThread } from '../utils/api'
import type { ChatStreamRequest, ChatAbortRequest, Thread } from '@monorepo/types'

// 生成 UUID
function generateUUID(): string {
  return crypto.randomUUID()
}

export interface Message {
  id: string // 前端 ID，用于 Vue key，永远不变
  backendId?: string // 后端返回的 ID，用于匹配 SSE 事件
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
  isStreaming?: boolean
}

export const useChatStore = defineStore('chat', () => {
  // 当前会话 ID
  const currentThreadId = ref<string | null>(null)
  // 默认 Agent ID
  const defaultAgentId = 'system-agent-id'
  // 会话列表
  const threads = ref<Thread[]>([])
  // 是否正在加载会话列表
  const isLoadingThreads = ref(false)
  // 消息列表
  const messages = ref<Message[]>([])
  // 是否正在加载历史消息
  const isLoadingMessages = ref(false)
  // 是否正在生成
  const isGenerating = ref(false)
  // 当前流式请求的控制器
  const currentAbortController = ref<AbortController | null>(null)
  // 当前正在生成的消息 ID
  const currentMessageId = ref<string | null>(null)

  /**
   * 加载会话列表
   */
  async function loadThreads() {
    isLoadingThreads.value = true
    try {
      const response = await getThreads()
      if (response.code === 0 && response.data) {
        threads.value = response.data
      }
    } catch (error) {
      console.error('Failed to load threads:', error)
    } finally {
      isLoadingThreads.value = false
    }
  }

  /**
   * 加载历史消息
   */
  async function loadMessages(threadId: string) {
    if (!threadId) return

    isLoadingMessages.value = true
    try {
      const response = await getMessages(threadId)
      if (response.code === 0 && response.data) {
        // 将后端消息格式转换为前端格式
        messages.value = response.data.map(msg => ({
          id: msg.id,
          backendId: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.created_at,
          isStreaming: false,
        }))
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
      messages.value = []
    } finally {
      isLoadingMessages.value = false
    }
  }

  /**
   * 切换会话
   */
  async function switchThread(threadId: string) {
    // 如果切换到的 threadId 就是当前的 threadId，且正在生成，说明是同一个会话，不需要中断
    // 只有当切换到不同的 threadId 时，才需要中断当前请求
    if (isGenerating.value && currentAbortController.value && currentThreadId.value !== threadId) {
      await interruptGeneration()
    }

    // 如果已经是同一个 threadId，且消息已加载，不需要重新加载
    if (currentThreadId.value === threadId && messages.value.length > 0) {
      return
    }

    currentThreadId.value = threadId
    await loadMessages(threadId)
  }

  /**
   * 创建新会话
   */
  function createNewThread() {
    currentThreadId.value = null
    messages.value = []
    isGenerating.value = false
    if (currentAbortController.value) {
      currentAbortController.value.abort()
      currentAbortController.value = null
    }
    currentMessageId.value = null
  }

  /**
   * 删除会话
   */
  async function removeThread(threadId: string) {
    try {
      const response = await deleteThread(threadId)
      if (response.code === 0) {
        // 从列表中移除
        threads.value = threads.value.filter(t => t.threadId !== threadId)

        // 如果删除的是当前会话，切换到新会话
        if (currentThreadId.value === threadId) {
          createNewThread()
        }
      }
      return response.code === 0
    } catch (error) {
      console.error('Failed to delete thread:', error)
      return false
    }
  }

  /**
   * 发送消息
   */
  async function sendMessage(content: string) {
    if (!content.trim() || isGenerating.value) return

    // 如果没有当前会话，创建一个新的 threadId
    if (!currentThreadId.value) {
      currentThreadId.value = generateUUID()
    }

    // 添加用户消息
    const userMessage: Message = {
      id: generateUUID(),
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    }
    messages.value.push(userMessage)

    // 创建 assistant 消息占位符（使用固定的前端 ID，用于 Vue key）
    const frontendMessageId = generateUUID()
    const assistantMessage: Message = {
      id: frontendMessageId, // 前端 ID，永远不变，用于 Vue key
      role: 'assistant',
      content: '',
      isStreaming: true,
    }
    messages.value.push(assistantMessage)

    isGenerating.value = true
    currentMessageId.value = frontendMessageId

    // 创建 SSE 连接
    if (!currentThreadId.value) {
      currentThreadId.value = generateUUID()
    }

    const requestData: ChatStreamRequest = {
      agent_id: defaultAgentId,
      thread_id: currentThreadId.value,
      content: content.trim(),
    }

    const abortController = createChatStream(requestData, {
      onStart: event => {
        // 将后端返回的 messageId 存储到 backendId 字段，不修改前端 ID
        const message = messages.value.find(m => m.id === frontendMessageId)
        if (message) {
          message.backendId = event.messageId
          message.createdAt = event.createdAt
        }
      },
      onToken: event => {
        // 通过 backendId 或 id 查找消息
        const message =
          messages.value.find(m => m.backendId === event.messageId) ||
          messages.value.find(m => m.id === event.messageId)
        if (message) {
          message.content += event.content
        }
      },
      onEnd: event => {
        // 通过 backendId 或 id 查找消息
        const message =
          messages.value.find(m => m.backendId === event.messageId) ||
          messages.value.find(m => m.id === event.messageId)
        if (message) {
          message.isStreaming = false
        }
        isGenerating.value = false
        currentAbortController.value = null
        currentMessageId.value = null

        // 消息发送完成后，刷新会话列表（以便更新会话标题和更新时间）
        loadThreads()
      },
      onError: event => {
        // 错误时可能还没有收到 start 事件，所以使用前端 ID 查找
        const message = messages.value.find(m => m.id === frontendMessageId)
        if (message) {
          message.content = message.content || `错误: ${event.message}`
          message.isStreaming = false
        }
        isGenerating.value = false
        currentAbortController.value = null
        currentMessageId.value = null
      },
    })

    currentAbortController.value = abortController
  }

  /**
   * 中断生成
   */
  async function interruptGeneration() {
    if (!currentAbortController.value || !isGenerating.value || !currentThreadId.value) return

    try {
      // 中断 SSE 连接
      currentAbortController.value.abort()

      // 调用后端中断接口
      const requestData: ChatAbortRequest = {
        agent_id: defaultAgentId,
        thread_id: currentThreadId.value,
      }
      await abortChat(requestData)

      // 更新消息状态（使用前端 ID 查找）
      if (currentMessageId.value) {
        const message = messages.value.find(m => m.id === currentMessageId.value)
        if (message) {
          message.isStreaming = false
        }
      }

      isGenerating.value = false
      currentAbortController.value = null
      currentMessageId.value = null
    } catch (error) {
      console.error('Failed to interrupt generation:', error)
    }
  }

  return {
    currentThreadId,
    threads,
    isLoadingThreads,
    messages,
    isLoadingMessages,
    isGenerating,
    loadThreads,
    loadMessages,
    switchThread,
    createNewThread,
    removeThread,
    sendMessage,
    interruptGeneration,
  }
})
