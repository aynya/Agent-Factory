<template>
  <div class="h-screen bg-gray-50 flex overflow-hidden">
    <!-- 左侧会话列表侧边栏 -->
    <div class="flex-shrink-0 h-full">
      <ThreadSidebar />
    </div>

    <!-- 右侧主内容区域 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- 顶部导航栏 -->
      <header class="sticky top-0 z-50">
        <div class="px-4 sm:px-6 lg:px-8">
          <div class="flex items-center h-16 relative">
            <!-- 左侧：Logo 和平台名 -->
            <div class="flex items-center space-x-3 flex-shrink-0">
              <div
                class="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center"
              >
                <el-icon :size="20" class="text-white">
                  <ChatDotRound />
                </el-icon>
              </div>
              <h1 class="text-xl font-bold text-gray-900">AI Agent Platform</h1>
            </div>

            <!-- 中间：Thread 标题（居中显示） -->
            <div
              class="flex-1 flex items-center justify-center absolute inset-0 pointer-events-none"
            >
              <h2
                v-if="currentThreadTitle"
                class="text-base font-medium text-gray-900 truncate max-w-md pointer-events-auto"
              >
                {{ currentThreadTitle }}
              </h2>
            </div>

            <!-- 右侧：用户信息下拉菜单 -->
            <div class="flex items-center flex-shrink-0 ml-auto">
              <el-dropdown
                v-if="authStore.user"
                trigger="click"
                placement="bottom-end"
                @command="handleCommand"
              >
                <div
                  class="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <el-avatar :size="32" :src="authStore.user.avatar">
                    {{ authStore.user.username.charAt(0).toUpperCase() }}
                  </el-avatar>
                  <span class="text-sm text-gray-700 font-medium hidden sm:inline">
                    {{ authStore.user.username }}
                  </span>
                  <el-icon class="text-gray-400 hidden sm:inline">
                    <ArrowDown />
                  </el-icon>
                </div>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item disabled>
                      <div class="flex flex-col">
                        <span class="text-sm font-medium text-gray-900">
                          {{ authStore.user.username }}
                        </span>
                      </div>
                    </el-dropdown-item>
                    <el-dropdown-item divided command="logout">
                      <el-icon class="mr-2">
                        <SwitchButton />
                      </el-icon>
                      退出登录
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
      </header>

      <div ref="messagesContainer" class="flex-1 overflow-y-auto messages-container">
        <!-- 主内容区域 -->
        <main class="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
          <!-- 消息列表 -->
          <div class="flex-1 min-h-0 mb-4 space-y-6">
            <!-- 欢迎界面（仅在 /chat 路由且无消息时显示） -->
            <div
              v-if="!route.params.threadId && chatStore.messages.length === 0"
              class="flex items-center justify-center h-full"
            >
              <div class="text-center py-12 max-w-2xl mx-auto">
                <div
                  class="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6"
                >
                  <el-icon :size="40" class="text-blue-600">
                    <ChatDotRound />
                  </el-icon>
                </div>
                <h2 class="text-3xl font-semibold text-gray-900 mb-2">
                  {{ authStore.user?.username || '你好' }}, 你好
                </h2>
                <p class="text-lg text-gray-500 mb-8">需要我为你做些什么?</p>
                <!-- 快捷提示按钮 -->
                <div class="grid grid-cols-2 gap-3 max-w-md mx-auto">
                  <button
                    class="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700"
                    @click="handleQuickPrompt('帮我写一段代码')"
                  >
                    帮我写代码
                  </button>
                  <button
                    class="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700"
                    @click="handleQuickPrompt('解释一下这个概念')"
                  >
                    解释概念
                  </button>
                  <button
                    class="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700"
                    @click="handleQuickPrompt('帮我学习新知识')"
                  >
                    帮我学习
                  </button>
                  <button
                    class="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700"
                    @click="handleQuickPrompt('给我一些建议')"
                  >
                    给我建议
                  </button>
                </div>
              </div>
            </div>

            <!-- 空会话提示（在 /chat/:threadId 但无消息时显示） -->
            <div
              v-else-if="route.params.threadId && chatStore.messages.length === 0"
              class="flex items-center justify-center h-full"
            >
              <div class="text-center py-12">
                <div
                  class="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6"
                >
                  <el-icon :size="40" class="text-blue-600">
                    <ChatDotRound />
                  </el-icon>
                </div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">开始对话</h3>
                <p class="text-gray-500 max-w-md mx-auto">输入消息开始与 AI 助手对话</p>
              </div>
            </div>

            <div
              v-for="message in chatStore.messages"
              :key="message.id"
              class="flex gap-4"
              :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <!-- 用户消息 -->
              <div v-if="message.role === 'user'" class="flex gap-3 max-w-[80%]">
                <div class="flex-1">
                  <div class="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                    <p class="text-sm whitespace-pre-wrap break-words">{{ message.content }}</p>
                  </div>
                </div>
              </div>

              <!-- AI 回复 -->
              <div v-else class="flex gap-3 w-[100%]">
                <div class="flex-1">
                  <div class="rounded-2xl rounded-tl-sm px-4 py-3">
                    <div
                      v-if="message.content"
                      class="prose prose-sm max-w-none markdown-body"
                      v-html="renderMarkdown(message.content)"
                    ></div>
                    <div
                      v-else-if="message.isStreaming"
                      class="flex items-center gap-2 text-gray-400"
                    >
                      <span
                        class="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                      ></span>
                      <span class="text-sm">AI 正在思考...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <footer class="max-w-4xl mx-auto w-full px-4 pb-8 pt-2 bg-transparent">
        <div
          class="relative bg-white rounded-[28px] border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-2 pl-5"
        >
          <div class="flex flex-col">
            <el-input
              v-model="inputText"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 8 }"
              placeholder="输入消息..."
              class="gemini-input mt-2"
              :disabled="chatStore.isGenerating"
              @keydown.ctrl.enter="handleSend"
              @keydown.meta.enter="handleSend"
            />

            <div class="flex items-center justify-between mt-2 mb-1 pr-2">
              <div class="flex items-center gap-1 text-gray-500">
                <el-button :icon="Plus" circle text class="!p-2 hover:bg-gray-100" />
                <el-button :icon="Picture" circle text class="!p-2 hover:bg-gray-100" />
              </div>

              <div class="flex items-center">
                <transition mode="out-in">
                  <el-button
                    v-if="chatStore.isGenerating"
                    type="danger"
                    circle
                    class="!w-10 !h-10 !p-0"
                    @click="handleInterrupt"
                  >
                    <el-icon :size="20">
                      <Close />
                    </el-icon>
                  </el-button>
                  <el-button
                    v-else
                    type="primary"
                    circle
                    :disabled="!inputText.trim()"
                    class="!w-10 !h-10 !p-0 !border-none send-btn"
                    @click="handleSend"
                  >
                    <el-icon :size="20">
                      <Promotion />
                    </el-icon>
                  </el-button>
                </transition>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-3 text-[11px] text-gray-400 text-center font-light">
          AI 可能会产生错误信息，请核实重要信息。按 Ctrl+Enter 发送
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import {
  ChatDotRound,
  SwitchButton,
  Promotion,
  Close,
  ArrowDown,
  Plus,
  Picture,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import ThreadSidebar from '@/components/ThreadSidebar.vue'
import MarkdownIt from 'markdown-it'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()

const inputText = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

/**
 * 获取当前 Thread 的标题
 */
const currentThreadTitle = computed(() => {
  const threadId = route.params.threadId
  if (!threadId || typeof threadId !== 'string') {
    return null
  }

  const thread = chatStore.threads.find(t => t.threadId === threadId)
  return thread?.title || null
})

// 初始化 markdown-it
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

/**
 * 渲染 Markdown
 */
function renderMarkdown(text: string): string {
  return md.render(text)
}

/**
 * 滚动到底部
 */
function scrollToBottom(isCheck = true) {
  nextTick(() => {
    if (messagesContainer.value) {
      if (isCheck) {
        if (
          messagesContainer.value.scrollHeight -
            messagesContainer.value.scrollTop -
            messagesContainer.value.clientHeight <
          50
        ) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      } else {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }
  })
}

/**
 * 快捷提示
 */
async function handleQuickPrompt(prompt: string) {
  inputText.value = prompt
  await handleSend()
}

/**
 * 发送消息
 */
async function handleSend() {
  if (!inputText.value.trim() || chatStore.isGenerating) return

  const text = inputText.value.trim()
  inputText.value = ''

  // 如果没有当前会话，先创建新会话
  if (!chatStore.currentThreadId) {
    chatStore.createNewThread()
  }

  await chatStore.sendMessage(text)

  // 如果当前在 /chat 路由，跳转到 /chat/:threadId
  if (!route.params.threadId && chatStore.currentThreadId) {
    router.push(`/chat/${chatStore.currentThreadId}`)
  }

  scrollToBottom(false)
}

/**
 * 中断生成
 */
async function handleInterrupt() {
  await chatStore.interruptGeneration()
  ElMessage.info('已停止生成')
}

/**
 * 处理下拉菜单命令
 */
async function handleCommand(command: string) {
  if (command === 'logout') {
    await handleLogout()
  }
}

/**
 * 退出登录
 */
async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    chatStore.createNewThread()
    authStore.logout()
    router.push('/login')
  } catch {
    // 用户取消
  }
}

// 监听路由变化，加载对应的会话
watch(
  () => route.params.threadId,
  async (threadId, oldThreadId) => {
    // 如果 threadId 没有变化，不重复加载
    if (threadId === oldThreadId) return

    if (threadId && typeof threadId === 'string') {
      // 如果当前 threadId 已经是目标 threadId，且正在生成，说明是刚发送消息后的跳转，不需要切换
      // switchThread 内部会处理这种情况，但这里可以提前返回避免不必要的调用
      if (chatStore.currentThreadId === threadId && chatStore.isGenerating) {
        return
      }
      await chatStore.switchThread(threadId)
    } else {
      // 在 /chat 路由时，清空当前会话
      chatStore.createNewThread()
    }
  }
)

// 监听消息变化，自动滚动到底部
watch(
  () => chatStore.messages,
  () => {
    scrollToBottom()
  },
  { deep: true }
)

onMounted(async () => {
  scrollToBottom()
  // 加载会话列表
  await chatStore.loadThreads()

  // 如果路由中有 threadId，加载对应的会话（仅在首次加载时）
  const threadId = route.params.threadId
  if (threadId && typeof threadId === 'string') {
    // 只有当当前 store 中的 threadId 与路由不一致时才加载
    if (chatStore.currentThreadId !== threadId) {
      await chatStore.switchThread(threadId)
    }
  } else {
    // 在 /chat 路由时，清空当前会话
    chatStore.createNewThread()
  }
})
</script>

<style scoped>
/* Markdown 样式 */
:deep(.markdown-body) {
  color: #24292f;
  line-height: 1.6;
}

:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3),
:deep(.markdown-body h4),
:deep(.markdown-body h5),
:deep(.markdown-body h6) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
}

:deep(.markdown-body h1) {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

:deep(.markdown-body h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

:deep(.markdown-body h3) {
  font-size: 1.25em;
}

:deep(.markdown-body p) {
  margin-bottom: 1em;
}

:deep(.markdown-body code) {
  background-color: rgba(175, 184, 193, 0.2);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  font-family: 'Courier New', monospace;
}

:deep(.markdown-body pre) {
  background-color: #f6f8fa;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin-bottom: 1em;
}

:deep(.markdown-body pre code) {
  background-color: transparent;
  padding: 0;
  font-size: 0.9em;
}

:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  margin-bottom: 1em;
  padding-left: 2em;
}

:deep(.markdown-body li) {
  margin-bottom: 0.5em;
}

:deep(.markdown-body blockquote) {
  border-left: 4px solid #dfe2e5;
  padding-left: 1em;
  margin: 1em 0;
  color: #6a737d;
}

:deep(.markdown-body a) {
  color: #0366d6;
  text-decoration: none;
}

:deep(.markdown-body a:hover) {
  text-decoration: underline;
}

:deep(.markdown-body table) {
  border-collapse: collapse;
  margin-bottom: 1em;
  width: 100%;
}

:deep(.markdown-body table th),
:deep(.markdown-body table td) {
  border: 1px solid #dfe2e5;
  padding: 6px 13px;
}

:deep(.markdown-body table th) {
  background-color: #f6f8fa;
  font-weight: 600;
}

/* 滚动条样式 */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 输入框样式 */
:deep(.gemini-input .el-textarea__inner) {
  box-shadow: none !important;
  border: none !important;
  padding: 0 !important;
  background: transparent !important;
  font-size: 16px;
  line-height: 1.5;
  color: #1f1f1f;
  resize: none;
}

/* 自定义发送按钮颜色 */
.send-btn {
  background-color: #1a73e8 !important;
  transition: all 0.2s ease;
}

.send-btn:disabled {
  background-color: #f1f3f4 !important;
  color: #9aa0a6 !important;
}

/* 按钮点击动画 */
.send-btn:active {
  transform: scale(0.9);
}

/* 渐变消失动画 */
.v-enter-active,
.v-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
