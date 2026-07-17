<template>
  <div class="app-shell room-shell">
    <div v-if="!room" class="center">加载中…</div>
    <template v-else>
      <div class="room-head">
        <h1 class="h-title">房间 <span class="small">({{ room.players.length }}/6)</span></h1>
        <p class="small">密码即可入口，开始后禁止新人加入；断线请重连。</p>
      </div>

      <div class="room-stats"><span class="chip lg">在线 {{ humanCount }} 真人 / {{ botCount }} 机器人</span></div>

      <div class="player-list">
        <div v-for="p in room.players" :key="p.id" class="player-card">
          <div class="avatar">{{ initial(p.name) }}</div>
          <div class="player-info">
            <div class="player-name">
              <strong>{{ p.name }}</strong>
              <span v-if="p.id === room.hostId" class="tag host">房主</span>
              <span v-if="p.isBot" class="tag bot">Bot</span>
              <span v-if="p.id === myId" class="tag">我</span>
            </div>
            <div class="small">筹码 {{ p.chips }}</div>
          </div>
        </div>
      </div>

      <div class="room-actions">
        <template v-if="isHost">
          <button class="ghost" :disabled="room.players.length >= 6" @click="addBot">+ 添加机器人</button>
          <button :disabled="room.players.length < 2 || starting" @click="startGame">{{ starting ? '开始中…' : '开始游戏' }}</button>
        </template>
        <p v-else class="small center grow">等待房主开始游戏…</p>
        <button class="ghost danger" @click="leave">退出房间</button>
      </div>

      <p v-if="err" class="center" style="color:#ff8a80;">{{ err }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { usePokerStore } from '~/stores/poker'

const route = useRoute()
const roomId = route.params.id as string
const store = usePokerStore()

const room = computed(() => store.room)
const myId = computed(() => store.playerId)
const isHost = computed(() => store.isHost)
const humanCount = computed(() => room.value?.players.filter((p: any) => !p.isBot).length || 0)
const botCount = computed(() => room.value?.players.filter((p: any) => p.isBot).length || 0)

const err = ref('')
const starting = ref(false)

function initial(name: string) {
  return name ? name.trim().charAt(0).toUpperCase() : '?'
}

onMounted(async () => {
  store.loadClientState()
  if (!store.token) {
    await navigateTo('/')
    return
  }
  if (!store.playerId) {
    await store.reconnect()
  }
  await refresh()
})

async function refresh() {
  try {
    await store.fetchState(roomId)
    if (store.room?.status === 'playing') {
      await navigateTo(`/game/${roomId}`)
    }
  } catch (e: any) {
    err.value = e?.statusMessage || 'load failed'
  }
}

const { pause, resume } = useIntervalFn(refresh, 3000, { immediate: true })

if (import.meta.client) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause()
    else { resume(); refresh() }
  })
}

onBeforeUnmount(() => pause())

async function addBot() {
  try { await store.addBot() } catch (e: any) { err.value = e?.statusMessage || 'add bot failed' }
}
async function startGame() {
  starting.value = true
  try {
    await store.startGame()
    await navigateTo(`/game/${roomId}`)
  } catch (e: any) {
    err.value = e?.statusMessage || 'start failed'
  } finally { starting.value = false }
}
async function leave() {
  await store.leave()
  await navigateTo('/')
}

watch(() => store.room?.status, (s) => {
  if (s === 'playing') navigateTo(`/game/${roomId}`)
})
</script>

<style scoped>
.room-shell { justify-content: flex-start; }
.room-head { text-align: center; }
.room-stats { text-align: center; margin: 2px 0; }
.player-list { display: flex; flex-direction: column; gap: 10px; max-width: 560px; margin: 0 auto; width: 100%; }
.player-card { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; background: rgba(255,255,255,.06); }
.avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#334155,#1e293b); display: flex; align-items: center; justify-content: center; font-weight: 800; flex: 0 0 auto; }
.player-info { min-width: 0; }
.player-name { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.room-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 10px; align-items: center; }
</style>
