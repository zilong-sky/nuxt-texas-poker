import { defineEventHandler, readBody, createError } from 'h3'
import { loadRoom, loadSession, saveRoom } from '~~/server/utils/store'
import { newPlayer } from '~~/server/utils/game'
import { MAX_PLAYERS } from '~~/server/utils/types'
import { sanitizeRoom } from '~~/server/utils/sanitize'

/**
 * 房主给房间添加机器人。
 * body: { token }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ token: string }>(event)
  const token = body?.token
  if (!token) throw createError({ statusCode: 401, statusMessage: 'NO_TOKEN' })
  const session = await loadSession(token)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'INVALID_TOKEN' })
  const room = await loadRoom(session.roomId)
  if (!room) throw createError({ statusCode: 404, statusMessage: 'ROOM_NOT_FOUND' })
  if (room.status !== 'waiting') {
    throw createError({ statusCode: 400, statusMessage: 'ROOM_STARTED' })
  }
  if (room.hostId !== session.playerId) {
    throw createError({ statusCode: 403, statusMessage: 'NOT_HOST' })
  }
  if (room.players.length >= MAX_PLAYERS) {
    throw createError({ statusCode: 400, statusMessage: 'ROOM_FULL' })
  }
  const botCount = room.players.filter(p => p.isBot).length + 1
  const usedSeats = new Set(room.players.map(p => p.seat))
  let seat = 0
  while (usedSeats.has(seat)) seat++
  const bot = newPlayer(`Bot-${botCount}`, true, seat)
  room.players.push(bot)
  await saveRoom(room)
  return { room: sanitizeRoom(room, session.playerId) }
})
