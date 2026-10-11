# 🔥 Linktree — 个人名片站

<div align="center">

  ![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=fff)
  ![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=fff)
  ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)
  ![Hono](https://img.shields.io/badge/Hono-E36008?logo=hono&logoColor=fff)
  ![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=fff)
  ![D1](https://img.shields.io/badge/D1(SQLite)-F38020?logo=sqlite&logoColor=fff)
  [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#-许可)
</div>

> **设计理念：**
> - **前台舞台** — 新粗野主义（Neo-Brutalism）：Raw · Heavy · Confrontational，粗边框、硬阴影、撞色（青/粉/黄）。
> - **后台工具** — 「橙墨系统」：浅色、克制、表格为王、⌘K 命令面板为签名。后台 ≠ 舞台。

---

## 📑 目录

- [项目概述](#-项目概述)
- [功能一览](#-功能一览)
- [架构](#-架构)
- [技术栈](#-技术栈)
- [项目结构](#-项目结构)
- [数据模型](#-数据模型d1--sqlite)
- [API 接口](#-api-接口)
- [管理面板](#-管理面板)
- [密钥与彩蛋](#-密钥与彩蛋)
- [部署方式](#-部署方式cloudflare--d1)
- [测试](#-测试)
- [安全注意](#-安全注意)
- [许可](#-许可)

---

## 📋 项目概述

**Linktree** 是一个通用的、数据库驱动的个人名片站（Link-in-Bio）：

- **主站**：头像、名字、社交链接、二维码弹窗、虚拟宠物、相册、分享入口；页脚藏有「彩蛋」入口。
- **任意页面**（`/whisper/`、`/test/`…）：由同一个模板 `index.html` 按 URL slug 渲染，页面内容全库驱动、后台可配。
- **管理面板**（`/admin/`）：功能完整的网页后台，直接增删改站点内容，**无需改代码**。

所有内容由 **Cloudflare D1（SQLite）** 驱动、前端动态渲染；**包括彩蛋、密钥在内的全部配置都能在管理面板里改**。

---

## ✨ 功能一览

- 🖥️ 多页面：主站 / 耳语页 / 任意新建页面共用同一模板，头像、名字、链接、二维码弹窗、虚拟宠物、相册
- 🥚 **彩蛋**：点页脚版权文字指定次数触发跳转（次数 / 时间窗 / 目标页，后台可配）
- 🔑 **密钥系统**：耳语页 `?k=` 访问控制，轮换密钥 + 永久密钥（周期 / 盐值后台可配）；永久密钥访问时地址栏自动转为当前有效密钥，且永久密钥永不下发客户端
- ⏳ **加载过渡弹窗**：进入页面时显示加载动画，数据就绪后自动消失
- 🎨 **品牌图标库**：链接图标可在内嵌的 Simple Icons 图标库弹窗中按品牌名一键选取
- 🛠️ **管理面板**：链接 / 相册 / 宠物 / 页面 / 设置 全量管理，显式保存模型，⌘K 命令面板
- 💾 **备份**：`wrangler d1 export` 一键导出全库 SQL；GitHub Actions 每月自动备份；Cloudflare Time Travel 7 天内任意时间点回滚

---

## 🏗️ 架构

```
浏览器（单一模板 index.html，按 URL slug 渲染任意页面 / admin）
      │  fetch
      ▼
Cloudflare Worker（Hono + TypeScript，单应用）
      ├── /api/*     → Hono 路由（JWT 认证、密钥门禁、CRUD）
      ├── 其余路径   → 页面 slug 返回 index.html
      └── Workers Static Assets（public/ 静态资源）
      │
      ▼
Cloudflare D1（SQLite）── 6 张表
```

- 前端为纯静态 HTML/CSS/JS，**零构建**，由 Workers Static Assets 托管。
- 一次 `wrangler deploy` 全部上线；绑定自定义域名后国内可直接访问。
- whisper 密钥门禁在服务端完成，未授权内容不下发。

---

## 🛠️ 技术栈

- 前端：原生 HTML / CSS / JavaScript（零框架、零构建）
- 图标：Font Awesome 6（自托管）+ Simple Icons 品牌图标（CDN，后台弹窗选取）
- 字体：Bebas Neue / DM Sans / Noto Sans SC（自托管）
- 后端：[Hono](https://hono.dev)（TypeScript）运行于 Cloudflare Workers
- 数据库：Cloudflare D1（托管 SQLite），迁移建表（`wrangler d1 migrations`）
- 认证：JWT（`jose`，HS256）+ `bcryptjs`，登录失败锁定
- 校验：`zod`（所有写接口请求体校验）
- 测试：vitest + `@cloudflare/vitest-pool-workers`（真实 Workers 运行时）

---

## 🗂️ 项目结构

```
├── src/
│   ├── index.ts            # Hono 入口：路由挂载 + 页面 slug 兜底
│   ├── routes/
│   │   ├── auth.ts         # POST /api/auth（登录 + 锁定）
│   │   ├── config.ts       # GET /api/config?page=&k=（whisper 密钥门禁）
│   │   └── admin/          # pages / links / gallery / pet / site-config / change-password
│   ├── db/
│   │   ├── repo.ts         # 数据访问层（全部 SQL 集中于此）
│   │   └── init.ts         # 管理员惰性初始化
│   ├── middleware/auth.ts  # JWT 校验中间件
│   └── lib/keygen.ts       # 密钥算法服务端入口（唯一实现在 public/assets/scripts/keygen.js）
├── public/                 # 静态资源（零构建）
│   ├── index.html  style.css  data-loader.js
│   ├── admin/              # 管理面板（登录页 + 控制台）
│   └── assets/             # scripts / images / pets / qrcodes / fonts / fontawesome
├── migrations/             # D1 迁移 SQL（wrangler d1 migrations apply）
├── tests/                  # vitest 单测 + 接口测试
├── wrangler.toml           # Worker + D1 + 静态资源配置
└── .github/workflows/      # 每月 D1 自动备份
```

---

## 🗄️ 数据模型（D1 / SQLite）

| 表 | 用途 |
|---|---|
| `pages` | 页面（slug / 标题 / 背景 / 启用 / 相册开关 / 排序） |
| `site_config` | 站点键值（avatar / username / favicon / footer + egg_* / key_*） |
| `links` | 链接（所属页面 / 图标 / 跳转 / 二维码 / 备注 / 启停 / 排序） |
| `gallery_images` | 相册图片 |
| `pet_config` | 宠物（每页一只）+ 单语语录数组（JSON 文本） |
| `admin` | 管理员（单行：用户名 / 密码哈希 / 登录锁定） |

外键 `ON DELETE CASCADE`：删页面自动清掉其链接 / 相册 / 宠物。种子数据仅含空白 `main` 页与功能开关默认值，**新站从完全空白开始**。

---

## 🔌 API 接口

> 管理接口均需请求头携带 `Authorization: Bearer <token>`（通过 `/api/auth` 登录获取）；增删改类接口用 `?id=` 指定目标记录。

### 公开接口
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/config?page=main\|whisper` | 指定页面的公开配置（页面、站点配置、链接、相册、宠物），无认证；whisper 页密钥门禁（无效 `k` 返回 404 防枚举） |

### 认证
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth` | 管理员登录，Body `{ username, password }`，返回 `{ token, username }`；连续 5 次失败锁定 15 分钟 |

### 管理接口（需登录）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET / POST / PUT / DELETE | `/api/admin/pages` | 页面 CRUD |
| GET / POST / PUT / DELETE | `/api/admin/links` | 链接 CRUD（GET 可 `?page_id=` 过滤） |
| GET / POST / PUT / DELETE | `/api/admin/gallery` | 相册 CRUD（GET 可 `?page_id=` 过滤） |
| GET / POST / PUT / DELETE | `/api/admin/pet` | 宠物 CRUD（语录随宠物整体读写） |
| GET / PUT | `/api/admin/site-config` | 站点配置（仅固定键，PUT 批量 upsert） |
| POST | `/api/admin/change-password` | 修改密码 / 用户名 |

---

## 🛠️ 管理面板

入口：`/admin/`（默认管理员 `admin`，首次登录后请立即修改密码）。

- **显式保存模型**：所有增 / 删 / 改 / 排序先落在本地工作副本，顶部「保存全部(N)」统一提交；带「未保存」角标、撤销、离开提醒。
- **标签页**：链接 / 相册 / 宠物 / 页面 / 设置。
- **链接图标**：内嵌 Simple Icons 图标库弹窗，搜索品牌一键填入图标 URL。
- **设置**：站点配置（头像 / 用户名 / favicon / 页脚）、彩蛋设置、密钥设置、修改用户名 / 密码。
- **⌘K 命令面板**：`Ctrl/⌘ + K` 快速跳转与操作；`Ctrl/⌘ + S` 保存。

---

## 🔑 密钥与彩蛋

- **彩蛋**（设置 → 彩蛋设置）：配置 启用 / 点击次数 / 时间窗口（毫秒）/ 跳转目标；跳转目标是耳语页时自动带上当前有效密钥。
- **密钥**（设置 → 密钥设置）：配置 启用 / 更换周期（每小时 / 每天 / 每周 / 每月 / 永不更换）/ 盐值 / 永久密钥；当前有效密钥实时显示，可一键复制链接。
  - 用永久密钥访问时，地址栏**瞬间变为当前轮换密钥**；永久密钥只在服务端校验，**永不下发客户端**。
  - 主页带有效密钥访问，会弹出「如何用彩蛋进入耳语页」的提示弹窗。

---

## 🚀 部署方式（Cloudflare + D1）

1. 安装依赖并登录 Cloudflare：

   ```bash
   npm install
   npx wrangler login
   ```

2. 创建数据库并把返回的 `database_id` 填入 `wrangler.toml`：

   ```bash
   npx wrangler d1 create linktree
   ```

3. 建表（含空白种子）：

   ```bash
   npm run db:migrate:remote
   ```

4. 配置生产密钥：

   ```bash
   npx wrangler secret put JWT_SECRET
   # 可选：指定初始管理员密码（默认 admin，仅首次创建账号时生效）
   npx wrangler secret put ADMIN_PASSWORD
   ```

5. 部署：

   ```bash
   npm run deploy
   ```

6. **绑定自定义域名**（国内访问必需，`workers.dev` 域名被墙）：
   Cloudflare Dashboard → Workers → Custom Domains 绑定你的域名（域名 DNS 需托管在 Cloudflare）。

### 本地开发

```bash
cp .dev.vars.example .dev.vars   # 填入 JWT_SECRET / ADMIN_PASSWORD
npm run db:migrate:local         # 本地建表
npm run dev                      # http://localhost:8787
```

### 备份与回滚

- 手动导出：`npx wrangler d1 export linktree --remote --output=backup.sql`
- 自动备份：仓库已含 `.github/workflows/d1-backup.yml`（每月自动导出并提交到 `backups/`；需配置 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 仓库密钥）
- 回滚：Cloudflare Dashboard → D1 → Time Travel，7 天内任意时间点秒级恢复

---

## 🧪 测试

```bash
npm test           # vitest（@cloudflare/vitest-pool-workers，真实 Workers 运行时）
npm run typecheck  # TypeScript 类型检查
```

- `tests/keygen.test.ts`：密钥轮换 / 校验（各周期、永久密钥、UTC 时间桶边界）
- `tests/api.test.ts`：空状态、whisper 门禁、登录 / 锁定、CRUD 闭环、zod 校验、白名单

---

## 🔒 安全注意

- **务必自定义 `JWT_SECRET`**，并用 `wrangler secret put` 配置，不要写进代码。
- 默认管理员密码 `admin`，首次登录后请立即在「设置 → 账号设置」修改。
- whisper 页密钥是**分享给朋友的访问凭证**，不是加密；需要真正的私密内容请勿放在公开互联网。
- 登录失败 5 次锁定 15 分钟；管理接口全部 JWT 鉴权 + zod 入参校验。

---

## 📄 许可

[MIT](LICENSE) © HuoLin
