import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@monorepo/types'
import { login, register, getCurrentUser, logout as apiLogout } from '../utils/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('access_token'))
  const isInitializing = ref(false)

  // 只要有 accessToken 就认为已认证（user 信息可以异步加载）
  const isAuthenticated = computed(() => !!accessToken.value)

  /**
   * 登录
   */
  async function loginUser(username: string, password: string) {
    const response = await login({ username, password })
    if (response.code === 0 && response.data) {
      accessToken.value = response.data.access_token
      user.value = response.data.user
      localStorage.setItem('access_token', response.data.access_token)
      return { success: true }
    }
    return { success: false, message: response.message }
  }

  /**
   * 注册
   */
  async function registerUser(username: string, password: string, avatar?: string) {
    const response = await register({ username, password, avatar })
    if (response.code === 0) {
      return { success: true }
    }
    return { success: false, message: response.message }
  }

  /**
   * 获取当前用户信息
   */
  async function fetchUser() {
    if (!accessToken.value) {
      return
    }
    // 如果正在初始化，避免重复请求
    if (isInitializing.value) {
      return
    }
    isInitializing.value = true
    try {
      const response = await getCurrentUser()
      if (response.code === 0 && response.data) {
        user.value = response.data
      } else {
        // 如果获取用户信息失败，清除 token
        accessToken.value = null
        user.value = null
        localStorage.removeItem('access_token')
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      // 如果获取用户信息失败，清除 token
      accessToken.value = null
      user.value = null
      localStorage.removeItem('access_token')
    } finally {
      isInitializing.value = false
    }
  }

  /**
   * 退出登录
   */
  function logout() {
    accessToken.value = null
    user.value = null
    localStorage.removeItem('access_token')
    apiLogout()
  }

  /**
   * 初始化：如果有 token，尝试获取用户信息
   */
  async function init() {
    if (accessToken.value) {
      await fetchUser()
    }
  }

  return {
    user,
    accessToken,
    isAuthenticated,
    isInitializing,
    loginUser,
    registerUser,
    fetchUser,
    logout,
    init,
  }
})
