<template>
  <MainLayout :title="headerTitle" @logout="handleLogout">
    <router-view />
  </MainLayout>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
import MainLayout from '@/components/MainLayout.vue'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
const headerTitle = ref<string | null>(null)

provide('setHeaderTitle', (t: string | null) => {
  headerTitle.value = t
})

function handleLogout() {
  chatStore.createNewThread()
}
</script>
