import { defineEventHandler, readBody, createError } from 'h3'
import { deleteRoom, loadRoom, loadSession, saveRoom } from '~~/server/utils/store'

/**
 * 玩家主动退出房间。
 * body: { token }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ token: string }>(event)
  const token = body?.token
  if (!token) throw createError({ statusCode: 401, statusMessage: 'NO_TOKEN' })
  const session = await loadSession(token)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'INVALID_TOKEN' })
  const room = await loadRoom(session.roomId)
  if (!room) return { ok: true }

  room.players = room.players.filter(p => p.id !== session.playerId)
  // 房主变更
  if (room.hostId === session.playerId) {
    const nextHuman = room.players.find(p => !p.isBot)
    if (nextHuman) room.hostId = nextHuman.id
  }
  const anyHuman = room.players.some(p => !p.isBot)
  if (!anyHuman) {
    room.players = []
    room.emptyAt = Date.now()
    await deleteRoom(room)
    return { ok: true }
  }
  await saveRoom(room)
  return { ok: true }
})
