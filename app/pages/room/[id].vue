<template>
  <div class="app-shell">
    <div v-if="!room" class="center">加载中…</div>
    <template v-else>
      <h1 class="h-title">房间 <span class="small">({{ room.players.length }}/6)</span></h1>
      <p class="small">密码即入口，开始后禁止新人加入；断线支持重连。</p>

      <div class="pot-bar">在线：{{ humanCount }} 真人 / {{ botCount }} 机器人</div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        <div v-for="p in room.players" :key="p.id" class="player-row">
          <div>
            <strong>{{ p.name }}</strong>
            <span v-if="p.id === room.hostId" class="tag host">房主</span>
            <span v-if="p.isBot" class="tag bot">Bot</span>
            <span v-if="p.id === myId" class="tag">我</span>
          </div>
          <div class="small">筹码 {{ p.chips }}</div>
        </div>
      </div>

      <div v-if="isHost" class="row" style="margin-top:12px;">
        <button class="ghost grow" :disabled="room.players.length >= 6" @click="addBot">+ 添加机器人</button>
        <button class="grow" :disabled="room.players.length < 2 || starting" @click="startGame">
          {{ starting ? '开始中…' : '开始游戏' }}
        </button>
      </div>
      <p v-else class="small center">等待房主开始游戏…</p>

      <button class="ghost danger" style="margin-top:auto;" @click="leave">退出房间</button>

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

onMounted(async () => {
  store.loadClientState()
  if (!store.token) {
    await navigateTo('/')
    return
  }
  if (!store.playerId) {
    // 尝试补 playerId
    await store.reconnect()
  }
  await refresh()
})

async function refresh() {
  try {
    await store.fetchState(roomId)
    // 若已开始，跳转到游戏页
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
