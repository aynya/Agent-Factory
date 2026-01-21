import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { AgentListItem } from '@monorepo/types'
import { getPublicAgents, getMyAgents } from '../utils/api'

export type AgentViewMode = 'all' | 'mine'

const MIN_LOADING_MS = 200

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref<AgentListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** 每次发起请求自增，用于丢弃被「后发请求」覆盖的旧结果，只应用最新一次的结果并正确维护 loading */
  let fetchId = 0

  /**
   * 拉取智能体列表
   * - 通过 Promise.all 保证至少 200ms 的 loading，避免快请求时的闪烁
   * - 切换时并发多次请求：只应用最新一次的结果，并在其完成时把 loading 置为 false
   *
   * @param viewMode 'all' 公开列表，'mine' 我的智能体
   * @param tag 可选，按标签过滤
   */
  async function fetchAgents(viewMode: AgentViewMode, tag?: string) {
    const myId = ++fetchId
    loading.value = true
    error.value = null

    const fetchPromise = (viewMode === 'mine' ? getMyAgents(tag) : getPublicAgents(tag))
      .then(r => r)
      .catch((e: unknown) => ({ __fetchError: e }) as const)

    try {
      const [res] = await Promise.all([fetchPromise, sleep(MIN_LOADING_MS)])

      if (myId !== fetchId) return

      if (res && '__fetchError' in res) {
        agents.value = []
        const err = res.__fetchError
        error.value = err instanceof Error ? err.message : '网络错误'
      } else if (res && res.code === 0 && res.data) {
        agents.value = res.data
        error.value = null
      } else {
        agents.value = []
        error.value = res && 'message' in res && res.message ? res.message : '获取列表失败'
      }
    } finally {
      if (myId === fetchId) loading.value = false
    }
  }

  /**
   * 清空列表与错误（可选，离开页或切换前调用）
   */
  function clearAgents() {
    agents.value = []
    error.value = null
  }

  return {
    agents,
    loading,
    error,
    fetchAgents,
    clearAgents,
  }
})
