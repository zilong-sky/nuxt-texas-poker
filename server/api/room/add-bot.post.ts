import { defineEventHandler, readBody, createError } from 'h3'
import { loadRoomOrCleanup, loadSession, saveRoom, unmarkRoomWaiting } from '~~/server/utils/store'
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
  const room = await loadRoomOrCleanup(session.roomId)
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
  // 生成不与任何玩家（含 Bot）冲突的 Bot-N
  const used = new Set(room.players.map(p => p.name))
  let n = 1
  let botName = `Bot-${n}`
  while (used.has(botName)) {
    n++
    botName = `Bot-${n}`
  }
  const usedSeats = new Set(room.players.map(p => p.seat))
  let seat = 0
  while (usedSeats.has(seat)) seat++
  const bot = newPlayer(botName, true, seat)
  room.players.push(bot)
  if (room.players.length >= MAX_PLAYERS) {
    await unmarkRoomWaiting(room.id)
  }
  await saveRoom(room)
  return { room: sanitizeRoom(room, session.playerId) }
})
