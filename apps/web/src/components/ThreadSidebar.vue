<template>
  <div class="h-full flex flex-col bg-white border-r border-gray-200">
    <!-- 头部：新会话按钮 -->
    <div class="p-4 border-b border-gray-200">
      <el-button type="primary" class="w-full" :icon="Plus" @click="handleNewChat">
        新会话
      </el-button>
    </div>

    <!-- 会话列表 -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="chatStore.isLoadingThreads" class="p-4 text-center text-gray-400">
        <el-icon class="animate-spin mb-2">
          <Loading />
        </el-icon>
        <p class="text-sm">加载中...</p>
      </div>

      <div v-else-if="chatStore.threads.length === 0" class="p-4 text-center text-gray-400">
        <p class="text-sm">暂无会话</p>
        <p class="text-xs mt-1">创建新会话开始对话</p>
      </div>

      <div v-else class="py-2">
        <div
          v-for="thread in chatStore.threads"
          :key="thread.threadId"
          class="group relative px-3 py-2 mx-2 mb-1 rounded-lg cursor-pointer transition-colors"
          :class="
            route.params.threadId === thread.threadId
              ? 'bg-blue-50 text-blue-700'
              : 'hover:bg-gray-50 text-gray-700'
          "
          @click="handleSelectThread(thread.threadId)"
        >
          <!-- 会话内容 -->
          <div class="flex items-start gap-2">
            <el-icon class="mt-0.5 flex-shrink-0" :size="16">
              <ChatDotRound />
            </el-icon>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">
                {{ thread.title || '未命名会话' }}
              </div>
              <div class="text-xs text-gray-400 mt-0.5">
                {{ formatTime(thread.updatedAt) }}
              </div>
            </div>
          </div>

          <!-- 删除按钮（hover 时显示） -->
          <el-button
            type="danger"
            :icon="Delete"
            size="small"
            text
            class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
            @click.stop="handleDeleteThread(thread.threadId)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Plus, ChatDotRound, Delete, Loading } from '@element-plus/icons-vue'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const route = useRoute()
const chatStore = useChatStore()

/**
 * 格式化时间
 */
function formatTime(time: string): string {
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    // 今天：显示时间
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  } else if (days === 1) {
    return '昨天'
  } else if (days < 7) {
    return `${days}天前`
  } else {
    // 超过7天：显示日期
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${month}-${day}`
  }
}

/**
 * 选择会话
 */
function handleSelectThread(threadId: string) {
  if (route.params.threadId === threadId) return

  // 跳转到对应的路由
  router.push(`/chat/${threadId}`)
}

/**
 * 创建新会话
 */
function handleNewChat() {
  // 如果当前在某个会话中，需要确认
  if (route.params.threadId) {
    ElMessageBox.confirm('确定要创建新会话吗？当前会话将被清空。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
      .then(() => {
        router.push('/chat')
        ElMessage.success('已创建新会话')
      })
      .catch(() => {
        // 用户取消
      })
  } else {
    // 已经在 /chat 路由，直接清空
    chatStore.createNewThread()
  }
}

/**
 * 删除会话
 */
async function handleDeleteThread(threadId: string) {
  try {
    await ElMessageBox.confirm('确定要删除此会话吗？删除后无法恢复。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    const success = await chatStore.removeThread(threadId)
    if (success) {
      ElMessage.success('已删除会话')
      // 如果删除的是当前会话，跳转到 /chat
      if (route.params.threadId === threadId) {
        router.push('/chat')
      }
    } else {
      ElMessage.error('删除失败')
    }
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
/* 滚动条样式 */
:deep(.el-scrollbar__wrap) {
  overflow-x: hidden;
}
</style>
