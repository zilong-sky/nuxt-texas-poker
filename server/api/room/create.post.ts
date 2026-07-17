import { randomUUID } from 'node:crypto'
import { defineEventHandler, readBody, createError } from 'h3'
import { markRoomWaiting, saveRoom, saveSession } from '~~/server/utils/store'
import type { Room } from '~~/server/utils/types'
import { newPlayer } from '~~/server/utils/game'
import { sanitizeRoom } from '~~/server/utils/sanitize'
import { ROOM_CREATE_PASSWORD, NICKNAME_MAX, NICKNAME_MIN } from '~~/server/utils/config'

/**
 * 创建房间。
 * body: { password, nickname }
 * - password 必须严格等于 ROOM_CREATE_PASSWORD。
 * - nickname trim 后长度 1..12。
 * - 当前用户成为房主。
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ password: string; nickname: string }>(event)
  const password = (body?.password || '').trim()
  const nickname = (body?.nickname || '').trim()

  if (!nickname || nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_NICKNAME' })
  }
  if (password !== ROOM_CREATE_PASSWORD) {
    throw createError({ statusCode: 400, statusMessage: 'INVALID_PASSWORD' })
  }

  const roomId = randomUUID()
  const host = newPlayer(nickname, false, 0)
  const room: Room = {
    id: roomId,
    hostId: host.id,
    status: 'waiting',
    players: [host],
    createdAt: Date.now(),
    lastSeenAt: Date.now()
  }
  await saveRoom(room)
  await markRoomWaiting(roomId)
  const token = randomUUID()
  await saveSession(token, { roomId, playerId: host.id })
  return { token, playerId: host.id, roomId, room: sanitizeRoom(room, host.id) }
})
