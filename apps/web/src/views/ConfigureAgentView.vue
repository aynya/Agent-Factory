<template>
  <div v-if="!loading" class="flex-1 flex flex-col overflow-hidden bg-[#F1F5F9]/30">
    <!-- 工具栏 -->
    <div
      class="h-14 border-b border-slate-200/60 px-6 flex items-center justify-between bg-white shrink-0"
    >
      <div class="flex items-center gap-4">
        <button
          @click="handleBack"
          class="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center"
        >
          <el-icon :size="12">
            <ArrowLeft />
          </el-icon>
        </button>
        <div class="flex flex-col">
          <div class="flex items-center gap-2 mb-0.5">
            <span
              class="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none"
            >
              正在配置
            </span>
            <span
              class="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-1.5 rounded border border-indigo-100"
            >
              {{ formatVersion(version) }}
            </span>
          </div>
          <span class="text-sm font-black text-slate-800 leading-none">{{ name || '未命名' }}</span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="hidden md:flex items-center gap-2 mr-2">
          <span class="text-[12px] text-slate-400 font-bold uppercase tracking-tighter">
            发布后将更新为
          </span>
          <span class="text-[12px] text-emerald-600 font-black">{{
            formatVersion(nextVersion)
          }}</span>
        </div>
        <button
          @click="handleSubmit"
          :disabled="submitting || !description.trim()"
          class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
        >
          发布修改
          <el-icon v-if="!submitting">
            <Check />
          </el-icon>
          <el-icon v-else class="animate-spin">
            <Loading />
          </el-icon>
        </button>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- 左侧配置面板 -->
      <div
        class="w-[420px] border-r border-slate-200/60 flex flex-col bg-slate-50/40 overflow-y-auto"
      >
        <div class="p-6 space-y-6">
          <!-- 头像展示区域（只读） -->
          <div
            class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center"
          >
            <div class="relative mb-4">
              <div
                class="w-24 h-24 rounded-[32px] overflow-hidden border-4 border-slate-50 shadow-xl"
              >
                <img
                  v-if="avatar"
                  :src="getAvatarUrl(avatar)"
                  alt="Avatar"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center"
                >
                  <el-icon :size="48" class="text-white">
                    <Avatar />
                  </el-icon>
                </div>
              </div>
            </div>
            <h4 class="font-black text-slate-800">智能体形象</h4>
            <p class="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">
              仅展示，不可修改
            </p>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-6 pb-20">
            <!-- 模块：基本信息 -->
            <section class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div class="flex items-center gap-4 mb-4">
                <div
                  class="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"
                >
                  <el-icon :size="14">
                    <User />
                  </el-icon>
                </div>
                <h4 class="text-sm font-bold text-slate-800">基本信息</h4>
              </div>

              <div class="space-y-4">
                <!-- 智能体名称（只读展示） -->
                <div class="space-y-1.5">
                  <label
                    class="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1"
                  >
                    智能体名称
                  </label>
                  <div
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-semibold text-sm cursor-default"
                  >
                    {{ name || '未命名' }}
                  </div>
                </div>

                <div class="space-y-1.5">
                  <label
                    class="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1"
                  >
                    简短描述
                  </label>
                  <div class="relative">
                    <textarea
                      v-model="description"
                      maxlength="60"
                      rows="2"
                      placeholder="一句话介绍它的核心能力..."
                      class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-200 transition-all outline-none resize-none text-sm leading-relaxed"
                      required
                    />
                    <span
                      :class="[
                        'absolute right-4 bottom-4 text-[9px] font-bold',
                        description.length === 60 ? 'text-rose-500' : 'text-slate-300',
                      ]"
                    >
                      {{ description.length }}/60
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <!-- 模块：系统提示词 -->
            <section class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-4">
                  <div
                    class="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600"
                  >
                    <el-icon :size="14">
                      <Document />
                    </el-icon>
                  </div>
                  <h4 class="text-sm font-bold text-slate-800">系统提示词</h4>
                </div>
                <span
                  class="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full"
                >
                  核心能力
                </span>
              </div>

              <div class="space-y-1.5">
                <textarea
                  v-model="systemPrompt"
                  rows="10"
                  placeholder="定义智能体的身份、专业知识背景、语言风格以及必须遵守的约束条件..."
                  class="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-200 transition-all outline-none resize-none leading-relaxed text-sm"
                />
                <p class="text-[10px] text-slate-400 flex items-center gap-1.5 ml-1">
                  <el-icon :size="10">
                    <InfoFilled />
                  </el-icon>
                  越清晰的指令，输出结果越符合预期。
                </p>
              </div>
            </section>

            <!-- 模块：分类与标签（只读展示） -->
            <section class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div class="flex items-center gap-4 mb-4">
                <div
                  class="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center text-sky-600"
                >
                  <el-icon :size="14">
                    <PriceTag />
                  </el-icon>
                </div>
                <h4 class="text-sm font-bold text-slate-800">分类与标签</h4>
              </div>

              <div class="flex flex-wrap gap-2">
                <span
                  class="inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 cursor-default"
                >
                  {{ tagLabel }}
                </span>
              </div>
            </section>
          </form>
        </div>
      </div>

      <!-- 右侧调试面板 -->
      <div class="flex-1 flex flex-col bg-[#F8FAFC] min-w-0">
        <div class="flex-1 flex flex-col overflow-hidden">
          <div
            ref="debugMessagesContainer"
            @scroll="handleScroll"
            class="flex-1 p-6 space-y-4 overflow-y-auto debug-messages-container"
          >
            <!-- 加载调试会话中 -->
            <div
              v-if="debugThreadLoading"
              class="flex flex-col items-center justify-center h-full text-slate-400"
            >
              <el-icon class="animate-spin" :size="28">
                <Loading />
              </el-icon>
              <p class="text-sm mt-2">正在获取调试会话...</p>
            </div>

            <!-- 无调试会话（获取失败或未就绪） -->
            <div
              v-else-if="!debugThreadId"
              class="flex flex-col items-center justify-center h-full text-slate-400"
            >
              <el-icon :size="32">
                <Tools />
              </el-icon>
              <p class="text-sm mt-2">无法加载调试会话</p>
            </div>

            <!-- 消息列表 -->
            <template v-else>
              <div class="flex justify-center mb-4">
                <div
                  class="bg-white border border-slate-100 px-4 py-1.5 rounded-full shadow-sm text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                >
                  调试对话环境（基于当前版本）
                </div>
              </div>
              <main class="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                <ChatMessageItem v-for="msg in chatStore.messages" :key="msg.id" :message="msg" />
                <div class="w-[100%] h-8"></div>
              </main>
            </template>
          </div>
        </div>

        <!-- 调试输入框（与 ChatView 输入区一致） -->
        <div
          v-if="debugThreadId && !debugThreadLoading"
          class="px-4 pb-8 pt-2 bg-transparent shrink-0 relative"
        >
          <ChatInput
            v-model="debugInput"
            placeholder="输入消息开始调试..."
            :is-generating="chatStore.isGenerating"
            :show-scroll-button="showScrollButton"
            :suggestions="suggestions"
            gradient-color="#F8FAFC"
            @send="handleSendDebug"
            @interrupt="chatStore.interruptGeneration()"
            @scroll-to-bottom="scrollToBottom(false)"
            @suggestion-click="useSuggestion"
          />
        </div>
      </div>
    </div>
  </div>
  <!-- 加载状态 -->
  <div v-else class="flex-1 flex items-center justify-center bg-[#F1F5F9]/30">
    <div class="flex flex-col items-center gap-2 text-slate-400">
      <el-icon class="animate-spin" :size="28">
        <Loading />
      </el-icon>
      <p class="text-sm">加载中...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Check,
  Loading,
  Avatar,
  User,
  Document,
  InfoFilled,
  PriceTag,
  Tools,
} from '@element-plus/icons-vue'
import type { UpdateAgentRequest } from '@monorepo/types'
import { getAgentDetail, updateAgent, getAgentDebugThread } from '@/utils/api'
import { useChatStore } from '@/stores/chat'
import { getAvatarUrl } from '@/utils/avatar'
import { formatVersion } from '@/utils/version'
import ChatMessageItem from '@/components/ChatMessageItem.vue'
import ChatInput from '@/components/ChatInput.vue'
import { useAutoScroll } from '@/composables/useAutoScroll'

const setHeaderTitle = inject<(t: string | null) => void>('setHeaderTitle')
const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()

const submitting = ref(false)
const loading = ref(true)

const name = ref('')
const description = ref('')
const systemPrompt = ref('')
const tag = ref<string | null>(null)
const avatar = ref<string | null>(null)
const version = ref(1)

const agentCategories = [
  { id: 'assistant', label: '助手' },
  { id: 'expert', label: '专家' },
  { id: 'creative', label: '创作' },
  { id: 'companion', label: '伴侣' },
  { id: 'explore', label: '探索' },
]

const suggestions = ['简单介绍下自己', '测试边界条件', '角色扮演测试']

const debugMessagesContainer = ref<HTMLElement | null>(null)
const debugThreadId = ref<string | null>(null)
const debugThreadLoading = ref(false)
const debugInput = ref('')

// 使用自动滚动 composable
const { showScrollButton, scrollToBottom, handleScroll } = useAutoScroll(debugMessagesContainer, {
  enableScrollButton: true,
  scrollOnMount: false, // 在 loadDebugThread 完成后手动调用
  watchSource: () => chatStore.messages,
  deep: true,
})

const tagLabel = computed(() => {
  if (!tag.value) return '未设置'
  const found = agentCategories.find(c => c.id === tag.value)
  return found ? found.label : tag.value
})

/** 发布后将更新到的版本号（当前版本 + 1） */
const nextVersion = computed(() => version.value + 1)

const agentId = computed(() => {
  const id = route.params.agentId
  return typeof id === 'string' && id ? id : null
})

onMounted(async () => {
  setHeaderTitle?.('配置智能体')
  if (!agentId.value) {
    ElMessage.error('无效的智能体ID')
    router.back()
    return
  }
  const detailOk = await loadAgentDetail()
  if (detailOk && agentId.value) {
    await loadDebugThread()
  }
})

/** 返回是否加载成功，失败时会 router.back() */
async function loadAgentDetail(): Promise<boolean> {
  if (!agentId.value) return false
  try {
    loading.value = true
    const result = await getAgentDetail(agentId.value)
    if (result.code === 0 && result.data) {
      const agent = result.data
      name.value = agent.name
      description.value = agent.description || ''
      systemPrompt.value = agent.config.systemPrompt || ''
      tag.value = agent.tag
      avatar.value = agent.avatar
      version.value = agent.version
      return true
    }
    ElMessage.error(result.message || '获取智能体详情失败')
    router.back()
    return false
  } catch (error) {
    console.error('Load agent detail error:', error)
    ElMessage.error('加载失败')
    router.back()
    return false
  } finally {
    loading.value = false
  }
}

async function loadDebugThread() {
  if (!agentId.value) return
  debugThreadLoading.value = true
  try {
    const res = await getAgentDebugThread(agentId.value)
    if (res.code === 0 && res.data) {
      const threadId = res.data.threadId
      chatStore.setOverrideAgentId(agentId.value)
      await chatStore.switchThread(threadId)
      // 在 switchThread 完成后再展示调试区，避免短暂显示其他会话的消息
      debugThreadId.value = threadId
      // 加载完成后滚动到底部
      scrollToBottom(false)
    } else {
      ElMessage.error(res.message || '获取调试会话失败')
    }
  } catch (e) {
    console.error('Load debug thread error:', e)
    ElMessage.error('加载调试会话失败')
  } finally {
    debugThreadLoading.value = false
  }
}

onUnmounted(() => {
  chatStore.setOverrideAgentId(null)
})

function handleBack() {
  router.back()
}

async function handleSubmit() {
  if (!description.value.trim()) {
    ElMessage.warning('请填写简短描述')
    return
  }

  if (description.value.length > 60) {
    ElMessage.warning('详细描述不能超过60个字符')
    return
  }

  try {
    submitting.value = true
    // 配置页仅允许修改：简短描述、系统提示词；头像、名称、标签只读，不提交
    const updateData: UpdateAgentRequest = {
      description: description.value.trim() || undefined,
      config: {
        systemPrompt: systemPrompt.value,
        ragConfig: null,
        mcpConfig: null,
      },
    }

    if (!agentId.value) {
      ElMessage.error('无效的智能体ID')
      return
    }
    const result = await updateAgent(agentId.value, updateData)
    if (result.code === 0) {
      ElMessage.success('更新成功')
      router.back()
    } else {
      ElMessage.error(result.message || '更新失败')
    }
  } catch (error) {
    console.error('Update agent error:', error)
    ElMessage.error('更新失败')
  } finally {
    submitting.value = false
  }
}

async function handleSendDebug() {
  const content = debugInput.value.trim()
  if (!content || chatStore.isGenerating || !debugThreadId.value) return
  await chatStore.sendMessage(content)
  debugInput.value = ''
  // 发送消息后滚动到底部
  scrollToBottom(false)
}

function useSuggestion(s: string) {
  debugInput.value = s
  nextTick(() => handleSendDebug())
}
</script>

<style scoped>
/* 自定义滚动条样式 */
.debug-messages-container::-webkit-scrollbar {
  width: 6px;
}

.debug-messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.debug-messages-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.debug-messages-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
