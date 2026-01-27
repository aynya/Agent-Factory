<template>
  <div
    class="chat-message-item flex gap-4"
    :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
    @click="handleCopyClick"
  >
    <!-- 用户消息 -->
    <div v-if="message.role === 'user'" class="flex gap-3 max-w-[80%]">
      <div class="flex-1">
        <div class="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
          <p class="text-sm whitespace-pre-wrap break-words">{{ message.content }}</p>
        </div>
      </div>
    </div>

    <!-- AI 回复 -->
    <div v-else class="flex gap-3 w-[100%]">
      <div class="flex-1 min-w-0">
        <div
          class="rounded-2xl rounded-tl-sm px-4 py-3"
          :class="message.isError ? 'bg-red-50 border border-red-200' : ''"
        >
          <div
            v-if="message.content"
            class="prose prose-sm max-w-none markdown-body"
            :class="message.isError ? 'error-message' : ''"
            v-html="renderMarkdown(message.content)"
          />
          <div v-else-if="message.isStreaming" class="flex items-center gap-2 text-gray-400">
            <span class="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
            <span class="text-sm">AI 正在思考...</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { createMarkdownRenderer, renderMarkdown as renderMarkdownUtil } from '@monorepo/utils'
import type { Message } from '@/stores/chat'
import 'highlight.js/styles/github-dark.css'

defineProps<{ message: Message }>()

const md = createMarkdownRenderer()
function renderMarkdown(text: string): string {
  return renderMarkdownUtil(text, md)
}

/** 代码块复制按钮点击（仅处理本消息内的 .code-block-copy-btn） */
async function handleCopyClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest('.code-block-copy-btn') as HTMLElement
  if (!btn || btn.classList.contains('copied')) return

  const codeContent = btn.getAttribute('data-code-content')
  if (!codeContent) return

  try {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = codeContent
    await navigator.clipboard.writeText(textarea.value)

    const copyIcon = btn.querySelector('.copy-icon') as HTMLElement
    const checkIcon = btn.querySelector('.check-icon') as HTMLElement
    const copyText = btn.querySelector('.copy-text') as HTMLElement

    btn.classList.add('copied')
    if (copyIcon) copyIcon.style.display = 'none'
    if (checkIcon) checkIcon.style.display = 'block'
    if (copyText) copyText.textContent = '已复制'

    setTimeout(() => {
      btn.classList.remove('copied')
      if (copyIcon) copyIcon.style.display = 'block'
      if (checkIcon) checkIcon.style.display = 'none'
      if (copyText) copyText.textContent = '复制'
    }, 2000)

    ElMessage.success('代码已复制')
  } catch (err) {
    console.error('复制失败', err)
    ElMessage.error('复制失败')
  }
}
</script>

<style scoped>
/* 错误消息样式 */
.error-message {
  color: #dc2626 !important;
}

.error-message :deep(p) {
  color: #dc2626 !important;
}

.error-message :deep(code) {
  background-color: rgba(220, 38, 38, 0.1) !important;
  color: #dc2626 !important;
}

/* Markdown 样式 */
:deep(.markdown-body) {
  color: #24292f;
  line-height: 1.6;
}

:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3),
:deep(.markdown-body h4),
:deep(.markdown-body h5),
:deep(.markdown-body h6) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
}

:deep(.markdown-body h1) {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

:deep(.markdown-body h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

:deep(.markdown-body h3) {
  font-size: 1.25em;
}

:deep(.markdown-body p) {
  margin-bottom: 1em;
}

/* 行内代码样式 */
:deep(.markdown-body code:not(.hljs)) {
  background-color: rgba(175, 184, 193, 0.2);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  font-family: 'Courier New', monospace;
}

/* 代码块容器样式（普通代码块，不在包装器内） */
:deep(.markdown-body pre:not(.code-block-wrapper pre)) {
  margin: 1em 0;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

/* 代码块包装器 */
:deep(.markdown-body .code-block-wrapper) {
  margin: 1em 0;
  border-radius: 8px;
  overflow: hidden;
  background-color: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

/* 代码块头部（语言标签和复制按钮） */
:deep(.markdown-body .code-block-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* 语言标签 */
:deep(.markdown-body .code-block-lang) {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family:
    'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
}

/* 复制按钮 */
:deep(.markdown-body .code-block-copy-btn) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  outline: none;
}

:deep(.markdown-body .code-block-copy-btn:hover) {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.9);
}

:deep(.markdown-body .code-block-copy-btn:active) {
  transform: scale(0.95);
}

:deep(.markdown-body .code-block-copy-btn.copied) {
  background-color: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

:deep(.markdown-body .code-block-copy-btn.copied:hover) {
  background-color: rgba(34, 197, 94, 0.2);
}

/* 复制按钮图标 */
:deep(.markdown-body .code-block-copy-btn svg) {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  stroke-width: 2;
}

:deep(.markdown-body .code-block-copy-btn .copy-icon) {
  display: block;
}

:deep(.markdown-body .code-block-copy-btn .check-icon) {
  display: none;
  color: #22c55e;
}

:deep(.markdown-body .code-block-copy-btn.copied .copy-icon) {
  display: none;
}

:deep(.markdown-body .code-block-copy-btn.copied .check-icon) {
  display: block;
}

/* 复制按钮文本 */
:deep(.markdown-body .code-block-copy-btn .copy-text) {
  font-size: 0.75rem;
  font-weight: 500;
}

/* highlight.js 代码块样式（在包装器内） */
:deep(.markdown-body .code-block-wrapper pre.hljs) {
  margin: 0 !important;
  padding: 16px !important;
  overflow-x: auto;
  border: none !important;
  border-radius: 0 !important;
  background-color: transparent !important;
  background: transparent !important;
}

:deep(.markdown-body .code-block-wrapper pre.hljs code) {
  background-color: transparent !important;
  background: transparent !important;
  padding: 0 !important;
  font-size: 0.875em;
  line-height: 1.6;
  font-family:
    'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
  display: block;
  white-space: pre;
  color: inherit;
}

/* highlight.js 代码块样式（不在包装器内的普通代码块） */
:deep(.markdown-body pre.hljs:not(.code-block-wrapper pre)) {
  padding: 16px;
  overflow-x: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 1em;
  border-radius: 8px;
}

:deep(.markdown-body pre.hljs:not(.code-block-wrapper pre) code) {
  background-color: transparent !important;
  padding: 0;
  font-size: 0.875em;
  line-height: 1.6;
  font-family:
    'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
  display: block;
  white-space: pre;
}

/* 代码块滚动条样式 */
:deep(.markdown-body .code-block-wrapper pre.hljs::-webkit-scrollbar),
:deep(.markdown-body pre.hljs::-webkit-scrollbar) {
  height: 8px;
}

:deep(.markdown-body .code-block-wrapper pre.hljs::-webkit-scrollbar-track),
:deep(.markdown-body pre.hljs::-webkit-scrollbar-track) {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

:deep(.markdown-body .code-block-wrapper pre.hljs::-webkit-scrollbar-thumb),
:deep(.markdown-body pre.hljs::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

:deep(.markdown-body .code-block-wrapper pre.hljs::-webkit-scrollbar-thumb:hover),
:deep(.markdown-body pre.hljs::-webkit-scrollbar-thumb:hover) {
  background: rgba(255, 255, 255, 0.3);
}

:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  margin-bottom: 1em;
  padding-left: 2em;
}

:deep(.markdown-body li) {
  margin-bottom: 0.5em;
}

:deep(.markdown-body blockquote) {
  border-left: 4px solid #dfe2e5;
  padding-left: 1em;
  margin: 1em 0;
  color: #6a737d;
}

:deep(.markdown-body a) {
  color: #0366d6;
  text-decoration: none;
}

:deep(.markdown-body a:hover) {
  text-decoration: underline;
}

:deep(.markdown-body table) {
  border-collapse: collapse;
  margin-bottom: 1em;
  width: 100%;
}

:deep(.markdown-body table th),
:deep(.markdown-body table td) {
  border: 1px solid #dfe2e5;
  padding: 6px 13px;
}

:deep(.markdown-body table th) {
  background-color: #f6f8fa;
  font-weight: 600;
}
</style>
