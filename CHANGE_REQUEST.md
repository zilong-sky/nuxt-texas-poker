# 需求变更：首页竖屏 / 对局页强制横屏，去掉横屏提示遮罩

## 一、去掉横屏遮罩
- `app/app.vue` 里删除 `maskType === 'portrait'` 相关分支和 "请横置手机" 遮罩。
- **保留** PC 遮罩（非移动 UA 仍显示"请使用手机浏览器访问"）。

## 二、首页 / 等待页 = 竖屏
- `app/pages/index.vue` 布局改回竖屏：昵称输入在上，创建/加入区块**上下堆叠**（不再左右分栏），房间列表在下方。
- `app/pages/room/[id].vue` 玩家列表改回单列竖向堆叠。
- 这两个页面 CSS 不用强制 100dvw，正常竖屏移动端布局即可。

## 三、对局页 = 强制横屏
- `app/pages/game/[id].vue`：
  - 页面挂载时**用 JS 把整个页面容器旋转 90°**，让用户竖着拿手机也能看到横屏对局画面。
  - 具体做法：给最外层 `.game-page` 加一个 `landscape-lock` wrapper，检测到竖屏时用 CSS transform：
    ```css
    @media (orientation: portrait) {
      .game-page {
        width: 100dvh;
        height: 100dvw;
        transform: rotate(90deg) translateY(-100dvw);
        transform-origin: top left;
        position: fixed;
        top: 0;
        left: 0;
      }
    }
    @media (orientation: landscape) {
      .game-page { width: 100dvw; height: 100dvh; }
    }
    ```
  - 效果：用户竖屏拿手机，游戏画面自动横过来显示，用户横过手机就是正常横屏。
  - 触摸事件坐标不用改，CSS 会自动处理。

## 四、验收
1. 首页/等待页竖屏正常显示，不再出现"请横置手机"遮罩
2. 对局页无论手机横竖握持，画面都是横向布局
3. PC 访问仍显示"请使用手机浏览器访问"
4. `npm run build` 通过
5. commit `feat: portrait home / auto-landscape game page` + push origin main
