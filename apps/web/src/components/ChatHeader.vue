<template>
  <header class="sticky top-0 z-50 bg-white border-b border-gray-200">
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

        <!-- 中间：标题（居中显示） -->
        <div class="flex-1 flex items-center justify-center absolute inset-0 pointer-events-none">
          <h2
            v-if="title"
            class="text-base font-medium text-gray-900 truncate max-w-md pointer-events-auto"
          >
            {{ title }}
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
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { ChatDotRound, SwitchButton, ArrowDown } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

interface Props {
  title?: string | null
}

withDefaults(defineProps<Props>(), {
  title: null,
})

const router = useRouter()
const authStore = useAuthStore()

const emit = defineEmits<{
  logout: []
}>()

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
    // 通知父组件退出登录（用于清理状态等）
    emit('logout')
    // 执行退出登录逻辑
    authStore.logout()
    // 跳转到登录页
    router.push('/login')
  } catch {
    // 用户取消
  }
}
</script>
