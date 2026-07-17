import { randomUUID } from 'node:crypto'
import type { Game, Player, Room, Stage } from './types'
import { ACTION_TIMEOUT_MS, BIG_BLIND, SMALL_BLIND } from './types'
import { cardToStr, createShuffledDeck, dealCards, settleSidePots } from './poker'
import { botDecide } from './bot'

/**
 * 游戏推进 / 行动处理 / 超时逻辑。
 * 所有函数直接修改传入的 Room 对象，调用方负责写回 KV。
 */

function activePlayers(room: Room): Player[] {
  return room.players.filter(p => !p.bust)
}

function inHandPlayers(room: Room): Player[] {
  return room.players.filter(p => !p.bust && !p.folded)
}

/** 找出下一个仍可行动的玩家索引（跳过 fold / allin / bust） */
function nextActionIdx(room: Room, from: number): number {
  const n = room.players.length
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n
    const p = room.players[idx]
    if (!p.bust && !p.folded && !p.allIn) return idx
  }
  return -1
}

/** 找到下一位「未破产」玩家（用于庄家 / 盲注） */
function nextAliveIdx(room: Room, from: number): number {
  const n = room.players.length
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n
    if (!room.players[idx].bust) return idx
  }
  return from
}

/** 开始新一局 */
export function startNewHand(room: Room) {
  room.lastSeenAt = Date.now()
  const alive = activePlayers(room)
  if (alive.length < 2) {
    room.status = 'ended'
    return
  }
  // 清理玩家状态
  for (const p of room.players) {
    p.hand = []
    p.bet = 0
    p.totalBet = 0
    p.folded = false
    p.allIn = false
    p.hasActed = false
  }
  // 庄家左移
  const prevDealer = room.game?.dealerIdx ?? -1
  const dealerIdx = prevDealer < 0
    ? Math.floor(Math.random() * room.players.length)
    : nextAliveIdx(room, prevDealer)

  const deck = createShuffledDeck()

  const game: Game = {
    deck,
    community: [],
    stage: 'preflop',
    pot: 0,
    currentBet: BIG_BLIND,
    minRaise: BIG_BLIND,
    dealerIdx,
    actionIdx: 0,
    actionDeadline: 0,
    lastActionAt: Date.now(),
    log: []
  }
  room.game = game

  // 盲注
  const sbIdx = nextAliveIdx(room, dealerIdx)
  const bbIdx = nextAliveIdx(room, sbIdx)
  placeBlind(room.players[sbIdx], SMALL_BLIND, game)
  placeBlind(room.players[bbIdx], BIG_BLIND, game)
  game.log.push(`${room.players[sbIdx].name} 下小盲 ${SMALL_BLIND}`)
  game.log.push(`${room.players[bbIdx].name} 下大盲 ${BIG_BLIND}`)

  // 发手牌（每人 2 张）
  for (const p of room.players) {
    if (p.bust) continue
    p.hand = dealCards(deck, 2)
  }

  // 首个行动位为大盲后一位
  game.actionIdx = nextActionIdx(room, bbIdx)
  game.actionDeadline = Date.now() + ACTION_TIMEOUT_MS
  room.status = 'playing'
}

function placeBlind(p: Player, amount: number, game: Game) {
  const bet = Math.min(amount, p.chips)
  p.chips -= bet
  p.bet += bet
  p.totalBet += bet
  game.pot += bet
  if (p.chips === 0) p.allIn = true
}

/** 判断本轮下注是否结束 */
function isBettingRoundOver(room: Room): boolean {
  const alive = inHandPlayers(room)
  if (alive.length <= 1) return true
  // 所有非 fold 非 allin 的玩家都已行动且 bet 相等
  const active = alive.filter(p => !p.allIn)
  if (active.length === 0) return true
  const target = room.game!.currentBet
  return active.every(p => p.hasActed && p.bet === target)
}

/** 推进到下一阶段 */
function advanceStage(room: Room) {
  const game = room.game!
  // 结束本轮：清空 bet，reset hasActed
  for (const p of room.players) {
    p.bet = 0
    p.hasActed = false
  }
  game.currentBet = 0
  game.minRaise = BIG_BLIND

  const alive = inHandPlayers(room)
  if (alive.length <= 1) {
    // 直接结束
    finishHand(room)
    return
  }

  if (game.stage === 'preflop') {
    // 发 3 张翻牌
    game.community.push(...dealCards(game.deck, 3))
    game.stage = 'flop'
    game.log.push(`翻牌：${game.community.map(cardToStr).join(' ')}`)
  } else if (game.stage === 'flop') {
    game.community.push(...dealCards(game.deck, 1))
    game.stage = 'turn'
    game.log.push(`转牌：${cardToStr(game.community[3])}`)
  } else if (game.stage === 'turn') {
    game.community.push(...dealCards(game.deck, 1))
    game.stage = 'river'
    game.log.push(`河牌：${cardToStr(game.community[4])}`)
  } else if (game.stage === 'river') {
    finishHand(room)
    return
  }

  // 如果剩余可行动玩家 <=1（其他 allin），直接推进到下一阶段
  const canAct = inHandPlayers(room).filter(p => !p.allIn)
  if (canAct.length <= 1) {
    // 快速发完剩余公共牌到摊牌
    while (game.community.length < 5) {
      game.community.push(...dealCards(game.deck, 1))
    }
    finishHand(room)
    return
  }

  // 新一轮行动从庄家左侧第一位仍可行动的玩家开始
  game.actionIdx = nextActionIdx(room, game.dealerIdx)
  game.actionDeadline = Date.now() + ACTION_TIMEOUT_MS
}

/** 结算本局 */
function finishHand(room: Room) {
  const game = room.game!
  game.stage = 'showdown'
  const showdown = room.players.map(p => ({
    id: p.id,
    totalBet: p.totalBet,
    folded: p.folded,
    hand: p.hand
  }))
  const results = settleSidePots(showdown, game.community)
  const winners: { playerId: string; amount: number; hand?: string }[] = []
  for (const r of results) {
    const player = room.players.find(p => p.id === r.id)!
    player.chips += r.win
    if (r.win > 0) {
      winners.push({ playerId: r.id, amount: r.win, hand: r.rank?.label })
      game.log.push(`${player.name} 赢得 ${r.win}${r.rank ? '（' + r.rank.label + '）' : ''}`)
    }
  }
  game.winners = winners
  // 标记破产
  for (const p of room.players) if (p.chips === 0) p.bust = true
  game.stage = 'ended'
  game.actionDeadline = 0
}

/**
 * 处理玩家动作。
 * 调用前应先执行 advanceIfTimedOut。
 */
export function applyAction(
  room: Room,
  playerId: string,
  action: 'fold' | 'call' | 'raise' | 'allin' | 'check',
  amount?: number
): { ok: boolean; err?: string } {
  const game = room.game
  if (!game || room.status !== 'playing' || game.stage === 'ended' || game.stage === 'showdown') {
    return { ok: false, err: 'NOT_PLAYING' }
  }
  if (game.actionIdx < 0 || room.players[game.actionIdx].id !== playerId) {
    return { ok: false, err: 'NOT_YOUR_TURN' }
  }
  const p = room.players[game.actionIdx]
  const toCall = game.currentBet - p.bet
  game.lastActionAt = Date.now()

  if (action === 'fold') {
    p.folded = true
    p.hasActed = true
    game.log.push(`${p.name} 弃牌`)
  } else if (action === 'check') {
    if (toCall > 0) return { ok: false, err: 'CANNOT_CHECK' }
    p.hasActed = true
    game.log.push(`${p.name} 过牌`)
  } else if (action === 'call') {
    const pay = Math.min(toCall, p.chips)
    p.chips -= pay
    p.bet += pay
    p.totalBet += pay
    game.pot += pay
    p.hasActed = true
    if (p.chips === 0) p.allIn = true
    game.log.push(`${p.name} 跟注 ${pay}`)
  } else if (action === 'raise') {
    const raiseTo = amount || 0
    if (raiseTo <= game.currentBet) return { ok: false, err: 'RAISE_TOO_SMALL' }
    const minRaiseTo = game.currentBet + game.minRaise
    if (raiseTo < minRaiseTo && raiseTo - p.bet < p.chips) {
      return { ok: false, err: 'RAISE_TOO_SMALL' }
    }
    const pay = raiseTo - p.bet
    if (pay > p.chips) return { ok: false, err: 'NOT_ENOUGH_CHIPS' }
    p.chips -= pay
    p.bet += pay
    p.totalBet += pay
    game.pot += pay
    game.minRaise = raiseTo - game.currentBet
    game.currentBet = raiseTo
    // 其他玩家需要重新行动
    for (const other of room.players) {
      if (other.id !== p.id && !other.folded && !other.allIn && !other.bust) {
        other.hasActed = false
      }
    }
    p.hasActed = true
    if (p.chips === 0) p.allIn = true
    game.log.push(`${p.name} 加注到 ${raiseTo}`)
  } else if (action === 'allin') {
    const pay = p.chips
    const newBet = p.bet + pay
    p.chips = 0
    p.bet = newBet
    p.totalBet += pay
    game.pot += pay
    p.allIn = true
    p.hasActed = true
    if (newBet > game.currentBet) {
      game.minRaise = Math.max(game.minRaise, newBet - game.currentBet)
      game.currentBet = newBet
      for (const other of room.players) {
        if (other.id !== p.id && !other.folded && !other.allIn && !other.bust) {
          other.hasActed = false
        }
      }
    }
    game.log.push(`${p.name} 全下 ${pay}`)
  } else {
    return { ok: false, err: 'UNKNOWN_ACTION' }
  }

  // 检查是否只剩一位未 fold（早结束）
  const stillIn = inHandPlayers(room)
  if (stillIn.length === 1) {
    finishHand(room)
    return { ok: true }
  }

  // 推进
  if (isBettingRoundOver(room)) {
    advanceStage(room)
  } else {
    game.actionIdx = nextActionIdx(room, game.actionIdx)
    game.actionDeadline = Date.now() + ACTION_TIMEOUT_MS
  }
  return { ok: true }
}

/**
 * 超时自动弃牌 + 连续推进 Bot 决策。
 * 只要 (1) 到达截止时间点 或 (2) 下一位是 Bot，就持续处理。
 */
export function advanceIfTimedOut(room: Room) {
  if (!room.game || room.status !== 'playing') return
  let guard = 0
  while (guard++ < 32) {
    const game = room.game
    if (!game || game.stage === 'ended' || game.stage === 'showdown') break
    const idx = game.actionIdx
    if (idx < 0) break
    const p = room.players[idx]
    if (!p) break

    const now = Date.now()
    if (p.isBot) {
      // Bot 延迟决策：首次遇到该 idx 时随机 1-6s
      const g: any = game
      if (g._botIdx !== idx) {
        g._botIdx = idx
        const delay = (Math.floor(Math.random() * 6) + 1) * 1000
        g._botDeadline = now + delay
      }
      if (now < g._botDeadline) break
      const decision = botDecide(room, p)
      g._botIdx = -1
      g._botDeadline = 0
      applyAction(room, p.id, decision.action, decision.amount)
      continue
    }
    if (now >= game.actionDeadline && game.actionDeadline > 0) {
      // 超时 —— 视为弃牌
      applyAction(room, p.id, 'fold')
      continue
    }
    break
  }

  // 如果本局已结束且房间仍在 playing，自动开启下一局
  if (room.game?.stage === 'ended' && room.status === 'playing') {
    const stillAlive = activePlayers(room)
    if (stillAlive.length >= 2) {
      // 简单策略：下一次 state 拉取时会自动开新局；这里为了体验直接开
      // 但为让玩家看到摊牌结果，保留 ended 状态 3 秒后再开
      const endedAt = (room.game as any)._endedAt || Date.now()
      ;(room.game as any)._endedAt = endedAt
      if (Date.now() - endedAt > 3000) {
        startNewHand(room)
      }
    } else {
      room.status = 'ended'
    }
  }
}

/** 生成玩家 ID / 名称 */
export function newPlayer(name: string, isBot = false, seat = 0): Player {
  return {
    id: randomUUID(),
    name,
    isBot,
    chips: 3000,
    hand: [],
    bet: 0,
    totalBet: 0,
    folded: false,
    allIn: false,
    bust: false,
    hasActed: false,
    seat
  }
}
