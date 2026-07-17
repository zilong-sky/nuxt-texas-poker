import { defineEventHandler, getQuery, createError, getRouterParam } from 'h3'
import { deleteRoom, loadRoomOrCleanup, loadSession, saveRoom } from '~~/server/utils/store'
import { advanceIfTimedOut } from '~~/server/utils/game'
import { sanitizeRoom } from '~~/server/utils/sanitize'

/**
 * 获取房间状态。前端每 3s 轮询。
 * 每次都会调用 advanceIfTimedOut，处理超时弃牌 + 推进 Bot。
 * 空房间超过 10min 会被清理。
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string
  const q = getQuery(event)
  const token = (q.token as string) || ''
  const session = token ? await loadSession(token) : null
  const viewerId = session?.roomId === id ? session.playerId : undefined

  const room = await loadRoomOrCleanup(id)
  if (!room) throw createError({ statusCode: 404, statusMessage: 'ROOM_NOT_FOUND' })

  // 清理空房间
  if (room.players.length === 0) {
    if (room.emptyAt && Date.now() - room.emptyAt > 10 * 60 * 1000) {
      await deleteRoom(room)
      throw createError({ statusCode: 404, statusMessage: 'ROOM_CLEANED' })
    }
  }

  const prev = JSON.stringify(room)
  advanceIfTimedOut(room)
  if (JSON.stringify(room) !== prev) {
    await saveRoom(room)
  }
  return { room: sanitizeRoom(room, viewerId) }
})
