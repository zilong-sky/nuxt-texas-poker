<template>
  <div class="game-page">
    <!-- ????????? + ?? + ?? D + ??? + HOLD'EM ?? ??? .table ? -->
    <!-- ??????? -->
    <aside class="side-rail">
      <button class="rail-btn back-btn" title="??" @click="onBack">
        <span class="arrow">?</span>
      </button>
      <div class="rail-time">{{ clockText }}</div>
      <button class="rail-btn chat-btn" title="??" @click="chatOpen = !chatOpen">
        <span class="ico">??</span>
      </button>
      <button class="rail-btn target-btn" title="??">
        <span class="ico-target"></span>
      </button>
      <button class="rail-btn buff-btn" title="BUFF">
        <span class="buff-line1">BUFF</span>
        <span class="buff-line2">5% ? 1X</span>
      </button>
    </aside>

    <!-- ?????? -->
    <section class="log-rail" :class="{ open: logOpen }">
      <button class="log-toggle" @click="logOpen = !logOpen">{{ logOpen ? '?' : '??' }}</button>
      <div v-if="logOpen" class="log-list">
        <div v-for="(l, i) in logList" :key="i" class="log-item">? {{ l }}</div>
        <div v-if="!logList.length" class="log-item small">????</div>
      </div>
    </section>

    <div v-if="!room || !room.game" class="loading">????</div>

    <template v-else>
      <!-- ???????? + ???? -->
      <div class="lounge">
        <!-- ????? -->
        <div class="window-scene">
          <div class="cityscape"></div>
          <div class="skyline"></div>
          <div class="curtain left"></div>
          <div class="curtain right"></div>
        </div>
        <!-- ??/??/?? ?? -->
        <div class="lounge-sofa left"></div>
        <div class="lounge-sofa right"></div>
        <div class="lounge-floor"></div>

        <div class="table-wrap">
          <!-- ?????????? -->
          <div class="dealer-top">
            <div class="dealer-avatar" aria-label="dealer">
              <div class="dealer-hair"></div>
              <div class="dealer-face">
                <div class="eye left"></div>
                <div class="eye right"></div>
                <div class="mouth"></div>
              </div>
              <div class="dealer-body"></div>
            </div>
          </div>

          <div class="table">
            <div class="table-inner">
              <div class="table-watermark">HOLD'EM</div>
              <!-- ???? -->
              <div class="community">
                <PokerCard
                  v-for="i in 5"
                  :key="i"
                  :card="community[i - 1] || null"
                  :face="!!community[i - 1]"
                  size="normal"
                  class="board-card"
                />
              </div>
              <!-- ?? + ?? D -->
              <div class="pot-row">
                <div class="dealer-chip">D</div>
                <div class="pot-info">
                  <div class="pot-label">??</div>
                  <div class="pot-amount">{{ formatChips(pot) }}</div>
                </div>
              </div>
              <div class="stage-tag">{{ stageLabel }}</div>
              <div v-if="winners.length" class="winners">
                <div v-for="w in winners" :key="w.playerId" class="winner-line">
                  <strong>{{ playerName(w.playerId) }}</strong>
                  <span>+{{ formatChips(w.amount) }}</span>
                  <span v-if="w.hand" class="small">?{{ w.hand }}?</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 6 ????? -->
          <div
            v-for="s in seats"
            :key="s.player.id"
            class="seat"
            :class="[
              'seat-' + s.seatNo,
              { active: s.active, folded: s.player.folded, bust: s.player.bust, me: s.isMe, offline: s.player.offline }
            ]"
          >
            <!-- ??????? -->
            <div v-if="!s.isMe" class="seat-cards">
              <PokerCard
                v-for="(c, ci) in otherHand(s.player)"
                :key="ci"
                :card="c"
                :face="revealStage && !!c"
                size="mini"
              />
              <div v-if="!revealStage && s.player.hand && s.player.hand.length" class="hand-mask">
                ??????
              </div>
            </div>

            <div class="avatar-wrap" :class="{ turn: s.active }">
              <svg v-if="s.active" class="timer-ring" viewBox="0 0 44 44">
                <circle class="ring-bg" cx="22" cy="22" r="20" />
                <circle
                  class="ring-fg"
                  cx="22"
                  cy="22"
                  r="20"
                  :stroke-dasharray="125.66"
                  :stroke-dashoffset="125.66 * (1 - s.timerPct / 100)"
                />
              </svg>
              <div class="avatar">{{ initial(s.player.name) }}</div>
              <div class="gift-icon" title="??">??</div>
              <div v-if="s.dealer" class="dealer-badge">D</div>
              <div v-if="s.active" class="timer-num">{{ s.remaining }}</div>
            </div>

            <div class="seat-name-row">
              <span class="seat-name">{{ s.player.name }}</span>
              <span v-if="s.player.isBot" class="tag bot">Bot</span>
            </div>

            <div class="chip-row">
              <span class="coin">?</span>
              <span class="chip-val">{{ formatChips(s.player.chips) }}</span>
            </div>

            <div class="seat-tags">
              <span v-if="s.sb" class="tag sb">SB</span>
              <span v-if="s.bb" class="tag bb">BB</span>
              <span v-if="s.player.folded" class="tag fold">??</span>
              <span v-if="s.player.allIn" class="tag allin">??</span>
              <span v-if="s.player.bust" class="tag fold">??</span>
            </div>

            <!-- ?????? -->
            <div v-if="s.player.bet > 0" class="seat-bet">
              <span class="coin">?</span>
              <span>{{ formatChips(s.player.bet) }}</span>
            </div>
          </div>

          <!-- ?????1??????+???+????? -->
          <div class="me-panel" :class="{ active: isMyTurn }">
            <div class="me-cards">
              <PokerCard
                v-for="(c, ci) in myHand"
                :key="ci"
                :card="c"
                :face="!!c"
                size="big"
              />
            </div>
            <div class="me-rank">{{ me?.handRank || handTypeHint || '?' }}</div>
            <div class="me-win">
              <div class="me-win-bar">
                <div class="me-win-fill" :style="{ width: winRatePct + '%' }"></div>
              </div>
              <div class="me-win-text">?? {{ winRatePct }}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ???? 4 ?? -->
      <footer class="action-bar">
        <button
          class="act-btn"
          :disabled="!isMyTurn || game.stage === 'ended'"
          @click="doAction('fold')"
        >??</button>
        <button
          class="act-btn"
          :disabled="!isMyTurn || game.stage === 'ended'"
          @click="doAction(canCheck ? 'check' : 'fold')"
        >{{ canCheck ? '??' : '??/??' }}</button>
        <button
          class="act-btn"
          :disabled="!isMyTurn || !canCheck || game.stage === 'ended'"
          @click="doAction('check')"
        >??</button>
        <button
          class="act-btn primary"
          :disabled="!isMyTurn || game.stage === 'ended'"
          @click="doAction(canCheck ? 'check' : 'call')"
        >{{ canCheck ? '????' : `? ${formatChips(toCall)}` }}</button>
      </footer>
    </template>

    <p v-if="err" class="err">{{ err }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { usePokerStore } from '~/stores/poker'

/**
 * ?????????? CHANGE_REQUEST ???? 6 ??????????????? 4 ???
 * ?? 1 ????????????? KV ?? seat index ?????????????? 2?6?
 */
const route = useRoute()
const roomId = route.params.id as string
const store = usePokerStore()

const room = computed<any>(() => store.room)
const me = computed<any>(() => store.me)
const err = ref('')
const now = ref(Date.now())
const logOpen = ref(false)
const chatOpen = ref(false)

// ??? 1..6 ?????????1 ??, 2 ??, 3 ??, 4 ??(????), 5 ??(????), 6 ??
// ????: 0=?? -> ??1?1..5 ??? -> ?? 2,3,4,5,6
const OFFSET_TO_SEAT = [1, 2, 3, 4, 5, 6]

const game = computed<any>(() => room.value?.game)
const players = computed<any[]>(() => room.value?.players || [])

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

const community = computed<any[]>(() => game.value?.community || [])
const pot = computed(() => game.value?.pot || 0)
const winners = computed<any[]>(() => game.value?.winners || [])
const logList = computed<string[]>(() => (game.value?.log || []).slice().reverse())

const dealerIdx = computed<number>(() => game.value?.dealerIdx ?? -1)
const actionIdx = computed<number>(() => game.value?.actionIdx ?? -1)
const count = computed(() => players.value.length || 1)
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

const myKvSeat = computed<number>(() => {
  const meP = players.value.find(p => p.id === store.playerId)
  return meP?.seat ?? -1
})

const isMyTurn = computed(() => {
  const g = game.value
  if (!g || g.stage === 'ended') return false
  return players.value[actionIdx.value]?.id === store.playerId
})
const toCall = computed(() => Math.max(0, (game.value?.currentBet || 0) - (me.value?.bet || 0)))
const canCheck = computed(() => toCall.value === 0)

/**
 * 6 ?????????????? 1??????? KV ?? seat index?
 * ????? (kvSeat - myKvSeat) mod maxSeats ??????????? 2..6?
 */
const seats = computed(() => {
  const ps = players.value
  if (!ps.length || myKvSeat.value < 0) return []
  const seatSlots = Math.max(6, ps.length)
  const out: any[] = []
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]
    const offset = (((p.seat - myKvSeat.value) % seatSlots) + seatSlots) % seatSlots
    const seatNo = OFFSET_TO_SEAT[Math.min(offset, 5)]
    const active = i === actionIdx.value && game.value?.stage !== 'ended'
    out.push({
      player: p,
      seatNo,
      idx: i,
      isMe: p.id === store.playerId,
      active,
      dealer: i === dealerIdx.value,
      sb: i === sbIdx.value,
      bb: i === bbIdx.value,
      remaining: active ? remaining.value : 0,
      timerPct: active ? timerPctVal.value : 0
    })
  }
  return out
})

const myHand = computed<any[]>(() => {
  const h = me.value?.hand
  if (h && h.length) return h
  return [null, null]
})
function otherHand(p: any) {
  if (revealStage.value && p?.hand?.length && p.hand[0]) return p.hand
  return [null, null]
}

/** ???????????????????????????? */
const handTypeHint = computed(() => {
  const h = myHand.value
  if (!h[0] || !h[1]) return ''
  const r1 = h[0].rank, r2 = h[1].rank
  const s1 = h[0].suit, s2 = h[1].suit
  if (r1 === r2) return '??'
  if (s1 === s2) return '???'
  return '??'
})

/** ???????????????????????? */
const winRatePct = computed(() => {
  const h = myHand.value
  if (!h[0] || !h[1]) return 0
  const r1 = h[0].rank, r2 = h[1].rank
  const s1 = h[0].suit, s2 = h[1].suit
  let base = 30
  if (r1 === r2) base = 55 + (r1 - 2) * 2
  else {
    base += (Math.max(r1, r2) - 7) * 3
    if (s1 === s2) base += 6
    if (Math.abs(r1 - r2) === 1) base += 4
  }
  const board = community.value.filter(Boolean).length
  if (board >= 3 && me.value?.handRank) base += 10
  return Math.max(3, Math.min(96, Math.round(base)))
})

function playerName(id: string) {
  return players.value.find((p: any) => p.id === id)?.name || '?'
}
function initial(name: string) {
  return name ? name.trim().charAt(0).toUpperCase() : '?'
}
function formatChips(v: any) {
  const x = Number(v) || 0
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(x % 1_000_000 === 0 ? 0 : 1) + 'M'
  if (x >= 10_000) return (x / 1_000_000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + 'M'
  return String(x)
}

/** ????????? */
const clockText = computed(() => {
  const d = new Date(now.value)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
})

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

async function onBack() { await store.leave(); await navigateTo('/') }
</script>

<style scoped>
.game-page {
  position: fixed; inset: 0; overflow: hidden;
  display: flex; flex-direction: column;
  color: var(--text);
  background: #0a0d14;
  font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* ---------- ??????? ---------- */
.side-rail {
  position: absolute; left: 6px; top: 6px; bottom: 96px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  z-index: 20; padding: 4px 2px;
}
.rail-btn {
  width: 40px; height: 40px; border-radius: 10px; border: none; color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 8px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.15);
  cursor: pointer; padding: 0; line-height: 1;
}
.rail-btn .arrow { font-size: 18px; }
.rail-btn .ico { font-size: 18px; }
.back-btn, .chat-btn {
  background: linear-gradient(180deg, #7a4bd6, #4b28a3);
}
.target-btn {
  background: radial-gradient(circle at 50% 50%,
    #fff 0 22%, #e53935 22% 40%, #fff 40% 55%, #e53935 55% 72%, #fff 72% 82%, #e53935 82% 100%);
  border-radius: 50%;
  position: relative;
}
.target-btn .ico-target { width: 6px; height: 6px; border-radius: 50%; background: #111; box-shadow: 0 0 0 2px #fff; }
.buff-btn {
  background: linear-gradient(180deg, #ff9a2f, #d15a00);
  flex-direction: column; gap: 0; font-weight: 800;
}
.buff-btn .buff-line1 { font-size: 10px; letter-spacing: 1px; }
.buff-btn .buff-line2 { font-size: 9px; opacity: .95; }
.rail-time {
  color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 1px;
  background: rgba(0,0,0,.35); padding: 2px 6px; border-radius: 6px;
}

/* ---------- ???? ---------- */
.log-rail {
  position: absolute; right: 4px; top: 8px; bottom: 96px; width: 22px;
  display: flex; flex-direction: column; align-items: flex-end; z-index: 15;
}
.log-rail.open { width: 46vw; max-width: 260px; }
.log-toggle {
  writing-mode: vertical-rl; background: rgba(75,40,163,.75); color: #fff;
  border: none; padding: 8px 4px; border-radius: 8px 0 0 8px;
  font-size: 12px; letter-spacing: 2px;
}
.log-list {
  flex: 1; overflow-y: auto; padding: 6px 8px; margin-top: 6px;
  background: rgba(10,14,28,.85); border: 1px solid rgba(120,90,220,.4);
  border-radius: 8px; width: 100%;
}
.log-item { font-size: 11px; color: #cfd6ee; padding: 2px 0; line-height: 1.35; }
.log-item.small { color: #7a819a; }

/* ---------- ???? ---------- */
.lounge {
  position: relative; flex: 1 1 auto;
  background:
    radial-gradient(120% 60% at 50% 0%, #23305a 0%, #10162a 55%, #060812 100%);
  overflow: hidden;
}
.window-scene {
  position: absolute; left: 12%; right: 12%; top: 6%; height: 30%;
  background: linear-gradient(180deg, #06172e 0%, #0a2044 55%, #142a55 100%);
  border: 3px solid #1a1010; border-radius: 6px;
  box-shadow: inset 0 0 40px rgba(0,0,0,.7), 0 6px 24px rgba(0,0,0,.6);
  overflow: hidden;
}
.window-scene::before, .window-scene::after {
  content: ""; position: absolute; top: 0; bottom: 0; width: 3px; background: #1a1010;
}
.window-scene::before { left: 50%; }
.cityscape {
  position: absolute; inset: 30% 0 20% 0;
  background:
    linear-gradient(90deg, transparent 0 4%, #0e1a30 4% 8%, transparent 8% 12%,
      #16223c 12% 20%, transparent 20% 24%, #0e1a30 24% 32%, transparent 32% 38%,
      #1a2846 38% 46%, transparent 46% 52%, #0e1a30 52% 60%, transparent 60% 66%,
      #16223c 66% 74%, transparent 74% 80%, #0e1a30 80% 88%, transparent 88% 96%);
  filter: brightness(1.1);
}
.skyline {
  position: absolute; inset: 0;
  background-image:
    radial-gradient(1px 1px at 12% 40%, #fce39a 60%, transparent 61%),
    radial-gradient(1px 1px at 22% 55%, #fff7c2 60%, transparent 61%),
    radial-gradient(1px 1px at 34% 30%, #ffd97a 60%, transparent 61%),
    radial-gradient(1px 1px at 46% 60%, #ffe89a 60%, transparent 61%),
    radial-gradient(1px 1px at 58% 42%, #fce39a 60%, transparent 61%),
    radial-gradient(1px 1px at 70% 55%, #fff7c2 60%, transparent 61%),
    radial-gradient(1px 1px at 82% 34%, #ffd97a 60%, transparent 61%),
    radial-gradient(1px 1px at 90% 62%, #ffe89a 60%, transparent 61%);
  opacity: .9;
}
.curtain {
  position: absolute; top: 0; bottom: 0; width: 12%;
  background:
    repeating-linear-gradient(90deg, #0b1d3a 0 6px, #163363 6px 12px, #0b1d3a 12px 18px);
  box-shadow: inset 0 0 30px rgba(0,0,0,.6);
}
.curtain.left { left: 0; }
.curtain.right { right: 0; }
.lounge-sofa {
  position: absolute; bottom: 20%; width: 22%; height: 20%;
  background: linear-gradient(180deg, #6a2828 0%, #3d1414 100%);
  border-radius: 20px 20px 8px 8px;
  box-shadow: inset 0 -8px 0 rgba(0,0,0,.35), 0 10px 20px rgba(0,0,0,.5);
  opacity: .8;
}
.lounge-sofa.left { left: 0; }
.lounge-sofa.right { right: 0; }
.lounge-floor {
  position: absolute; left: 0; right: 0; bottom: 0; height: 20%;
  background:
    linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.75)),
    repeating-linear-gradient(0deg, #1a0d0a 0 12px, #0e0705 12px 24px);
}

/* ---------- ?? ---------- */
.table-wrap {
  position: absolute; inset: 6% 6% 4% 6%;
  display: block;
}
.dealer-top {
  position: absolute; left: 50%; top: 4%; transform: translate(-50%, -40%);
  z-index: 5; pointer-events: none;
}
.dealer-avatar {
  width: 78px; height: 92px; position: relative;
  filter: drop-shadow(0 8px 12px rgba(0,0,0,.55));
}
.dealer-hair {
  position: absolute; left: 12px; right: 12px; top: 0; height: 44px;
  background: linear-gradient(180deg, #2a1a11, #0d0605);
  border-radius: 50% 50% 40% 40% / 60% 60% 40% 40%;
}
.dealer-face {
  position: absolute; left: 18px; right: 18px; top: 10px; height: 40px;
  background: linear-gradient(180deg, #fbdcc0, #f0b790);
  border-radius: 50%;
  box-shadow: inset 0 -4px 0 rgba(0,0,0,.08);
}
.dealer-face .eye {
  position: absolute; top: 18px; width: 4px; height: 4px; border-radius: 50%;
  background: #1a0a04;
}
.dealer-face .eye.left { left: 10px; }
.dealer-face .eye.right { right: 10px; }
.dealer-face .mouth {
  position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%);
  width: 10px; height: 4px; border-radius: 0 0 8px 8px; background: #b6314c;
}
.dealer-body {
  position: absolute; left: 6px; right: 6px; bottom: 0; height: 42px;
  background: linear-gradient(180deg, #1a1a1a, #050505);
  border-radius: 50% 50% 8px 8px / 55% 55% 8px 8px;
  border-top: 3px solid #d92626;
}
.dealer-body::before {
  content: ""; position: absolute; left: 50%; top: 4px; transform: translateX(-50%);
  width: 6px; height: 12px; background: #f5c518; border-radius: 3px;
}

.table {
  position: absolute; left: 6%; right: 6%; top: 8%; bottom: 30%;
  border-radius: 50%/50%;
  background: radial-gradient(ellipse at 50% 40%, #204d8a 0%, #123064 45%, #071736 100%);
  border: 6px solid #050914;
  box-shadow:
    inset 0 0 0 4px #1c2b52,
    inset 0 0 60px rgba(0,0,0,.65),
    0 12px 24px rgba(0,0,0,.7);
}
.table-inner {
  position: absolute; inset: 6%;
  border-radius: 50%/50%;
  border: 2px solid rgba(245,197,24,.35);
  box-shadow: inset 0 0 40px rgba(0,0,0,.35);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.table-watermark {
  position: absolute; left: 0; right: 0; top: 46%; transform: translateY(-50%);
  text-align: center; color: rgba(180,200,255,.10);
  font-size: 42px; font-weight: 900; letter-spacing: 12px; pointer-events: none;
  font-family: "Georgia", serif;
}
.community {
  display: flex; gap: 6px; align-items: center; justify-content: center;
  margin-top: -8px; z-index: 2;
}
.pot-row {
  margin-top: 10px; display: flex; align-items: center; gap: 10px; z-index: 2;
}
.dealer-chip {
  width: 26px; height: 26px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff, #d0d0d0 55%, #8a8a8a 100%);
  color: #1a1a1a; font-weight: 900; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #f5c518;
  box-shadow: 0 3px 6px rgba(0,0,0,.5);
}
.pot-info { display: flex; flex-direction: column; align-items: center; line-height: 1.1; }
.pot-label { font-size: 10px; color: #cfd6ee; letter-spacing: 3px; }
.pot-amount { font-size: 18px; font-weight: 900; color: #f5c518; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
.stage-tag {
  position: absolute; top: 10%; right: 12%;
  font-size: 10px; letter-spacing: 3px; color: #f5c518; opacity: .85;
}
.winners {
  position: absolute; left: 8%; right: 8%; bottom: 10%;
  text-align: center; font-size: 12px; color: #f5c518;
}
.winner-line { padding: 1px 0; }
.winner-line .small { color: #cfd6ee; }

/* ---------- ????? 6 ?? ---------- */
.seat {
  position: absolute; width: 22%; max-width: 96px; min-width: 74px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  color: #eef1fa;
  z-index: 3;
}
.seat-1 { left: 22%; bottom: 22%; transform: translateX(-50%); }
.seat-2 { right: 6%;  bottom: 24%; }
.seat-3 { right: 2%;  top: 24%; }
.seat-4 { right: 30%; top: -1%; }
.seat-5 { left: 30%;  top: -1%; }
.seat-6 { left: 6%;   bottom: 24%; }

.seat.active { filter: drop-shadow(0 0 6px rgba(245,197,24,.7)); }
.seat.folded { opacity: .5; }
.seat.bust { opacity: .35; }
.seat.offline { filter: grayscale(.6); }

.avatar-wrap {
  position: relative; width: 54px; height: 54px;
}
.avatar {
  position: absolute; inset: 3px; border-radius: 50%;
  background: linear-gradient(160deg, #3f2a86, #1a1230);
  border: 2px solid #f5c518;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 800; font-size: 18px;
  box-shadow: 0 3px 8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.2);
}
.seat.me .avatar { border-color: #4dd0e1; }
.gift-icon {
  position: absolute; right: -6px; top: -4px;
  width: 20px; height: 20px; border-radius: 6px;
  background: linear-gradient(160deg, #a06bff, #5b2ecc);
  border: 1px solid #d3b8ff;
  color: #fff; font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,.5);
}
.dealer-badge {
  position: absolute; left: -8px; bottom: -4px;
  width: 20px; height: 20px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff, #b0b0b0 60%, #6a6a6a 100%);
  color: #1a1a1a; font-weight: 900; font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #f5c518;
}
.timer-ring {
  position: absolute; inset: -3px; width: calc(100% + 6px); height: calc(100% + 6px);
  transform: rotate(-90deg);
}
.timer-ring .ring-bg {
  fill: none; stroke: rgba(255,255,255,.15); stroke-width: 3;
}
.timer-ring .ring-fg {
  fill: none; stroke: #f5c518; stroke-width: 3; stroke-linecap: round;
  transition: stroke-dashoffset .4s linear;
}
.timer-num {
  position: absolute; left: 50%; bottom: -14px; transform: translateX(-50%);
  font-size: 10px; font-weight: 800; color: #f5c518;
  background: rgba(0,0,0,.55); padding: 1px 5px; border-radius: 8px;
}

.seat-name-row { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
.seat-name { font-size: 12px; font-weight: 700; max-width: 78px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.chip-row {
  display: inline-flex; align-items: center; gap: 3px; padding: 1px 8px;
  background: rgba(0,0,0,.55); border-radius: 10px;
  border: 1px solid rgba(245,197,24,.4);
  font-size: 12px; color: #f5c518; font-weight: 800;
}
.chip-row .coin { color: #ffe680; font-size: 12px; }

.seat-tags { display: flex; gap: 3px; margin-top: 2px; flex-wrap: wrap; justify-content: center; }
.tag {
  font-size: 9px; padding: 1px 4px; border-radius: 6px; background: #2a3350; color: #cfd6ee;
  border: 1px solid #3d4a75;
}
.tag.bot { background: #22323f; }
.tag.sb { background: #274a8a; color: #cfe7ff; }
.tag.bb { background: #7a4b0f; color: #ffe0a8; }
.tag.fold { background: #4a1e1e; color: #ffb0b0; }
.tag.allin { background: #5a1e75; color: #f0d0ff; }

.seat-cards {
  position: absolute; top: -34px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 3px;
}
.hand-mask {
  position: absolute; left: 50%; top: 100%; transform: translate(-50%, 2px);
  font-size: 9px; color: #cfd6ee; background: rgba(0,0,0,.55);
  padding: 1px 4px; border-radius: 4px; white-space: nowrap;
}
.seat-bet {
  position: absolute; top: -14px; right: -8px;
  display: inline-flex; align-items: center; gap: 3px;
  background: rgba(0,0,0,.6); border: 1px solid #f5c518; border-radius: 10px;
  padding: 1px 6px; font-size: 10px; color: #f5c518; font-weight: 800;
}

/* ---------- ????????? + ?? + ?? ---------- */
.me-panel {
  position: absolute; left: 2%; bottom: -2%;
  width: 46%; max-width: 220px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 4px 6px 6px; border-radius: 12px;
  background: linear-gradient(180deg, rgba(20,30,60,.75), rgba(6,10,26,.9));
  border: 1px solid rgba(245,197,24,.4);
  box-shadow: 0 6px 18px rgba(0,0,0,.55);
  z-index: 6;
}
.me-panel.active { animation: mePulse 1.2s infinite; }
@keyframes mePulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(245,197,24,.6); }
  50% { box-shadow: 0 0 0 6px rgba(245,197,24,0); }
}
.me-cards { display: flex; gap: 6px; }
.me-rank {
  font-size: 12px; font-weight: 800; color: #f5c518; letter-spacing: 1px;
}
.me-win { width: 100%; }
.me-win-bar {
  height: 6px; border-radius: 4px; background: rgba(255,255,255,.12); overflow: hidden;
  border: 1px solid rgba(255,255,255,.15);
}
.me-win-fill {
  height: 100%; background: linear-gradient(90deg, #4dd0e1, #f5c518);
  transition: width .4s ease;
}
.me-win-text { font-size: 10px; color: #cfd6ee; text-align: right; margin-top: 1px; }

/* ---------- ???? 4 ?? ---------- */
.action-bar {
  flex: 0 0 auto;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
  padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
  background: linear-gradient(to top, #05070f 60%, transparent);
  z-index: 25;
}
.act-btn {
  height: 46px; border-radius: 14px; border: 1px solid #6b93ff;
  background: linear-gradient(180deg, #2f4fb0, #16296b);
  color: #fff; font-size: 14px; font-weight: 800; letter-spacing: 1px;
  box-shadow: 0 4px 10px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.2);
  cursor: pointer;
}
.act-btn.primary {
  background: linear-gradient(180deg, #3f6bff, #1f3ecf);
  border-color: #9db6ff;
}
.act-btn:disabled {
  background: linear-gradient(180deg, #303645, #1a1e2a);
  color: #6b7396; border-color: #2d3547; cursor: not-allowed;
  box-shadow: none;
}

.err {
  position: absolute; bottom: 66px; left: 50%; transform: translateX(-50%);
  color: #ff8a80; font-size: 12px; z-index: 40;
  background: rgba(0,0,0,.7); padding: 3px 10px; border-radius: 6px;
}
.loading {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #cfd6ee; font-size: 14px;
}

/* ???? */
@media (max-width: 380px) {
  .table-watermark { font-size: 32px; letter-spacing: 8px; }
  .act-btn { font-size: 13px; height: 42px; }
  .avatar-wrap { width: 46px; height: 46px; }
  .avatar { font-size: 15px; }
}
</style>
