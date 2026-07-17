# 需求变更：对局页视觉风格靠近参考图

## 一、桌面配色改蓝色系
- `app/assets/main.css` 新增/覆盖变量：
  ```css
  --felt: #1e3a8a;         /* 深蓝 */
  --felt-light: #3b5cb8;   /* 亮蓝 */
  --felt-dark: #0f1e4a;    /* 暗蓝 */
  --rail: #2a1810;         /* 深棕木边 */
  --gold: #d4a04a;         /* 金色 */
  ```
- `.table` 背景改成蓝色径向渐变：`radial-gradient(ellipse at center, var(--felt-light) 0%, var(--felt) 55%, var(--felt-dark) 100%)`
- 保留金色边框和棕色 rail

## 二、荷官换成女性卡通头像
- `app/pages/game/[id].vue` 里 `.dealer-avatar` 内容从 🎩 改成 👩‍💼 或 🃏
- 荷官头像下方标签"荷官"改成"发牌员"
- 荷官头像圆形背景改成浅色（`background: linear-gradient(135deg, #fbeee0, #d9b892)`），金边

## 三、本人手牌移到桌面下方居中
- 目前本人手牌在底部操作栏内。改成：
  - **手牌位置**：桌面下方独立居中的一行，2张大牌横排，牌下方显示当前牌型（如"高牌 / 一对 / 两对..."）
  - **操作按钮**：手牌下方一整排
- 牌型判断：优先用后端返回的 `me.handRank` 字段；如果后端没有此字段，前端可以先显示占位符"—"，不做实际判断（本次先不做算法）。
- CSS：
  ```css
  .me-hand-center {
    position: absolute;
    bottom: 90px;  /* 在操作栏之上 */
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    z-index: 10;
  }
  .me-hand-rank {
    color: var(--gold);
    font-size: 14px;
    font-weight: 700;
    text-shadow: 0 1px 3px rgba(0,0,0,.6);
  }
  ```

## 四、按钮改成蓝色矩形（参考图风格）
- 4个操作按钮**统一蓝色系**，扁平矩形：
  ```css
  .action-btn {
    background: linear-gradient(180deg, #4f7ce8, #2a4fb8);
    color: white;
    border: 1px solid #6b93ff;
    border-radius: 6px;
    min-width: 90px;
    min-height: 48px;
    font-weight: 700;
    box-shadow: 0 2px 6px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.2);
  }
  .action-btn.danger { background: linear-gradient(180deg, #e74c3c, #b03729); }  /* 弃牌保留红 */
  ```
- 加注按钮和输入框合成一组，输入框在按钮下方或按钮左侧

## 五、本人座位（左下）调整
- 由于手牌移到桌面下方，本人座位 seat-5 可以缩小，只显示头像+昵称+筹码，跟其他 5 个座位一样样式
- 或者直接**不显示** seat-5（本人信息挪到底部手牌区旁边），看哪个更清爽 —— 采用**保留 seat-5 但缩小**方案

## 六、其他细节
- 每个座位下注筹码显示：位置朝桌面中心方向（如 seat-1 左上，下注筹码在座位的右下方）
- 底池金色文字加大，靠近公共牌下方
- 阶段标签（FLOP/TURN/RIVER）小字置于底池右侧，不要单独一行占位

## 七、验收
1. `npm run build` 通过
2. 桌面蓝色，按钮蓝色矩形，弃牌保留红色
3. 荷官头像换成女性卡通（emoji 或 SVG 皆可）
4. 本人 2 张手牌在桌面下方居中，下方有牌型占位
5. commit `feat: blue theme + centered hole cards + dealer avatar` + push origin main
