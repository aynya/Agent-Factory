<template>
  <div class="min-h-screen flex bg-white">
    <!-- 左侧装饰区域 -->
    <div
      class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 relative overflow-hidden justify-center"
    >
      <div
        class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJIMjB2LTJoMTZ6bTAtNEgydjJoMzRWMzB6bTAtNEgydjJoMzRWMjZ6bTAtNEgydjJoMzRWMjJ6bTAtNEgydjJoMzRWMTh6bTAtNEgydjJoMzRWMTR6bTAtNEgydjJoMzRWMTB6bTAtNEgydjJoMzRWNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-10"
      ></div>
      <div class="relative z-10 flex flex-col justify-center items-center text-white p-12">
        <div class="mb-8">
          <div class="flex items-center space-x-2 mb-4">
            <div
              class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm"
            >
              <el-icon :size="28">
                <ChatDotRound />
              </el-icon>
            </div>
            <h1 class="text-3xl font-bold">AI Agent Platform</h1>
          </div>
          <p class="text-blue-100 text-lg max-w-md">加入我们，开启智能对话之旅</p>
        </div>
        <div class="mt-12 space-y-4 text-blue-100">
          <div class="flex items-center space-x-3">
            <el-icon :size="20"><Check /></el-icon>
            <span>快速注册，立即使用</span>
          </div>
          <div class="flex items-center space-x-3">
            <el-icon :size="20"><Check /></el-icon>
            <span>免费体验所有功能</span>
          </div>
          <div class="flex items-center space-x-3">
            <el-icon :size="20"><Check /></el-icon>
            <span>安全加密，保护隐私</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧注册表单区域 -->
    <div class="flex-1 flex items-center justify-center p-8 bg-gray-50">
      <div class="w-full max-w-md">
        <!-- Logo (移动端显示) -->
        <div class="lg:hidden mb-8 text-center">
          <div class="inline-flex items-center space-x-2 mb-4">
            <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <el-icon :size="24" class="text-white">
                <ChatDotRound />
              </el-icon>
            </div>
            <h1 class="text-2xl font-bold text-gray-800">AI Agent</h1>
          </div>
        </div>

        <el-card class="border-0 shadow-xl" :body-style="{ padding: '2.5rem' }">
          <div class="mb-8">
            <h2 class="text-3xl font-bold text-gray-900 mb-2">注册</h2>
            <p class="text-gray-500">创建新账号，开始您的AI之旅</p>
          </div>

          <el-form
            ref="registerFormRef"
            :model="registerForm"
            :rules="registerRules"
            label-width="0"
            @submit.prevent="handleRegister"
          >
            <el-form-item prop="username" class="mb-5">
              <el-input
                v-model="registerForm.username"
                placeholder="请输入用户名"
                size="large"
                :prefix-icon="User"
                clearable
                class="h-12"
              />
            </el-form-item>

            <el-form-item prop="password" class="mb-5">
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="请输入密码（至少6个字符）"
                size="large"
                :prefix-icon="Lock"
                show-password
                clearable
                class="h-12"
              />
            </el-form-item>

            <el-form-item prop="confirmPassword" class="mb-6">
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                placeholder="请再次输入密码"
                size="large"
                :prefix-icon="Lock"
                show-password
                clearable
                class="h-12"
                @keyup.enter="handleRegister"
              />
            </el-form-item>

            <el-form-item class="mb-6">
              <el-button
                type="primary"
                size="large"
                class="w-full h-12 text-base font-medium"
                :loading="loading"
                @click="handleRegister"
              >
                注册
              </el-button>
            </el-form-item>

            <div class="text-center">
              <span class="text-gray-500 text-sm">已有账号？</span>
              <router-link
                to="/login"
                class="text-blue-600 hover:text-blue-700 font-medium text-sm ml-1 transition-colors"
              >
                立即登录
              </router-link>
            </div>
          </el-form>
        </el-card>

        <div class="mt-6 text-center text-xs text-gray-400">
          © 2024 AI Agent Platform. All rights reserved.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules, type RuleItem } from 'element-plus'
import { User, Lock, ChatDotRound, Check } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const registerFormRef = ref<FormInstance>()
const loading = ref(false)

const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: '',
})

const validateConfirmPassword = (
  _rule: RuleItem,
  value: string,
  callback: (error?: Error) => void,
) => {
  if (value !== registerForm.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const registerRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 50, message: '用户名长度在 2 到 50 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少 6 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
}

const handleRegister = async () => {
  if (!registerFormRef.value) return

  await registerFormRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true
    try {
      const result = await authStore.registerUser(registerForm.username, registerForm.password)

      if (result.success) {
        ElMessage.success('注册成功，请登录')
        router.push('/login')
      } else {
        ElMessage.error(result.message || '注册失败')
      }
    } catch (error) {
      ElMessage.error('注册失败，请稍后重试')
      console.error('Register error:', error)
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
:deep(.el-card) {
  border-radius: 12px;
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

:deep(.el-input.is-focus .el-input__wrapper) {
  box-shadow: 0 0 0 1px #409eff inset;
}

:deep(.el-button--primary) {
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

:deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #5568d3 0%, #653a8f 100%);
}
</style>
