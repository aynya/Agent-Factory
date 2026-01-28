<template>
  <div :class="containerClass">
    <div class="max-w-4xl mx-auto w-full relative">
      <!-- 自动滚动到底部按钮 -->
      <button
        v-if="showScrollButton"
        @click="handleScrollToBottom"
        class="absolute left-1/2 -translate-x-1/2 -top-12 w-10 h-10 rounded-full shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center z-10 scroll-to-bottom-btn border"
        :class="{
          'animate-pulse border-blue-500 bg-blue-50': isGenerating,
          'bg-white border-gray-300 hover:bg-gray-50': !isGenerating,
        }"
      >
        <el-icon :size="18" :style="{ color: isGenerating ? '#2563eb' : '#4b5563' }">
          <ArrowDown />
        </el-icon>
      </button>
      <!-- 渐变遮罩 -->
      <div
        v-if="gradientColor"
        class="absolute -top-8 left-0 right-0 h-8 pointer-events-none"
        :style="{ background: `linear-gradient(to top, ${gradientColor}, transparent)` }"
      />
      <div
        class="relative bg-white rounded-[28px] border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-2 pl-5"
      >
        <div class="flex flex-col">
          <el-input
            :model-value="modelValue"
            @update:model-value="handleInput"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 8 }"
            :placeholder="placeholder"
            class="gemini-input mt-2"
            :disabled="disabled || isGenerating"
            @keydown.ctrl.enter.prevent="handleSend"
            @keydown.meta.enter.prevent="handleSend"
          />

          <div class="flex items-center justify-between mt-2 mb-1 pr-2">
            <div class="flex items-center gap-1 text-gray-500">
              <el-button :icon="Plus" circle text class="!p-2 hover:bg-gray-100" />
              <el-button :icon="Picture" circle text class="!p-2 hover:bg-gray-100" />
            </div>

            <div class="flex items-center">
              <transition mode="out-in">
                <el-button
                  v-if="isGenerating"
                  type="danger"
                  circle
                  class="!w-10 !h-10 !p-0"
                  @click="handleInterrupt"
                >
                  <el-icon :size="20">
                    <Close />
                  </el-icon>
                </el-button>
                <el-button
                  v-else
                  type="primary"
                  circle
                  :disabled="!modelValue.trim()"
                  class="!w-10 !h-10 !p-0 !border-none send-btn"
                  @click="handleSend"
                >
                  <el-icon :size="20">
                    <Promotion />
                  </el-icon>
                </el-button>
              </transition>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="max-w-4xl mx-auto w-full mt-3 text-[11px] text-gray-400 text-center font-light">
      AI 可能会产生错误信息，请核实重要信息。按 Ctrl+Enter 发送
    </div>
    <!-- 建议按钮 -->
    <div
      v-if="suggestions && suggestions.length > 0"
      class="max-w-4xl mx-auto w-full flex gap-2 mt-4 overflow-x-auto pb-2"
    >
      <button
        v-for="(suggestion, i) in suggestions"
        :key="i"
        type="button"
        class="whitespace-nowrap bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
        :disabled="isGenerating"
        @click="handleSuggestionClick(suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Promotion, Close, Plus, Picture, ArrowDown } from '@element-plus/icons-vue'

interface Props {
  modelValue: string
  placeholder?: string
  disabled?: boolean
  isGenerating?: boolean
  showScrollButton?: boolean
  suggestions?: string[]
  containerClass?: string
  gradientColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '输入消息...',
  disabled: false,
  isGenerating: false,
  showScrollButton: false,
  suggestions: () => [],
  containerClass: '',
  gradientColor: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  interrupt: []
  'scroll-to-bottom': []
  'suggestion-click': [suggestion: string]
}>()

function handleInput(value: string) {
  emit('update:modelValue', value)
}

function handleSend() {
  if (!props.modelValue.trim() || props.isGenerating) return
  emit('send')
}

function handleInterrupt() {
  emit('interrupt')
}

function handleScrollToBottom() {
  emit('scroll-to-bottom')
}

function handleSuggestionClick(suggestion: string) {
  emit('suggestion-click', suggestion)
}
</script>

<style scoped>
/* 输入框样式 */
:deep(.gemini-input .el-textarea__inner) {
  box-shadow: none !important;
  border: none !important;
  padding: 0 !important;
  background: transparent !important;
  font-size: 16px;
  line-height: 1.5;
  color: #1f1f1f;
  resize: none;
}

/* 自定义发送按钮颜色 */
.send-btn {
  background-color: #1a73e8 !important;
  transition: all 0.2s ease;
}

.send-btn:disabled {
  background-color: #f1f3f4 !important;
  color: #9aa0a6 !important;
}

/* 按钮点击动画 */
.send-btn:active {
  transform: scale(0.9);
}

/* 滚动按钮动画 */
.scroll-to-bottom-btn {
  cursor: pointer;
}

.scroll-to-bottom-btn:active {
  transform: translateX(-50%) scale(0.9);
}
</style>
