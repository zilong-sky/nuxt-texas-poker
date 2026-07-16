# 需求变更：昵称 + 固定密码创建 + 房间列表

## 一、首页流程重构（app/pages/index.vue）
1. 页面顶部一个必填输入框：**昵称**（1-12 字符，trim 后非空）。用户先填昵称。
2. 昵称下方两块区域：
   - **创建房间**：一个密码输入框 + "创建房间"按钮。仅当密码 === `654321` 时后端才允许创建。密码错误前端弹窗"密码无效，无法创建房间"。
   - **加入房间**：下方列出**所有当前 status='waiting' 且未满 6 人**的房间，标题格式：`{房主昵称} 创建的房间`，右侧显示 `X/6 人`。点击整行即加入（**不需要密码**）。
3. 昵称为空时，创建按钮 + 房间列表点击都禁用，提示"请先填写昵称"。
4. 加入前后端校验：若房间内已有相同昵称（含 Bot 名），返回错误码 `NAME_TAKEN`，前端弹窗"昵称已被占用，请更换后重试"，停留首页。
5. 玩家昵称在整个对局中始终显示为用户填的昵称，删除原来的"玩家XXX"随机名逻辑。

## 二、后端 API 变更
### 1. 新增 `GET /api/room/list`
返回所有 `status='waiting'` 且 `players.length < 6` 的房间数组：
```
[{ id, hostName, playerCount, maxPlayers: 6 }, ...]
```
用一个 KV set `rooms:waiting` 存房间 id 集合，房间状态变化（创建/开局/清空）时增删。或简单起见每次 `SCAN` 也行，但优先用 set。

### 2. 拆分 `POST /api/room/join` 为两个接口
- **`POST /api/room/create`**  入参 `{ password, nickname }`
  - 密码必须严格等于 `654321`（写常量 `ROOM_CREATE_PASSWORD` 在 `server/utils/config.ts`），否则返回 `INVALID_PASSWORD`。
  - 昵称校验（1-12 字符，trim）。
  - 创建新房间，当前用户为房主，玩家名 = nickname。加入 `rooms:waiting`。
  - 返回 `{ token, playerId, roomId }`。
  - **删除**"密码即房间索引"的逻辑（`room:pw:*` 键不再需要，删掉相关代码）。同一密码可开多个房间，房间之间用 roomId 区分。
- **`POST /api/room/join`**  入参 `{ roomId, nickname }`
  - 校验房间存在、`status='waiting'`、`players.length<6`。
  - 校验昵称不与房间内任何玩家（含 Bot）重复，重复返回 `NAME_TAKEN`。
  - 加入房间，玩家名 = nickname。
  - 返回 `{ token, playerId, roomId }`。

### 3. `add-bot` 加机器人时也要保证名字不与真人重复（Bot-1、Bot-2...，若冲突则 Bot-3、Bot-4 顺延）。

### 4. `start`（开局）时把该房间从 `rooms:waiting` set 移除。房间彻底销毁时也移除。

## 三、前端调整
1. `app/pages/index.vue`：按上面重写。房间列表用 3 秒轮询 `/api/room/list` 刷新。
2. localStorage 里除了 `pokerToken` 再存一份 `pokerNickname`，下次进来自动回填。
3. reconnect 逻辑保留：有 token 就直接跳房间。
4. 等待页、对局页显示的玩家名从后端返回的 `player.name` 直接取，不要再前端拼"玩家XXX"。

## 四、其它
- 沿用现有 `@vercel/kv`，KV 环境变量已配好，无需改依赖。
- `server/utils/config.ts` 集中导出常量 `ROOM_CREATE_PASSWORD = '654321'`、初始筹码、小/大盲等（把散落在代码里的常量搬过来）。
- 更新 README，说明"固定密码 654321 用于创建房间，加入房间无需密码"。

## 五、验收
1. `npm run build` 通过。
2. 本地起 dev 或直接测线上：
   - 用密码 `abc` 建房 → 应返回 400 `INVALID_PASSWORD`。
   - 用密码 `654321` + 昵称 `Alice` 建房 → 成功。
   - `GET /api/room/list` 应包含此房间，`hostName: "Alice"`。
   - 昵称 `Alice` 尝试 join 同房间 → `NAME_TAKEN`。
   - 昵称 `Bob` join 成功。
3. commit + push origin main。commit message：`feat: nickname + fixed password + room list`。
