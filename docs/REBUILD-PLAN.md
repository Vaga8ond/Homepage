# SPIKE 首页重构执行方案书

> 2026-08-29 · 清场后全新重建 · 每阶段验收通过后 git

## 一、背景

上一轮实现累积了过多遗留问题（preloader 三次推倒、刷新闪烁、钩子不一致、彩蛋不全、未帧验项积压）。已执行全删：`src/` 全部移除，从零重建。

## 二、现状

**已删**：`src/`（pages / layouts / scripts / styles / env.d.ts，共 16 文件）
**保留**：
- `docs/reverse/` — 源站完整逆向资料（00-head…08-frame.html + source.js / source.css，已剥 scoped hash）★ 重建唯一事实来源
- `public/` — 字体（Anton 400 / Instrument 400 / JB Mono var）、favicon、videos
- 工具链 — astro.config（devToolbar 已禁用）、package.json、tsconfig、pnpm
- git 历史（a9ae559 及之前全部可回溯）
- 帧验工具 — playwright-core + chromium（/tmp/pwtest），源站本地服务 :4321

## 三、已验证硬结论（重建时不许再走回头路）

| # | 结论 | 来源 |
|---|---|---|
| 1 | 波浪底边锚定公式 `offY = h - 32*(rows-1) - 4`，与 separator 严密贴合 | 三轮截图对照定案（commit 8839962） |
| 2 | 标题字号上限：Anton 400 `12.6vw`（15vw 溢出，Anton 自然字宽 7.35em）；备选 Big Shoulders 800 可用 ~13.3vw，**待拍板** | 盒测量 + 截图 |
| 3 | 墨框体系：body padding 1rem（移动 .5rem）+ site-mount absolute border 1rem + wrapper `clip-path: inset(0 -1rem)` 防漏缝 + scrollbar 轨道 1rem | source.css 3130-3360 |
| 4 | preloader 条码几何：5v+3h 字形全部百分比/origin 见 `docs/reverse/07-intro.html` + source.css:3200-3340 | 源站源码 |
| 5 | 时序契约：intro 时间轴 t0 `set(wrapper,{opacity:''})`（页面显现）→ t≈3.15s 派发 `intro` 事件（head/hero 入场都挂它）→ t5 mount opacity=1 + intro.remove + 解锁滚动 | source.js:4264-4332 |
| 6 | 刷新闪烁根治：html SSR 带 `is-scroll-blocked`（height 100lvh + overflow hidden）→ 浏览器恢复钳到 0，首帧即顶部；解锁时机归 preloader | 插桩实测（恢复发生在首帧前，pin 必输） |
| 7 | 帧验锚点必须取"时间轴 t0"（wrapper opacity 复位），不能取导航时刻（两侧加载速度不同会错位对比） | P2 教训 |
| 8 | 批量改名用 perl；词边界 `\bx\b` 漏 `x__*` 前缀，需补 `s/\.x__/a__/g` 式规则 | P1 教训 |

## 四、阶段计划

> 顺序调整说明：**preloader 放最后**（P7）。它是争议最大、返工最多的部件；先把它的事件契约（#5）以 1 行桩 `siteLoaded → dispatch('intro')` 打通，页面各段先全部建好、验收好，最后装 preloader 只动一处。

### P0 清场（已完成，待验收）
- [x] src/ 全删，资产/工具/逆向资料保留
- [ ] **验收点**：你确认清场范围 → git 提交清场

### P1 地基
- Layout（html `is-scroll-blocked` SSR、字体预载、meta）+ global.css 令牌（色板 `--color-primary/secondary`、字体、#3 墨框全套）+ site-wrapper / site-mount / site-scrollbar / site-contrast-mask + core.ts（App、ticker、$、REDUCED、resize/scroll 总线）+ main.ts（#5 桩 + #6 解锁时机）
- **验收**：空骨架页渲染；墨框四面完整；滚动条自绘；刷新逐帧采样无闪烁；0 错误

### P2 site-head
- logo（**待你提供真实 logo 素材**，暂 SP 占位）、console 打字机（66 条彩蛋**全量**，上轮只有 25）、菜单 hover 箭头、socials clip-path 图标、contrast 按钮；入场 = translateY(-100%)→0 挂 `intro` 事件
- **验收**：与 :4321 源站并排帧对照（静止态 + 入场帧）

### P3 hero
- a-waves（canvas 线浪，#1 锚定公式）、a-separator（binary ticker，scroll 驱动滚动）、s__title 字符入场（#2 字号，**字体先拍板**）、s__content 揭示
- **验收**：五帧对照（时间轴 t0 +500/1200/2500/3500/4200ms）+ 终态断言 + resize 后揭示态不丢

### P4 about
- 网格 path 描边、canvas smileys/awards、文字揭示
- **验收**：滚动进入触发帧对照源站同段落

### P5 work
- 10 卡片网格、js-letter 悬停逐字、卡片 canvas 素材、滚动视差
- **验收**：hover 逐帧 + 滚动对照

### P6 my-way + cta + site-foot
- my-way 三对象（现占位，**内容待你定**）、cta 大标题 + 涟漪按钮（参数帧验，上轮欠账）、foot logo
- **验收**：与源站对应段帧对照

### P7 preloader（最后装）
- site-intro 条码（#4 几何照抄 source.css）+ #5 完整时间轴 + 解锁接管（#6）
- **方向待你拍板**：a) 复刻源站条码 b) 换自有标识（SPIKE 字形/任意图形）c) 完全原创（给感觉或参考）；时长 5s / 2.5s
- **验收**：五帧对照 + 终态断言 + 刷新无闪烁 + REDUCED 路径

### P8 收尾
- contrast-mask 切换、移动端 .5rem 断点全查、全页滚动录像与源站逐段对照（上轮从未做过折叠线以下）、rAF 单循环性能核对、遗留清单清零
- **验收**：全页录像对照 + 跑分 + 0 错误

## 五、遗留问题 → 阶段映射（清零表）

| 遗留问题 | 归属 |
|---|---|
| 刷新闪烁 | P1 内建（#6） |
| console 彩蛋 25/66 | P2 全量 |
| 占位 logo "SP" | P2（等素材） |
| 标题字体未拍板 | P3 前 |
| CTA 涟漪参数未帧验 | P6 |
| preloader 效果不满意 | P7（方向待定） |
| 折叠线以下从未对照 | P8 |
| my-way 占位内容 | P6（等你定） |

## 六、工作约定

1. 分段执行、分段验收：每阶段先给验收标准，做完给你截图/本地地址自查
2. **git 只在你验收通过后提交**，一阶段一提交
3. 源站对照一律以 `docs/reverse/` + :4321 为准，不再凭记忆
4. 需要你拍板的四项（可随阶段推进陆续给）：preloader 方向 / 标题字体 / logo 素材 / my-way 内容
