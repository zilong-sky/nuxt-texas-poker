<template>
  <div class='game-page' :style="{ '--vvw': vvw + 'px', '--vvh': vvh + 'px' }">
    <!-- 左侧竖向功能栏：返回 + 系统时间 + 聊天 + 靶心 + BUFF -->
    <div class='top-rail'>
      <button class='rail-btn back-btn' title='返回' @click='onBack'>
        <span class='arrow'>←</span>
      </button>
      <div class='rail-time'>{{ clockText }}</div>
      <button class='rail-btn chat-btn' title='聊天' @click='chatOpen = !chatOpen'>
        <span class='ico'>💬</span>
      </button>
    </div>
    <div class='bottom-rail'>
      <button class='rail-btn target-btn' title='靶心'>
        <span class='ico-target'></span>
      </button>
      <button class='rail-btn buff-btn' title='BUFF'>
        <span class='buff-line1'>BUFF</span>
        <span class='buff-line2'>5% · 1X</span>
      </button>
    </div>

    <!-- 右侧竖向操作日志滚动区 -->
    <section class='log-rail' :class='{ open: logOpen }'>
      <button class='log-toggle' @click='logOpen = !logOpen'>{{ logOpen ? logLabelClose : logLabelOpen }}</button>
      <div v-if='logOpen' class='log-list'>
        <div v-for='(l, i) in logList' :key='i' class='log-item'>• {{ l }}</div>
        <div v-if='!logList.length' class='log-item small'>暂无日志</div>
      </div>
    </section>

    <div v-if='!room || !room.game' class='loading' role='status'>加载中…(Loading)</div>

    <template v-else>
      <!-- 包厢背景：夜景窗户 + 窗帘 + 沙发 + 地毯 -->
      <div class='lounge'>
        <div class='window-scene'>
          <div class='cityscape'></div>
          <div class='skyline'></div>
          <div class='curtain left'></div>
          <div class='curtain right'></div>
        </div>
        <div class='lounge-sofa left'></div>
        <div class='lounge-sofa right'></div>
        <div class='lounge-floor'></div>

        <div class='table-wrap'>
          <div class='dealer-top'>
            <div class='dealer-avatar' aria-label='dealer'>
              <div class='dealer-hair'></div>
              <div class='dealer-face'>
                <div class='eye left'></div>
                <div class='eye right'></div>
                <div class='mouth'></div>
              </div>
              <div class='dealer-body'></div>
            </div>
          </div>

          <div class='table'>
            <div class='table-inner'>
              <div class='table-watermark'>{{ watermark }}</div>
              <div class='corner-deco'>
                <div class='dealer-chip'>D</div>
                <span class='red-back deco-back'></span>
              </div>
              <div class='pot-row'>
                <div class='pot-info'>
                  <div class='pot-label'>底池</div>
                  <div class='pot-amount'>{{ formatChips(pot) }}</div>
                </div>
              </div>
              <div class='community'>
                <PokerCard v-for='i in 5' :key='i' :card='community[i - 1] || null' :face='!!community[i - 1]' size='normal' class='board-card' />
              </div>
              <div class='stage-tag'>{{ stageLabel }}</div>
              <div v-if='winners.length' class='winners'>
                <div v-for='w in winners' :key='w.playerId' class='winner-line'>
                  <strong>{{ playerName(w.playerId) }}</strong>
                  <span>+{{ formatChips(w.amount) }}</span>
                  <span v-if='w.hand' class='small'>「{{ w.hand }}」</span>
                </div>
              </div>
            </div>

            <!-- 桌面上：其他5席位的背面手牌，按席位方向贴在桌面边缘 -->
            <template v-for='s in seats' :key="'th-'+s.player.id">
              <div v-if='!s.isMe' class='table-hand' :class="'th-seat-'+s.seatNo">
                <PokerCard v-for='(c, ci) in otherHand(s.player)' :key='ci' :card='c' :face='revealStage && !!c' size='mini' />
                <div v-if='!revealStage && s.player.hand && s.player.hand.length' class='hand-mask'>暂时无法查看</div>
                <div v-if='s.dealer' class='table-dealer-chip'>D</div>
              </div>
            </template>

          </div>

          <!-- 6 席位环形布局：席位1 = 玩家本人（下方左侧永久固定），仅头像+筹码，无名字 -->
          <div v-for='s in seats' :key='s.player.id' class='seat' :class='[seatPrefix + s.seatNo, { active: s.active, folded: s.player.folded, bust: s.player.bust, me: s.isMe, offline: s.player.offline }]'>
            <div class='avatar-wrap' :class='{ turn: s.active }'>
              <svg v-if='s.active' class='timer-ring' viewBox='0 0 44 44'>
                <circle class='ring-bg' cx='22' cy='22' r='20' />
                <circle class='ring-fg' cx='22' cy='22' r='20' :stroke-dasharray='125.66' :stroke-dashoffset='125.66 * (1 - s.timerPct / 100)' />
              </svg>
              <div class='avatar'>{{ initial(s.player.name) }}</div>
              <div class='gift-badge' aria-hidden='true'>🎁</div>
              <div v-if='s.active' class='timer-num'>{{ s.remaining }}</div>
            </div>
            <div class='chip-row'>
              <span class='coin'>🪙</span>
              <span class='chip-val'>{{ formatChips(s.player.chips) }}M</span>
            </div>
            <div class='seat-tags'>
              <span v-if='s.sb' class='tag sb'>SB</span>
              <span v-if='s.bb' class='tag bb'>BB</span>
              <span v-if='s.player.folded' class='tag fold'>弃牌</span>
              <span v-if='s.player.allIn' class='tag allin'>全下</span>
              <span v-if='s.player.bust' class='tag fold'>出局</span>
            </div>
            <!-- 已下注/全下时展示红色牌背 -->
            <div v-if='s.player.bet > 0 || s.player.allIn' class='bet-cards' :class='{ allin: s.player.allIn }'>
              <span class='red-back'></span>
              <span class='red-back offset'></span>
            </div>
            <div v-if='s.player.bet > 0' class='seat-bet'>
              <span class='coin'>🪙</span>
              <span>{{ formatChips(s.player.bet) }}</span>
            </div>
          </div>

          <!-- 我方手牌 + 牌型 + 胜率 + 倒计时，紧贴席位1头像上方 -->
          <div class='me-panel' :class='{ active: isMyTurn }'>
            <svg v-if='isMyTurn' class='me-timer-ring' viewBox='0 0 100 100'>
              <circle class='ring-bg' cx='50' cy='50' r='46' />
              <circle class='ring-fg' cx='50' cy='50' r='46' :stroke-dasharray='289.03' :stroke-dashoffset='289.03 * (1 - timerPctVal / 100)' />
              <text class='ring-text' x='50' y='58' text-anchor='middle'>{{ remaining }}</text>
            </svg>
            <div class='me-cards'>
              <PokerCard v-for='(c, ci) in myHand' :key='ci' :card='c' :face='!!c' size='big' />
              <div v-if='dealerIsMe' class='table-dealer-chip me-dealer'>D</div>
            </div>
            <div class='me-rank'>{{ meHandRankText }}</div>
            <div class='me-win'>
              <div class='me-win-bar'>
                <div class='me-win-fill' :style='{ width: winRatePct + pctSuffix }'></div>
              </div>
              <div class='me-win-text'>胜率 {{ winRatePct }}%</div>
            </div>
          </div>

        </div>
      </div>

      <!-- 底部操作 4 按钮 -->
      <footer class='action-bar'>
        <button class='act-btn' :disabled='foldDisabled' @click='doAction(actFold)'>弃牌</button>
        <button class='act-btn' :disabled='foldDisabled' @click='doAction(canCheck ? actCheck : actFold)'>{{ canCheck ? checkLabel : checkFoldLabel }}</button>
        <button class='act-btn' :disabled='checkDisabled' @click='doAction(actCheck)'>过牌</button>
        <button class='act-btn primary' :disabled='foldDisabled' @click='doAction(canCheck ? actCheck : actCall)'>{{ callBtnLabel }}</button>
      </footer>
    </template>

    <p v-if='err' class='err'>{{ err }}</p>
  </div>
</template>

<script setup lang='ts'>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { usePokerStore } from '~/stores/poker'

const vvw = ref(typeof window !== 'undefined' ? window.innerWidth : 0)
const vvh = ref(typeof window !== 'undefined' ? window.innerHeight : 0)
function updateViewport() {
  const vv = (typeof window !== 'undefined') ? window.visualViewport : null
  vvw.value = vv ? vv.width : (typeof window !== 'undefined' ? window.innerWidth : 0)
  vvh.value = vv ? vv.height : (typeof window !== 'undefined' ? window.innerHeight : 0)
}

// 常量字符串（避免模板中使用引号/反引号，方便通过 shell 写文件）
const logLabelClose = '收起'
const logLabelOpen = '日志'
const watermark = 'HOLD' + String.fromCharCode(39) + 'EM'
const seatPrefix = 'seat-'
const pctSuffix = '%'
const actFold = 'fold'
const actCheck = 'check'
const actCall = 'call'
const checkLabel = '过牌'
const checkFoldLabel = '过牌/弃牌'

const route = useRoute()
const roomId = route.params.id as string
const store = usePokerStore()

const room = computed<any>(() => store.room)
const me = computed<any>(() => store.me)
const err = ref('')
const now = ref(Date.now())
const logOpen = ref(false)
const chatOpen = ref(false)

// 席位 1..6 环形分布：席位 1 = 玩家本人（下方左侧永久固定）
// 顺时针填充：偏移 0 -> 席位1；1..5 -> 席位 2,3,4,5,6
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

const dealerIsMe = computed(() => players.value[dealerIdx.value]?.id === store.playerId)
const isMyTurn = computed(() => {
  const g = game.value
  if (!g || g.stage === 'ended') return false
  return players.value[actionIdx.value]?.id === store.playerId
})
const toCall = computed(() => Math.max(0, (game.value?.currentBet || 0) - (me.value?.bet || 0)))
const canCheck = computed(() => toCall.value === 0)

const foldDisabled = computed(() => !isMyTurn.value || game.value?.stage === 'ended')
const checkDisabled = computed(() => !isMyTurn.value || !canCheck.value || game.value?.stage === 'ended')
const callBtnLabel = computed(() => {
  if (canCheck.value) return '跟任意注'
  return '跟 ' + formatChips(toCall.value)
})

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

const handTypeHint = computed(() => {
  const h = myHand.value
  if (!h[0] || !h[1]) return ''
  const r1 = h[0].rank, r2 = h[1].rank
  const s1 = h[0].suit, s2 = h[1].suit
  if (r1 === r2) return '口袋对子'
  if (s1 === s2) return '同花两张'
  return '高牌'
})
const meHandRankText = computed(() => me.value?.handRank || handTypeHint.value || '—')

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

const clockText = computed(() => {
  const d = new Date(now.value)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return hh + ':' + mm
})

onMounted(async () => {
  if (typeof window !== 'undefined') {
    updateViewport()
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', updateViewport)
      vv.addEventListener('scroll', updateViewport)
    }
    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)
  }
  store.loadClientState()
  if (!store.token) { await navigateTo('/'); return }
  if (!store.playerId) await store.reconnect()
  await refresh()
})

async function refresh() {
  try {
    await store.fetchState(roomId)
    if (store.room?.status === 'waiting') await navigateTo('/room/' + roomId)
  } catch (e: any) {
    err.value = e?.statusMessage || 'load failed'
  }
}

const { pause, resume } = useIntervalFn(refresh, 2000, { immediate: true })
const tick = useIntervalFn(() => { now.value = Date.now() }, 500, { immediate: true })

if (import.meta.client) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); tick.pause() }
    else { resume(); tick.resume(); refresh() }
  })
}

onBeforeUnmount(() => {
  pause(); tick.pause()
  if (typeof window !== 'undefined') {
    const vv = window.visualViewport
    if (vv) {
      vv.removeEventListener('resize', updateViewport)
      vv.removeEventListener('scroll', updateViewport)
    }
    window.removeEventListener('resize', updateViewport)
    window.removeEventListener('orientationchange', updateViewport)
  }
})

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
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
/* Force landscape on portrait devices by rotating the whole page 90deg. */
@media (orientation: portrait) {
  .game-page {
    position: fixed;
    top: 0;
    left: 0;
    width: var(--vvh, 100vh);
    height: var(--vvw, 100vw);
    transform-origin: top left;
    transform: translate(var(--vvw, 100vw), 0) rotate(90deg);
    overflow: hidden;
    inset: auto;
  }
}
@media (orientation: landscape) {
  .game-page {
    transform: none;
    width: var(--vvw, 100%);
    height: var(--vvh, 100%);
  }
}


/* ---------- 左侧竖向功能栏 ---------- */
.top-rail {
  position: absolute; left: 8px; top: 8px;
  display: flex; flex-direction: row; align-items: center; gap: 8px;
  z-index: 20;
}
.bottom-rail {
  position: absolute; left: 8px; bottom: 8px;
  display: flex; flex-direction: row; align-items: center; gap: 8px;
  z-index: 20;
}
.top-rail .rail-btn, .bottom-rail .rail-btn { background: rgba(0,0,0,.35); }
.rail-btn {
  width: 36px; height: 36px; border-radius: 10px; border: none; color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 8px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.12);
  opacity: .88;
  cursor: pointer; padding: 0; line-height: 1;
}
.rail-btn:hover { opacity: 1; }
.rail-btn .arrow { font-size: 16px; }
.rail-btn .ico { font-size: 16px; }
.back-btn, .chat-btn {
  background: linear-gradient(180deg, rgba(122,75,214,.78), rgba(75,40,163,.78));
}
.target-btn {
  background: radial-gradient(circle at 50% 50%,
    rgba(255,255,255,.9) 0 22%, rgba(229,57,53,.85) 22% 40%, rgba(255,255,255,.9) 40% 55%, rgba(229,57,53,.85) 55% 72%, rgba(255,255,255,.9) 72% 82%, rgba(229,57,53,.85) 82% 100%);
  border-radius: 50%;
  position: relative;
}
.target-btn .ico-target { width: 5px; height: 5px; border-radius: 50%; background: #111; box-shadow: 0 0 0 2px #fff; }
.buff-btn {
  background: linear-gradient(180deg, rgba(255,154,47,.82), rgba(209,90,0,.82));
  flex-direction: column; gap: 0; font-weight: 800;
}
.buff-btn .buff-line1 { font-size: 9px; letter-spacing: 1px; }
.buff-btn .buff-line2 { font-size: 8px; opacity: .95; }
.rail-time {
  color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 1px;
  background: rgba(0,0,0,.35); padding: 2px 6px; border-radius: 6px;
}

/* ---------- 右侧操作日志 ---------- */
.log-rail {
  position: absolute; right: 4px; top: 8px; bottom: 96px; width: 24px;
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

/* ---------- 包厢背景 ---------- */
.lounge {
  position: relative; flex: 1 1 auto;
  background:
    radial-gradient(120% 60% at 50% 0%, #23305a 0%, #10162a 55%, #060812 100%);
  overflow: hidden;
  container-type: size;
}
.window-scene {
  position: absolute; left: 12%; right: 12%; top: 6%; height: 30%;
  background: linear-gradient(180deg, #06172e 0%, #0a2044 55%, #142a55 100%);
  border: 3px solid #1a1010; border-radius: 6px;
  box-shadow: inset 0 0 40px rgba(0,0,0,.7), 0 6px 24px rgba(0,0,0,.6);
  overflow: hidden;
}
.window-scene::before, .window-scene::after {
  content: ''; position: absolute; top: 0; bottom: 0; width: 3px; background: #1a1010;
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

/* ---------- 桌面 & 荷官 ---------- */
.table-wrap {
  position: absolute; left: 110px; right: 110px; top: 50%;
  transform: translateY(-50%);
  height: clamp(140px, 26vh, 220px);
  width: auto;
  max-width: calc(100% - 220px);
  margin: 0 auto;
}
.dealer-top {
  position: absolute; left: 50%; top: 0; transform: translate(-50%, -100%);
  z-index: 6; pointer-events: none;
}
.dealer-avatar {
  width: 78px; height: 92px; position: relative;
  filter: drop-shadow(0 8px 12px rgba(0,0,0,.55));
  transform: scale(0.7); transform-origin: bottom center;
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
  content: ''; position: absolute; left: 50%; top: 4px; transform: translateX(-50%);
  width: 6px; height: 12px; background: #f5c518; border-radius: 3px;
}

.table {
  position: absolute; inset: 0;
  border-radius: 9999px;
  background: radial-gradient(ellipse at 50% 40%, #204d8a 0%, #123064 45%, #071736 100%);
  border: 6px solid #050914;
  box-shadow:
    inset 0 0 0 4px #1c2b52,
    inset 0 0 60px rgba(0,0,0,.65),
    0 12px 24px rgba(0,0,0,.7);
}
.table-inner {
  position: absolute; inset: 5%;
  border-radius: 9999px;
  border: 2px solid rgba(245,197,24,.35);
  box-shadow: inset 0 0 40px rgba(0,0,0,.35);
}
.table-watermark {
  position: absolute; left: 0; right: 0; top: 46%; transform: translateY(-50%);
  text-align: center; color: rgba(180,200,255,.10);
  font-size: 42px; font-weight: 900; letter-spacing: 12px; pointer-events: none;
  font-family: 'Georgia', serif;
}
.community {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  display: flex; gap: 6px; align-items: center; justify-content: center;
  z-index: 2;
}
.pot-row {
  position: absolute; left: 50%; top: 14%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px; z-index: 3;
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

/* ---------- 左上角庄位装饰：D 筹码 + 红色牌背 ---------- */
.corner-deco {
  position: absolute; left: 8%; top: 12%;
  display: flex; align-items: center; gap: 6px;
  z-index: 3; pointer-events: none;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,.5));
}
.corner-deco .dealer-chip { width: 28px; height: 28px; font-size: 14px; }
.corner-deco .deco-back {
  width: 22px; height: 30px; border-radius: 3px;
  background:
    repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 3px, transparent 3px 6px),
    linear-gradient(135deg, #d21f3c, #6a0a1c);
  border: 1px solid #3a0a12;
  box-shadow: inset 0 0 4px rgba(255,255,255,.15);
  transform: rotate(-8deg);
}

/* ---------- 头像紫色礼物角标 ---------- */
.gift-badge {
  position: absolute; top: -4px; right: -4px;
  width: 20px; height: 20px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #b98cff, #6a2fcf 65%, #3d1685 100%);
  border: 2px solid #f5c518;
  color: #fff; font-size: 11px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 5px rgba(0,0,0,.55);
  z-index: 5;
}
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

/* ---------- 席位（6 席环形） ---------- */
.seat {
  position: absolute; width: 74px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  color: #eef1fa;
  z-index: 3;
}
.seat-1 { left: 30%; top: 100%; transform: translate(-50%, -50%); }
.seat-2 { left: 70%; top: 100%; transform: translate(-50%, -50%); }
.seat-3 { left: 100%; top: 50%; transform: translate(0, -50%); }
.seat-4 { left: 70%; top: 0; transform: translate(-50%, -100%); }
.seat-5 { left: 30%; top: 0; transform: translate(-50%, -100%); }
.seat-6 { left: 0; top: 50%; transform: translate(-100%, -50%); }

.seat.active { filter: drop-shadow(0 0 6px rgba(245,197,24,.7)); }
.seat.folded { opacity: .5; }
.seat.bust { opacity: .35; }
.seat.offline { filter: grayscale(.6); }

.avatar-wrap { position: relative; width: 54px; height: 54px; flex: 0 0 54px; overflow: visible; }
.avatar {
  position: absolute; inset: 3px; border-radius: 50%;
  background: linear-gradient(160deg, #3f2a86, #1a1230);
  border: 2px solid #f5c518;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 800; font-size: 18px;
  box-shadow: 0 3px 8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.2);
}
.seat.me .avatar { border-color: #4dd0e1; }
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
.timer-ring .ring-bg { fill: none; stroke: rgba(255,255,255,.15); stroke-width: 3; }
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
  background: linear-gradient(180deg, #f5c518, #b8890a);
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,.45);
  font-size: 12px; color: #1a1206; font-weight: 800;
  margin-top: -10px; position: relative; z-index: 4;
  box-shadow: 0 2px 4px rgba(0,0,0,.5);
}
.chip-row .coin { font-size: 12px; }

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

/* 已下注：红色牌背标记（席位侧） */
.bet-cards {
  position: absolute; top: -6px; right: -18px;
  display: flex; z-index: 4; pointer-events: none;
  filter: drop-shadow(0 3px 5px rgba(0,0,0,.55));
}
.bet-cards .red-back {
  width: 14px; height: 20px; border-radius: 3px;
  background:
    repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 3px, transparent 3px 6px),
    linear-gradient(135deg, #d21f3c, #6a0a1c);
  border: 1px solid #3a0a12;
  box-shadow: inset 0 0 4px rgba(255,255,255,.15);
}
.bet-cards .red-back.offset { margin-left: -8px; transform: rotate(10deg); }
.bet-cards.allin .red-back { box-shadow: 0 0 6px rgba(255, 80, 80, .8); }
.seat-bet {
  position: absolute; top: 12px; right: -16px;
  display: inline-flex; align-items: center; gap: 3px;
  background: rgba(0,0,0,.7); border: 1px solid #f5c518; border-radius: 10px;
  padding: 1px 6px; font-size: 10px; color: #f5c518; font-weight: 800;
  z-index: 5;
}

/* ---------- 玩家本人（席位1）面板 ---------- */
.me-panel {
  position: absolute; left: 50%; top: 100%;
  transform: translate(-50%, -50%);
  width: auto; max-width: 220px; min-width: 130px;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 4px 8px 6px; border-radius: 12px;
  background: linear-gradient(180deg, rgba(20,30,60,.78), rgba(6,10,26,.92));
  border: 1px solid rgba(245,197,24,.5);
  box-shadow: 0 6px 18px rgba(0,0,0,.6);
  z-index: 10;
  z-index: 18;
}
.me-timer-ring {
  position: absolute; top: 50%; left: -10px; transform: translate(-100%, -50%);
  width: 44px; height: 44px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.5));
}
.me-timer-ring .ring-bg { fill: rgba(0,0,0,.55); stroke: rgba(255,255,255,.15); stroke-width: 4; }
.me-timer-ring .ring-fg {
  fill: none; stroke: #f5c518; stroke-width: 4; stroke-linecap: round;
  transform: rotate(-90deg); transform-origin: 50% 50%;
  transition: stroke-dashoffset .4s linear;
}
.me-timer-ring .ring-text {
  fill: #f5c518; font-size: 26px; font-weight: 800;
  font-family: system-ui, sans-serif;
}
.me-cards { position: relative; }
.me-cards :deep(.pcard.big) { width: 52px; height: 72px; }
.me-cards :deep(.pcard.big .r) { font-size: 22px; }
.me-cards :deep(.pcard.big .s) { font-size: 18px; }
.me-cards :deep(.pcard.big.back)::after { font-size: 24px; }
.table-hand {
  position: absolute; display: flex; gap: 3px; z-index: 3;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,.6));
}
.table-hand .hand-mask {
  position: absolute; left: 50%; top: 100%; transform: translate(-50%, 2px);
  font-size: 9px; color: #cfd6ee; background: rgba(0,0,0,.55);
  padding: 1px 4px; border-radius: 4px; white-space: nowrap;
}
/* non-me hands anchored on the INNER side of each avatar (toward table center) */
.table-hand { transform: translate(-50%, -50%); }
.table-hand.th-seat-2 { left: 70%; top: 66%; }
.table-hand.th-seat-3 { left: 70%; top: 34%; }
.table-hand.th-seat-4 { left: 60%; top: 30%; }
.table-hand.th-seat-5 { left: 40%; top: 30%; }
.table-hand.th-seat-6 { left: 30%; top: 50%; }
.table-dealer-chip {
  position: absolute; left: 100%; top: 50%; transform: translate(4px, -50%);
  width: 20px; height: 20px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff, #b0b0b0 60%, #6a6a6a 100%);
  color: #1a1a1a; font-weight: 900; font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #f5c518;
  box-shadow: 0 2px 5px rgba(0,0,0,.55);
  z-index: 4;
}
.table-dealer-chip.me-dealer {
  left: auto; right: -22px; top: 50%; transform: translateY(-50%);
}
.me-panel.active { animation: mePulse 1.2s infinite; }
@keyframes mePulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(245,197,24,.6); }
  50% { box-shadow: 0 0 0 6px rgba(245,197,24,0); }
}
.me-cards { display: flex; gap: 4px; }
.me-rank { font-size: 12px; font-weight: 800; color: #f5c518; letter-spacing: 1px; }
.me-win { width: 100%; }
.me-win-bar {
  height: 6px; border-radius: 4px; background: rgba(255,255,255,.12); overflow: hidden;
  border: 1px solid rgba(255,255,255,.15);
}
.me-win-fill {
  height: 100%;
  background: linear-gradient(90deg, #4dd0e1 0%, #7bfdd0 40%, #f5c518 80%, #ff6a3d 100%);
  transition: width .4s ease;
}
.me-win-text { font-size: 10px; color: #cfd6ee; text-align: right; margin-top: 1px; }

/* ---------- 底部动作按钮 ---------- */
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
  color: #ffffff; font-size: 16px; font-weight: 700; letter-spacing: 1px;
  background: #0a0d14; z-index: 50;
}

@media (max-width: 380px) {
  .table-watermark { font-size: 32px; letter-spacing: 8px; }
  .act-btn { font-size: 13px; height: 42px; }
  .avatar-wrap { width: 46px; height: 46px; }
  .avatar { font-size: 15px; }
}
</style>

<style>
html, body { overscroll-behavior: none; }
</style>
