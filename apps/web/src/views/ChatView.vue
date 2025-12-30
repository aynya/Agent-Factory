<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <!-- 顶部导航栏 -->
    <header class="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center space-x-3">
            <div
              class="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center"
            >
              <el-icon :size="20" class="text-white">
                <ChatDotRound />
              </el-icon>
            </div>
            <h1 class="text-xl font-bold text-gray-900">AI Agent Platform</h1>
          </div>

          <div class="flex items-center space-x-4">
            <el-button type="primary" size="small" @click="handleNewChat">
              <el-icon class="mr-1"><Plus /></el-icon>
              新会话
            </el-button>
            <div v-if="authStore.user" class="flex items-center space-x-3">
              <el-avatar :size="32" :src="authStore.user.avatar">
                {{ authStore.user.username.charAt(0).toUpperCase() }}
              </el-avatar>
              <span class="text-sm text-gray-700 font-medium hidden sm:inline">
                {{ authStore.user.username }}
              </span>
            </div>
            <el-button type="danger" size="small" @click="handleLogout">
              <el-icon class="mr-1"><SwitchButton /></el-icon>
              退出登录
            </el-button>
          </div>
        </div>
      </div>
    </header>

    <!-- 主内容区域 -->
    <main class="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
      <!-- 消息列表 -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto mb-4 space-y-6 messages-container">
        <div v-if="chatStore.messages.length === 0" class="flex items-center justify-center h-full">
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
                <div v-else-if="message.isStreaming" class="flex items-center gap-2 text-gray-400">
                  <span class="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                  <span class="text-sm">AI 正在思考...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="bg-white rounded-2xl border border-gray-200 shadow-lg p-4">
        <div class="flex items-end gap-3">
          <div class="flex-1">
            <el-input
              v-model="inputText"
              type="textarea"
              :rows="3"
              :autosize="{ minRows: 3, maxRows: 6 }"
              placeholder="输入消息..."
              class="resize-none"
              :disabled="chatStore.isGenerating"
              @keydown.ctrl.enter="handleSend"
              @keydown.meta.enter="handleSend"
            />
          </div>
          <div class="flex flex-col gap-2">
            <el-button
              v-if="chatStore.isGenerating"
              type="danger"
              size="large"
              :icon="Close"
              @click="handleInterrupt"
            >
              停止
            </el-button>
            <el-button
              v-else
              type="primary"
              size="large"
              :icon="Promotion"
              :disabled="!inputText.trim() || chatStore.isGenerating"
              @click="handleSend"
            >
              发送
            </el-button>
          </div>
        </div>
        <div class="mt-2 text-xs text-gray-400 text-center">按 Ctrl+Enter 或 Cmd+Enter 发送</div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { ChatDotRound, SwitchButton, Plus, Promotion, Close } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import MarkdownIt from 'markdown-it'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

const inputText = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

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
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

/**
 * 发送消息
 */
async function handleSend() {
  if (!inputText.value.trim() || chatStore.isGenerating) return

  const text = inputText.value.trim()
  inputText.value = ''

  await chatStore.sendMessage(text)
  scrollToBottom()
}

/**
 * 中断生成
 */
async function handleInterrupt() {
  await chatStore.interruptGeneration()
  ElMessage.info('已停止生成')
}

/**
 * 创建新会话
 */
function handleNewChat() {
  if (chatStore.messages.length > 0) {
    ElMessageBox.confirm('确定要创建新会话吗？当前会话将被清空。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
      .then(() => {
        chatStore.createNewThread()
        ElMessage.success('已创建新会话')
      })
      .catch(() => {
        // 用户取消
      })
  } else {
    chatStore.createNewThread()
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

// 监听消息变化，自动滚动到底部
watch(
  () => chatStore.messages,
  () => {
    scrollToBottom()
  },
  { deep: true }
)

onMounted(() => {
  scrollToBottom()
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
</style>
