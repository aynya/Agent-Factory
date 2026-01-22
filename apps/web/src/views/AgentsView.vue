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
        v-else-if="agentsStore.agents.length === 0 && viewMode === 'all'"
        class="flex-1 flex items-center justify-center text-gray-400 mt-12"
      >
        <p class="text-sm">暂无公开智能体</p>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
        <!-- 添加智能体卡片（仅在我的智能体时显示） -->
        <div
          v-if="viewMode === 'mine'"
          class="create-agent-card group relative flex flex-col items-center justify-center text-center cursor-pointer h-full bg-slate-50/50 rounded-[24px] p-6 border-2 border-dashed border-slate-200 transition-all duration-300"
          @click="handleCreateAgent"
        >
          <div
            class="w-16 h-16 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-4 transition-all duration-500 create-agent-card__icon-box"
          >
            <el-icon :size="20" class="text-slate-400 create-agent-card__icon">
              <Plus />
            </el-icon>
          </div>
          <h3 class="text-[17px] font-bold text-slate-800 mb-2">创建新智能体</h3>
          <p class="text-slate-400 text-sm max-w-[180px]">
            定制属于你自己的 AI 助手，开启智能办公新体验。
          </p>
        </div>

        <AgentCard
          v-for="a in agentsStore.agents"
          :key="a.agentId"
          :agent="a"
          @click="openAgentDetail"
        />
      </div>
    </main>

    <!-- 智能体详情弹窗 -->
    <AgentDetailModal
      :agent="selectedAgent"
      @close="closeAgentDetail"
      @start-using="handleStartUsing"
      @share="handleShare"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading, Plus } from '@element-plus/icons-vue'
import type { AgentListItem } from '@monorepo/types'
import { useAgentsStore } from '@/stores/agents'
import AgentCard from '@/components/AgentCard.vue'
import AgentDetailModal from '@/components/AgentDetailModal.vue'

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

/** 选中的智能体（用于详情弹窗） */
const selectedAgent = ref<AgentListItem | null>(null)

onMounted(() => {
  setHeaderTitle?.('智能体')
})

onUnmounted(() => {
  // 确保关闭弹窗时恢复滚动
  document.body.style.overflow = ''
})

watch(
  [() => route.path, () => route.query.tag],
  () => {
    agentsStore.fetchAgents(viewMode.value, activeCategory.value ?? undefined)
  },
  { immediate: true }
)

/** 标签对应的主题 class，用于分类标签按钮 */
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

/** 创建新智能体 */
function handleCreateAgent() {
  router.push('/agents/me/create')
}

/** 打开智能体详情弹窗 */
function openAgentDetail(agent: AgentListItem) {
  selectedAgent.value = agent
}

/** 关闭智能体详情弹窗 */
function closeAgentDetail() {
  selectedAgent.value = null
}

/** 开始使用智能体 */
function handleStartUsing(agent: AgentListItem) {
  // TODO: 后续对接跳转到聊天页面或工作台
  console.log('开始使用:', agent.agentId)
  closeAgentDetail()
}

/** 分享智能体 */
function handleShare(agent: AgentListItem) {
  // TODO: 后续对接分享功能
  console.log('分享:', agent.agentId)
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

/* 创建智能体卡片样式 */
.create-agent-card:hover {
  border-color: #818cf8;
  background: white;
}

.create-agent-card__icon-box {
  transition:
    transform 0.5s ease,
    background-color 0.5s ease;
}

.create-agent-card:hover .create-agent-card__icon-box {
  transform: scale(1.1);
  background-color: #4f46e5;
}

.create-agent-card__icon {
  color: #94a3b8;
  transition: color 0.5s ease;
}

.create-agent-card:hover .create-agent-card__icon {
  color: white;
}
</style>
