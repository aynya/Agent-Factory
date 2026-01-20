<template>
  <div class="h-screen bg-gray-50 flex overflow-hidden">
    <!-- 左侧侧边栏 -->
    <div class="flex-shrink-0 h-full">
      <ThreadSidebar />
    </div>

    <!-- 右侧主内容区域 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <ChatHeader :title="title" @logout="$emit('logout')" />
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import ThreadSidebar from '@/components/ThreadSidebar.vue'
import ChatHeader from '@/components/ChatHeader.vue'
import { useChatStore } from '@/stores/chat'

defineProps<{ title?: string | null }>()
defineEmits<{ logout: [] }>()

const chatStore = useChatStore()

onMounted(() => {
  chatStore.loadThreads()
})
</script>
