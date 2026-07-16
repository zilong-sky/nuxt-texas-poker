<template>
  <div>
    <NuxtPage />
    <div v-if="maskType" class="orient-mask">
      <div class="orient-mask-inner">
        <div class="rotate-icon">{{ maskType === 'pc' ? '💻' : '📱' }}</div>
        <div class="orient-mask-text">{{ maskText }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useWindowSize } from '@vueuse/core'

const mounted = ref(false)
const isMobile = ref(false)
const { width, height } = useWindowSize()

onMounted(() => {
  mounted.value = true
  isMobile.value = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
})

const maskType = computed<'pc' | 'portrait' | null>(() => {
  if (!mounted.value) return null
  if (!isMobile.value) return 'pc'
  if (height.value > width.value) return 'portrait'
  return null
})

const maskText = computed(() =>
  maskType.value === 'pc' ? '请使用手机浏览器访问' : '请横置手机游玩'
)
</script>
