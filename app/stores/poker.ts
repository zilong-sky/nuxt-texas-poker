import { defineStore } from 'pinia'

/**
 * 全局房间状态：昵称、token、房间信息、动作、断线重连。
 */
export const usePokerStore = defineStore('poker', {
  state: () => ({
    token: '' as string,
    playerId: '' as string,
    nickname: '' as string,
    room: null as any,
    error: '' as string,
    loading: false as boolean
  }),
  getters: {
    me(state): any {
      if (!state.room) return null
      return state.room.players.find((p: any) => p.id === state.playerId) || null
    },
    isHost(state): boolean {
      return !!(state.room && state.room.hostId === state.playerId)
    }
  },
  actions: {
    loadClientState() {
      if (import.meta.client) {
        this.token = localStorage.getItem('pokerToken') || ''
        this.nickname = localStorage.getItem('pokerNickname') || ''
      }
    },
    setToken(t: string) {
      this.token = t
      if (import.meta.client) localStorage.setItem('pokerToken', t)
    },
    clearToken() {
      this.token = ''
      if (import.meta.client) localStorage.removeItem('pokerToken')
    },

    _handleFatal(e: any): boolean {
      const code = e?.statusMessage || e?.data?.statusMessage
      const status = e?.statusCode || e?.response?.status || e?.status
      const fatal = code === 'ROOM_NOT_FOUND' || code === 'INVALID_TOKEN' || code === 'NO_TOKEN' || code === 'ROOM_CLEANED' || status === 404 || status === 401
      if (fatal) {
        this.room = null
        this.playerId = ''
        this.clearToken()
        if (import.meta.client) {
          try { navigateTo('/') } catch {}
        }
      }
      return fatal
    },
    setNickname(name: string) {
      this.nickname = name
      if (import.meta.client) {
        if (name) localStorage.setItem('pokerNickname', name)
        else localStorage.removeItem('pokerNickname')
      }
    },
    async createRoom(password: string, nickname: string) {
      this.loading = true
      this.error = ''
      try {
        const res = await $fetch<any>('/api/room/create', {
          method: 'POST',
          body: { password, nickname }
        })
        this.setToken(res.token)
        this.setNickname(nickname)
        this.playerId = res.playerId
        this.room = res.room
        return res.roomId as string
      } catch (e: any) {
        this.error = e?.statusMessage || e?.data?.statusMessage || 'CREATE_FAILED'
        throw e
      } finally {
        this.loading = false
      }
    },
    async joinRoom(roomId: string, nickname: string) {
      this.loading = true
      this.error = ''
      try {
        const res = await $fetch<any>('/api/room/join', {
          method: 'POST',
          body: { roomId, nickname }
        })
        this.setToken(res.token)
        this.setNickname(nickname)
        this.playerId = res.playerId
        this.room = res.room
        return res.roomId as string
      } catch (e: any) {
        this.error = e?.statusMessage || e?.data?.statusMessage || 'JOIN_FAILED'
        throw e
      } finally {
        this.loading = false
      }
    },
    async listRooms() {
      return await $fetch<Array<{ id: string; hostName: string; playerCount: number; maxPlayers: number }>>(
        '/api/room/list'
      )
    },
    async fetchState(roomId: string) {
      try {
        const res = await $fetch<any>(`/api/room/${roomId}/state`, {
          params: { token: this.token }
        })
        this.room = res.room
        if (this.room?.viewerPlayerId) this.playerId = this.room.viewerPlayerId
      } catch (e: any) {
        this.error = e?.statusMessage || 'STATE_FAILED'
        this._handleFatal(e)
        throw e
      }
    },
    async addBot() {
      try {
        const res = await $fetch<any>('/api/room/add-bot', {
          method: 'POST',
          body: { token: this.token }
        })
        this.room = res.room
      } catch (e: any) {
        this.error = e?.statusMessage || e?.data?.statusMessage || 'ADD_BOT_FAILED'
        this._handleFatal(e)
        throw e
      }
    },
    async startGame() {
      try {
        const res = await $fetch<any>('/api/room/start', {
          method: 'POST',
          body: { token: this.token }
        })
        this.room = res.room
      } catch (e: any) {
        this.error = e?.statusMessage || e?.data?.statusMessage || 'START_FAILED'
        this._handleFatal(e)
        throw e
      }
    },
    async action(action: string, amount?: number) {
      try {
        const res = await $fetch<any>('/api/game/action', {
          method: 'POST',
          body: { token: this.token, action, amount }
        })
        this.room = res.room
      } catch (e: any) {
        this.error = e?.statusMessage || e?.data?.statusMessage || 'ACTION_FAILED'
        this._handleFatal(e)
        throw e
      }
    },
    async leave() {
      try {
        await $fetch('/api/room/leave', { method: 'POST', body: { token: this.token } })
      } catch {}
      this.room = null
      this.playerId = ''
      this.clearToken()
    },
    async reconnect(): Promise<string | null> {
      this.loadClientState()
      if (!this.token) return null
      try {
        const res = await $fetch<any>('/api/room/reconnect', {
          method: 'POST',
          body: { token: this.token }
        })
        this.playerId = res.playerId
        return res.roomId as string
      } catch {
        this.clearToken()
        return null
      }
    }
  }
})
