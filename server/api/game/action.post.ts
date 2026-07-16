import { defineEventHandler, readBody, createError } from 'h3'
import { loadRoom, loadSession, saveRoom } from '~~/server/utils/store'
import { advanceIfTimedOut, applyAction } from '~~/server/utils/game'
import { sanitizeRoom } from '~~/server/utils/sanitize'

/**
 * 玩家动作接口。
 * body: { token, action, amount? }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ token: string; action: 'fold' | 'call' | 'raise' | 'allin' | 'check'; amount?: number }>(event)
  const token = body?.token
  if (!token) throw createError({ statusCode: 401, statusMessage: 'NO_TOKEN' })
  const session = await loadSession(token)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'INVALID_TOKEN' })
  const room = await loadRoom(session.roomId)
  if (!room) throw createError({ statusCode: 404, statusMessage: 'ROOM_NOT_FOUND' })

  // 每次动作前先推进超时/Bot
  advanceIfTimedOut(room)

  const res = applyAction(room, session.playerId, body.action, body.amount)
  if (!res.ok) {
    await saveRoom(room)
    throw createError({ statusCode: 400, statusMessage: res.err || 'BAD_ACTION' })
  }
  // 再推进一次，让 Bot 立即接管
  advanceIfTimedOut(room)
  await saveRoom(room)
  return { room: sanitizeRoom(room, session.playerId) }
})
