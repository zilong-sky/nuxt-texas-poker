# 修复：Vercel 只提供 REDIS_URL，需换掉 @vercel/kv

## 现状
- Vercel Marketplace 集成的是 Upstash Redis，生产环境只有 `REDIS_URL`（形如 `rediss://default:xxx@xxx.upstash.io:6379`）。
- 目前代码用 `@vercel/kv`，它读 `KV_REST_API_URL` / `KV_REST_API_TOKEN`，环境没这俩变量 → `/api/room/join` 500 报错。

## 任务
1. `npm remove @vercel/kv` → `npm install ioredis`。
2. 重写 `server/utils/kv.ts`：
   - 用 `ioredis` 单例连接 `process.env.REDIS_URL`。
   - 导出兼容层 `kv`，实现现有代码用到的方法：`get<T>(key)`（自动 JSON.parse）、`set(key, value, opts?)` 支持 `{ ex: seconds }` 走 `SET ... EX`、`del(key)`、`expire(key, seconds)`。value 若非字符串则 `JSON.stringify` 后写入。
   - 保留 `ROOM_KEY`/`ROOM_PW_KEY`/`SESSION_KEY`/`KV_TTL_SEC` 导出，签名不变。
   - 连接选项加 `maxRetriesPerRequest: 3, enableReadyCheck: false, lazyConnect: false`，`tls: {}` 当 URL 以 `rediss://` 开头。
3. 全项目搜其他直接 import `@vercel/kv` 的地方一并改成 `~/server/utils/kv` 的 `kv`。
4. `npm run build` 必须通过。
5. 本地 `git add -A && git commit -m "fix: switch storage from @vercel/kv to ioredis (REDIS_URL)"` 然后 `git push`。

完成后输出：修改文件清单 + build 结果 + commit sha。
