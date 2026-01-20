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
            @click="activeCategory = activeCategory === cat.id ? null : cat.id"
          >
            {{ cat.label }}
          </button>
        </div>
        <!-- 第二组：显示所有 / 我的智能体 -->
        <div class="flex flex-row items-center gap-2 flex-shrink-0">
          <button
            class="end-option-btn"
            :class="{ 'is-active': viewMode === 'all' }"
            @click="viewMode = 'all'"
          >
            显示所有
          </button>
          <button
            class="end-option-btn"
            :class="{ 'is-active': viewMode === 'mine' }"
            @click="handleMyAgents"
          >
            我的智能体
          </button>
        </div>
      </div>

      <!-- 占位：后续可扩展智能体卡片列表等 -->
      <div class="flex-1 flex items-center justify-center text-gray-400 mt-12">
        <p class="text-sm">智能体创建与分享功能即将上线</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'

const setHeaderTitle = inject<(t: string | null) => void>('setHeaderTitle')

const agentCategories = [
  { id: 'assistant', label: '助手' },
  { id: 'expert', label: '专家' },
  { id: 'creative', label: '创作' },
  { id: 'companion', label: '伴侣' },
  { id: 'explore', label: '探索' },
]

const activeCategory = ref<string | null>(null)
/** 第二组：'all' 显示所有 agent，'mine' 我的智能体 */
const viewMode = ref<'all' | 'mine'>('all')

onMounted(() => {
  setHeaderTitle?.('智能体')
})

function handleMyAgents() {
  viewMode.value = 'mine'
  // 后续：加载「我的智能体」列表等
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
</style>
