# TODO.md —— 任务执行清单

> 由 [product.md](./product.md) 里程碑展开，按依赖顺序排列；每项含验收方式。
> 约定：`[ ]` 待办 / `[x]` 完成；M1→M5 顺序执行，M2/M3 内部子项可并行。

---

## M0 准备（0.5 天）

- [x] T0.1 初始化 Astro + TypeScript 工程（pnpm），配置静态输出、无框架 runtime
- [x] T0.2 确定设计令牌：品牌主色/近黑/阴影色/暖白、三级字体选型（付费 PP 系或免费替代：Space Grotesk / Instrument Serif / JetBrains Mono）并自托管 woff2
- [x] T0.3 准备素材：项目视频 8–10 条（1082×636，≤2MB，muted/loop）、笑脸/图标 SVG 双主题贴图、Logo
- [ ] 验收：`astro dev` 空页面跑通；字体 preload 生效（Network 面板确认）

## M1 骨架：微框架 + Preloader + Head（1.5 天）

- [x] T1.1 设计系统 CSS：`:root` 颜色/字体令牌、`.theme-contrasted`、1px 边框瑞士网格、`::selection`、`scrollbar-width:none`
- [x] T1.2 自研微框架四件套：
  - `$` 事件总线（on/once/off/emit + context 去重）
  - `Ticker`（挂 gsap.ticker，广播 `tick(t)`，`nextTick` 下一帧回调）
  - `App`（UA 类名、`[data-intersect]` IO → `intersect` 事件 + is-in/out-of-view 类、resize 节流 200ms、`safeWidth/safeHeight/maxScrollTop/scrollProgress`）
  - `Scrollbar`（CSS 变量驱动 + thumb 拖拽）
- [x] T1.3 Lenis ↔ GSAP 集成（同 ticker、`lagSmoothing(0)`、scroll → ScrollTrigger.update）
- [x] T1.4 Preloader：5s 时间轴（竖线 scaleY stagger .15 → 横线 → 边框 3s → 收合），`-=1.85s` 派发 `intro`，5s 移除 + 解除 `is-scroll-blocked` + `updateViewport`
- [x] T1.5 Head：锚点菜单（lenis.scrollTo 五次缓动）、Logo/社交位、主题切换按钮、控制台容器
- [ ] 验收：刷新页面完整看到 preloader 仪式 → Head 滑入；滚动平滑且自绘滚动条同步；`App` 事件在控制台可观测

## M2 首屏：Hero 波浪 + 拆字（2 天）

- [x] T2.1 手写 Perlin/simplex 噪声模块（随机种子、perlin2）
- [x] T2.2 `x-waves` 组件：10×32px 采样点阵、`cos(θ)·32/sin(θ)·16` 位移、`d` 字符串批量拼接、入场 dashoffset 描边（3s expo.out stagger from edges）
- [x] T2.3 鼠标速度场：平滑 `vs/a`（lerp .1）、半径 `max(175,vs)` 推力、弹簧回归（-x·0.005、阻尼 .925、±100px 夹紧）、`introend` 后启用
- [x] T2.4 拆字工具：`.char > .char__inner` 双层 + overflow 裁切 + resize 重建（200ms 节流后 revert + re-split）
- [x] T2.5 Hero 标题入场时间轴（y -200%→-100%，2s expo.inOut，stagger .02）+ 星标 rotate + 分隔线上下滑入
- [x] T2.6 idle 漂移：每帧 1% 概率随机字符 to-top/bottom/left/right（CSS keyframe 1s cubic-bezier(.86,0,.07,1)），2s 移除
- [x] T2.7 `x-separator` 二进制条 ×3：每帧每字符 10% 概率翻转 0/1
- [ ] 验收：录像对比源站 Hero；甩动鼠标线被推开并回弹；标题偶尔"漏字"；离屏后 DevTools Performance 显示该段 0 开销

## M3 中段：About 隧道 + Playground 物理场（2.5 天）

- [x] T3.1 About 隧道：外框/内框 12 列（移动 8）连线 + 四角二次缓动 `1-(1-h·g)²` 插值；单 path `d` 批量 setAttribute
- [x] T3.2 滚动驱动：`p` 进出视口进度、`sp` lerp .2、`offsetY=400·(sp·2-1)` 写 `--offset-y`；**量化 diff ≠0 才重建**
- [x] T3.3 奖项列表：IO threshold .5 → `is-revealed` 淡入
- [x] T3.4 笑脸 Canvas 粒子：hover 抛 10 个（移动 5），重力 .45、vy∈[-15,-5]、旋转/alpha 漂移、出界回收；双主题贴图预加载
- [x] T3.5 Playground 飞物：`--x/y/z/rx/ry/rz/s` 每帧写入；z=-20000 → vz 40~50 → z>1000 回收；自动投放 0.5–1s（移动 ×1.25）、同屏 ≤5 + 初始 2–5
- [x] T3.6 拖拽：弹簧追踪 `v+=(target-pos)·0.075` 阻尼 .9、姿态=速度映射；松手重力 .5 坠落 1s 回收
- [x] T3.7 放射线 SVG（中心笑脸 → 边缘 12 列网格点）+ 文案双层 `--amplitude` 差速
- [ ] 验收：滚动时隧道穿越平滑无抖动；奖项 hover 笑脸四散；Playground 卡片可抓取拖拽、松手坠落；双主题下贴图正确

## M4 旗舰段：Work 滚动穿越（3 天）

- [x] T4.1 区高 = 项目数 × 50lvh；容器层级（蒙版/场景/Canvas 点阵）搭建
- [x] T4.2 蒙版 SVG：evenodd 圆角孔洞（全屏外环 − 洞）、洞内缩 16px 描边层、网格线 clipPath
- [x] T4.3 幽灵字母：每源字母克隆 `宽/字宽·0.75+2` 份，`--ix/--iy/--ap/--p` 变量 + `::before` 阴影副本；CSS 消费 `rotateY(head·-10°·state) translate3d(...)`
- [x] T4.4 ScrollTrigger scrub:1 对称时间轴 7 步（蒙版 scale→maxScale / 场景 .75→1 / clipPath / pointsProgress / state / 卡片 progress±1 slow(0.15,0.6) stagger .25 / animationProgress→1e4），出段全 `immediateRender:false`
- [x] T4.5 Canvas 点阵：24px 网格、`dist·(1-r)·0.2` 从中心扩散、flowX 横向流动、量化 diff 重绘
- [x] T4.6 `x-work` 组件：progress attr 双向回调、±1 暂停/中间播放、`#` 链接拦截
- [x] T4.7 视频链式懒加载（data-src → src，canplaythrough 链）
- [x] T4.8 `contrastchange` 重读 `--color-primary` 为 strokeStyle
- [ ] 验收：慢速滚动全段录像，对照源站：穿洞放大→字母/视频卡飞过→点阵扩散→对称收回；视频无卡顿加载；离屏视频全部 paused

## M5 收尾：CTA + 主题 + 降级 + 上线（2.5 天）

- [x] T5.1 CTA 弹簧网格：12×8 质点双层弹簧（力层/位移层，阻尼 .9）
- [x] T5.2 脉冲波：按钮 scale .85→1.05 循环打点，波前 speed 15、包络 `cos(a·0.01)·(1-dist/30)`；hover 600ms 冲击（speed 30/strength 5）+ 网格外扩
- [x] T5.3 主题切换：全屏遮罩 x -100%→0（1s expo.inOut），中途换类 + `contrastchange` 广播
- [x] T5.4 控制台打字机：≥30 条文案库、20ms/字、标点 400ms、保留末 5 行
- [x] T5.5 移动端降级全表：网格 12→8、粒子减半、3D ×0.5、投放 ×1.25、触摸事件（touchstart/move/end）
- [x] T5.6 **`prefers-reduced-motion` 降级**：跳过 preloader、停 idle/粒子、scrub→淡入淡出
- [x] T5.7 dt 归一化（`v·dt/16.7`）适配高刷屏
- [x] T5.8 可访问性：菜单/链接 Tab 可达 + 自定义焦点样式、aria-label、视频无音轨
- [x] T5.9 性能：bundle gzip 63.4KB ≤70KB ✅（Lighthouse 未跑）、视频 AV1/H.264 双源 + poster、Lighthouse 桌面 ≥90
- [x] T5.10 product.md 验收清单 11 项逐条勾验 + 浏览器录像终检
- [x] T5.11 部署 Cloudflare Pages + 自定义域名 + 基础 SEO/meta/OG
- [ ] 验收：全部 11 项行为验收通过；移动端真机过一遍；reduced-motion 模式静态可读

---

## 总量估算

| 阶段 | 工期 | 累计 |
|---|---|---|
| M0 准备 | 0.5 天 | 0.5 |
| M1 骨架 | 1.5 天 | 2 |
| M2 首屏 | 2 天 | 4 |
| M3 中段 | 2.5 天 | 6.5 |
| M4 旗舰段 | 3 天 | 9.5 |
| M5 收尾 | 2.5 天 | 12 |

单人全职约 **12 个工作日**；每阶段结束做一次录像对比源站 + 性能检查。
