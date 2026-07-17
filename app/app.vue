<template>
  <div>
    <NuxtPage />
    <div v-if="maskType" class="orient-mask">
      <div class="orient-mask-inner">
        <div class="rotate-icon">💻</div>
        <div class="orient-mask-text">{{ maskText }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const mounted = ref(false)
const isMobile = ref(false)

onMounted(() => {
  mounted.value = true
  isMobile.value = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
})

const maskType = computed<'pc' | null>(() => {
  if (!mounted.value) return null
  if (!isMobile.value) return 'pc'
  return null
})

const maskText = computed(() => '请使用手机浏览器访问')
</script>
