<template>
  <div class="flex-1 flex overflow-y-auto create-agent-view">
    <main
      class="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-12 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <button
        @click="handleBack"
        class="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm mb-8 transition-colors group"
      >
        <el-icon class="group-hover:-translate-x-1 transition-transform">
          <ArrowLeft />
        </el-icon>
        返回市场
      </button>

      <div
        class="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12"
      >
        <h2 class="text-3xl font-extrabold text-slate-900 mb-2">创建新智能体</h2>
        <p class="text-slate-500 mb-10">填写下方信息，定制您的专属 AI 助手</p>

        <form @submit.prevent="handleSubmit" class="space-y-8">
          <!-- Avatar Section -->
          <div class="flex flex-col items-center gap-4">
            <div @click="handleAvatarClick" class="relative group cursor-pointer">
              <div
                class="w-28 h-28 rounded-[32px] overflow-hidden border-4 border-slate-50 shadow-md group-hover:ring-4 group-hover:ring-indigo-100 transition-all"
              >
                <img
                  v-if="avatar"
                  :src="getAvatarUrl(avatar)"
                  alt="Avatar Preview"
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
              <div
                class="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 rounded-[32px] transition-opacity"
              >
                <el-icon :size="24" class="text-white">
                  <Picture />
                </el-icon>
              </div>
              <input
                ref="fileInputRef"
                type="file"
                @change="handleImageUpload"
                class="hidden"
                accept="image/*"
              />
            </div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-widest"
              >点击更换头像</span
            >
          </div>

          <!-- Name Field -->
          <div>
            <label class="block text-sm font-bold text-slate-700 mb-2 ml-1">智能体名称</label>
            <div class="relative">
              <input
                v-model="name"
                type="text"
                maxlength="10"
                placeholder="例如：写作助手"
                class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all outline-none"
                required
              />
              <span
                :class="[
                  'absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold',
                  name.length === 10 ? 'text-rose-500' : 'text-slate-400',
                ]"
              >
                {{ name.length }}/10
              </span>
            </div>
          </div>

          <!-- Description Field -->
          <div>
            <label class="block text-sm font-bold text-slate-700 mb-2 ml-1">详细描述</label>
            <div class="relative">
              <textarea
                v-model="description"
                maxlength="60"
                rows="3"
                placeholder="简短描述智能体的功能与应用场景..."
                class="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all outline-none resize-none"
                required
              ></textarea>
              <span
                :class="[
                  'absolute right-4 bottom-4 text-[10px] font-bold',
                  description.length === 60 ? 'text-rose-500' : 'text-slate-400',
                ]"
              >
                {{ description.length }}/60
              </span>
            </div>
          </div>

          <!-- Category Field -->
          <div>
            <label class="block text-sm font-bold text-slate-700 mb-4 ml-1">选择分类</label>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                v-for="cat in agentCategories"
                :key="cat.id"
                type="button"
                @click="selectedCategory = cat.id"
                :class="[
                  'py-3 px-4 rounded-xl text-sm font-bold transition-all border',
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                    : 'bg-white text-slate-500 border-slate-100 hover:border-indigo-200 hover:bg-slate-50',
                ]"
              >
                {{ cat.label }}
              </button>
            </div>
          </div>

          <div class="pt-4">
            <button
              type="submit"
              :disabled="isSubmitting || !name.trim() || !description.trim()"
              class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white h-16 rounded-2xl font-extrabold text-lg shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-3 group"
            >
              <span v-if="isSubmitting">创建中...</span>
              <span v-else>完成创建</span>
              <el-icon v-if="!isSubmitting" class="group-hover:scale-110 transition-transform">
                <Check />
              </el-icon>
              <el-icon v-else class="animate-spin">
                <Loading />
              </el-icon>
            </button>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Avatar, Picture, Check, Loading } from '@element-plus/icons-vue'
import { createAgent } from '@/utils/api'
import { ElMessage } from 'element-plus'
import { getAvatarUrl, handleImageUpload as handleImageUploadUtil } from '@/utils/avatar'

const router = useRouter()
const setHeaderTitle = inject<(t: string | null) => void>('setHeaderTitle')

const agentCategories = [
  { id: 'assistant', label: '助手' },
  { id: 'expert', label: '专家' },
  { id: 'creative', label: '创作' },
  { id: 'companion', label: '伴侣' },
  { id: 'explore', label: '探索' },
]

const name = ref('')
const description = ref('')
const selectedCategory = ref<string>('assistant')
const avatar = ref<string>('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const isSubmitting = ref(false)

// 生成随机默认头像
function generateDefaultAvatar() {
  const seed = Math.random().toString(36).substring(7)
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`
}

onMounted(() => {
  setHeaderTitle?.('创建智能体')
  avatar.value = generateDefaultAvatar()
})

function handleAvatarClick() {
  fileInputRef.value?.click()
}

async function handleImageUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    try {
      const base64 = await handleImageUploadUtil(file)
      // 显示预览（base64）
      avatar.value = base64
    } catch (error) {
      // 错误已在工具函数中处理
      console.error('Image upload error:', error)
    }
  }
}

function handleBack() {
  router.push('/agents/me')
}

async function handleSubmit() {
  if (!name.value.trim() || !description.value.trim()) {
    ElMessage.warning('请填写完整信息')
    return
  }

  if (name.value.length > 10) {
    ElMessage.warning('智能体名称不能超过10个字符')
    return
  }

  if (description.value.length > 60) {
    ElMessage.warning('详细描述不能超过60个字符')
    return
  }

  isSubmitting.value = true

  try {
    const result = await createAgent({
      name: name.value.trim(),
      description: description.value.trim(),
      tag: selectedCategory.value,
      avatar: avatar.value || undefined,
    })

    if (result.code === 0) {
      ElMessage.success('创建成功')
      router.push('/agents/me')
    } else {
      ElMessage.error(result.message || '创建失败')
    }
  } catch (error) {
    console.error('Create agent error:', error)
    ElMessage.error('创建失败，请稍后重试')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
/* 固定滚动条区域，避免布局闪动 */
.create-agent-view {
  /* 预留滚动条空间，即使滚动条不显示也不会改变布局 */
  scrollbar-gutter: stable;
}

.animate-in {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
