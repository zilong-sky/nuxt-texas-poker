# 需求：Nuxt 4 移动端德州扑克（Vercel KV 持久化 + 60s 超时自动弃牌 + Vercel 自动部署）

严格按本文件从零搭建整个项目。工作目录 = 项目根目录（此文件所在目录）。已 `git init`，Node 版本用当前系统默认（Node 20+）。

## 一、技术栈与项目初始化
1. 使用 **Nuxt 4**（`npx nuxi@latest init . --force` 或手动创建，确保 `package.json` 中 `nuxt` 版本为 ^4.0.0）。TypeScript 开启。Nitro preset 使用 `vercel`。
2. 状态管理用 `@pinia/nuxt`。UI 层可用原生 CSS 或 UnoCSS/Tailwind 任选其一（轻量优先，不装重型组件库）。
3. 云端存储用 **Vercel KV**（`@vercel/kv`）。所有房间/对局状态必须存 KV，前端不缓存权威状态。
4. 目录使用 Nuxt 4 标准：`app/`、`server/api/`、`server/utils/`。

## 二、页面（仅手机竖屏）
- `app/pages/index.vue`：**首页**，房间密码输入框 + 提交按钮。无独立"创建房间"按钮，密码即入口。
- `app/pages/room/[id].vue`：**等待页**，展示房间成员（真人/AI 区分）、每人筹码、在线人数、剩余名额。房主可见【添加机器人】【开始游戏】；非房主只能查看。固定文案提示"开局后禁止新人进入、支持断线重连"。
- `app/pages/game/[id].vue`：**对局页**，显示公共牌、底池、当前行动玩家、大小盲标记、60s 倒计时进度条、所有玩家（本人手牌可见、他人默认背面）、底部操作区（弃牌/跟注/加注（数字输入）/全下），下方对局日志滚动区，角落"断线重连"按钮。
- 全局中间件：检测 UA，若非移动端（`/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) === false`）在客户端弹窗遮罩"请使用手机浏览器访问"，禁止交互。

## 三、后端 API（`server/api/`，全部权威在后端）
下列接口全部读写 Vercel KV：
- `POST /api/room/join`：入参 `{ password, sessionToken? }`。逻辑：
  - 用 `room:pw:<password>` 做索引查 roomId。若不存在 → 创建 roomId（uuid），本用户为房主，写入 `room:<id>` 房间对象（含 `password`、`hostId`、`status:'waiting'`、`players:[]`、`createdAt`），把当前用户加入 players。
  - 若房间存在：校验 `status==='waiting'` 且 `players.length<6`，加入。否则返回相应错误码（`ROOM_STARTED` / `ROOM_FULL`）。
  - 生成新的 `sessionToken`（uuid），绑定 `session:<token>` → `{ roomId, playerId }`，返回给前端存 localStorage。
- `POST /api/room/add-bot`：房主专用，房间 `waiting` 且未满 6 人时添加 AI 玩家（`isBot:true`, 初始 3000 筹码，名字如 `Bot-1..N`）。
- `POST /api/room/start`：房主专用，`players.length>=2` 才允许开局。锁定 `status='playing'`，初始化第一局：随机庄家、扣小/大盲、发底牌、随机洗牌、进入 preflop 阶段、把 action 指向大盲下一位、写入 `actionDeadline = now + 60_000`。
- `GET /api/room/:id/state?token=...`：返回当前玩家可见的房间状态（他人手牌用 `null` 或 `back` 遮蔽，摊牌阶段亮牌）。前端每 3 秒轮询这个接口。
- `POST /api/game/action`：入参 `{ token, action: 'fold'|'call'|'raise'|'allin', amount? }`。校验是否轮到该玩家、当前 stage、金额合法。执行完毕后推进 action 到下一位活跃玩家；若一轮下注结束则进入下一阶段（发翻牌 3 张 / 转牌 / 河牌 / 摊牌结算）。每次推进后写入新的 `actionDeadline = now + 60_000`。
- `POST /api/room/leave`：玩家主动退出，从 players 移除；若房间空则打时间戳 `emptyAt`（后台清理由 `state` 接口懒清理：读到 `emptyAt` 存在且已超过 10 分钟则删除 KV 内所有该房间键）。
- `POST /api/room/reconnect`：`{ token }` → 校验 session 有效性，返回 roomId 让前端跳过去。

## 四、超时与推进逻辑（关键）
- 后端**不启动定时器进程**（Vercel serverless 无常驻）。改为每次调 `GET /api/room/:id/state` 或 `POST /api/game/action` 时，先跑一次 `advanceIfTimedOut(room)`：
  - 若 `now >= room.actionDeadline` 且当前行动玩家未提交操作 → 视为自动弃牌（`fold`），把该玩家标 `folded=true`，推进到下一位。
  - 若下一位是 Bot → 立即调用 `botDecide(room, playerId)` 完成 AI 决策（简单策略：手牌评估 + 底池赔率，弃/跟/加/全下四选一），再推进。Bot 不占 60s。
  - 循环直到轮到真人 & 未超时，或本轮/本局结束。
- 每次 state 接口调用都要保证幂等地推进，确保即使某玩家不轮询、其他玩家的轮询也能触发超时结算。

## 五、扑克引擎
- 在 `server/utils/poker.ts` 中实现：52 张牌洗牌、发牌、7 选 5 最优牌型评估（高牌→皇家同花顺共 9 档）、比大小、多路 side pot 结算。
- 在 `server/utils/bot.ts` 中实现 Bot 决策函数（简单启发式即可，但必须能完成整局）。
- 每局固定参数：初始筹码 3000、小盲 10、大盲 20，全部代码内常量，前端不可改。
- 一局结束后自动开下一局（庄家按钮左移，重发底牌，扣盲注）；某玩家筹码为 0 时标 `bust=true`，不再参与发牌但保留座位。

## 六、Vercel KV 键设计
```
room:pw:<password>      -> roomId
room:<id>               -> RoomState JSON（含 game 子对象）
session:<token>         -> { roomId, playerId }
```
所有写入用 `kv.set` + 合理 TTL（房间键 24h；session 键 24h）。

## 七、环境变量与部署
- 项目根目录写 `README.md`，中文说明：
  1) 在 Vercel Dashboard → Storage → Create KV。
  2) Connect to Project 后自动注入 `KV_REST_API_URL` / `KV_REST_API_TOKEN` / `KV_URL` / `KV_REST_API_READ_ONLY_TOKEN`。
  3) `git push` GitHub → Vercel 自动部署。
  4) 本地开发：`npm i` → `vercel link` → `vercel env pull .env.local` → `npm run dev`。
- `nuxt.config.ts` 显式声明 `nitro: { preset: 'vercel' }`、`ssr: true`、`runtimeConfig`（如需）。
- `.gitignore` 忽略 `.env*`、`.output/`、`.vercel/`、`node_modules/`。

## 八、前端约束
- 全局 3 秒轮询 state 接口，用 `useIntervalFn` + `visibilitychange` 页面隐藏时暂停节流。
- 会话令牌存 `localStorage.pokerToken`；首页进入前若存在有效 token 则调 `/api/room/reconnect` 直接跳房间。
- CSS 强制 `viewport-fit=cover`、`max-width:480px`、居中，PC 端由 `useMediaQuery('(min-width: 768px)')` 或 UA 判定后弹遮罩。
- 60 秒倒计时进度条根据 `actionDeadline - now` 客户端本地渲染，仅视觉用；权威超时判定在后端。

## 九、代码质量
- 后端关键文件（`server/api/*`、`server/utils/poker.ts`、`server/utils/bot.ts`、超时推进逻辑）加详细中文注释，说明规则来源。
- 剔除任何 PC 端布局代码与冗余第三方 UI 库。

## 十、交付流程
1. 完成所有代码后：`npm run build` 必须通过（Nitro 输出 `.output`），本地 `npm run dev` 至少启动无报错。
2. 生成一份 `README.md`（部署说明）+ `CHANGE_REQUEST.md` 保留在根目录。
3. `git add -A && git commit -m "feat: nuxt4 mobile texas holdem with vercel kv persistence"`。
4. **不要** `git push`，也 **不要** 创建 GitHub 远程仓库 —— 我会在你完成后手动接手 push & Vercel 关联。

完成后在终端输出：
- 已生成的关键文件列表
- `npm run build` 的最终状态（成功/失败）
- 一句话总结实现范围
