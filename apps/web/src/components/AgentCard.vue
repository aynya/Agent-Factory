<template>
  <div
    class="agent-card group relative flex flex-col h-full bg-white rounded-[24px] p-6 border border-slate-100 overflow-hidden transition-all duration-300 cursor-pointer"
    @click="$emit('click', agent)"
  >
    <!-- 背景光晕效果 -->
    <div class="agent-card__glow"></div>

    <div class="flex items-start gap-4 mb-5 relative z-10">
      <div
        class="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-slate-50 border border-slate-100 shadow-sm flex items-center justify-center"
      >
        <img
          v-if="agent.avatar"
          :src="getAvatarUrl(agent.avatar)"
          :alt="agent.name"
          class="w-full h-full object-cover agent-card__avatar-img"
        />
        <el-icon v-else :size="28" class="text-slate-400">
          <Avatar />
        </el-icon>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2 mb-1">
          <span v-if="agent.tag" class="tag-badge" :class="tagBadgeTheme(agent.tag)">
            {{ tagLabel(agent.tag) }}
          </span>
          <span
            class="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50 ml-auto"
          >
            {{ formatVersion(agent.latestVersion) }}
          </span>
        </div>
        <h3 class="text-[17px] font-bold text-slate-900 truncate leading-tight agent-card__name">
          {{ agent.name }}
        </h3>
      </div>
    </div>

    <p
      class="text-slate-500 text-[13.5px] leading-relaxed mb-6 line-clamp-2 desc-fixed flex-grow relative z-10"
    >
      {{ agent.description || '暂无描述' }}
    </p>

    <div class="pt-5 border-t border-slate-50 flex items-center justify-between relative z-10">
      <span class="text-xs text-slate-400">{{ formatUpdateTime(agent.updatedAt) }}</span>
      <!-- 操作按钮：只有所有者才显示 -->
      <div v-if="isOwner" class="flex items-center gap-2" @click.stop>
        <!-- 删除按钮：hover 显示 -->
        <button
          @click="handleDelete"
          class="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all duration-300"
          aria-label="删除"
        >
          <el-icon :size="15">
            <DeleteFilled />
          </el-icon>
        </button>
        <!-- 配置按钮：常驻显示 -->
        <button
          @click="handleConfigure"
          class="h-8 w-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all duration-300"
          aria-label="配置"
        >
          <el-icon :size="15">
            <Tools />
          </el-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Avatar, DeleteFilled, Tools } from '@element-plus/icons-vue'
import type { AgentListItem } from '@monorepo/types'
import { getAvatarUrl } from '@/utils/avatar'
import { formatVersion } from '@/utils/version'

const props = defineProps<{
  agent: AgentListItem
  isOwner?: boolean
}>()

const emit = defineEmits<{
  click: [agent: AgentListItem]
  delete: [agent: AgentListItem]
  configure: [agent: AgentListItem]
}>()

function handleDelete(e: Event) {
  e.stopPropagation()
  emit('delete', props.agent)
}

function handleConfigure(e: Event) {
  e.stopPropagation()
  emit('configure', props.agent)
}

const agentCategories = [
  { id: 'assistant', label: '助手' },
  { id: 'expert', label: '专家' },
  { id: 'creative', label: '创作' },
  { id: 'companion', label: '伴侣' },
  { id: 'explore', label: '探索' },
]

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
</script>

<style scoped>
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

/* 卡片样式 */
.agent-card {
  box-shadow:
    0 2px 15px -3px rgba(0, 0, 0, 0.07),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.agent-card:hover {
  border-color: #c7d2fe;
  box-shadow:
    0 4px 20px -3px rgba(0, 0, 0, 0.1),
    0 8px 10px -2px rgba(0, 0, 0, 0.08);
}

/* 背景光晕效果 */
.agent-card__glow {
  position: absolute;
  top: -2.5rem;
  right: -2.5rem;
  width: 8rem;
  height: 8rem;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 50%;
  filter: blur(3rem);
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
}

.agent-card:hover .agent-card__glow {
  opacity: 1;
}

/* 头像 hover 放大 */
.agent-card__avatar-img {
  transition: transform 0.7s ease-out;
}

.agent-card:hover .agent-card__avatar-img {
  transform: scale(1.1);
}

/* 名称 hover 变蓝 */
.agent-card__name {
  transition: color 0.3s ease;
}

.agent-card:hover .agent-card__name {
  color: #4f46e5;
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
