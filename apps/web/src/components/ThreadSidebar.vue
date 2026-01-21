<template>
  <div
    class="h-full flex flex-col bg-white border-r border-gray-200 transition-all duration-300"
    :class="isCollapsed ? 'w-16' : 'w-64'"
  >
    <!-- 头部：展开/收纳按钮和新会话按钮 -->
    <div
      class="header-section transition-all duration-300 p-3 flex flex-col items-center"
      :class="isCollapsed ? 'collapsed' : 'expanded'"
    >
      <div class="menu-wrapper w-full flex mb-4">
        <el-button
          :icon="isCollapsed ? Menu : Fold"
          text
          circle
          class="menu-btn !text-gray-600 hover:!bg-gray-100"
          @click="toggleCollapse"
        />
      </div>

      <div class="chat-btn-wrapper w-full flex justify-center">
        <button
          class="gemini-btn group"
          :class="{ 'is-collapsed': isCollapsed }"
          @click="handleNewChat"
        >
          <div class="icon-box">
            <el-icon :size="20">
              <Plus />
            </el-icon>
          </div>
          <span class="btn-text">新会话</span>
        </button>
      </div>

      <div class="agent-btn-wrapper w-full flex justify-center mt-2">
        <button
          class="gemini-btn agent-btn group"
          :class="{
            'is-collapsed': isCollapsed,
            'is-active': route.path === '/agents' || route.path === '/agents/me',
          }"
          @click="handleGoAgents"
        >
          <div class="icon-box">
            <el-icon :size="20">
              <Avatar />
            </el-icon>
          </div>
          <span class="btn-text">智能体</span>
        </button>
      </div>
    </div>

    <!-- 会话列表 -->
    <div
      v-if="!isCollapsed"
      class="flex-1 overflow-y-hidden hover:overflow-y-auto messages-container"
    >
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
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Plus, ChatDotRound, Delete, Loading, Menu, Fold, Avatar } from '@element-plus/icons-vue'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const route = useRoute()
const chatStore = useChatStore()

// 侧边栏收纳状态
const isCollapsed = ref(false)

/**
 * 切换侧边栏展开/收纳状态
 */
function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
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
 * 跳转到智能体页面
 */
function handleGoAgents() {
  router.push('/agents')
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
    // 若在 /agents 等其他页，先跳转到 /chat
    if (route.path !== '/chat') {
      router.push('/chat')
    }
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
.messages-container {
  /* 关键：预留滚动条空间，防止挤压 */
  scrollbar-gutter: stable;
  /* 默认隐藏溢出，防止非 hover 状态下产生滚动 */
  overflow-y: hidden;
}

.messages-container:hover {
  /* 仅在 hover 时允许滚动 */
  overflow-y: auto;
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

.header-section {
  --sidebar-collapsed-width: 64px;
  --btn-size: 40px;
  /* 收起时的圆直径 */
}

/* 菜单按钮固定大小 */
.menu-btn {
  width: var(--btn-size) !important;
  height: var(--btn-size) !important;
  font-size: 20px !important;
}

/* 仿 Gemini 按钮逻辑 */
.gemini-btn {
  display: flex;
  align-items: center;
  height: var(--btn-size);
  border: none;
  cursor: pointer;
  background-color: #c2e7ff;
  /* Gemini 蓝色 */
  color: #041e49;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  outline: none;
}

/* 展开状态：胶囊型 */
.expanded .gemini-btn {
  width: 100%;
  /* 充满父容器 */
  border-radius: 12px;
  padding: 0 12px;
  /* 初始左间距 */
}

/* 收起状态：圆形 */
.is-collapsed {
  width: var(--btn-size) !important;
  border-radius: 50% !important;
  padding: 0 !important;
  justify-content: center;
  /* 图标绝对居中 */
}

/* 图标盒子：固定宽度，确保位置不抖动 */
.icon-box {
  width: var(--btn-size);
  height: var(--btn-size);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 文字过渡动画 */
.btn-text {
  margin-left: 4px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 1;
  transition:
    opacity 0.2s ease,
    transform 0.3s ease;
}

.is-collapsed .btn-text {
  opacity: 0;
  width: 0;
  margin: 0;
  pointer-events: none;
}

.gemini-btn:hover {
  background-color: #b3d9f2;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 智能体按钮：区分色，激活态 */
.agent-btn {
  background-color: #e8dcff;
  color: #2d1f66;
}

.agent-btn:hover {
  background-color: #ddd0f5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.agent-btn.is-active {
  background-color: #c9b8f5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
</style>
