import type { Room } from './types'

/**
 * 房间下发给客户端的脱敏。
 * - 只有 `viewerPlayerId` 对应玩家能看到自己的手牌
 * - 其他玩家在摊牌前一律不下发手牌，摊牌后（stage=ended）下发已未 fold 玩家的手牌
 */
export function sanitizeRoom(room: Room, viewerPlayerId?: string) {
  const game = room.game
  const isShowdown = game?.stage === 'ended' || game?.stage === 'showdown'
  const players = room.players.map(p => {
    const showHand = p.id === viewerPlayerId || (isShowdown && !p.folded)
    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      chips: p.chips,
      bet: p.bet,
      totalBet: p.totalBet,
      folded: p.folded,
      allIn: p.allIn,
      bust: p.bust,
      hasActed: p.hasActed,
      seat: p.seat,
      hand: showHand ? p.hand : (p.hand?.length ? p.hand.map(() => null) : [])
    }
  })

  const sanGame = game ? {
    community: game.community,
    stage: game.stage,
    pot: game.pot,
    currentBet: game.currentBet,
    minRaise: game.minRaise,
    dealerIdx: game.dealerIdx,
    actionIdx: game.actionIdx,
    actionDeadline: game.actionDeadline,
    log: game.log.slice(-40),
    winners: game.winners
  } : null

  return {
    id: room.id,
    hostId: room.hostId,
    status: room.status,
    players,
    game: sanGame,
    createdAt: room.createdAt,
    viewerPlayerId
  }
}
