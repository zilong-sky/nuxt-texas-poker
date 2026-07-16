<template>
  <div class="app-shell">
    <h1 class="h-title center">🎴 德州扑克</h1>
    <p class="center small">先填写昵称，然后创建房间或加入一个已有房间。</p>

    <div class="row">
      <input
        v-model="nickname"
        placeholder="昵称（1-12 个字符）"
        maxlength="12"
        @input="onNicknameInput"
      />
    </div>

    <section class="section">
      <h2 class="section-title">创建房间</h2>
      <div class="row">
        <input
          v-model="password"
          placeholder="创建密码"
          maxlength="20"
          @keyup.enter="onCreate"
        />
        <button :disabled="loading" @click="onCreate">
          {{ loading ? '处理中…' : '创建房间' }}
        </button>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">加入房间</h2>
      <p v-if="!rooms.length" class="small center" style="opacity:.7;">
        当前没有可加入的房间。
      </p>
      <div v-else style="display:flex;flex-direction:column;gap:8px;">
        <button
          v-for="r in rooms"
          :key="r.id"
          class="ghost room-row"
          :disabled="loading"
          @click="onJoin(r.id)"
        >
          <span>{{ r.hostName }} 创建的房间</span>
          <span class="small">{{ r.playerCount }}/{{ r.maxPlayers }} 人</span>
        </button>
      </div>
    </section>

    <p v-if="errorText" class="center" style="color:#ff8a80;">{{ errorText }}</p>
    <p class="small center" style="margin-top:24px;">提示：请使用手机浏览器访问本页面。</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { usePokerStore } from '~/stores/poker'

const store = usePokerStore()
const nickname = ref('')
const password = ref('')
const rooms = ref<Array<{ id: string; hostName: string; playerCount: number; maxPlayers: number }>>([])
const loading = computed(() => store.loading)
const error = computed(() => store.error)
const errorText = computed(() => {
  const m: Record<string, string> = {
    ROOM_STARTED: '房间已开始，无法加入',
    ROOM_FULL: '房间已满员',
    INVALID_PASSWORD: '密码无效，无法创建房间',
    INVALID_NICKNAME: '请先填写昵称',
    NAME_TAKEN: '昵称已被占用，请更换后重试',
    ROOM_NOT_FOUND: '房间不存在或已解散',
    CREATE_FAILED: '创建失败，请稍后重试',
    JOIN_FAILED: '加入失败，请稍后重试'
  }
  return m[error.value] || error.value
})

function onNicknameInput() {
  store.error = ''
}

function ensureNickname(): string | null {
  const v = nickname.value.trim()
  if (!v) {
    store.error = 'INVALID_NICKNAME'
    alert('请先填写昵称')
    return null
  }
  return v
}

async function onCreate() {
  const name = ensureNickname()
  if (!name) return
  const pw = password.value.trim()
  try {
    const roomId = await store.createRoom(pw, name)
    await navigateTo(`/room/${roomId}`)
  } catch (e: any) {
    const code = e?.statusMessage || e?.data?.statusMessage
    if (code === 'INVALID_PASSWORD') alert('密码无效，无法创建房间')
  }
}

async function onJoin(roomId: string) {
  const name = ensureNickname()
  if (!name) return
  try {
    const rid = await store.joinRoom(roomId, name)
    await navigateTo(`/room/${rid}`)
  } catch (e: any) {
    const code = e?.statusMessage || e?.data?.statusMessage
    if (code === 'NAME_TAKEN') alert('昵称已被占用，请更换后重试')
  }
}

async function refreshRooms() {
  try {
    rooms.value = await store.listRooms()
  } catch {}
}

let timer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  store.loadClientState()
  if (store.nickname) nickname.value = store.nickname
  const roomId = await store.reconnect()
  if (roomId) {
    await navigateTo(`/room/${roomId}`)
    return
  }
  await refreshRooms()
  timer = setInterval(refreshRooms, 3000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.section { margin-top: 20px; }
.section-title { font-size: 15px; margin: 0 0 8px; opacity: .85; }
.room-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  text-align: left;
}
</style>
