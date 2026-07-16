<template>
  <div class="app-shell">
    <h1 class="h-title center">🃏 德州扑克</h1>
    <p class="center small">输入房间密码，密码相同则进同一房间；不存在则自动创建。</p>
    <div class="row">
      <input v-model="name" placeholder="昵称（可选）" maxlength="12" />
    </div>
    <div class="row">
      <input v-model="password" placeholder="房间密码" maxlength="20" @keyup.enter="submit" />
    </div>
    <button :disabled="loading" @click="submit">
      {{ loading ? '进入中…' : '进入房间' }}
    </button>
    <p v-if="error" class="center" style="color:#ff8a80;">{{ errorText }}</p>
    <p class="small center" style="margin-top:24px;">提示：请使用手机浏览器访问本页面。</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { usePokerStore } from '~/stores/poker'

const store = usePokerStore()
const password = ref('')
const name = ref('')
const loading = computed(() => store.loading)
const error = computed(() => store.error)
const errorText = computed(() => {
  const m: Record<string, string> = {
    ROOM_STARTED: '房间已开始，无法加入',
    ROOM_FULL: '房间已满员',
    PASSWORD_REQUIRED: '请输入密码',
    JOIN_FAILED: '进入失败，请稍后重试'
  }
  return m[error.value] || error.value
})

onMounted(async () => {
  // 尝试重连
  const roomId = await store.reconnect()
  if (roomId) {
    await navigateTo(`/room/${roomId}`)
  }
})

async function submit() {
  if (!password.value.trim()) {
    store.error = 'PASSWORD_REQUIRED'
    return
  }
  try {
    const roomId = await store.join(password.value.trim(), name.value.trim())
    await navigateTo(`/room/${roomId}`)
  } catch {}
}
</script>
