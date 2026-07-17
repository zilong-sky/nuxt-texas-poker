import { defineEventHandler } from 'h3'
import { listWaitingRooms, isRoomDead } from '~~/server/utils/store'
import { MAX_PLAYERS } from '~~/server/utils/types'

/**
 * 列出所有 status='waiting' 且未满员的房间。
 */
export default defineEventHandler(async () => {
  const rooms = await listWaitingRooms()
  const list = rooms
    .filter(r => !isRoomDead(r) && r.players.length < MAX_PLAYERS)
    .map(r => {
      const host = r.players.find(p => p.id === r.hostId)
      return {
        id: r.id,
        hostName: host?.name || 'unknown',
        playerCount: r.players.length,
        maxPlayers: MAX_PLAYERS
      }
    })
    .sort((a, b) => a.hostName.localeCompare(b.hostName))
  return list
})
