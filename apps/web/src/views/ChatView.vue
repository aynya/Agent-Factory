<template>
  <div class="min-h-screen bg-gray-50">
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
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <el-card class="shadow-lg border-0">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-bold text-gray-900">对话</h2>
              <p class="text-sm text-gray-500 mt-1">与AI助手开始对话</p>
            </div>
          </div>
        </template>

        <div class="min-h-[500px] flex items-center justify-center">
          <div class="text-center py-12">
            <div
              class="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6"
            >
              <el-icon :size="40" class="text-blue-600">
                <ChatDotRound />
              </el-icon>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">对话功能开发中</h3>
            <p class="text-gray-500 max-w-md mx-auto">
              Phase 1 主要完成用户身份认证功能，对话交互功能将在后续阶段开发
            </p>
            <div class="mt-8 flex items-center justify-center space-x-6 text-sm text-gray-400">
              <div class="flex items-center space-x-2">
                <el-icon><Check /></el-icon>
                <span>用户认证</span>
              </div>
              <div class="flex items-center space-x-2">
                <el-icon><Check /></el-icon>
                <span>安全登录</span>
              </div>
              <div class="flex items-center space-x-2">
                <el-icon><Check /></el-icon>
                <span>状态管理</span>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { ChatDotRound, SwitchButton, Check } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    authStore.logout()
    router.push('/login')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
:deep(.el-card) {
  border-radius: 12px;
}

:deep(.el-card__header) {
  border-bottom: 1px solid #f0f0f0;
  padding: 1.5rem;
}
</style>
