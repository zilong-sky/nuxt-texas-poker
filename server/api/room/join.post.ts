import { randomUUID } from 'node:crypto'
import { defineEventHandler, readBody, createError } from 'h3'
import { loadRoom, saveRoom, saveSession, unmarkRoomWaiting } from '~~/server/utils/store'
import type { Room } from '~~/server/utils/types'
import { MAX_PLAYERS } from '~~/server/utils/types'
import { newPlayer } from '~~/server/utils/game'
import { sanitizeRoom } from '~~/server/utils/sanitize'
import { NICKNAME_MAX, NICKNAME_MIN } from '~~/server/utils/config'

/**
 * 加入房间。
 * body: { roomId, nickname }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ roomId: string; nickname: string }>(event)
  const roomId = (body?.roomId || '').trim()
  const nickname = (body?.nickname || '').trim()

  if (!nickname || nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_NICKNAME' })
  }
  if (!roomId) {
    throw createError({ statusCode: 400, statusMessage: 'ROOM_NOT_FOUND' })
  }

  const room: Room | null = await loadRoom(roomId)
  if (!room) throw createError({ statusCode: 404, statusMessage: 'ROOM_NOT_FOUND' })
  if (room.status !== 'waiting') {
    throw createError({ statusCode: 400, statusMessage: 'ROOM_STARTED' })
  }
  if (room.players.length >= MAX_PLAYERS) {
    throw createError({ statusCode: 400, statusMessage: 'ROOM_FULL' })
  }
  if (room.players.some(p => p.name === nickname)) {
    throw createError({ statusCode: 400, statusMessage: 'NAME_TAKEN' })
  }

  const seat = nextSeat(room)
  const p = newPlayer(nickname, false, seat)
  room.players.push(p)

  // 满员后从等待列表移除
  if (room.players.length >= MAX_PLAYERS) {
    await unmarkRoomWaiting(room.id)
  }
  await saveRoom(room)

  const token = randomUUID()
  await saveSession(token, { roomId: room.id, playerId: p.id })
  return { token, playerId: p.id, roomId: room.id, room: sanitizeRoom(room, p.id) }
})

function nextSeat(room: Room): number {
  const used = new Set(room.players.map(p => p.seat))
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i
  return room.players.length
}
