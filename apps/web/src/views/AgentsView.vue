<template>
  <div class="flex-1 flex overflow-y-auto">
    <main class="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
      <!-- 分类标签行：前五个为一组在 start，后两个为一组在 end -->
      <div
        class="flex flex-row flex-wrap items-center justify-between gap-4 py-4 border-b border-gray-200"
      >
        <!-- 第一组：五类分类 -->
        <div class="flex flex-row items-center gap-2 flex-wrap justify-start">
          <button
            v-for="cat in agentCategories"
            :key="cat.id"
            class="category-tag"
            :class="{ 'is-active': activeCategory === cat.id }"
            @click="handleTagClick(cat.id)"
          >
            {{ cat.label }}
          </button>
        </div>
        <!-- 第二组：显示所有 / 我的智能体 -->
        <div class="flex flex-row items-center gap-2 flex-shrink-0">
          <button
            class="end-option-btn"
            :class="{ 'is-active': viewMode === 'all' }"
            @click="handleViewAll"
          >
            显示所有
          </button>
          <button
            class="end-option-btn"
            :class="{ 'is-active': viewMode === 'mine' }"
            @click="handleViewMine"
          >
            我的智能体
          </button>
        </div>
      </div>

      <!-- 列表区域 -->
      <div v-if="agentsStore.loading" class="flex-1 flex items-center justify-center mt-12">
        <div class="flex flex-col items-center gap-2 text-gray-400">
          <el-icon class="animate-spin" :size="28">
            <Loading />
          </el-icon>
          <p class="text-sm">加载中...</p>
        </div>
      </div>
      <div v-else-if="agentsStore.error" class="flex-1 flex items-center justify-center mt-12">
        <p class="text-sm text-red-500">{{ agentsStore.error }}</p>
      </div>
      <div
        v-else-if="agentsStore.agents.length === 0"
        class="flex-1 flex items-center justify-center text-gray-400 mt-12"
      >
        <p class="text-sm">{{ viewMode === 'mine' ? '暂无我的智能体' : '暂无公开智能体' }}</p>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div
          v-for="a in agentsStore.agents"
          :key="a.agentId"
          class="agent-card rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div class="flex items-start gap-3">
            <div
              class="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center"
            >
              <img
                v-if="a.avatar"
                :src="a.avatar"
                :alt="a.name"
                class="w-full h-full object-cover"
              />
              <el-icon v-else :size="24" class="text-gray-400">
                <Avatar />
              </el-icon>
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-medium text-gray-900 truncate">{{ a.name }}</div>
              <p class="text-sm text-gray-500 mt-0.5 line-clamp-2">
                {{ a.description || '暂无描述' }}
              </p>
              <div class="flex flex-wrap gap-1.5 mt-2">
                <span v-if="a.tag" class="tag-badge">{{ tagLabel(a.tag) }}</span>
                <span
                  class="status-badge"
                  :class="a.status === 'public' ? 'status-public' : 'status-private'"
                >
                  {{ a.status === 'public' ? '公开' : '仅自己' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading, Avatar } from '@element-plus/icons-vue'
import { useAgentsStore } from '@/stores/agents'

const setHeaderTitle = inject<(t: string | null) => void>('setHeaderTitle')
const route = useRoute()
const router = useRouter()
const agentsStore = useAgentsStore()

const agentCategories = [
  { id: 'assistant', label: '助手' },
  { id: 'expert', label: '专家' },
  { id: 'creative', label: '创作' },
  { id: 'companion', label: '伴侣' },
  { id: 'explore', label: '探索' },
]

/** 从路由 path 推导：/agents/me => mine，/agents => all */
const viewMode = computed<'all' | 'mine'>(() => (route.path.endsWith('/me') ? 'mine' : 'all'))

/** 从路由 query.tag 同步，与标签选择一一对应 */
const activeCategory = computed<string | null>(() => (route.query.tag as string) || null)

onMounted(() => {
  setHeaderTitle?.('智能体')
})

watch(
  [() => route.path, () => route.query.tag],
  () => {
    agentsStore.fetchAgents(viewMode.value, activeCategory.value ?? undefined)
  },
  { immediate: true }
)

function tagLabel(tagId: string): string {
  return agentCategories.find(c => c.id === tagId)?.label ?? tagId
}

/** 切换标签：选中则设 ?tag=xxx，再点同一标签则取消 tag */
function handleTagClick(catId: string) {
  const newTag = route.query.tag === catId ? undefined : catId
  router.replace({ path: route.path, query: newTag ? { tag: newTag } : {} })
}

/** 显示所有：/agents[?tag=xxx] */
function handleViewAll() {
  router.replace({
    path: '/agents',
    query: route.query.tag ? { tag: route.query.tag } : {},
  })
}

/** 我的智能体：/agents/me[?tag=xxx] */
function handleViewMine() {
  router.replace({
    path: '/agents/me',
    query: route.query.tag ? { tag: route.query.tag } : {},
  })
}
</script>

<style scoped>
.category-tag {
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s;
}

.category-tag:hover {
  background: #e5e7eb;
  color: #374151;
  border-color: #d1d5db;
}

.category-tag.is-active {
  background: #e8dcff;
  color: #2d1f66;
  border-color: #c9b8f5;
}

/* 第二组 end 处两个选项的统一样式 */
.end-option-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s;
}

.end-option-btn:hover {
  background: #e5e7eb;
  color: #374151;
  border-color: #d1d5db;
}

.end-option-btn.is-active {
  background: #eef2ff;
  color: #4f46e5;
  border-color: #c7d2fe;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tag-badge {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: #f3f4f6;
  color: #4b5563;
}

.status-badge {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

.status-public {
  background: #d1fae5;
  color: #065f46;
}

.status-private {
  background: #e5e7eb;
  color: #4b5563;
}
</style>
