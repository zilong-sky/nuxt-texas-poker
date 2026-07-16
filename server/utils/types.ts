/**
 * 类型定义与共享常量。
 */

export const INITIAL_CHIPS = 3000
export const SMALL_BLIND = 10
export const BIG_BLIND = 20
export const MAX_PLAYERS = 6
export const ACTION_TIMEOUT_MS = 60_000

export type Suit = 'S' | 'H' | 'D' | 'C' // 黑 红 方 梅
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export interface Card {
  suit: Suit
  rank: Rank
}

export type Stage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended'

/** 玩家（真人 / Bot） */
export interface Player {
  id: string          // 玩家 ID（uuid）
  name: string        // 显示名
  isBot: boolean
  chips: number       // 剩余筹码
  hand: Card[]        // 手牌（后端存全部；下发时脱敏）
  bet: number         // 本轮当前下注额（每 stage 归零）
  totalBet: number    // 本局累计下注
  folded: boolean     // 是否弃牌
  allIn: boolean      // 是否全下
  bust: boolean       // 是否已破产
  hasActed: boolean   // 本轮是否已行动过
  seat: number        // 座位号 0..MAX-1
}

/** 单局游戏状态 */
export interface Game {
  deck: Card[]
  community: Card[]
  stage: Stage
  pot: number
  currentBet: number   // 本轮当前需要跟到的注额
  minRaise: number     // 最小加注幅度
  dealerIdx: number    // 大庄索引（players 中）
  actionIdx: number    // 当前行动玩家索引（players 中）
  actionDeadline: number // 当前行动截止时间戳 ms
  log: string[]          // 对局日志
  winners?: { playerId: string; amount: number; hand?: string }[]
}

export interface Room {
  id: string
  password: string
  hostId: string
  status: 'waiting' | 'playing' | 'ended'
  players: Player[]
  createdAt: number
  emptyAt?: number
  game?: Game
}

/** 会话数据 */
export interface Session {
  roomId: string
  playerId: string
}
