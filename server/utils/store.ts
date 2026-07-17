import type { H3Event } from 'h3'
import { kv, ROOM_KEY, ROOMS_WAITING_KEY, SESSION_KEY, KV_TTL_SEC } from './kv'
import type { Room, Session } from './types'

/** 鍔犺浇鎴块棿锛涙壘涓嶅埌杩斿洖 null */
export async function loadRoom(id: string): Promise<Room | null> {
  const room = await kv.get<Room>(ROOM_KEY(id))
  return room || null
}

/** 淇濆瓨鎴块棿锛?4h TTL锛?*/
export async function saveRoom(room: Room): Promise<void> {
  await kv.set(ROOM_KEY(room.id), room, { ex: KV_TTL_SEC })
}

/** 鍒犻櫎鎴块棿 */
export async function deleteRoom(room: Room): Promise<void> {
  await kv.del(ROOM_KEY(room.id))
  await kv.srem(ROOMS_WAITING_KEY, room.id)
}

/** 鎶婃埧闂村姞鍏ョ瓑寰呭垪琛?*/
export async function markRoomWaiting(roomId: string): Promise<void> {
  await kv.sadd(ROOMS_WAITING_KEY, roomId)
}

/** 浠庣瓑寰呭垪琛ㄧЩ闄?*/
export async function unmarkRoomWaiting(roomId: string): Promise<void> {
  await kv.srem(ROOMS_WAITING_KEY, roomId)
}

/** 鍒楀嚭鎵€鏈夌瓑寰呬腑鐨勬埧闂达紙浼氳嚜鍔ㄦ竻鐞嗗凡澶辨晥鏉＄洰锛?*/
export async function listWaitingRooms(): Promise<Room[]> {
  const ids = await kv.smembers(ROOMS_WAITING_KEY)
  if (!ids.length) return []
  const rooms: Room[] = []
  const stale: string[] = []
  for (const id of ids) {
    const room = await loadRoom(id)
    if (!room || room.status !== 'waiting' || isRoomDead(room)) {
      if (room && isRoomDead(room)) await deleteRoom(room)
      stale.push(id)
      continue
    }
    rooms.push(room)
  }
  if (stale.length) await kv.srem(ROOMS_WAITING_KEY, ...stale)
  return rooms
}

/** 鏍规嵁 token 鎵?session */
export async function loadSession(token: string): Promise<Session | null> {
  return (await kv.get<Session>(SESSION_KEY(token))) || null
}

export async function saveSession(token: string, s: Session): Promise<void> {
  await kv.set(SESSION_KEY(token), s, { ex: KV_TTL_SEC })
}

/** 浠庝簨浠朵腑璇诲彇 token锛坆ody / query锛?*/
export function readToken(event: H3Event, body?: any, tokenFromQuery?: string): string | undefined {
  return body?.token || body?.sessionToken || tokenFromQuery
}

/** 5 鍒嗛挓鏃犳搷浣滆涓烘鎴块棿 */
export const IDLE_LIMIT_MS = 5 * 60 * 1000

/** waiting 鎴块棿 3 鍒嗛挓鏃犺闂涓烘鎴块棿 */
export const WAITING_IDLE_MS = 3 * 60 * 1000

/** 鍒ゆ柇鎴块棿鏄惁搴旇鍥炴敹锛氭棤鐪熶汉 鎴?寮€灞€鍚?5 鍒嗛挓鏃犳搷浣?*/
export function isRoomDead(room: Room): boolean {
  const anyHuman = room.players.some(p => !p.isBot)
  if (!anyHuman) return true
  if (room.status === 'playing' && room.game) {
    const last = room.game.lastActionAt || 0
    if (last > 0 && Date.now() - last > IDLE_LIMIT_MS) return true
  }
  const seen = room.lastSeenAt || room.createdAt || 0
  if (room.status === 'waiting' && seen > 0 && Date.now() - seen > WAITING_IDLE_MS) {
    return true
  }
  return false
}

/** 鍔犺浇鎴块棿锛岃嫢鍛戒腑鍥炴敹鏉′欢鍒欏垹闄ゅ苟杩斿洖 null */
export async function loadRoomOrCleanup(id: string): Promise<Room | null> {
  const room = await loadRoom(id)
  if (!room) return null
  if (isRoomDead(room)) {
    await deleteRoom(room)
    return null
  }
  room.lastSeenAt = Date.now()
  await saveRoom(room)
  return room
}
