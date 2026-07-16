import type { H3Event } from 'h3'
import { kv, ROOM_KEY, ROOMS_WAITING_KEY, SESSION_KEY, KV_TTL_SEC } from './kv'
import type { Room, Session } from './types'

/** 加载房间；找不到返回 null */
export async function loadRoom(id: string): Promise<Room | null> {
  const room = await kv.get<Room>(ROOM_KEY(id))
  return room || null
}

/** 保存房间（24h TTL） */
export async function saveRoom(room: Room): Promise<void> {
  await kv.set(ROOM_KEY(room.id), room, { ex: KV_TTL_SEC })
}

/** 删除房间 */
export async function deleteRoom(room: Room): Promise<void> {
  await kv.del(ROOM_KEY(room.id))
  await kv.srem(ROOMS_WAITING_KEY, room.id)
}

/** 把房间加入等待列表 */
export async function markRoomWaiting(roomId: string): Promise<void> {
  await kv.sadd(ROOMS_WAITING_KEY, roomId)
}

/** 从等待列表移除 */
export async function unmarkRoomWaiting(roomId: string): Promise<void> {
  await kv.srem(ROOMS_WAITING_KEY, roomId)
}

/** 列出所有等待中的房间（会自动清理已失效条目） */
export async function listWaitingRooms(): Promise<Room[]> {
  const ids = await kv.smembers(ROOMS_WAITING_KEY)
  if (!ids.length) return []
  const rooms: Room[] = []
  const stale: string[] = []
  for (const id of ids) {
    const room = await loadRoom(id)
    if (!room || room.status !== 'waiting') {
      stale.push(id)
      continue
    }
    rooms.push(room)
  }
  if (stale.length) await kv.srem(ROOMS_WAITING_KEY, ...stale)
  return rooms
}

/** 根据 token 找 session */
export async function loadSession(token: string): Promise<Session | null> {
  return (await kv.get<Session>(SESSION_KEY(token))) || null
}

export async function saveSession(token: string, s: Session): Promise<void> {
  await kv.set(SESSION_KEY(token), s, { ex: KV_TTL_SEC })
}

/** 从事件中读取 token（body / query） */
export function readToken(event: H3Event, body?: any, tokenFromQuery?: string): string | undefined {
  return body?.token || body?.sessionToken || tokenFromQuery
}
