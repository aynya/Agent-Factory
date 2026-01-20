import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: () => import('../components/Layout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'chat' } },
        {
          path: 'chat',
          name: 'chat',
          component: () => import('../views/ChatView.vue'),
        },
        {
          path: 'chat/:threadId',
          name: 'chat-thread',
          component: () => import('../views/ChatView.vue'),
        },
        {
          path: 'agents',
          name: 'agents',
          component: () => import('../views/AgentsView.vue'),
        },
      ],
    },
  ],
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // 如果路由需要认证
  if (to.meta.requiresAuth) {
    // 如果有 accessToken 但 user 信息还未加载，先尝试获取用户信息
    if (authStore.accessToken && !authStore.user && !authStore.isInitializing) {
      await authStore.fetchUser()
    }

    // 检查是否已登录（只要有 accessToken 就认为已认证）
    if (authStore.isAuthenticated) {
      next()
    } else {
      // 未登录，跳转到登录页
      next({ name: 'login', query: { redirect: to.fullPath } })
    }
  } else {
    // 如果已登录，访问登录/注册页时跳转到聊天页
    // 如果有 accessToken 但 user 信息还未加载，先尝试获取用户信息
    if (authStore.accessToken && !authStore.user && !authStore.isInitializing) {
      await authStore.fetchUser()
    }

    if (authStore.isAuthenticated && (to.name === 'login' || to.name === 'register')) {
      next({ name: 'chat' })
    } else {
      next()
    }
  }
})

export default router
