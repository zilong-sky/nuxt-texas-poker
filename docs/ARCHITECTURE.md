# nuxt-texas-poker 项目技术文档

> 后续修改需求时，先读本文档定位相关模块；如与实际代码不符请以代码为准，并顺手更新本文。

---

## 1. 项目概览
- **名称**：nuxt-texas-poker（线下私密密码 6 人德州扑克）
- **框架**：Nuxt 4 + Nitro（server 路由）+ Pinia（前端状态）+ ioredis（KV 持久化）
- **仓库**：https://github.com/zilong-sky/nuxt-texas-poker
- **线上**：https://nuxt-texas-poker.vercel.app
- **本地**：`E:\workspace\codex-ws\nuxt-texas-poker`
- **部署**：GitHub push → Vercel 自动部署；环境变量 `REDIS_URL`（Upstash Redis / Vercel KV，`rediss://` 自动开 TLS）
- **适配**：仅手机竖屏访问首页/房间页；游戏页 CSS `transform: rotate(90deg)` 强制横屏

---

## 2. 目录结构

```
nuxt-texas-poker/
├─ nuxt.config.ts
├─ package.json
├─ README.md              # 部署/启动文档
├─ CHANGE_REQUEST.md      # 每轮下发给 Codex 的需求单（一次性用）
├─ docs/
│  └─ ARCHITECTURE.md     # ← 本文件
├─ app/
│  ├─ app.vue
│  ├─ assets/main.css
│  ├─ components/
│  │  └─ PokerCard.vue    # 单张扑克牌组件（rank/suit/back/big 变体）
│  ├─ stores/
│  │  └─ poker.ts         # Pinia store：token/房间/请求封装 + 致命错误清 token
│  └─ pages/
│     ├─ index.vue        # 首页（昵称+密码创建/加入 + 恢复未完成对局提示条）
│     ├─ room/[id].vue    # 等待室（房主加AI/开始；玩家等待）
│     └─ game/[id].vue    # 对局页（≈880 行，UI 全部在此，反复被 Codex 迭代）
└─ server/
   ├─ api/
   │  ├─ room/
   │  │  ├─ create.post.ts      # 建房（校验密码=654321、昵称）
   │  │  ├─ join.post.ts        # 加入房间
   │  │  ├─ list.get.ts         # 房间列表（仅 waiting）
   │  │  ├─ add-bot.post.ts     # 房主添加AI
   │  │  ├─ start.post.ts       # 房主开局，锁人
   │  │  ├─ leave.post.ts       # 离开房间
   │  │  ├─ reconnect.post.ts   # 断线重连（token → roomId）
   │  │  └─ [id]/state.get.ts   # 拉取房间快照
   │  └─ game/
   │     └─ action.post.ts      # 玩家动作：fold/check/call/bet/raise/allin
   └─ utils/
      ├─ config.ts        # 所有可调常量（密码/筹码/盲注/超时/上限）
      ├─ types.ts         # Card/Player/Game/Room/Session 类型 + 常量转出
      ├─ kv.ts            # ioredis 单例 + kv.get/set/del/sadd/srem/smembers + key 前缀
      ├─ store.ts         # 房间/session 读写、死房间惰性清理
      ├─ poker.ts         # 洗牌/发牌/牌型评估/边池结算
      ├─ game.ts          # 一手牌全流程：开局/推进/超时/结算
      ├─ bot.ts           # AI 决策
      └─ sanitize.ts      # 出给客户端前隐藏他人手牌
```

---

## 3. 关键常量（`server/utils/config.ts`）

| 常量 | 值 | 含义 |
|---|---|---|
| `ROOM_CREATE_PASSWORD` | `654321` | 建房密码（固定，用户偏好） |
| `INITIAL_CHIPS` | 3000 | 初始筹码 |
| `SMALL_BLIND` / `BIG_BLIND` | 10 / 20 | 盲注 |
| `MAX_PLAYERS` | 6 | 单房上限（真人+AI） |
| `ACTION_TIMEOUT_MS` | 60_000 | 玩家单次行动 60s 超时自动弃牌 |
| `NICKNAME_MIN/MAX` | 1 / 12 | 昵称长度 |
| `IDLE_LIMIT_MS`（在 store.ts） | 300_000 | 开局后 5min 无操作 → 死房间 |

改数值只需改 `config.ts`；改规则要动 `poker.ts` / `game.ts`。

---

## 4. 数据模型（`server/utils/types.ts`）

```ts
Player  { id, name, isBot, chips, hand[], bet, totalBet, folded, allIn, bust, hasActed, seat }
Game    { deck[], community[], stage, pot, currentBet, minRaise,
          dealerIdx, actionIdx, actionDeadline, lastActionAt, log[], winners? }
Room    { id, hostId, status: waiting|playing|ended, players[], createdAt, emptyAt?, game? }
Session { roomId, playerId }
Stage   = preflop | flop | turn | river | showdown | ended
```

## 5. KV 存储（`server/utils/kv.ts`）

- 客户端：ioredis 单例（`globalThis.__redis__` 复用，避免 serverless 冷启建连风暴）
- Key 命名：
  - `room:<roomId>`  → 完整 Room JSON
  - `session:<token>` → `{ roomId, playerId }`
  - `rooms:waiting`  → Set，存所有 waiting 状态 roomId
- 全部 24h TTL

**惰性清理**（`store.ts:isRoomDead / loadRoomOrCleanup`）：任何 handler 入口都用 `loadRoomOrCleanup(id)` 取房，命中即删并返回 null；触发条件：
1. 房间内**没有任何真人玩家**（全AI/全离场）
2. `status='playing'` 且 `game.lastActionAt` 距今 > 5 分钟

前端收到 404/`ROOM_NOT_FOUND` 后 `poker.ts:_handleFatal` 自动清 token 并跳 `/`。

---

## 6. 后端 API

| 方法 | 路径 | Body/Query | 作用 |
|---|---|---|---|
| POST | `/api/room/create` | `{ password, nickname }` | 创建房间，返回 `{ token, playerId, roomId, room }` |
| POST | `/api/room/join` | `{ roomId, nickname }` | 加入房间（无密码，只校验 waiting 未满） |
| GET | `/api/room/list` | — | 列出所有 waiting 房间 |
| POST | `/api/room/add-bot` | `{ token }` | 房主等待期加 AI |
| POST | `/api/room/start` | `{ token }` | 房主开局，`status→playing`，永久锁人 |
| POST | `/api/room/leave` | `{ token }` | 玩家离开 |
| POST | `/api/room/reconnect` | `{ token }` | 断线重连，返回 `{ roomId, playerId }` |
| GET | `/api/room/:id/state?token=` | — | 拉快照（含 `viewerPlayerId`，他人手牌已 sanitize） |
| POST | `/api/game/action` | `{ token, action, amount? }` | action ∈ `fold/check/call/bet/raise/allin` |

**统一错误**：`throw createError({ statusCode, statusMessage })`；常见 `INVALID_PASSWORD` / `NAME_TAKEN` / `ROOM_NOT_FOUND` / `INVALID_TOKEN` / `NOT_YOUR_TURN` / `ROOM_FULL` / `ILLEGAL_ACTION`。

---

## 7. 游戏引擎（`server/utils/game.ts` ≈360 行）

关键函数：
- `startNewHand(room)`：洗牌、庄家左移、盲注、发底牌、`lastActionAt=now`
- `applyAction(room, playerId, action, amount)`：合法性校验 → 修改状态 → 推进
- `advanceStage(room)`：翻/转/河/结算，重置 `bet/hasActed`
- `advanceIfTimedOut(room)`：任何入口都会先调它——超时自动 fold + 推进（也会更新 `lastActionAt`）
- `settle(room)`：调 `poker.ts:settleSidePots`，分边池，写 `game.winners`

**顺序**：handler → `loadRoomOrCleanup` → `advanceIfTimedOut` → 执行请求 → `saveRoom`。

---

## 8. 前端

### 8.1 Pinia store（`app/stores/poker.ts`）
- state: `token / playerId / nickname / room / error / loading`
- 每个 API 动作有独立 action；`_handleFatal(e)` 集中处理致命错误
- token/nickname 持久化到 `localStorage`（keys: `pokerToken`, `pokerNickname`）

### 8.2 页面

| 页面 | 说明 |
|---|---|
| `index.vue` | 首页竖屏。检测本地 token → 显示"恢复/放弃"提示条（不再自动跳）。表单：昵称 + 建房密码 / 加入。 |
| `room/[id].vue` | 等待室竖屏。展示席位、房主"加机器人"和"开始游戏"按钮。 |
| `game/[id].vue` | 对局页强制横屏（竖屏 CSS rotate 90°）。**UI 全部在这里**——所有布局需求最终落在这个文件。 |

### 8.3 游戏页布局约束（历经多轮迭代）
- **视口方向**：竖屏时 `.game-page { transform: rotate(90deg); width:100dvh; height:100dvw; transform-origin:top left; left:100dvw; }` 无提示浮层
- **椭圆桌** `.table-wrap`：`aspect-ratio: 2/1`，左右各留安全区避开工具栏
- **6 席位**：绝对定位到 `.table-inner`，`translate(-50%,-50%)`。当前坐标（θ 从 140° 顺时针每 60°，`rx=44% ry=38%`）：
  - seat-1 我方 (16.3%, 74.4%) · seat-2 (57.6%, 87.4%) · seat-3 (91.3%, 63%) · seat-4 (83.7%, 25.6%) · seat-5 (42.4%, 12.6%) · seat-6 (8.7%, 37%)
  - **我方永久锁 seat-1（左下）**，视图通过 `viewerPlayerId` 把真实 seat 映射到显示 seat-1
- **我方手牌 `.me-panel`**：定位到 `.table-wrap` 内 `left:50% top:100% translate(-50%,-50%)`，即桌下沿正中；手牌 52×72，牌型+胜率条紧凑排下方，倒计时环放牌左侧
- **其他 5 席手牌**：贴头像内侧（朝桌心），牌背 + 「暂时无法查看」，摊牌阶段亮牌
- **桌面固定装饰**：荷官(50%, 10%)、底池(50%, 32%)、庄位 D+红牌背装饰(28%, 33%)、公共牌区(33-67%, 38-48%)
- **左侧竖栏 `.side-rail`**：返回箭头+系统时间、聊天、红色靶心、BUFF(5%·1X)。半透明、`pointer-events` 已放行子元素
- **底部 `.action-bar`**：横向 4 按钮 弃牌 / 过牌|弃牌 / 过牌 / 跟任意注；根据 `isMyTurn`+`canCheck` 置灰
- **头像统一规范**：圆形、右上角紫色🎁 `.gift-badge`（用户已表示后期再决定要不要）、下方金黄胶囊筹码（M 缩写、`margin-top:-10px` 贴头像）；不显示昵称文字
- **下注/全下**：座位侧边 `.bet-cards .red-back` 红色牌背标记
- **金币**：金黄色 + `formatChips` M 缩写
- **投影/微光**：`box-shadow` + `drop-shadow` 统一手游质感

---

## 9. 部署 & 本地

```bash
# 本地
npm install
REDIS_URL='rediss://...' npm run dev       # http://localhost:3000

# 构建
npm run build

# 部署：git push origin main → Vercel 自动 build & deploy
# 环境变量：Vercel 项目 Settings → Environment Variables 里配 REDIS_URL
```

**Storage 关联**：vercel CLI 56.x 不支持 storage 子命令，必须在 Vercel 网页 stores 页面点 "Connect Project"。

---

## 10. 修改工作流（重要，Codex 驱动）

**用户偏好**：所有代码改动通过 Codex CLI 完成，Hermes 不手动改 .vue/.ts。

标准流程：
1. Hermes 把需求写到项目根 `CHANGE_REQUEST.md`（清晰边界：动哪些文件、不动哪些）
2. Hermes 后台起 Codex：
   ```bash
   /c/Users/Administrator/AppData/Local/OpenAI/Codex/bin/<hash>/codex.exe exec \
     --sandbox danger-full-access --skip-git-repo-check \
     "严格按 CHANGE_REQUEST.md 执行。npm 走 bash -lc。build 通过后 git commit && push。"
   ```
   参考 skill: `codex`, `codex-windows`。**必须先 ls 出实际 hash**，不能通配 *。
3. Codex 完成后 push 到 main，Vercel 自动部署
4. Hermes `curl -sI https://nuxt-texas-poker.vercel.app | head -3` 校验 200
5. 用户在手机上验证 UI

**不动清单**（除非用户明确要求）：
- `server/utils/config.ts` 里的常量数值
- `server/utils/game.ts` 里的规则/流程
- KV schema（`kv.ts` 的 key 前缀）
- `app/pages/index.vue` / `app/pages/room/[id].vue`（除非改首页/等待室）

---

## 11. 已知遗留 / 待优化

- 首页 duplicated imports 与 sourcemap 警告（不影响 build）
- session key 无索引，回收房间时不主动删 `session:<token>`；靠 24h TTL 兜底
- 无定时任务，全靠 handler 入口惰性清理死房间
- 头像/荷官目前用 emoji/CSS 占位，未接真实立绘
- UI 反复迭代过：席位定位、我方手牌位置、桌面比例。**改 UI 前先看 `app/pages/game/[id].vue` 里的 `<style scoped>`**，坐标全在那里

---

## 12. 常用锚点（快速定位）

- 席位坐标：`app/pages/game/[id].vue` `.seat-1` ~ `.seat-6`
- 我方手牌：`.me-panel`
- 桌面容器：`.table-wrap` / `.table-inner`
- 荷官/底池/D/公共牌：`.dealer-avatar` / `.pot-row` / `.corner-deco` / `.community`
- 操作按钮：`.action-bar` + `foldDisabled`/`checkDisabled` computed
- 建房密码：`server/utils/config.ts:ROOM_CREATE_PASSWORD`
- 死房间清理：`server/utils/store.ts:isRoomDead` / `loadRoomOrCleanup`
- 超时弃牌：`server/utils/game.ts:advanceIfTimedOut`
- 致命错误跳首页：`app/stores/poker.ts:_handleFatal`
