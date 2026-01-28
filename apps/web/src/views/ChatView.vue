<template>
  <div
    ref="messagesContainer"
    @scroll="handleScroll"
    class="flex-1 flex overflow-y-auto messages-container"
  >
    <!-- 主内容区域 -->
    <main class="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
      <!-- 消息列表 -->
      <div class="flex-1 min-h-0 mb-4 space-y-6">
        <!-- 欢迎界面（仅在 /chat 路由且无消息时显示） -->
        <div
          v-if="!route.params.threadId && chatStore.messages.length === 0"
          class="flex flex-col items-center justify-center h-full"
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

          <!-- 输入框（在欢迎界面时显示在中间） -->
          <transition name="input-fade" mode="out-in">
            <ChatInput
              v-if="!route.params.threadId && chatStore.messages.length === 0"
              key="input-center"
              v-model="inputText"
              :is-generating="chatStore.isGenerating"
              container-class="w-full max-w-2xl mx-auto mt-4 input-container input-container-center"
              @send="handleSend"
              @interrupt="handleInterrupt"
            />
          </transition>
        </div>

        <ChatMessageItem
          v-for="message in chatStore.messages"
          :key="message.id"
          :message="message"
        />
        <div class="w-[100%] h-8"></div>
      </div>
    </main>
  </div>

  <!-- 输入框（有消息时显示在底部） -->
  <transition name="input-fade" mode="out-in">
    <footer
      v-if="chatStore.messages.length > 0"
      key="input-bottom"
      class="max-w-4xl mx-auto w-full px-4 pb-8 pt-2 bg-transparent input-container input-container-bottom relative"
    >
      <ChatInput
        v-model="inputText"
        :is-generating="chatStore.isGenerating"
        :show-scroll-button="showScrollButton"
        gradient-color="rgb(249, 250, 251)"
        @send="handleSend"
        @interrupt="handleInterrupt"
        @scroll-to-bottom="scrollToBottom(false)"
      />
    </footer>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ChatDotRound } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import ChatMessageItem from '@/components/ChatMessageItem.vue'
import ChatInput from '@/components/ChatInput.vue'
import { useAutoScroll } from '@/composables/useAutoScroll'

const setHeaderTitle = inject<(t: string | null) => void>('setHeaderTitle')

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()

const inputText = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

// 使用自动滚动 composable
const { showScrollButton, scrollToBottom, handleScroll, updateScrollButtonVisibility } =
  useAutoScroll(messagesContainer, {
    enableScrollButton: true,
    scrollOnMount: false, // 在 onMounted 中手动调用，因为需要先加载数据
    watchSource: () => chatStore.messages,
    deep: true,
    customVisibilityCheck: () => {
      // 只在有消息且不在欢迎界面时显示按钮
      const hasMessages = route.params.threadId || chatStore.messages.length > 0
      if (!hasMessages) {
        return false
      }
      // 如果接近底部，隐藏按钮；否则显示按钮
      const isNearBottom =
        messagesContainer.value &&
        messagesContainer.value.scrollHeight -
          messagesContainer.value.scrollTop -
          messagesContainer.value.clientHeight <
          50
      return !isNearBottom
    },
  })

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
      // switchThread 内部会处理中断逻辑（如果切换到不同的 threadId 且正在生成）
      await chatStore.switchThread(threadId)
      scrollToBottom(false)
    } else {
      // 在 /chat 路由时，清空当前会话（会中断生成）
      await chatStore.createNewThread()
    }
  }
)

// 监听消息变化，处理错误消息
watch(
  () => chatStore.messages,
  () => {
    if (chatStore.messages[chatStore.messages.length - 1]?.isError) {
      ElMessage.error(chatStore.messages[chatStore.messages.length - 1]?.errorMessage || '生成失败')
    }
  },
  { deep: true }
)

// 监听滚动事件，更新按钮显示状态（composable 已处理，但需要调用自定义检查）
watch(
  () => [route.params.threadId, chatStore.messages.length],
  () => {
    updateScrollButtonVisibility()
  }
)

watch(currentThreadTitle, t => {
  setHeaderTitle?.(t ?? null)
})

onMounted(async () => {
  setHeaderTitle?.(currentThreadTitle.value ?? null)
  // 如果路由中有 threadId，加载对应的会话（仅在首次加载时）
  const threadId = route.params.threadId
  if (threadId && typeof threadId === 'string') {
    // 只有当当前 store 中的 threadId 与路由不一致时才加载
    if (chatStore.currentThreadId !== threadId) {
      await chatStore.switchThread(threadId)
    }
  } else {
    // 在 /chat 路由时，清空当前会话
    await chatStore.createNewThread()
  }
  scrollToBottom(false)
})

// 组件卸载前（离开聊天页面时）中断生成
onBeforeUnmount(async () => {
  if (chatStore.isGenerating) {
    await chatStore.interruptGeneration()
  }
})
</script>

<style scoped>
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

/* 输入框位置动画 */
.input-container {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-container-center {
  position: relative;
  animation: slideInFromCenter 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-container-bottom {
  position: relative;
  animation: slideInFromBottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideInFromCenter {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInFromBottom {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 输入框切换过渡动画 */
.input-fade-enter-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute !important;
  left: 50% !important;
  bottom: 0 !important;
  width: 100% !important;
  max-width: 56rem !important;
  /* max-w-4xl */
  transform: translateX(-50%) !important;
  z-index: 1;
}

.input-fade-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.input-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px) scale(0.95);
}
</style>
