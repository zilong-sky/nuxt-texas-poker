<template>
  <div class="game-page">
    <button class="icon-btn" title="刷新重连" @click="reconnect">⟳</button>
    <button class="icon-btn leave-icon" title="退出" @click="leave">✕</button>

    <div class="log-panel">
      <button class="log-toggle" @click="logOpen = !logOpen">{{ logOpen ? '▾ 日志' : '▸ 日志' }}</button>
      <div v-if="logOpen" class="log-list">
        <div v-for="(l, i) in logList" :key="i" class="log-item">· {{ l }}</div>
        <div v-if="!logList.length" class="log-item small">暂无记录</div>
      </div>
    </div>

    <div v-if="!room || !room.game" class="loading">加载中…</div>

    <template v-else>
      <div class="table-area">
        <div class="table">
          <div class="dealer">
            <div class="dealer-avatar">🎩</div>
            <div class="dealer-label">荷官</div>
          </div>
          <div class="community">
            <PokerCard v-for="i in 5" :key="i" :card="community[i - 1] || null" :face="true" size="normal" />
          </div>
          <div class="pot">
            <span class="pot-label">底池</span>
            <span class="chip lg" :class="chipClass(pot)">{{ pot }}</span>
          </div>
          <div class="stage">{{ stageLabel }}</div>
          <div v-if="winners.length" class="winners">
            <div v-for="w in winners" :key="w.playerId" class="winner-line">
              <strong>{{ playerName(w.playerId) }}</strong> +{{ w.amount }}
              <span v-if="w.hand" class="small">（{{ w.hand }}）</span>
            </div>
          </div>
        </div>

        <div
          v-for="s in seats"
          :key="s.player.id"
          class="seat"
          :class="['seat-' + s.seatNo, { active: s.active, folded: s.player.folded, bust: s.player.bust, me: s.isMe }]"
        >
          <div v-if="!s.isMe" class="seat-cards">
            <PokerCard v-for="(c, ci) in otherHand(s.player)" :key="ci" :card="c" :face="revealStage" size="mini" />
          </div>
          <div class="seat-body">
            <div class="avatar-wrap" :class="{ active: s.active }">
              <div v-if="s.active" class="timer-ring" :style="{ '--p': s.timerPct }">
                <div class="avatar">{{ initial(s.player.name) }}</div>
              </div>
              <div v-else class="avatar">{{ initial(s.player.name) }}</div>
            </div>
            <div class="seat-meta">
              <div class="seat-name">{{ s.player.name }}<span v-if="s.isMe" class="tag">我</span></div>
              <div class="seat-tags">
                <span v-if="s.dealer" class="tag dealer">D</span>
                <span v-if="s.sb" class="tag sb">SB</span>
                <span v-if="s.bb" class="tag bb">BB</span>
                <span v-if="s.player.isBot" class="tag bot">Bot</span>
                <span v-if="s.player.folded" class="tag fold">弃牌</span>
                <span v-if="s.player.allIn" class="tag allin">全下</span>
                <span v-if="s.player.bust" class="tag fold">出局</span>
                <span v-if="s.player.offline" class="tag offline">离线</span>
                <span v-if="s.active" class="tag think">{{ s.remaining }}s</span>
              </div>
              <div class="seat-chips"><span class="chip" :class="chipClass(s.player.chips)">{{ s.player.chips }}</span></div>
            </div>
          </div>
          <div v-if="s.player.bet > 0" class="seat-bet">
            <span class="chip" :class="chipClass(s.player.bet)">{{ s.player.bet }}</span>
          </div>
        </div>
      </div>

      <div class="bottom-zone">
        <div v-if="me" class="me-seat" :class="{ active: isMyTurn }">
          <div class="me-cards">
            <PokerCard v-for="(c, ci) in myHand" :key="ci" :card="c" :face="true" size="big" />
          </div>
        </div>

        <div class="action-area">
          <template v-if="isMyTurn && room.game.stage !== 'ended'">
            <button class="btn-fold" @click="doAction('fold')">弃牌</button>
            <button class="btn-call" @click="doAction(canCheck ? 'check' : 'call')">
              {{ canCheck ? '过牌' : `跟注 ${toCall}` }}
            </button>
            <div class="raise-group">
              <input v-model.number="raiseAmount" type="number" :min="minRaiseTo" :max="(me?.chips || 0) + (me?.bet || 0)" :placeholder="`加注到 ${minRaiseTo}`" />
              <button class="btn-raise" @click="doRaise">加注</button>
            </div>
            <button class="btn-allin" @click="doAction('allin')">全下 ({{ me?.chips || 0 }})</button>
          </template>
          <div v-else-if="room.game.stage !== 'ended'" class="wait-text">等待 {{ actionPlayerName }} 行动…</div>
          <div v-else class="wait-text">本局结束</div>
        </div>
      </div>
    </template>

    <p v-if="err" class="err">{{ err }}</p>
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
const logOpen = ref(false)

const CLOCKWISE = [5, 4, 3, 2, 1, 6]

const game = computed(() => room.value?.game)
const players = computed(() => room.value?.players || [])
const myIndex = computed(() => players.value.findIndex((p: any) => p.id === store.playerId))

const revealStage = computed(() => {
  const s = game.value?.stage
  return s === 'showdown' || s === 'ended'
})
const stageLabel = computed(() => {
  const map: Record<string, string> = {
    preflop: 'PRE-FLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER',
    showdown: 'SHOWDOWN', ended: 'SHOWDOWN'
  }
  return map[game.value?.stage as string] || ''
})

const community = computed(() => game.value?.community || [])
const pot = computed(() => game.value?.pot || 0)
const winners = computed(() => game.value?.winners || [])
const logList = computed(() => (game.value?.log || []).slice().reverse())

const count = computed(() => players.value.length || 1)
const dealerIdx = computed(() => game.value?.dealerIdx ?? -1)
const actionIdx = computed(() => game.value?.actionIdx ?? -1)
const sbIdx = computed(() => {
  const d = dealerIdx.value
  if (d < 0) return -1
  return count.value === 2 ? d : (d + 1) % count.value
})
const bbIdx = computed(() => {
  const d = dealerIdx.value
  if (d < 0) return -1
  return count.value === 2 ? (d + 1) % count.value : (d + 2) % count.value
})

const remaining = computed(() => {
  const d = game.value?.actionDeadline || 0
  return Math.max(0, Math.ceil((d - now.value) / 1000))
})
const timerPctVal = computed(() => Math.max(0, Math.min(100, (remaining.value / 60) * 100)))

const isMyTurn = computed(() => {
  const g = game.value
  if (!g || g.stage === 'ended') return false
  return players.value[actionIdx.value]?.id === store.playerId
})
const toCall = computed(() => Math.max(0, (game.value?.currentBet || 0) - (me.value?.bet || 0)))
const canCheck = computed(() => toCall.value === 0)
const minRaiseTo = computed(() => (game.value?.currentBet || 0) + (game.value?.minRaise || 20))
const actionPlayerName = computed(() => players.value[actionIdx.value]?.name || '')
const myTimerPct = computed(() => (isMyTurn.value ? timerPctVal.value : 0))

const seats = computed(() => {
  const ps = players.value
  const n = ps.length
  if (!n) return []
  const mi = myIndex.value >= 0 ? myIndex.value : 0
  const out: any[] = []
  for (let i = 0; i < n; i++) {
    const offset = (((i - mi) % n) + n) % n
    const seatNo = CLOCKWISE[offset % 6]
    const p = ps[i]
    const active = i === actionIdx.value && game.value?.stage !== 'ended'
    out.push({
      player: p, seatNo, idx: i,
      isMe: p.id === store.playerId,
      active,
      dealer: i === dealerIdx.value,
      sb: i === sbIdx.value,
      bb: i === bbIdx.value,
      remaining: active ? remaining.value : 0,
      timerPct: active ? timerPctVal.value : 0
    })
  }
  out.sort((a, b) => a.seatNo - b.seatNo)
  return out
})

const myHand = computed(() => {
  const h = me.value?.hand
  return h && h.length ? h : [null, null]
})
function otherHand(p: any) {
  if (revealStage.value && p?.hand?.length) return p.hand
  return [null, null]
}

function playerName(id: string) {
  return players.value.find((p: any) => p.id === id)?.name || '?'
}
function initial(name: string) {
  return name ? name.trim().charAt(0).toUpperCase() : '?'
}
function chipClass(v: any) {
  const x = Number(v) || 0
  if (x >= 1000) return 'black'
  if (x >= 500) return 'purple'
  if (x >= 200) return 'orange'
  if (x >= 100) return 'green'
  if (x >= 50) return 'blue'
  return ''
}

onMounted(async () => {
  store.loadClientState()
  if (!store.token) { await navigateTo('/'); return }
  if (!store.playerId) await store.reconnect()
  await refresh()
})

async function refresh() {
  try {
    await store.fetchState(roomId)
    if (store.room?.status === 'waiting') await navigateTo(`/room/${roomId}`)
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
  try { await store.action(a, amount) }
  catch (e: any) { err.value = e?.statusMessage || 'action failed' }
}
async function doRaise() {
  const amt = Number(raiseAmount.value)
  if (!amt || amt < minRaiseTo.value) { err.value = `加注最小 ${minRaiseTo.value}`; return }
  await doAction('raise', amt)
  raiseAmount.value = null
}
async function reconnect() { err.value = ''; await refresh() }
async function leave() { await store.leave(); await navigateTo('/') }
</script>

<style scoped>
.game-page {
  position: fixed;
  top: 0;
  left: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: radial-gradient(ellipse at center, #0a2418 0%, var(--bg2) 70%);
}
@media (orientation: portrait) {
  .game-page {
    width: 100dvh;
    height: 100dvw;
    transform: rotate(90deg) translateY(-100dvw);
    transform-origin: top left;
  }
}
@media (orientation: landscape) {
  .game-page {
    width: 100dvw;
    height: 100dvh;
    transform: none;
  }
}

.icon-btn {
  position: absolute;
  top: 8px;
  z-index: 30;
  width: 34px; height: 34px;
  min-height: 34px;
  padding: 0;
  border-radius: 50%;
  background: rgba(0,0,0,.4);
  color: var(--text);
  font-size: 16px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--panel-border);
}
.icon-btn:first-of-type { left: 8px; }
.leave-icon { left: 48px; }

.loading {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--muted); font-size: 16px;
}

.log-panel { position: absolute; top: 8px; right: 8px; z-index: 30; max-width: 240px; }
.log-toggle {
  width: 100%; min-height: 32px; padding: 4px 10px; font-size: 12px;
  background: rgba(0,0,0,.45); color: var(--text); border: 1px solid var(--panel-border);
}
.log-list {
  margin-top: 6px; max-height: 200px; overflow-y: auto;
  background: rgba(0,0,0,.55); border: 1px solid var(--panel-border);
  border-radius: 8px; padding: 6px 8px; font-size: 11px; line-height: 1.5;
}
.log-item { color: var(--text); }

.table-area { position: relative; flex: 1; min-height: 0; }
.table {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 85%; height: 80%;
  border-radius: 50% / 50%;
  background: radial-gradient(ellipse at center, var(--felt-light) 0%, var(--felt) 55%, var(--felt-dark) 100%);
  border: 12px solid var(--rail);
  box-shadow: 0 0 0 4px var(--gold), 0 0 0 6px rgba(245,197,24,.35), inset 0 0 80px rgba(0,0,0,.55), 0 14px 34px rgba(0,0,0,.6);
}
.community { position: absolute; left: 50%; top: 26%; transform: translateX(-50%); display: flex; gap: 8px; }
.pot {
  position: absolute; left: 50%; top: 44%; transform: translate(-50%, -50%);
  display: flex; align-items: center; gap: 8px;
  font-size: 20px; font-weight: 800; color: var(--gold); text-shadow: 0 1px 3px rgba(0,0,0,.6);
}
.pot-label { font-size: 12px; color: var(--muted); font-weight: 600; }
.stage { position: absolute; left: 50%; top: 60%; transform: translateX(-50%); font-size: 12px; color: var(--muted); letter-spacing: 2px; font-weight: 700; }
.winners {
  position: absolute; left: 50%; top: 80%; transform: translateX(-50%); text-align: center;
  background: rgba(0,0,0,.5); border: 1px solid var(--gold); border-radius: 8px; padding: 4px 10px; font-size: 12px;
}
.winner-line { white-space: nowrap; }

.seat { position: absolute; width: 108px; display: flex; flex-direction: column; align-items: center; gap: 3px; z-index: 5; }
.seat-cards { display: flex; gap: 3px; }
.seat-body { display: flex; align-items: center; gap: 6px; }
.avatar-wrap { position: relative; }
.timer-ring {
  width: 42px; height: 42px; border-radius: 50%; padding: 3px;
  background: conic-gradient(var(--gold) calc(var(--p) * 1%), rgba(255,255,255,.1) 0);
  display: flex; align-items: center; justify-content: center;
}
.avatar {
  width: 100%; height: 100%; border-radius: 50%;
  background: linear-gradient(135deg, #334155, #1e293b);
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; color: #fff; font-size: 15px; border: 2px solid rgba(255,255,255,.15);
}
.seat-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.seat-name { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 64px; }
.seat-tags { display: flex; flex-wrap: wrap; gap: 2px; }
.seat-tags .tag { margin-left: 0; }
.seat-chips { display: flex; }
.seat-bet { position: absolute; z-index: 6; }
.seat-1 { top: 4%;  left: 18%; }
.seat-2 { top: 4%;  right: 18%; }
.seat-3 { top: 42%; right: 2%; }
.seat-4 { bottom: 22%; right: 22%; }
.seat-5 { bottom: 22%; left: 22%; }
.seat-6 { top: 42%; left: 2%; }
.seat-1 .seat-bet, .seat-6 .seat-bet, .seat-5 .seat-bet { right: -6px; top: 46%; }
.seat-2 .seat-bet, .seat-3 .seat-bet, .seat-4 .seat-bet { left: -6px; top: 46%; }

.dealer {
  position: absolute; top: -2%; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  z-index: 4; pointer-events: none;
}
.dealer-avatar {
  width: 46px; height: 46px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #2a2f3a, #0f1218);
  border: 2px solid var(--gold);
  box-shadow: 0 0 0 2px rgba(245,197,24,.3), 0 4px 10px rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
}
.dealer-label {
  font-size: 11px; font-weight: 700; color: var(--gold); letter-spacing: 2px;
  text-shadow: 0 1px 2px rgba(0,0,0,.7);
}
.seat.active { background: rgba(245,197,24,.08); border-radius: 12px; padding: 4px; animation: seatPulse 1.2s infinite; }
.seat.folded { opacity: 0.45; }
.seat.bust { opacity: 0.3; }

.bottom-zone {
  flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 4px 10px calc(6px + env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(0,0,0,.55), transparent);
}
.me-seat { display: flex; align-items: center; gap: 12px; padding: 2px 10px; border-radius: 12px; }
.me-seat.active { animation: seatPulse 1.2s infinite; }
.me-cards { display: flex; gap: 6px; }
.me-info { display: flex; align-items: center; gap: 8px; }
.me-meta { display: flex; flex-direction: column; gap: 2px; }
.me-meta .seat-name { max-width: 120px; font-size: 14px; }
.action-area { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; width: 100%; }
.raise-group { display: flex; align-items: center; gap: 6px; }
.raise-group input { width: 110px; }
.wait-text { color: var(--muted); font-size: 13px; }

.err {
  position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
  color: #ff8a80; font-size: 12px; z-index: 40; background: rgba(0,0,0,.6); padding: 2px 8px; border-radius: 6px;
}
/* --- optimized action bar (per CHANGE_REQUEST) --- */
.action-area { gap: 10px; padding: 4px 0 2px; }
.action-area button.btn-fold,
.action-area button.btn-call,
.action-area button.btn-raise,
.action-area button.btn-allin {
  min-width: 84px; min-height: 52px;
  border-radius: 10px; border: none; padding: 0 14px;
  font-weight: 800; font-size: 15px; letter-spacing: 1px;
  box-shadow: 0 4px 10px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.25);
  cursor: pointer; transition: transform .08s ease, filter .15s ease;
}
.action-area button.btn-fold:active,
.action-area button.btn-call:active,
.action-area button.btn-raise:active,
.action-area button.btn-allin:active { transform: translateY(1px); filter: brightness(.95); }
.action-area .btn-fold  { background: linear-gradient(135deg, #e53935, #b71c1c); color: #fff; }
.action-area .btn-call  { background: linear-gradient(135deg, #ffb300, #ff8f00); color: #1a1a1a; }
.action-area .btn-raise { background: linear-gradient(135deg, #42a5f5, #1565c0); color: #fff; }
.action-area .btn-allin { background: linear-gradient(135deg, #f5f5f5, #e0e0e0); color: #1a1a1a; }
.action-area .raise-group { display: flex; align-items: center; gap: 6px; }
.action-area .raise-group input {
  width: 80px; height: 44px; padding: 0 8px; border-radius: 8px;
  border: 1px solid var(--panel-border); background: rgba(0,0,0,.35);
  color: var(--text); font-size: 14px; text-align: center;
}
.me-seat { flex-direction: column; gap: 4px; }
.me-cards { gap: 8px; }
</style>
