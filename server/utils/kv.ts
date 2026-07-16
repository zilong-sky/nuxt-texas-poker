import Redis from 'ioredis'

const url = process.env.REDIS_URL || ''

declare global {
  // eslint-disable-next-line no-var
  var __redis__: Redis | undefined
}

function createClient(): Redis {
  if (!url) {
    throw new Error('REDIS_URL is not set')
  }
  const isTls = url.startsWith('rediss://')
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: false,
    ...(isTls ? { tls: {} } : {}),
  })
}

const redis: Redis = globalThis.__redis__ ?? createClient()
if (!globalThis.__redis__) globalThis.__redis__ = redis

type SetOpts = { ex?: number }

export const kv = {
  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await redis.get(key)
    if (raw === null || raw === undefined) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return raw as unknown as T
    }
  },
  async set(key: string, value: unknown, opts?: SetOpts): Promise<'OK' | null> {
    const payload = typeof value === 'string' ? value : JSON.stringify(value)
    if (opts?.ex && opts.ex > 0) {
      return (await redis.set(key, payload, 'EX', opts.ex)) as 'OK' | null
    }
    return (await redis.set(key, payload)) as 'OK' | null
  },
  async del(key: string): Promise<number> {
    return await redis.del(key)
  },
  async expire(key: string, seconds: number): Promise<number> {
    return await redis.expire(key, seconds)
  },
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!members.length) return 0
    return await redis.sadd(key, ...members)
  },
  async srem(key: string, ...members: string[]): Promise<number> {
    if (!members.length) return 0
    return await redis.srem(key, ...members)
  },
  async smembers(key: string): Promise<string[]> {
    return await redis.smembers(key)
  },
}

/** 房间 KV Key */
export const ROOM_KEY = (id: string) => `room:${id}`
/** 会话 Key */
export const SESSION_KEY = (token: string) => `session:${token}`
/** 等待中房间 id 集合 */
export const ROOMS_WAITING_KEY = 'rooms:waiting'

/** 24 小时 TTL（秒） */
export const KV_TTL_SEC = 60 * 60 * 24
