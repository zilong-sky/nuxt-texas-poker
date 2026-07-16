import { randomUUID } from 'node:crypto'
import { defineEventHandler, readBody, createError } from 'h3'
import { kv, KV_TTL_SEC, ROOM_PW_KEY } from '~~/server/utils/kv'
import { loadRoom, saveRoom, saveSession } from '~~/server/utils/store'
import type { Room } from '~~/server/utils/types'
import { MAX_PLAYERS } from '~~/server/utils/types'
import { newPlayer } from '~~/server/utils/game'
import { sanitizeRoom } from '~~/server/utils/sanitize'

/**
 * 加入房间。
 * body: { password: string, name?: string }
 * 逻辑：
 *  1. 通过 room:pw:<password> 找 roomId
 *  2. 若不存在 -> 创建新房间，本用户为房主
 *  3. 若存在 -> 校验 status==='waiting' 且 players < 6
 *  4. 生成新 sessionToken 存入 session:<token> -> { roomId, playerId }
 *  5. 返回 { token, room, playerId }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ password: string; name?: string }>(event)
  const password = (body?.password || '').trim()
  if (!password) {
    throw createError({ statusCode: 400, statusMessage: 'PASSWORD_REQUIRED' })
  }
  const playerName = (body?.name || '').trim() || `玩家${Math.floor(Math.random() * 900 + 100)}`

  const pwKey = ROOM_PW_KEY(password)
  let roomId = await kv.get<string>(pwKey)
  let room: Room | null = roomId ? await loadRoom(roomId) : null

  // 密码索引存在但房间已被清理 -> 视为新建
  if (roomId && !room) {
    roomId = null
  }

  if (!room) {
    // 新建
    roomId = randomUUID()
    const host = newPlayer(playerName, false, 0)
    room = {
      id: roomId,
      password,
      hostId: host.id,
      status: 'waiting',
      players: [host],
      createdAt: Date.now()
    }
    await kv.set(pwKey, roomId, { ex: KV_TTL_SEC })
    await saveRoom(room)
    const token = randomUUID()
    await saveSession(token, { roomId, playerId: host.id })
    return { token, playerId: host.id, room: sanitizeRoom(room, host.id) }
  }

  // 已存在
  if (room.status !== 'waiting') {
    throw createError({ statusCode: 400, statusMessage: 'ROOM_STARTED' })
  }
  if (room.players.length >= MAX_PLAYERS) {
    throw createError({ statusCode: 400, statusMessage: 'ROOM_FULL' })
  }
  const seat = nextSeat(room)
  const p = newPlayer(playerName, false, seat)
  room.players.push(p)
  await saveRoom(room)
  const token = randomUUID()
  await saveSession(token, { roomId: room.id, playerId: p.id })
  return { token, playerId: p.id, room: sanitizeRoom(room, p.id) }
})

function nextSeat(room: Room): number {
  const used = new Set(room.players.map(p => p.seat))
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i
  return room.players.length
}
