<template>
  <div class="app-shell index-shell">
    <div class="index-card">
      <h1 class="h-title center">🎲 德州扑克</h1>
      <p class="center small">填写昵称后创建房间，或加入已有房间。</p>

      <div v-if="hasSaved" class="resume-banner">
        <span class="small">检测到未完成对局，是否恢复?</span>
        <div class="resume-actions">
          <button :disabled="resuming" @click="onResume">{{ resuming ? '恢复中…' : '恢复' }}</button>
          <button class="ghost" :disabled="resuming" @click="onAbandon">放弃</button>
        </div>
      </div>
      <div class="nickname-row">
        <input v-model="nickname" placeholder="昵称（1-12 字符）" maxlength="12" @input="onNicknameInput" />
      </div>

      <section class="index-section">
        <h2 class="section-title">创建房间</h2>
        <div class="row">
          <input v-model="password" placeholder="创建密码" maxlength="20" @keyup.enter="onCreate" />
          <button :disabled="loading" @click="onCreate">{{ loading ? '处理中…' : '创建房间' }}</button>
        </div>
      </section>

      <section class="index-section">
        <h2 class="section-title">加入房间</h2>
        <p v-if="!rooms.length" class="small center" style="opacity:.7;">暂无可加入的房间。</p>
        <div v-else class="room-list">
          <button v-for="r in rooms" :key="r.id" class="ghost room-card" :disabled="loading" @click="onJoin(r.id)">
            <div class="room-host">{{ r.hostName }}</div>
            <div class="small">{{ r.playerCount }}/{{ r.maxPlayers }} 人</div>
          </button>
        </div>
      </section>

      <p v-if="errorText" class="center" style="color:#ff8a80;">{{ errorText }}</p>
    </div>
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
  // 不再自动跳转到旧房间：只提示，让用户点击后再恢复
  hasSaved.value = !!store.token
  await refreshRooms()
  timer = setInterval(refreshRooms, 3000)
})

const hasSaved = ref(false)
const resuming = ref(false)

async function onResume() {
  if (resuming.value) return
  resuming.value = true
  try {
    const rid = await store.reconnect()
    if (rid) {
      await navigateTo(`/room/${rid}`)
      return
    }
    hasSaved.value = false
  } finally {
    resuming.value = false
  }
}

function onAbandon() {
  store.clearToken()
  hasSaved.value = false
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.index-shell { align-items: center; justify-content: flex-start; }
.index-card { width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 14px; }
.nickname-row { display: flex; }
.nickname-row input { flex: 1; }
.section-title { font-size: 15px; margin: 0 0 8px; opacity: .85; }
.row { display: flex; gap: 8px; }
.row input { flex: 1; }
.room-list { display: flex; flex-direction: column; gap: 8px; }
.room-card { display: flex; flex-direction: column; gap: 4px; text-align: left; width: 100%; }
.room-host { font-weight: 700; }
.resume-banner { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-radius: 10px; background: rgba(245,197,24,.08); border: 1px solid rgba(245,197,24,.35); }
.resume-actions { display: flex; gap: 6px; }
</style>
