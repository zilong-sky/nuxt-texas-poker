import type { Player, Room } from './types'
import { evaluateBest } from './poker'

/**
 * 极简 Bot 决策：
 * - preflop：按手牌强度简单启发（大对 / 高牌 / 同花连张 -> 跟注/加注）
 * - flop 之后：用 7 张牌评估当前牌力，结合底池赔率
 */
export function botDecide(
  room: Room,
  bot: Player
): { action: 'fold' | 'call' | 'raise' | 'allin' | 'check'; amount?: number } {
  const game = room.game!
  const toCall = game.currentBet - bot.bet
  const canCheck = toCall === 0

  // 计算牌力（0..1）
  let strength = 0
  if (game.community.length >= 3) {
    const rank = evaluateBest([...bot.hand, ...game.community])
    // 类别 0..9 -> 0..1
    strength = rank.category / 9
    // 用 tiebreak 微调
    strength += (rank.tiebreak[0] || 0) / 14 / 10
  } else {
    // preflop
    const [a, b] = bot.hand
    if (!a || !b) return canCheck ? { action: 'check' } : { action: 'fold' }
    const pair = a.rank === b.rank
    const suited = a.suit === b.suit
    const high = Math.max(a.rank, b.rank)
    const low = Math.min(a.rank, b.rank)
    strength = (high + low) / 28
    if (pair) strength += 0.35
    if (suited) strength += 0.08
    if (high - low === 1) strength += 0.05
  }

  // 加一点随机性
  strength += (Math.random() - 0.5) * 0.1

  // 底池赔率
  const potOdds = toCall / Math.max(1, game.pot + toCall)

  if (canCheck) {
    if (strength > 0.7 && bot.chips > game.minRaise) {
      const raiseTo = Math.min(bot.chips + bot.bet, game.currentBet + Math.max(game.minRaise, Math.floor(game.pot / 2)))
      if (raiseTo > game.currentBet) return { action: 'raise', amount: raiseTo }
    }
    return { action: 'check' }
  }

  if (strength < potOdds - 0.05) {
    return { action: 'fold' }
  }

  if (strength > 0.8) {
    if (bot.chips <= toCall) return { action: 'allin' }
    // 加注 1/2 底池
    const raiseTo = Math.min(bot.chips + bot.bet, game.currentBet + Math.max(game.minRaise, Math.floor(game.pot / 2) || game.minRaise))
    if (raiseTo > game.currentBet) return { action: 'raise', amount: raiseTo }
  }

  // 跟注
  if (bot.chips <= toCall) return { action: 'allin' }
  return { action: 'call' }
}
