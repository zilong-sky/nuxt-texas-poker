/**
 * 类型定义与共享常量。常量从 config.ts 转出。
 */
export { INITIAL_CHIPS, SMALL_BLIND, BIG_BLIND, MAX_PLAYERS, ACTION_TIMEOUT_MS } from './config'

export type Suit = 'S' | 'H' | 'D' | 'C'
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export interface Card {
  suit: Suit
  rank: Rank
}

export type Stage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended'

/** 玩家（真人 / Bot） */
export interface Player {
  id: string
  name: string
  isBot: boolean
  chips: number
  hand: Card[]
  bet: number
  totalBet: number
  folded: boolean
  allIn: boolean
  bust: boolean
  hasActed: boolean
  seat: number
}

/** 单局游戏状态 */
export interface Game {
  deck: Card[]
  community: Card[]
  stage: Stage
  pot: number
  currentBet: number
  minRaise: number
  dealerIdx: number
  actionIdx: number
  actionDeadline: number
  log: string[]
  winners?: { playerId: string; amount: number; hand?: string }[]
}

export interface Room {
  id: string
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
