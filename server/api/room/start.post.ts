import { defineEventHandler, readBody, createError } from 'h3'
import { loadRoom, loadSession, saveRoom } from '~~/server/utils/store'
import { advanceIfTimedOut, startNewHand } from '~~/server/utils/game'
import { sanitizeRoom } from '~~/server/utils/sanitize'

/**
 * 房主开始游戏。
 * body: { token }
 * 要求 players >= 2 且 status='waiting'。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ token: string }>(event)
  const token = body?.token
  if (!token) throw createError({ statusCode: 401, statusMessage: 'NO_TOKEN' })
  const session = await loadSession(token)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'INVALID_TOKEN' })
  const room = await loadRoom(session.roomId)
  if (!room) throw createError({ statusCode: 404, statusMessage: 'ROOM_NOT_FOUND' })
  if (room.hostId !== session.playerId) {
    throw createError({ statusCode: 403, statusMessage: 'NOT_HOST' })
  }
  if (room.status !== 'waiting') {
    throw createError({ statusCode: 400, statusMessage: 'ALREADY_STARTED' })
  }
  if (room.players.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'NEED_AT_LEAST_2' })
  }
  startNewHand(room)
  // 若首个行动位是 Bot，立即推进
  advanceIfTimedOut(room)
  await saveRoom(room)
  return { room: sanitizeRoom(room, session.playerId) }
})
