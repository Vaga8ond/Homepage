# 占位清单（上线前必须替换）

照 wodniack.dev 逐区重建，以下位置目前是占位/源站原文。**标 ⚠️ 的含源站真实内容，商用前必须换掉。**

| # | 位置 | 现状 | 待办 |
|---|------|------|------|
| 1 | head/foot logo + favicon | M/W 线条字形自绘占位 | 换成自己的 identity（源站是 Antoine Wodniack 的 AW） |
| 2 | `sr-only` 名字 | SPIKE（index.astro 多处） | 真名/品牌名 |
| 3 | head socials ×2 | `https://codepen.io` / `https://www.linkedin.com` 裸域 | 填自己的主页 URL |
| 4 | head availability 文案 | "Coding globally from China." + `mailto:hi@example.com` | 换文案 + 真邮箱 |
| 5 | ⚠️ CTA email（index.astro:330） | `hi@example.com`（曾误留源站 hi@wodniack.dev，已改） | 真邮箱 |
| 6 | ⚠️ about 奖墙 10 项 | 源站原文（CSSDA / GSAP SOTM / Comm Arts 等 = Antoine 的奖项） | 换成自己的奖项或删 |
| 7 | ⚠️ work 卡 ×10 + `public/videos/` ×10 | hash key 占位卡（frame 暗红色块）+ **源站作品视频 452K 未引用** | 接自己的项目/视频；不用就删 videos/ |
| 8 | og:image / og:url | 未加（无素材/无域名） | 有域名+分享图后补进 Layout.astro |
| 9 | 打字机彩蛋文案 | 源站 66 条 verbatim（source.js:4349，英文冷笑话） | 用户定：占位保留，想换自写 |
| 10 | 二维码 | 按用户决策删除，不恢复 | — |

## 已确认的决策
- 字体：标题 Anton 维持（不换 Big Shoulders）
- 部署：暂不部署，本地交付
- tag：不打版本号
- 移动端适配：全部改完后再做（P8.3 排最后）
