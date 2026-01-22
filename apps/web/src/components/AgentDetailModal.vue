<template>
  <Teleport to="body">
    <div
      v-if="agent"
      class="agent-detail-modal fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
      @click.self="handleClose"
    >
      <!-- 背景遮罩 -->
      <div
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
        @click="handleClose"
      ></div>

      <!-- 弹窗容器 -->
      <div
        class="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden agent-detail-modal__container"
      >
        <!-- 关闭按钮 -->
        <button
          class="absolute top-6 right-6 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-90"
          @click="handleClose"
        >
          <el-icon :size="18">
            <Close />
          </el-icon>
        </button>

        <!-- 弹窗内容 -->
        <div class="flex flex-col">
          <!-- 顶部 Hero 区域 -->
          <div class="p-8 pb-4 flex flex-col md:flex-row gap-6 items-start">
            <div
              class="w-24 h-24 md:w-32 md:h-32 rounded-3xl overflow-hidden shadow-lg border-4 border-white bg-slate-50 shrink-0 flex items-center justify-center"
            >
              <img
                v-if="agent.avatar"
                :src="getAvatarUrl(agent.avatar)"
                :alt="agent.name"
                class="w-full h-full object-cover"
              />
              <el-icon v-else :size="48" class="text-slate-400">
                <Avatar />
              </el-icon>
            </div>
            <div class="flex-1 pt-2">
              <div class="flex items-center gap-2 mb-2">
                <span v-if="agent.tag" class="modal-tag-badge" :class="tagBadgeTheme(agent.tag)">
                  {{ tagLabel(agent.tag).toUpperCase() }}
                </span>
                <span
                  class="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  在线
                </span>
              </div>
              <h2 class="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
                {{ agent.name }}
              </h2>
              <div class="flex items-center gap-4 text-slate-400 text-sm">
                <span class="flex items-center gap-1.5 font-medium">
                  <el-icon :size="14">
                    <Avatar />
                  </el-icon>
                  系统智能体
                </span>
                <span class="flex items-center gap-1.5 font-medium">
                  <el-icon :size="14">
                    <Calendar />
                  </el-icon>
                  {{ formatUpdateTime(agent.updatedAt).replace('更新于 ', '') }}
                </span>
              </div>
            </div>
          </div>

          <!-- 内容区域 -->
          <div class="px-8 pb-8">
            <div class="bg-slate-50/50 rounded-2xl p-6 mb-8">
              <h3 class="text-sm font-bold text-slate-800 mb-3 uppercase tracking-widest">简介</h3>
              <p class="text-slate-600 leading-relaxed text-[15px]">
                {{ agent.description || '暂无描述' }}
              </p>
            </div>

            <!-- 统计信息行 -->
            <div class="grid grid-cols-3 gap-4 mb-8">
              <div class="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm text-center">
                <div class="text-slate-400 text-[10px] font-bold uppercase mb-1">状态</div>
                <div class="text-xl font-bold text-slate-900">
                  {{ agent.status === 'public' ? '公开' : '私有' }}
                </div>
              </div>
              <div class="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm text-center">
                <div class="text-slate-400 text-[10px] font-bold uppercase mb-1">创建时间</div>
                <div class="text-xl font-bold text-slate-900">
                  {{ formatUpdateTime(agent.createdAt).replace('更新于 ', '') }}
                </div>
              </div>
              <div class="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm text-center">
                <div class="text-slate-400 text-[10px] font-bold uppercase mb-1">更新时间</div>
                <div class="text-xl font-bold text-slate-900">
                  {{ formatUpdateTime(agent.updatedAt).replace('更新于 ', '') }}
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-2xl font-bold text-base shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 group"
                @click="handleStartUsing"
              >
                开始使用
                <el-icon class="text-sm group-hover:translate-x-1 transition-transform">
                  <Promotion />
                </el-icon>
              </button>
              <button
                class="px-8 h-14 rounded-2xl border border-slate-200 text-slate-600 font-bold text-base hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                @click="handleShare"
              >
                <el-icon>
                  <Share />
                </el-icon>
                分享
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { Avatar, Close, Calendar, Promotion, Share } from '@element-plus/icons-vue'
import type { AgentListItem } from '@monorepo/types'
import { getAvatarUrl } from '@/utils/avatar'

const props = defineProps<{
  agent: AgentListItem | null
}>()

const emit = defineEmits<{
  close: []
  startUsing: [agent: AgentListItem]
  share: [agent: AgentListItem]
}>()

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

/** 标签对应的主题 class，用于弹窗内 tag 徽标颜色 */
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

function handleClose() {
  emit('close')
}

function handleStartUsing() {
  if (props.agent) {
    emit('startUsing', props.agent)
  }
}

function handleShare() {
  if (props.agent) {
    emit('share', props.agent)
  }
}

// 监听 agent 变化，控制 body 滚动
watch(
  () => props.agent,
  newVal => {
    if (newVal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  // 确保关闭弹窗时恢复滚动
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* 弹窗样式 */
.agent-detail-modal__container {
  animation: modalFadeIn 0.3s ease-out;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-20px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 弹窗内标签样式 */
.modal-tag-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  font-size: 0.6875rem;
  line-height: 1rem;
  font-weight: 700;
  border-radius: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid transparent;
}

.modal-tag-badge.tag-theme-assistant {
  background: #e0f2fe;
  color: #0c4a6e;
  border-color: #bae6fd;
}

.modal-tag-badge.tag-theme-expert {
  background: #eef2ff;
  color: #312e81;
  border-color: #c7d2fe;
}

.modal-tag-badge.tag-theme-creative {
  background: #fef3c7;
  color: #78350f;
  border-color: #fde68a;
}

.modal-tag-badge.tag-theme-companion {
  background: #fff1f2;
  color: #881337;
  border-color: #fecdd3;
}

.modal-tag-badge.tag-theme-explore {
  background: #ecfdf5;
  color: #064e3b;
  border-color: #a7f3d0;
}
</style>
