import { kv } from '@vercel/kv'

/**
 * Vercel KV 客户端封装。
 * 直接复用 `@vercel/kv` 的默认实例，其会从环境变量读取连接信息：
 *   - KV_REST_API_URL
 *   - KV_REST_API_TOKEN
 */
export { kv }

/** 房间 KV Key */
export const ROOM_KEY = (id: string) => `room:${id}`
/** 密码 -> 房间 ID 索引 Key */
export const ROOM_PW_KEY = (pw: string) => `room:pw:${pw}`
/** 会话 Key */
export const SESSION_KEY = (token: string) => `session:${token}`

/** 24 小时 TTL（秒） */
export const KV_TTL_SEC = 60 * 60 * 24
