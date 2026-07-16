# Nuxt 4 移动端德州扑克

一个基于 Nuxt 4 + Vercel KV 的移动端德州扑克小游戏，支持真人+机器人混玩、60 秒行动超时自动弃牌、断线重连，可一键部署到 Vercel。

## 技术栈
- **前端 / 服务端**：Nuxt 4（SSR + Nitro `vercel` preset）
- **状态管理**：Pinia (`@pinia/nuxt`)
- **工具库**：`@vueuse/core` / `@vueuse/nuxt`
- **持久化**：Vercel KV（`@vercel/kv`）
- **UI**：原生 CSS，专为手机竖屏（`max-width: 480px`）设计

## 目录结构
```
app/
  app.vue                    # 根组件（含 PC 拦截遮罩）
  assets/main.css            # 全局样式
  pages/
    index.vue                # 首页：输入密码进入房间
    room/[id].vue            # 等待页：房主可加机器人/开始
    game/[id].vue            # 对局页：公共牌、动作区、日志
  stores/poker.ts            # Pinia 全局房间状态
server/
  api/room/join.post.ts      # 加入/创建房间
  api/room/add-bot.post.ts   # 添加机器人
  api/room/start.post.ts     # 开始游戏
  api/room/leave.post.ts     # 退出
  api/room/reconnect.post.ts # 断线重连
  api/room/[id]/state.get.ts # 状态查询（含超时推进）
  api/game/action.post.ts    # 玩家动作
  utils/poker.ts             # 52 张牌 / 7 选 5 / 边池
  utils/bot.ts               # Bot 决策
  utils/game.ts              # 发牌、阶段推进、超时逻辑
  utils/kv.ts                # KV 客户端封装
  utils/store.ts             # 房间/会话读写
  utils/types.ts             # 类型 & 常量
  utils/sanitize.ts          # 下发脱敏
```

## 部署到 Vercel

1. 在 [Vercel Dashboard](https://vercel.com/dashboard) → **Storage** → **Create KV**。
2. 创建成功后，点击 **Connect to Project**，Vercel 会自动向项目注入以下环境变量：
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_URL`
   - `KV_REST_API_READ_ONLY_TOKEN`
3. 将本仓库 `git push` 到 GitHub，Vercel 会自动构建并部署（`nitro.preset = 'vercel'`）。
4. 部署完成后用手机浏览器访问 `https://<your-project>.vercel.app` 即可。

## 本地开发
```bash
npm install
vercel link                # 关联到 Vercel 项目
vercel env pull .env.local # 拉取 KV 环境变量
npm run dev                # 访问 http://localhost:3000
```
> 想在电脑上体验，请在浏览器 DevTools 中切换到 iPhone/Android 模拟移动端 UA，否则会被 PC 遮罩挡住。

## 游戏规则约定（前端不可改）
- 初始筹码 `3000`
- 小盲 `10` / 大盲 `20`
- 单房最多 `6` 人（真人 + Bot）
- 每次行动限时 `60s`，超时自动弃牌
- 无服务端常驻定时器：每次 `GET /api/room/:id/state` 或 `POST /api/game/action` 时会调用 `advanceIfTimedOut` 推进 Bot 及超时结算。

## Vercel KV Key 规范
```
room:pw:<password>  ->  roomId
room:<id>           ->  RoomState (含 game)
session:<token>     ->  { roomId, playerId }
```
所有写入均带 `24h` TTL。空房间在 `state` 请求中会被延迟 10 分钟后清理。
