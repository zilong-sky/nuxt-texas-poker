<template>
  <div>
    <NuxtPage />
    <div v-if="showPcMask" class="pc-mask">
      <div>
        <div style="font-size:24px;margin-bottom:12px;">📱 手机专用</div>
        <div>请使用手机浏览器访问此页面。</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
const showPcMask = ref(false)
onMounted(() => {
  if (typeof navigator === 'undefined') return
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  showPcMask.value = !isMobile
})
</script>
