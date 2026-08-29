# Product.md —— 个人主页（My Homepage）产品规格

> 本文档基于对 [wodniack.dev](https://wodniack.dev) 的完整逆向分析（详见 [wodniack-analysis.md](./wodniack-analysis.md)）提炼而成，
> 定义一个同级别、可落地、可自行维护的创意开发者作品集 one-pager。
> 深层实现参数（缓动、stagger、物理系数等）均来自源站逆向结果，可直接照抄调参。

---

## 1. 产品概述

- **形态**：单页应用式作品集（one-pager），无子路由，导航为锚点平滑滚动。
- **定位**：创意开发者 / 前端动画工程师的个人名片，"打开 3 秒内让人记住"。
- **风格**：粗野主义 × 瑞士网格：巨型显示字体、1px 边框骨架、单主色撞近黑、大面积留白中的高密度动效。
- **一句话卖点**：满屏物理/滚动驱动动画，但静止时零 CPU 开销，且无任何框架运行时。

## 2. 目标与非目标

**目标**
1. 首屏（Hero + 预加载动画）≤ 5s 完整入场，Lighthouse Performance（桌面）≥ 90。
2. 全站动画 60fps：单一 rAF、离屏门控、重绘 diff。
3. 支持高对比主题切换（无闪烁擦除过渡）。
4. 桌面 / 平板 / 移动三档系统性降级，移动端可完整体验所有 section。

**非目标**
- 不做 CMS / 博客 / 多语言（第一版）。
- 不做 SSR 框架（Next/Nuxt）——静态 Astro 足够。
- 不追求还原源站像素级复刻，复刻"架构与体验"，视觉用自己的品牌色与字体。

## 3. 技术选型

| 层 | 选型 | 理由 / 与源站差异 |
|---|---|---|
| 构建 | **Astro（最新 v4+）**，纯静态输出 | 零框架运行时；源站同款。所有逻辑放一个 hoisted vanilla JS bundle |
| 动画 | **GSAP（免费核心）+ ScrollTrigger** | 源站用了付费的 SplitText / DrawSVG；**我们替代**：① 字符拆分自写（span.char > span.char__inner 双层 + overflow 裁切），② 描边动画用 `stroke-dasharray/offset` |
| 平滑滚动 | **Lenis** | 与 GSAP 同 ticker 集成：`lenis.on("scroll", ScrollTrigger.update)` + `gsap.ticker.add(t => lenis.raf(t*1000))` + `lagSmoothing(0)` |
| 行为组件 | Web Components（`x-waves` / `x-separator` / `x-work`） | 自定义元素承载"组件行为"，无框架依赖 |
| 字体 | 自托管 woff2 + `preload`，三级字体体系 | 显示标题 / 正文衬线 / 等宽标签，各 2 个字重以内 |
| 部署 | Cloudflare Pages / Vercel 静态托管 | 不开反爬盾（源站有，个人站无必要） |

**自研微框架（~800 行以内）**，四个单例：
- `$` 事件总线：`on/once/off/emit`，回调带 context；
- `Ticker`：挂 `gsap.ticker`，每帧广播 `tick(t)`，附 `nextTick`（下一帧执行，读写分离）；
- `App`：UA 类名、Lenis 初始化、`[data-intersect]` 的 IntersectionObserver → 派发 DOM `intersect` 事件 + `is-in-view / is-out-of-view-top/bottom` 类、resize 节流 200ms、全局 `safeWidth/safeHeight/maxScrollTop/scrollProgress`；
- `Scrollbar`：自绘滚动条（CSS 变量驱动，thumb 可拖拽）。

**所有 section 动画类统一契约**：
```
constructor → 查 DOM/初始状态
→ siteLoaded 事件 → init()（几何计算）
→ bindEvents()（$ 总线 + intersect）
→ onIntersect：离屏 $.off("tick")，进屏 $.on("tick")
```

## 4. 页面信息架构（自上而下）

| # | Section | 内容 | 核心体验 |
|---|---|---|---|
| 0 | Preloader | Logo / 姓名 | ~5s 入场仪式，结束后解锁滚动 |
| 1 | Head（固定） | Logo、锚点菜单、主题切换、社交、彩蛋控制台 | 常驻 UI，入场从顶部滑入 |
| 2 | Hero | 巨型职位标题（两行大字）、波浪背景、边框 | Perlin 噪声波浪 + 逐字符入场/漂移 |
| 3 | Separator ×N | 二进制 0/1 装饰条 | 随机翻转的"数据流"质感 |
| 4 | About | 简介 + 奖项/履历列表 | 透视网格隧道 + hover 抛粒子 |
| 5 | Work | 项目视频卡（8–10 个） | 滚动穿越隧道（全站高潮） |
| 6 | Playground（对应源站 My Way） | 工作方式 / 技能卡片 | 3D 物理飞物 + 可拖拽 |
| 7 | CTA / Contact | 联系按钮、链接、页脚 | 弹簧网格脉冲/冲击波 |

导航锚点：`#about` `#work` `#contact`（lenis.scrollTo，五次缓动 `t<.5 ? 16t⁵ : 1+16(--t)⁵`）。

## 5. 动画规格（逐段，含逆向参数）

### 5.0 Preloader（总长 ~5s）
1. Logo 竖线 `scaleY 0→1`，1s，power4.inOut，stagger .15；
2. 横线 `scaleX 0→1`，0.4s；边框三边 3s 画入（power3.inOut）；
3. 2s 处线条收合消失（transformOrigin 切 50% 0）；
4. **`-=1.85s` 派发 `intro` 事件**（Hero/Head 监听它开始入场）；
5. 5s 移除 preloader、移除 `is-scroll-blocked`、派发 `updateViewport`。

### 5.1 Hero —— 噪声波浪 + 字符动画
- **波浪背景**：SVG 竖向折线，采样网格 10px×32px；
  - 每点角度 = `perlin2((x+t·0.0125)·0.002, (y+t·0.005)·0.0015)`（手写 Perlin/simplex，随机种子）；
  - 位移 `cos(θ)·32, sin(θ)·16`，坐标 round(x·10)/10 再拼 `d` 字符串；
  - **鼠标交互**（intro 结束后启用）：追踪鼠标平滑速度 `vs`（lerp .1）与方向角 `a`；半径 `max(175, vs)` 内的点受推力 `cos(dist·0.001)·(1-dist/R)`，弹簧回归 `-x·0.005`、阻尼 `.925`、位移 ±100px 夹紧；
  - 入场用描边动画：`stroke-dashoffset` 从全长 → 0，3s expo.out，stagger from edges。
- **标题**：自写拆字 → `.char`（overflow hidden）> `.char__inner`；
  - 入场：`y -200% → -100%`，2s expo.inOut，stagger .02；
  - idle：每帧 1% 概率随机字符加 `to-top/bottom/left/right`（CSS keyframe 1s `cubic-bezier(.86,0,.07,1)`），2s 后移除；
  - 字号 `min(15vw, 18.5rem)/0.8` 显示字体。

### 5.2 Separator
纯 class 切换：每帧每字符 10% 概率 0↔1 翻转；离屏停。

### 5.3 About —— 透视网格隧道
- 外框（section）与内框（内容）之间：**12 列**（移动 8）对应点连线；四角斜线以 `d = 1-(1-h·g)²` 二次缓动插值 → 透视汇聚；
- 全部线拼单条 path `d`，一次性 `setAttribute`；
- 滚动：进度 `p`（viewport 进入→离开），`sp += (p-sp)·0.2`；内框 `offsetY = 400·(sp·2-1)`（移动 200）写 `--offset-y`；
- **仅当 round((p-sp)·1000)/1000 ≠ 0 时重建 path**；
- 奖项 hover：抛 10 个（移动 5）Canvas 粒子，48px，重力 `0.45/帧`，`vy ∈ [-15,-5]`，随机角速度 + alpha 漂移，出下边界回收；两套贴图对应双主题，预加载。

### 5.4 Work —— 滚动穿越隧道（旗舰段）
- 区高 = 项目数 × **50lvh**（10 项目 = 500lvh）；
- 层级：SVG 圆角孔洞蒙版（evenodd：全屏外环 − 圆角洞，洞边内缩 16px 复制一层做描边 + 网格线 clip）→ 场景（幽灵字母 + `x-work` 视频卡）→ Canvas 点阵（24px 网格）；
- **ScrollTrigger scrub:1**，trigger 为 section，start `top 25%` / end `bottom 75%`；时间轴对称（进 0.75 / 出 0.75，出段全部 `immediateRender:false`）：
  1. 蒙版 `scale 1 → maxScale(视宽/半洞宽)` power4.in（镜头穿洞）；
  2. 场景 `scale .75 → 1` power3.in；容器 `clipPath inset(0 1rem) → 0`；
  3. `pointsProgress 0→1`：点阵从屏幕中心扩散 `pos + dist·(1-r)·0.2`；
  4. `state 0→1` 写 `--state`（字母 3D 强度渐满）；
  5. 各视频卡 `progress` 属性 `1 → -1`，ease `slow(0.15,0.6)`，stagger .25；卡片 CSS：`rotateY(p·-20°) translate3d(p·(50vw+100%)−50%, y·50%−50%, p²·−5rem) scale(var(--size))`；
  6. `animationProgress → 1e4`：幽灵字母（每源字母克隆 `宽/字宽·0.75 + 2` 份）`--progress` mod 循环飞过：`rotateY(head·−10°·state) translate3d(head·50vw·state, iy·50%·ahead·state, 0)`；`::before` 阴影副本（shadow 色，scale(1.05,1.02) 偏移）；
  7. 结尾全部反向。
- **视频链式懒加载**：section 首次进视口才开始逐个 `load()`（`data-src` → src），`canplaythrough` 触发下一个；
- `x-work` 组件：`progress` 为 ±1 时 `video.pause()`，中间 `play()`；muted/loop/playsinline；
- 主题切换时重读 `--color-primary` 作点阵 strokeStyle。

### 5.5 Playground —— 3D 物理飞物
- DOM 卡片 + CSS 3D（容器 `perspectiveOrigin: 50% <ruler底>`）；
- 每帧写 `--x/--y/--z/--rx/--ry/--rz/--s`；CSS：`translate3d rotateX/Y rotate scale`；
- 生成：`z=-20000`，`vz 40~50`，随机 `vx/vy`（±屏宽·0.25%）、自转 `vrx/vry 0.25~1`；`z>1000` 回收；
- **拖拽**（mousedown/touchstart）：弹簧追踪 `v += (target−pos)·0.075`，阻尼 .9；姿态 = 速度映射（`ry=vx·0.15, rx=−vy·0.15`）；松手：重力 `vy += 0.5` 坠落 + 旋转，1s 后回收；
- 自动投放：视口内每 0.5–1s（移动 ×1.25）随机抛一个，同屏上限 5 + 初始 2~5；
- 背景：SVG 放射线由中心笑脸向边缘 12 列网格点汇聚；文案双层按 `--amplitude` 差速滚动。

### 5.6 CTA —— 弹簧网格波
- SVG 网格质点 12×8；双层弹簧（力层 vx/vy + 位移层 wx/wy，阻尼均 .9，力→位移 ×3）；
- **脉冲**：按钮文字 `scale .85→1.05` 2.7s power2.in 循环，打点触发波：波前 `progress += 15/帧`（移动 10），波前 30px 内质点推力 `cos(a·0.01)·(1−dist/30)·strength`（strength 1，移动 .35）；
- **hover 600ms → 冲击**：speed 30 / strength 5 + 网格整体 `easeOut` 指数外扩淡入；离开恢复脉冲。

### 5.7 Head
- 入场（intro 后 1s 起）：整条 `y -100% → 0` 1.5s expo.inOut，内容 stagger .1 expo.out；QR/头像 `--bg-p 0→100%`；
- 控制台彩蛋：帧驱动逐字打字（20ms/字，`,· `100ms、`.·…`400ms），只保留末 5 行，文案库 ≥ 30 条自嘲/加载文案；
- **主题切换**：全屏遮罩 `x -100%→0` 1s expo.inOut，**中途换 `.theme-contrasted` 类**，广播 `contrastchange`（Canvas/SVG 重读色），遮罩复位。

## 6. 设计系统

```css
:root {
  --color-primary: <品牌主色>;       /* 源站 #f40c3f 红，选一个高饱和撞色 */
  --color-secondary: <近黑>;         /* 源站 #160000（带色相的黑） */
  --color-shadow: <主色暗阶>;        /* 幽灵字母阴影副本，源站 #540000 */
  --color-white: <暖白>;             /* 源站 #fff0eb */
}
.theme-contrasted { --color-primary: <暖白>; --color-shadow: <灰阶>; }
```
- 字体三级：`--font-display`（巨型标题，`min(15vw, 18.5rem)/0.8`）/ `--font-serif`（正文，weight 200）/ `--font-mono`（8–14px 标签、行高 16px）；
- 全站 1px 边框瑞士网格；分隔线 `linear-gradient` 半像素技巧；`::selection` 反色；`scrollbar-width:none` + 自绘滚动条；
- 断点：**767 / 987 / 1080 / 1280**（+1530/1680 大屏增益）；移动端统一降级表：网格密度 12→8、粒子 10→5、3D 位移 ×0.5、投放间隔 ×1.25。

## 7. 性能预算与验收

| 项 | 预算 |
|---|---|
| JS bundle（gzip） | ≤ 70KB（GSAP+ST+Lenis+自研框架；无付费插件） |
| 首屏 LCP | ≤ 2.5s（字体 preload + 关键 CSS 内联） |
| 动画帧率 | 60fps；静止页面（滚动停止、无 hover）CPU ≈ 0% |
| 视频 | 全部懒加载链式；单条 ≤ 2MB，1082×636 级 |

**验收清单**（对照源站行为）：
- [ ] Preloader 5s 仪式感完整，`intro` 事件驱动各段入场；
- [ ] Hero：波浪噪声流动 + 鼠标推线 + 字符入场与随机漂移；
- [ ] About：隧道随滚动穿越（lerp 平滑），奖项 hover 抛粒子，双主题粒子贴图正确；
- [ ] Work：scrub 穿洞对称进出、幽灵字母循环飞过、点阵扩散、视频按需加载并在 ±1 进度暂停/播放；
- [ ] Playground：飞物持续投放、可拖拽（弹簧手感）、松手坠落回收；
- [ ] CTA：周期脉冲 + hover 冲击波，网格外扩；
- [ ] 主题切换擦除过渡无闪烁；全站颜色变量化；
- [ ] 移动端 767 断点全段可玩；
- [ ] **`prefers-reduced-motion`：提供静态降级**（源站缺失，我们必须补）——跳过 preloader、停用 idle 动画与粒子、scrub 退化为淡入淡出；
- [ ] 键盘可达：菜单/联系链接可 Tab，焦点样式自定义。

## 8. 里程碑

1. **M1 骨架**：Astro 工程 + 设计系统 + Lenis/GSAP 集成 + 自研微框架（$/Ticker/App/Scrollbar）+ Preloader/Head。
2. **M2 首屏**：Hero 波浪背景（噪声+鼠标场）+ 拆字入场 + idle 漂移 + Separator。
3. **M3 中段**：About 隧道 + 笑脸粒子；Playground 3D 物理 + 拖拽。
4. **M4 旗舰段**：Work 穿洞 scrub 时间轴 + 幽灵字母 + 视频懒加载链。
5. **M5 收尾**：CTA 波网格 + 主题切换擦除 + 控制台彩蛋 + 移动端降级 + reduced-motion + 性能调优压测。

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| 高刷屏（120Hz）物理过快 | 速度按 `dt` 归一（源站未做，我们改进）：`v · (dt/16.7)` |
| 付费插件不可用 | 自写拆字 + dashoffset 描边（已列入选型） |
| 巨型字母换行/响应式 | resize 节流 200ms 后全量重算（SplitText.revert + 重建），源站同款 |
| 视频体积 | AV1/H.264 双源，首帧 poster，仅 Work 段加载 |
