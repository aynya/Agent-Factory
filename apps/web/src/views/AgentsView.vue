<template>
  <div class="flex-1 flex overflow-y-auto">
    <main class="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
      <!-- 页面标题 -->
      <section class="page-title mb-6">
        <h1 class="page-title__main">
          {{ viewMode === 'all' ? '探索智能体' : '我的智能体' }}
        </h1>
        <p class="page-title__sub">
          {{ viewMode === 'all' ? '发现优质智能体，按标签或分类筛选' : '管理您创建的智能体' }}
        </p>
      </section>

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
            :class="[
              activeCategory === cat.id ? tagBadgeTheme(cat.id) : '',
              { 'is-active': activeCategory === cat.id },
            ]"
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
          class="flex flex-col justify-between p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
        >
          <div>
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
                <span v-if="a.tag" class="tag-badge" :class="tagBadgeTheme(a.tag)">{{
                  tagLabel(a.tag)
                }}</span>
                <h3 class="font-medium text-gray-900 truncate" :class="{ 'mt-1': a.tag }">
                  {{ a.name }}
                </h3>
              </div>
            </div>
            <p class="text-sm text-gray-500 mt-2 line-clamp-2 desc-fixed">
              {{ a.description || '暂无描述' }}
            </p>
          </div>
          <div class="mt-4 pt-4 border-t border-gray-100">
            <span class="text-xs text-gray-400">{{ formatUpdateTime(a.updatedAt) }}</span>
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

/** 标签对应的主题 class，用于卡片内 tag 徽标颜色 */
function tagBadgeTheme(tagId: string | null): string {
  if (!tagId) return ''
  const m: Record<string, string> = {
    assistant: 'tag-theme-assistant',
    expert: 'tag-theme-expert',
    creative: 'tag-theme-creative',
    companion: 'tag-theme-companion',
    explore: 'tag-theme-explore',
  }
  return m[tagId] ?? ''
}

/** 格式化为「更新于 yyyy-MM-dd」 */
function formatUpdateTime(iso: string): string {
  if (!iso) return ''
  const d = iso.slice(0, 10)
  return d ? `更新于 ${d}` : ''
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
.page-title__main {
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
  letter-spacing: -0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  line-height: 1.3;
}

.page-title__sub {
  margin-top: 0.375rem;
  font-size: 0.9375rem;
  color: #6b7280;
  line-height: 1.5;
}

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

/* 未命中下面「is-active + 主题」时用的 fallback */
.category-tag.is-active {
  background: #e8dcff;
  color: #2d1f66;
  border-color: #c9b8f5;
}

/* 选中时与卡片内 tag 同色：复用 tag-theme-* 的配色 */
.category-tag.is-active.tag-theme-assistant {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.category-tag.is-active.tag-theme-expert {
  background: #ede9fe;
  color: #5b21b6;
  border-color: #ddd6fe;
}

.category-tag.is-active.tag-theme-creative {
  background: #fce7f3;
  color: #be185d;
  border-color: #fbcfe8;
}

.category-tag.is-active.tag-theme-companion {
  background: #d1fae5;
  color: #047857;
  border-color: #a7f3d0;
}

.category-tag.is-active.tag-theme-explore {
  background: #fef3c7;
  color: #b45309;
  border-color: #fde68a;
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

/* 描述固定两行高度，避免 1 行/2 行切换时卡片高度变化 */
.desc-fixed {
  min-height: 2.5rem;
}

.tag-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1rem;
  font-weight: 500;
  border-radius: 9999px;
  background: #f3f4f6;
  color: #4b5563;
}

.tag-theme-assistant {
  background: #dbeafe;
  color: #1d4ed8;
}

.tag-theme-expert {
  background: #ede9fe;
  color: #5b21b6;
}

.tag-theme-creative {
  background: #fce7f3;
  color: #be185d;
}

.tag-theme-companion {
  background: #d1fae5;
  color: #047857;
}

.tag-theme-explore {
  background: #fef3c7;
  color: #b45309;
}
</style>
