<template>
  <!-- 有 agentId 时即渲染占位，避免挂载/数据到达时布局闪动；无数据时显示骨架 -->
  <aside
    class="w-96 border-l border-slate-100 bg-white flex flex-col shrink-0 overflow-hidden chat-agent-sidebar-shadow"
    :class="{ 'sidebar-content-enter': agent }"
  >
    <!-- 无数据：骨架占位 -->
    <template v-if="!agent">
      <div
        class="p-7 flex flex-col items-center border-b border-slate-50 bg-gradient-to-b from-slate-50/50 to-white shrink-0"
      >
        <div class="w-28 h-28 rounded-[40px] bg-slate-100 animate-pulse mb-6" />
        <div class="h-6 w-32 bg-slate-100 rounded animate-pulse mb-2" />
        <div class="flex gap-2">
          <div class="h-5 w-12 bg-slate-100 rounded-full animate-pulse" />
          <div class="h-5 w-12 bg-slate-100 rounded-full animate-pulse" />
        </div>
      </div>
      <div class="flex-1 p-8 space-y-4 min-h-0">
        <div class="h-5 w-24 bg-slate-100 rounded animate-pulse" />
        <div class="h-20 bg-slate-50 rounded-3xl animate-pulse" />
      </div>
    </template>
    <!-- 有数据：完整内容 -->
    <template v-else>
      <!-- 顶部智能体概览 -->
      <div
        class="p-7 flex flex-col items-center border-b border-slate-50 bg-gradient-to-b from-slate-50/50 to-white shrink-0"
      >
        <div class="relative mb-6">
          <div
            class="w-28 h-28 rounded-[40px] overflow-hidden border-4 border-white shadow-2xl bg-white p-1"
          >
            <img
              v-if="agent.avatar"
              :src="getAvatarUrl(agent.avatar)"
              :alt="agent.name"
              class="w-full h-full object-cover rounded-[34px]"
            />
            <div
              v-else
              class="w-full h-full rounded-[34px] bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center"
            >
              <el-icon :size="40" class="text-white">
                <Avatar />
              </el-icon>
            </div>
          </div>
          <div
            class="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center text-indigo-500"
          >
            <el-icon :size="18">
              <Key />
            </el-icon>
          </div>
        </div>

        <h2 class="text-xl font-black text-slate-900 text-center mb-2 tracking-tight">
          {{ agent.name }}
        </h2>
        <div class="flex items-center gap-2">
          <span
            v-if="agent.tag"
            class="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100"
          >
            {{ tagLabel(agent.tag) }}
          </span>
          <span
            class="px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100"
          >
            {{ formatVersion(agent.version) }}
          </span>
        </div>
      </div>

      <!-- 可滚动内容区 -->
      <div class="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar min-h-0">
        <!-- 核心描述 -->
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center"
            >
              <el-icon :size="12">
                <Document />
              </el-icon>
            </div>
            <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              核心描述
            </h4>
          </div>
          <div
            class="p-5 bg-slate-50/50 rounded-3xl border border-slate-100/50 relative max-h-40 overflow-y-auto sidebar-scrollbar"
          >
            <p class="text-[14px] text-slate-600 leading-relaxed font-medium">
              {{ agent.description || '暂无描述' }}
            </p>
          </div>
        </div>

        <!-- 用户创建的智能体：展示系统提示词（与核心描述同样式，更高高度限制） -->
        <div v-if="isOwner && agent.systemPrompt != null" class="space-y-4">
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center"
            >
              <el-icon :size="12">
                <Monitor />
              </el-icon>
            </div>
            <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              系统提示词 (Prompt)
            </h4>
          </div>
          <div
            class="p-5 bg-slate-50/50 rounded-3xl border border-slate-100/50 text-[14px] text-slate-600 leading-relaxed font-medium whitespace-pre-wrap max-h-72 overflow-y-auto sidebar-scrollbar"
          >
            {{ agent.systemPrompt }}
          </div>
        </div>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { Key, Document, Monitor, Avatar } from '@element-plus/icons-vue'
import { getAvatarUrl } from '@/utils/avatar'
import { formatVersion } from '@/utils/version'

/** 侧边栏展示用的智能体数据（只读），由父组件传入 */
export interface ChatAgentSidebarAgent {
  name: string
  description: string | null
  avatar: string | null
  tag: string | null
  version: number
  systemPrompt?: string | null
}

withDefaults(
  defineProps<{
    agent: ChatAgentSidebarAgent | null
    isOwner?: boolean
  }>(),
  { isOwner: false }
)

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
</script>

<style scoped>
.chat-agent-sidebar-shadow {
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.02);
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* 核心描述 / 系统提示词区域滚动条：细窄样式 */
.sidebar-scrollbar::-webkit-scrollbar {
  width: 5px;
}

.sidebar-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 仅对内容做淡入，避免整块插入导致布局闪动 */
@keyframes sidebar-content-enter {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.sidebar-content-enter {
  animation: sidebar-content-enter 0.25s ease-out;
}
</style>
