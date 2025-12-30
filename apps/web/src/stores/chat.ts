import { ref } from 'vue'
import { defineStore } from 'pinia'
import { createChatStream, abortChat } from '../utils/api'
import type { ChatStreamRequest, ChatAbortRequest } from '@monorepo/types'

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
  const currentThreadId = ref<string>(generateUUID())
  // 默认 Agent ID
  const defaultAgentId = 'system-agent-id'
  // 消息列表
  const messages = ref<Message[]>([])
  // 是否正在生成
  const isGenerating = ref(false)
  // 当前流式请求的控制器
  const currentAbortController = ref<AbortController | null>(null)
  // 当前正在生成的消息 ID
  const currentMessageId = ref<string | null>(null)

  /**
   * 创建新会话
   */
  function createNewThread() {
    currentThreadId.value = generateUUID()
    messages.value = []
    isGenerating.value = false
    if (currentAbortController.value) {
      currentAbortController.value.abort()
      currentAbortController.value = null
    }
    currentMessageId.value = null
  }

  /**
   * 发送消息
   */
  async function sendMessage(content: string) {
    if (!content.trim() || isGenerating.value) return

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
    if (!currentAbortController.value || !isGenerating.value) return

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
    messages,
    isGenerating,
    createNewThread,
    sendMessage,
    interruptGeneration,
  }
})
