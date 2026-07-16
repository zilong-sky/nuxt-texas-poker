<template>
  <div class="app-shell">
    <div v-if="!room || !room.game" class="center">加载中…</div>
    <template v-else>
      <div class="row" style="justify-content:space-between;">
        <div class="small">阶段：{{ stageLabel }}</div>
        <div class="small">底池：<strong style="color:var(--accent);">{{ room.game.pot }}</strong></div>
      </div>

      <div class="pot-bar">
        <span v-if="room.game.community.length === 0" class="small">发牌前…</span>
        <span v-for="(c, i) in room.game.community" :key="i" class="card-tile" :class="{ red: c.suit === 'H' || c.suit === 'D' }">
          {{ cardStr(c) }}
        </span>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;">
        <div v-for="(p, idx) in room.players" :key="p.id" class="player-row"
             :class="{ active: idx === room.game.actionIdx, folded: p.folded }">
          <div>
            <strong>{{ p.name }}</strong>
            <span v-if="p.id === room.hostId" class="tag host">房主</span>
            <span v-if="p.isBot" class="tag bot">Bot</span>
            <span v-if="idx === room.game.dealerIdx" class="tag dealer">D</span>
            <span v-if="p.allIn" class="tag">全下</span>
            <span v-if="p.bust" class="tag">出局</span>
          </div>
          <div class="small" style="text-align:right;">
            <div>筹码 {{ p.chips }}</div>
            <div v-if="p.bet > 0">下注 {{ p.bet }}</div>
          </div>
        </div>
      </div>

      <!-- 手牌 -->
      <div v-if="me" class="pot-bar">
        <div class="small" style="margin-bottom:4px;">我的手牌</div>
        <template v-if="me.hand && me.hand.length">
          <template v-for="(c, i) in me.hand" :key="i">
            <span v-if="c" class="card-tile" :class="{ red: c.suit === 'H' || c.suit === 'D' }">
              {{ cardStr(c) }}
            </span>
            <span v-else class="card-tile back">?</span>
          </template>
        </template>
      </div>

      <!-- 倒计时 -->
      <div v-if="isMyTurn" class="small">
        剩余思考时间 {{ remaining }}s
        <div class="progress"><span :style="{ width: progressPct + '%' }" /></div>
      </div>

      <!-- 日志 -->
      <div class="log">
        <div v-for="(l, i) in room.game.log.slice().reverse()" :key="i">· {{ l }}</div>
      </div>

      <!-- 摊牌信息 -->
      <div v-if="room.game.stage === 'ended' && room.game.winners" class="pot-bar">
        <strong style="color:var(--accent);">本局结算</strong>
        <div v-for="w in room.game.winners" :key="w.playerId" class="small">
          {{ playerName(w.playerId) }} + {{ w.amount }} <span v-if="w.hand">（{{ w.hand }}）</span>
        </div>
      </div>

      <!-- 动作区 -->
      <div v-if="isMyTurn && room.game.stage !== 'ended'" style="display:flex;flex-direction:column;gap:8px;">
        <div class="row">
          <button class="danger grow" @click="doAction('fold')">弃牌</button>
          <button class="grow" @click="doAction(canCheck ? 'check' : 'call')">
            {{ canCheck ? '过牌' : `跟注 ${toCall}` }}
          </button>
        </div>
        <div class="row">
          <input v-model.number="raiseAmount" type="number" :min="minRaiseTo" :max="me.chips + me.bet"
                 :placeholder="`加注到 ${minRaiseTo}`" />
          <button class="grow" @click="doRaise">加注</button>
        </div>
        <button class="ghost" @click="doAction('allin')">全下（{{ me.chips }}）</button>
      </div>
      <div v-else-if="room.game.stage !== 'ended'" class="small center">
        等待 {{ actionPlayerName }} 行动…
      </div>

      <div class="row" style="margin-top:auto;">
        <button class="ghost grow" @click="reconnect">🔄 断线重连</button>
        <button class="ghost danger grow" @click="leave">退出</button>
      </div>
      <p v-if="err" class="center small" style="color:#ff8a80;">{{ err }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { usePokerStore } from '~/stores/poker'

const route = useRoute()
const roomId = route.params.id as string
const store = usePokerStore()

const room = computed(() => store.room)
const me = computed<any>(() => store.me)
const err = ref('')
const raiseAmount = ref<number | null>(null)
const now = ref(Date.now())

const stageLabel = computed(() => {
  const s = room.value?.game?.stage
  return { preflop: '翻牌前', flop: '翻牌', turn: '转牌', river: '河牌', showdown: '摊牌', ended: '结算' }[s as string] || s
})

const isMyTurn = computed(() => {
  const g = room.value?.game
  if (!g || g.stage === 'ended') return false
  return room.value.players[g.actionIdx]?.id === store.playerId
})
const toCall = computed(() => Math.max(0, (room.value?.game?.currentBet || 0) - (me.value?.bet || 0)))
const canCheck = computed(() => toCall.value === 0)
const minRaiseTo = computed(() => (room.value?.game?.currentBet || 0) + (room.value?.game?.minRaise || 20))
const remaining = computed(() => {
  const d = room.value?.game?.actionDeadline || 0
  return Math.max(0, Math.ceil((d - now.value) / 1000))
})
const progressPct = computed(() => Math.max(0, Math.min(100, (remaining.value / 60) * 100)))

const actionPlayerName = computed(() => {
  const g = room.value?.game
  if (!g) return ''
  return room.value.players[g.actionIdx]?.name || ''
})

function playerName(id: string) {
  return room.value?.players.find((p: any) => p.id === id)?.name || '?'
}
function cardStr(c: any) {
  if (!c) return ''
  const map: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
  const suit = { S: '♠', H: '♥', D: '♦', C: '♣' }[c.suit as 'S' | 'H' | 'D' | 'C']
  return suit + (map[c.rank] || c.rank)
}

onMounted(async () => {
  store.loadToken()
  if (!store.token) { await navigateTo('/'); return }
  if (!store.playerId) await store.reconnect()
  await refresh()
})

async function refresh() {
  try {
    await store.fetchState(roomId)
    if (store.room?.status === 'waiting') {
      await navigateTo(`/room/${roomId}`)
    }
  } catch (e: any) {
    err.value = e?.statusMessage || 'load failed'
  }
}

const { pause, resume } = useIntervalFn(refresh, 3000, { immediate: true })
const tick = useIntervalFn(() => { now.value = Date.now() }, 500, { immediate: true })

if (import.meta.client) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); tick.pause() }
    else { resume(); tick.resume(); refresh() }
  })
}

onBeforeUnmount(() => { pause(); tick.pause() })

async function doAction(a: string, amount?: number) {
  try {
    await store.action(a, amount)
  } catch (e: any) {
    err.value = e?.statusMessage || 'action failed'
  }
}
async function doRaise() {
  const amt = Number(raiseAmount.value)
  if (!amt || amt < minRaiseTo.value) {
    err.value = `加注最少 ${minRaiseTo.value}`
    return
  }
  await doAction('raise', amt)
  raiseAmount.value = null
}
async function reconnect() {
  await refresh()
}
async function leave() {
  await store.leave()
  await navigateTo('/')
}
</script>
