# wodniack.dev 完全拆解报告

> 分析方式：浏览器实测（含 32s 滚动录像 `wodniack-scroll-recording.webm`）+ JS bundle / CSS 静态逆向。
> 站点：法国创意开发者 AW 的作品集 one-pager（Awwwards SOTD 级作品），粗野主义红黑设计。

---

## 1. 技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 框架 | **Astro v4.15.9** | 纯静态输出，**无任何前端框架运行时**（不是 React/Vue），全部逻辑在一个 hoisted vanilla JS bundle（195KB 未压缩）里 |
| 动画 | **GSAP 3.12.5** | 打包插件：ScrollTrigger、**SplitText（Club 付费）**、**DrawSVGPlugin（Club 付费）**、EasePack（expo/slow 等） |
| 平滑滚动 | **Lenis 1.1.13** | 完整打包进 bundle；`lenis.on("scroll", ScrollTrigger.update)`，`gsap.ticker.add(t => lenis.raf(t*1000))`，`lagSmoothing(0)` —— Lenis 与 GSAP 共用同一个 rAF |
| 自定义元素 | `a-waves`、`a-separator`、`a-work` | Web Components 做"行为组件" |
| 字体 | PP Editorial New / PP Fraktion Mono / Bigger Display | Pangram Pangram 商业字体，woff2 自托管 + preload（5 个字重） |
| 媒体 | 10 个项目 mp4（1082×636，muted/loop/playsinline），`data-src` 懒加载 | |
| 部署 | Cloudflare（含 bot 反爬盾 + Insights） | curl 直接抓会命中 5 秒挑战页（检测 webdriver/headless/plugins 伪造） |
| 路由 | **无子页面** —— 一个 92KB HTML 的 one-pager，导航为 `#about/#work/#contact` 锚点（lenis.scrollTo 平滑跳转） | |

## 2. 运行时架构（自研 ~800 行微框架）

整站没有框架，是手写的一套模式，所有 section 动画类都遵循同一契约：

```
constructor() → 查询 DOM、初始化状态
  → (document 已 loaded ? 立即 : 监听 siteLoaded) → init()
  → init(): setSize/setXxx 计算几何 + bindEvents
  → bindEvents(): 订阅 $ 事件总线 + intersect 事件
  → onIntersect(e): 离屏时 $.off("tick") 停止计算，进屏恢复
```

核心单例：

- **`$`**（事件总线）：`on/once/off/emit`，回调带 context，去重注册。
- **`xe`**（tick 管理器）：挂在 `gsap.ticker` 上，每帧 `$.emit("tick", t*1000)` 给全站；另提供 `nextTick`（下一帧执行一次，用于布局后写读分离）。
- **`App`**（入口类）：
  - UA 探测 → `html.is-mac/is-chrome/...` 类名；
  - 初始化 Lenis；
  - `IntersectionObserver` 观察所有 `[data-intersect]` 元素 → 派发 DOM 自定义事件 `intersect`（detail.isIntersecting）并维护 `is-in-view / is-out-of-view-top / is-out-of-view-bottom` 类；
  - resize **节流 200ms**，写全局 `window.safeWidth/safeHeight/maxScrollTop/scrollProgress`；
  - `siteLoaded` → `html.is-loaded` + 事件广播，触发 5 秒 preloader intro 时间轴，中途（-=1.85s）派发 `intro` 事件，结束时移除 preloader、解除 `is-scroll-blocked` 滚动锁、派发 `updateViewport`。
- **Scrollbar**：自绘滚动条，CSS 变量 `--scrollbar-height/--scrollbar-top` 驱动，thumb 可拖拽（拖拽直接 `window.scrollTo`）。
- **Head UI**：对比度切换、控制台打字机彩蛋、菜单平滑滚动。

**关键性能模式（这是整站最值得学的）**：

1. **单一 rAF**：Lenis、所有 canvas/SVG 重算、粒子物理全部挂在 gsap.ticker 的 "tick" 事件上。
2. **离屏即停**：每个 section 的 tick 回调通过 intersect 事件动态 `$.on/$.off`，看不见就不算。
3. **变化检测才重绘**：`Math.round(x*100)/100` 与上一帧比较，相同则跳过 canvas 重绘 / SVG path 重建。
4. **JS 写 CSS 变量，CSS calc() 消费**：物理循环只写 `--x/--y/--z/--progress` 等变量，transform 计算交给 CSS，避免逐帧读布局。
5. **视频链式懒加载**：Work 区进入视口才开始 `loadNextVideo()`，靠 `canplaythrough` 事件一个接一个加载。

## 3. 逐段动画拆解

### 3.1 Preloader（~5s）
Logo 竖线 `scaleY 0→1`（stagger .15，power4.inOut）→ 横线 `scaleX` → 边框 3s 画入；2s 处线条向上收合；`-=1.85s` 处派发 `intro`（Hero/Head 的入场都监听它）；5s 处移除 preloader、解锁滚动。期间 `html.is-scroll-blocked` 禁滚。

### 3.2 Hero —— Perlin 噪声波浪 + 逐字符漂移
- **`a-waves` 背景**：SVG 竖向折线（水平 10px、垂直 32px 采样成点阵），每点用 **Perlin 噪声**（手写 simplex 实现，随机种子）算角度 → 位移 `cos(θ)*32, sin(θ)*16`，噪声随时间流动（`t*0.0125`）。
- **鼠标交互**（intro 结束后才开启，`introend` 事件）：跟踪鼠标速度 `vs`（lerp 平滑）与方向 `a`，半径 `max(175, vs)` 内的点受推力，弹簧回归（`v += -x*0.005`，阻尼 .925，位移 ±100px 夹紧）—— 甩得越快线被推得越开。
- **标题**：GSAP **SplitText** 拆 words+chars → 手动给每个 char 包一层 `.char__inner`（overflow 裁切）；入场：`y: -200% → -100%`，stagger .02，expo.inOut 2s（字符从遮罩下方逐个顶上来）；波浪线用 **DrawSVG** `100%→0%` 描边展开（3s，stagger from edges）。
- **idle 彩蛋**：每帧 1% 概率随机选一个字符，加 `to-top/bottom/left/right` 类（CSS keyframe 1s `cubic-bezier(.86,0,.07,1)` 滑出滑回），2s 后移除 —— 标题偶尔"漏字"。
- 星标 `rotate 90°→0`，分隔线从上下滑入。

### 3.3 `a-separator`（二进制滚动条 ×3）
装饰性 0/1 字符串，每帧每字符 10% 概率翻转 —— 纯 class 切换（`a__char--0/1`）。

### 3.4 About —— 透视网格隧道 + 笑脸粒子
- **几何**：外框（section 全域）与内框（内容块）之间，12 列（移动 8）采样点两两连线；4 个角的斜向线用二次缓动 `d = 1-(1-h·g)²` 插值 → 形成**透视汇聚**的隧道网格。全部线拼成一个 SVG path 的 `d` 字符串。
- **滚动驱动**：进度 `p`（进入视口→离开），`sp += (p-sp)*0.2` 平滑；内框 `offsetY = 400·(sp·2-1)` —— 隧道随滚动前后穿越。**只有 `p` 变化才重建 path**。
- **Awards hover**：从奖项中心抛 10 个（移动 5）笑脸 canvas 粒子（48px，重力 `.45`/帧，初速 `vy ∈ [-15,-5]`，随机角速度，alpha 漂移，落出下边界回收）。高对比主题自动换反色贴图（预加载两张 SVG Image）。
- 奖项行 IntersectionObserver（threshold .5）→ `is-revealed` 淡入。

### 3.5 Work —— 滚动穿越隧道（全站最复杂）
- **结构**：区高 = 项目数 × **50lvh**（10 项目 = 500lvh 滚动跑道）。内部：SVG 圆角矩形孔洞蒙版（evenodd：外全屏 - 内圆角洞）+ 场景（幽灵字母 + 视频卡）+ canvas 点阵。
- **ScrollTrigger scrub:1**（top 25% → bottom 75%），时间轴**对称进出**（前 0.75 进、后 0.75 出，全部 `immediateRender:!1`）：
  1. 蒙版 `scale 1 → maxScale(≈全屏)` power4.in —— **镜头穿洞放大**；
  2. 场景 `scale .75 → 1`；容器 `clipPath inset(0 1rem) → 0`；
  3. `pointsProgress 0→1`：canvas 点阵（24px 网格）从屏幕中心向外扩散；
  4. `state 0→1` 写 `--state`，控制字母 3D 位移强度从 0 渐满；
  5. 各 `a-work` 卡片 `progress` attr `1 → -1`（ease `slow(0.15,0.6)`，stagger .25）：视频卡 `rotateY(-20°·p) + 横向 50vw 飞过 + scale(--size)`；
  6. `animationProgress → 1e4`：**幽灵字母**（每个源字母克隆 `宽度/字宽·0.75+2` 份）以 `--progress`（mod 循环）无限飞过，transform: `rotateY(head·-10°·state) translate3d(head·50vw·state, iy·50%·ahead·state, 0)`，`::before` 用 shadow 色做偏移阴影副本；
  7. 结尾全部反向收回。
- **`a-work` 自定义元素**：`progress` attr 为 1 或 -1（两端）时视频 `pause()`，中间 `play()`；锚点链接 `#` 阻止默认。
- `contrastchange` 时重读 `--color-primary` 作 canvas 点阵 strokeStyle。

### 3.6 My Way —— 3D 物理游乐场
- DOM 卡片做 CSS 3D（`perspectiveOrigin` 定在标尺处），JS 每帧写 `--x/--y/--z/--rx/--ry/--rz/--s`，CSS: `translate3d(...) rotateX/Y(...) rotate(...) scale(...)`。
- **生成**：从 `z=-20000` 以 `vz 40~50` 飞向观众，随机横漂/自转；`z>1000` 回收入池。
- **拖拽**：抓住后弹簧追踪鼠标（`vx += (target-x)·0.075`，阻尼 .9，姿态随速度倾斜）；松手 → 重力 `.5` 坠落 + 旋转，1s 后淡出回收。**可以真拖**。
- **自动投放**：在视口内每 0.5~1s（移动端 ×1.25）随机再抛一个，同屏上限 5 + 初始 2~5 个。
- SVG 放射线从中央笑脸向边缘网格点汇聚；文案双层（distorted/normal）按 `--amplitude` 差速滚动错位。

### 3.7 CTA —— 弹簧网格 + 波
- SVG 网格质点（12×8），双层弹簧（vx/vy 推力层 + wx/wy 位移层，阻尼 .9）。
- **脉冲**：按钮文字 `scale .85→1.05`（2.7s，repeat）打点触发 `wavePulse`：波前 `progress 0→height`（speed 15），波前 30px 内质点按 `cos(a·0.01)·(1-距离/30)` 包络受推力 —— 网格周期性荡开涟漪。
- **hover 600ms → shock**：speed 30、strength ×5 的冲击波 + 网格整体按 `easeOut` 指数外扩（`--bg-p` 式的 op 淡入）；离开后恢复脉冲。

### 3.8 Head —— 控制台打字机彩蛋
页眉小控制台帧驱动逐字打出 60+ 条自嘲文案（每字 20ms，标点 400ms，保留最后 5 行），QR 码用 `--bg-p 0→100%` 渐显。

## 4. 设计系统

```css
:root {
  --color-primary: #f40c3f;   /* 红 */
  --color-secondary: #160000; /* 近黑 */
  --color-shadow: #540000;    /* 字母阴影副本色 */
  --color-white: #fff0eb;     /* 暖白 */
}
.theme-contrasted { --color-primary: #fff2ed; --color-shadow: #4d4040; } /* 米白反转 */
```

- **主题切换**：全屏 `.site-contrast-mask` 从 -100% 滑入擦除（1s expo.inOut），**中途换类** → 全站 CSS 变量瞬变 → 广播 `contrastchange`（canvas/SVG 重读颜色）→ 遮罩滑出。视觉上是"擦除reveal"而非闪烁切换。
- 字体三级：**Bigger Display**（巨型标题 `min(15vw, 18.5rem)/.8`）/ **Editorial New**（正文 200）/ **Fraktion Mono**（8–14px 标签 UI）。
- 瑞士网格：全站 1px 边框骨架；分隔线用 `linear-gradient` 半像素技巧。
- 断点：767 / 987 / 1080 / 1280 / 1530 / 1680px；移动端**系统性降级**（网格密度 12→8、粒子数减半、3D 位移减半、投放间隔 ×1.25）。
- `scrollbar-width:none` + 自绘滚动条；`::selection` 反色。

## 5. 可复用工程要点

1. **one-pager + Astro 静态 + 零框架运行时** = 极致首屏（动画全是 vanilla JS）。
2. Lenis ↔ GSAP 同 ticker 集成（官方推荐写法）。
3. `IntersectionObserver → DOM CustomEvent("intersect") → $总线 on/off("tick")` 的**离屏门控**模式。
4. 物理/几何动画走 **CSS 变量单向数据流**（JS 只写 var，CSS calc 出 transform）。
5. scrub 时间轴的**对称 in/out + immediateRender:!1** 写法，防止 fromTo 初始渲染互相覆盖。
6. SVG 动画 = **批量拼 `d` 字符串**一次性 `setAttribute`，比逐元素操作快得多。
7. 重绘前做**量化 diff**（round(x·100)/100 比较），静止画面零开销。
8. 预加载与内容入场通过 `siteLoaded/intro/introend/updateViewport` 事件**解耦**。

## 6. 缺陷与复刻注意

- **无 `prefers-reduced-motion` 支持** —— 整站动画对动效敏感用户不友好，复刻时应补。
- SplitText / DrawSVG 是 **Club GSAP 付费插件**；替代：自写字符拆分（本站的 `.char__inner` 包装其实已手写）+ `stroke-dasharray/offset` 模拟描边。
- `window.safeWidth` 等直接污染 window（非标准）。
- 拖拽/物理为手写数值积分，帧率 >60Hz 屏幕上速度会偏快（无 dt 归一）。
- 单 HTML 92KB / JS 195KB（未 gzip），因为所有 section 内容 + 10 个视频引用都在一个页面。
- 站点在 Cloudflare 盾后，脚本化抓取需真实浏览器环境（本次通过浏览器内同源 fetch 拿到真实 HTML）。

---

*分析产物：本报告 + `wodniack-scroll-recording.webm`（32s 首页滚动录像）。逆向样本：`/tmp/wodniack/`（hoisted.pretty.js 6401 行、styles.pretty.css 3344 行、rendered.html 92KB）。*
