# 需求变更：对局页布局按参考图重做（含荷官位）

## 一、座位布局（6玩家 + 1荷官，横屏）
```
    座位1      荷官(dealer)      座位2
   (左上)      (中上，发牌员)     (右上)

  座位6                          座位3
  (左中)                          (右中)

    我(座位5,左下)      座位4(右下)
```
- 玩家 6 人：3 上（左上/右上，中上让位给荷官）→ 不对，重新看：
  **修正**：桌上边3个玩家 → 中间是荷官（不算玩家），所以上边实际有2个玩家 + 中间的荷官。
  → 玩家 6 人分布：**上边2人（左上+右上）+ 两侧2人（左中+右中）+ 下边2人（左下=我 + 右下）**
  → 中间上方额外画一个荷官头像（发牌员，非玩家）

```
    座位1    [荷官]    座位2       ← 上边：玩家1 · 荷官 · 玩家2
   
  座位6              座位3         ← 两侧：玩家6/玩家3
  
    我(座位5)  座位4                ← 下边：我在左下,玩家4在右下
```

## 二、座位分配逻辑（app/pages/game/[id].vue script）
1. `seats` 计算属性重写：
   - 找到"我"的 index (myIndex)
   - **本人固定放在 seat 5（左下）**
   - 顺时针分配：以我为起点，逆时针（因为我在左下）依次分配：
     - offset 0 → seat 5（我，左下）
     - offset 1 → seat 4（右下）
     - offset 2 → seat 3（右中）
     - offset 3 → seat 2（右上）
     - offset 4 → seat 1（左上）
     - offset 5 → seat 6（左中）
   - 数组顺序：`CLOCKWISE = [5, 4, 3, 2, 1, 6]`（从我开始顺时针）

## 三、座位 CSS 位置
```css
.seat-1 { top: 4%;  left: 18%; }              /* 左上 */
.seat-2 { top: 4%;  right: 18%; }             /* 右上 */
.seat-3 { top: 42%; right: 2%; }              /* 右中 */
.seat-4 { bottom: 22%; right: 22%; }          /* 右下（我上方偏右） */
.seat-5 { bottom: 22%; left: 22%; }           /* 左下=我（可能不用绝对定位，见下方） */
.seat-6 { top: 42%; left: 2%; }               /* 左中 */
```
注意：本人座位 seat-5 在桌面区域内左下角，头像+昵称+筹码显示；本人**手牌+操作按钮**在桌面下方的独立操作栏里（不在 seat-5 里面）。

## 四、荷官头像（新增）
- 桌面中央上方，纯装饰元素，不参与游戏：
  ```html
  <div class="dealer">
    <div class="dealer-avatar">🎩</div>
    <div class="dealer-label">荷官</div>
  </div>
  ```
- 位置：`top: -2%, left: 50%, transform: translateX(-50%)`
- 样式：圆形头像，深色背景，金色边框，图标可用 🎩 或 "D"

## 五、桌面 & 公共牌 & 底池
- 桌面 `.table`：宽 84% 高 78%，居中，金色边框
- `.community`：桌面正中央 5 张公共牌横排
- `.pot`：公共牌下方，金色文字"底池 XXX"
- `.stage`：底池下方小字显示阶段（FLOP/TURN/RIVER…）

## 六、底部操作栏
- 位置：`position: absolute; bottom: 0; left: 0; right: 0;` 或 flex 底部
- 分两行：
  - **第一行**：本人手牌（2 张大牌居中）
  - **第二行**：4 个彩色按钮 + 加注输入
- 4 按钮配色：
  - 弃牌 → 红 `linear-gradient(135deg,#e53935,#b71c1c)` 白字
  - 跟注/过牌 → 金 `linear-gradient(135deg,#ffb300,#ff8f00)` 黑字
  - 加注 → 蓝 `linear-gradient(135deg,#42a5f5,#1565c0)` 白字 + 内嵌输入框
  - 全下 → 灰白 `linear-gradient(135deg,#f5f5f5,#e0e0e0)` 黑字
- 每按钮 min-width: 90px, min-height: 50px, border-radius: 12px, font-weight: 700

## 七、不改的部分
- 后端 / API / 游戏逻辑 / 轮询 全部不动
- 只改 `app/pages/game/[id].vue`

## 八、验收
1. `npm run build` 通过
2. 座位分布符合"上2侧2下2 + 荷官中上"
3. 本人固定在左下位（seat-5）
4. 底部4个彩色按钮清晰可见
5. commit: `feat: dealer + 6-seat layout per user spec`
6. push origin main
