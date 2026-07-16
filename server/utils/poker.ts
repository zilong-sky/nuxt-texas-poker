import type { Card, Rank, Suit } from './types'

/**
 * 德州扑克引擎：
 * - 创建 / 洗 52 张牌
 * - 发牌
 * - 从 7 张牌（2 手牌 + 5 公共牌）中评估最优 5 张牌型
 * - 比较手牌大小
 * - 结算主池 / 边池（side pot）
 */

const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

/** 创建一副已洗好的 52 张牌 */
export function createShuffledDeck(): Card[] {
  const deck: Card[] = []
  for (const s of SUITS) {
    for (const r of RANKS) deck.push({ suit: s, rank: r })
  }
  // Fisher-Yates 洗牌
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

/** 从牌堆顶取 n 张 */
export function dealCards(deck: Card[], n: number): Card[] {
  return deck.splice(0, n)
}

/**
 * 牌型分类（数值越大越强）：
 * 9 皇家同花顺
 * 8 同花顺
 * 7 四条
 * 6 葫芦（三带二）
 * 5 同花
 * 4 顺子
 * 3 三条
 * 2 两对
 * 1 一对
 * 0 高牌
 */
export interface HandRank {
  category: number     // 上述 0..9
  tiebreak: number[]   // 用于同类比较（从高到低）
  label: string        // 中文名
}

/** 生成 5 张组合（返回所有 C(n,5)） */
function combinations<T>(arr: T[], k: number): T[][] {
  const res: T[][] = []
  const n = arr.length
  const idx = Array.from({ length: k }, (_, i) => i)
  if (k > n) return res
  while (true) {
    res.push(idx.map(i => arr[i]))
    let i = k - 1
    while (i >= 0 && idx[i] === n - k + i) i--
    if (i < 0) break
    idx[i]++
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1
  }
  return res
}

/** 评估 5 张牌的具体牌型 */
function evaluate5(cards: Card[]): HandRank {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a)
  const suits = cards.map(c => c.suit)
  const isFlush = suits.every(s => s === suits[0])
  // 顺子（A 可作为 1 处理 A2345）
  const uniq = [...new Set(ranks)]
  let isStraight = false
  let straightHigh = 0
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) {
      isStraight = true
      straightHigh = uniq[0]
    } else if (uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2) {
      isStraight = true
      straightHigh = 5
    }
  }
  // rank -> count 统计
  const countMap = new Map<number, number>()
  for (const r of ranks) countMap.set(r, (countMap.get(r) || 0) + 1)
  // 排序：先按 count 从大到小，再按点数从大到小
  const groups = [...countMap.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return b[0] - a[0]
  })
  const counts = groups.map(g => g[1]).join('')
  const groupRanks = groups.map(g => g[0])

  if (isFlush && isStraight && straightHigh === 14) {
    return { category: 9, tiebreak: [14], label: '皇家同花顺' }
  }
  if (isFlush && isStraight) {
    return { category: 8, tiebreak: [straightHigh], label: '同花顺' }
  }
  if (counts === '41') {
    return { category: 7, tiebreak: groupRanks, label: '四条' }
  }
  if (counts === '32') {
    return { category: 6, tiebreak: groupRanks, label: '葫芦' }
  }
  if (isFlush) {
    return { category: 5, tiebreak: ranks, label: '同花' }
  }
  if (isStraight) {
    return { category: 4, tiebreak: [straightHigh], label: '顺子' }
  }
  if (counts === '311') {
    return { category: 3, tiebreak: groupRanks, label: '三条' }
  }
  if (counts === '221') {
    return { category: 2, tiebreak: groupRanks, label: '两对' }
  }
  if (counts === '2111') {
    return { category: 1, tiebreak: groupRanks, label: '一对' }
  }
  return { category: 0, tiebreak: ranks, label: '高牌' }
}

/** 从最多 7 张牌中选出最优 5 张 */
export function evaluateBest(cards: Card[]): HandRank {
  if (cards.length < 5) {
    // 少于 5 张时（极端情况）也按现有牌评估
    return evaluate5([...cards, ...Array(5 - cards.length).fill(cards[0])])
  }
  const combos = combinations(cards, 5)
  let best: HandRank | null = null
  for (const c of combos) {
    const r = evaluate5(c)
    if (!best || compareHand(r, best) > 0) best = r
  }
  return best!
}

/** 比较两个牌型：>0 a 胜；<0 b 胜；=0 平 */
export function compareHand(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) return a.category - b.category
  const len = Math.min(a.tiebreak.length, b.tiebreak.length)
  for (let i = 0; i < len; i++) {
    if (a.tiebreak[i] !== b.tiebreak[i]) return a.tiebreak[i] - b.tiebreak[i]
  }
  return 0
}

/**
 * 边池结算。
 * 传入：所有仍在牌桌上的玩家（含 fold）及其 totalBet + 手牌 + 公共牌。
 * 返回：每位玩家赢得的筹码数。
 */
export interface ShowdownPlayer {
  id: string
  totalBet: number
  folded: boolean
  hand: Card[]
}

export function settleSidePots(
  players: ShowdownPlayer[],
  community: Card[]
): { id: string; win: number; rank?: HandRank }[] {
  const wins = new Map<string, number>()
  for (const p of players) wins.set(p.id, 0)

  // 逐层剥离形成边池
  let contribs = players.map(p => ({ ...p, remain: p.totalBet }))
  const eligibleIds = new Set(players.filter(p => !p.folded).map(p => p.id))

  while (true) {
    const withStake = contribs.filter(p => p.remain > 0)
    if (withStake.length === 0) break
    const minStake = Math.min(...withStake.map(p => p.remain))
    let potSize = 0
    for (const p of contribs) {
      if (p.remain > 0) {
        const take = Math.min(minStake, p.remain)
        p.remain -= take
        potSize += take
      }
    }
    // 本层可争夺者：仍有 remain>=0 且未 fold 且在 eligibleIds
    const contenders = contribs.filter(p => eligibleIds.has(p.id) && (p.totalBet - p.remain) > 0)
    if (contenders.length === 0) {
      // 无人可争，返还给最后放入者（罕见）——分给未弃牌的贡献者
      const fallback = contribs.filter(p => !p.folded && p.totalBet > 0)
      if (fallback.length > 0) {
        const share = Math.floor(potSize / fallback.length)
        for (const f of fallback) wins.set(f.id, (wins.get(f.id) || 0) + share)
      }
      continue
    }
    // 评估手牌
    const ranks = contenders.map(c => ({
      id: c.id,
      rank: evaluateBest([...c.hand, ...community])
    }))
    ranks.sort((a, b) => compareHand(b.rank, a.rank))
    const top = ranks.filter(r => compareHand(r.rank, ranks[0].rank) === 0)
    const share = Math.floor(potSize / top.length)
    const remainder = potSize - share * top.length
    for (const t of top) wins.set(t.id, (wins.get(t.id) || 0) + share)
    if (remainder > 0) wins.set(top[0].id, (wins.get(top[0].id) || 0) + remainder)
  }

  const res: { id: string; win: number; rank?: HandRank }[] = []
  for (const p of players) {
    const rank = p.folded ? undefined : evaluateBest([...p.hand, ...community])
    res.push({ id: p.id, win: wins.get(p.id) || 0, rank })
  }
  return res
}

/** 卡牌简易字符串（用于日志） */
export function cardToStr(c: Card): string {
  const rMap: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
  const sMap: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
  return sMap[c.suit] + (rMap[c.rank] || String(c.rank))
}
