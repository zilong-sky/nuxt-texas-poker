import { defineEventHandler, readBody, createError } from 'h3'
import { loadRoomOrCleanup, loadSession } from '~~/server/utils/store'

/**
 * 断线重连：根据 token 找到 session，返回 roomId。
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
  return { roomId: session.roomId, playerId: session.playerId, status: room.status }
})
