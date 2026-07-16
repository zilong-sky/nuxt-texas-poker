# Nuxt 4 移动端德州扑克

一个基于 Nuxt 4 + Redis (KV) 的移动端德州扑克小游戏，支持真人 + 机器人混玩、60 秒行动超时自动弃牌、断线重连，可一键部署到 Vercel。

## 技术栈
- **前端 / 服务端**：Nuxt 4（SSR + Nitro `vercel` preset）
- **状态管理**：Pinia (`@pinia/nuxt`)
- **工具库**：`@vueuse/core` / `@vueuse/nuxt`
- **持久化**：Redis / Vercel KV，通过 `ioredis` 访问 `REDIS_URL`
- **UI**：原生 CSS，专为手机竖屏（`max-width: 480px`）设计

## 目录结构
```
app/
  app.vue                    # 根组件（含 PC 拦截遮罩）
  assets/main.css            # 全局样式
  pages/
    index.vue                # 首页：昵称 + 创建/加入房间列表
    room/[id].vue            # 等待页：房主可加机器人 / 开始
    game/[id].vue            # 对局页：公共牌、动作区、日志
  stores/poker.ts            # Pinia 全局状态
server/
  api/room/create.post.ts    # 创建房间（固定密码 654321）
  api/room/join.post.ts      # 加入指定房间（无需密码）
  api/room/list.get.ts       # 列出等待中未满员的房间
  api/room/add-bot.post.ts   # 添加机器人
  api/room/start.post.ts     # 开始游戏
  api/room/leave.post.ts     # 退出
  api/room/reconnect.post.ts # 断线重连
  api/room/[id]/state.get.ts # 状态查询（含超时推进）
  api/game/action.post.ts    # 玩家动作
  utils/config.ts            # 常量集中导出
  utils/poker.ts             # 52 张牌 / 7 选 5 / 边池
  utils/bot.ts               # Bot 决策
  utils/game.ts              # 发牌、阶段推进、超时逻辑
  utils/kv.ts                # KV 客户端封装
  utils/store.ts             # 房间/会话读写
  utils/types.ts             # 类型 & 常量
  utils/sanitize.ts          # 下发脱敏
```

## 房间玩法
- 首页必须填写昵称（1-12 字符）后才能创建或加入房间。
- **创建房间**需输入创建密码 `654321`（后端常量 `ROOM_CREATE_PASSWORD`），密码错误无法创建。
- **加入房间**在首页直接选择房间列表中的一项即可，**无需密码**；同一房间内昵称必须唯一（含 Bot）。
- 房间开局或被解散后会从等待列表中移除。

## 部署到 Vercel

1. 在 [Vercel Dashboard](https://vercel.com/dashboard) → **Storage** → 连接一个 Redis 兼容存储。
2. 将连接串通过环境变量 `REDIS_URL` 注入到项目。
3. `git push` 到 GitHub，Vercel 自动构建部署（`nitro.preset = 'vercel'`）。
4. 部署完成后用手机浏览器访问 `https://<your-project>.vercel.app`。

## 本地开发
```bash
npm install
vercel link
vercel env pull .env.local
npm run dev
```
> 想在电脑上体验，请在浏览器 DevTools 中切换到 iPhone / Android 模拟移动端 UA，否则会被 PC 遮罩挡住。

## 游戏规则约定
- 初始筹码 `3000`
- 小盲 `10` / 大盲 `20`
- 单房最大 `6` 人（真人 + Bot）
- 每次行动限时 `60s`，超时自动弃牌
- 无服务常驻定时器：每次 `GET /api/room/:id/state` 或 `POST /api/game/action` 时会调用 `advanceIfTimedOut` 推进 Bot 及超时结算。

## Redis Key 规范
```
rooms:waiting       ->  Set<roomId>
room:<id>           ->  RoomState (含 game)
session:<token>     ->  { roomId, playerId }
```
所有写入均带 `24h` TTL。空房间在 `state` 请求中被延迟 10 分钟后清理。
