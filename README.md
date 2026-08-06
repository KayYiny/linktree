# 🔥 Linktree — 个人名片站

<div align="center">
  <img src="assets/images/avatar.webp" alt="Avatar" width="120" style="border: 4px solid #000; box-shadow: 8px 8px 0 #2a2a2a;">
  <br><br>

  ![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=fff)
  ![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=fff)
  ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=fff)
  ![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=fff)
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
- [数据模型](#-数据模型)
- [API 接口](#-api-接口)
- [管理面板](#-管理面板)
- [密钥与彩蛋](#-密钥与彩蛋)
- [部署方式](#-部署方式)
- [安全注意](#-安全注意)
- [许可](#-许可)

---

## 📋 项目概述

**Linktree** 是一个通用的、数据库驱动的个人名片站（Link-in-Bio）：

- **主站**：头像、名字、社交链接、二维码弹窗、虚拟宠物、相册、分享入口；页脚藏有「彩蛋」入口。
- **任意页面**（`/whisper/`、`/test/`…）：由同一个模板 `index.html` 按 URL slug 渲染，页面内容（标题/背景/链接/相册/宠物）在后台「页面」新建、全库驱动。
- **管理面板**（`/admin/`）：功能完整的网页后台，直接增删改站点内容，**无需改代码**。

所有内容由 **PostgreSQL 数据库** 驱动、前端动态渲染；**包括彩蛋、密钥在内的全部配置都能在管理面板里改**。

---

## ✨ 功能一览

- 🖥️ 多页面：主站 / 耳语页 / 任意新建页面共用同一模板，头像、名字、链接、二维码弹窗、虚拟宠物、相册、双语（i18n）
- 🥚 **彩蛋**：点页脚版权文字指定次数触发跳转（次数 / 时间窗 / 目标页，后台可配）
- 🔑 **密钥系统**：耳语页 `?k=` 访问控制，轮换密钥 + 永久密钥（周期 / 盐值后台可配）；永久密钥访问时地址栏自动转为当前有效密钥；主页带密钥访问会弹出「如何用彩蛋进入耳语页」提示
- ⏳ **加载过渡弹窗**：进入页面时显示加载动画，数据就绪后自动消失
- 🛠️ **管理面板**：链接 / 相册 / 宠物 / 翻译 / 页面 / 设置 全量管理，显式保存模型
- 💾 **导出 / 导入**：一键备份全站数据；导入走事务式整库重建（幂等）

---

## 🏗️ 架构

```
浏览器（单一模板 index.html，按 URL slug 渲染任意页面 / admin）
      │  fetch
      ▼
Vercel Serverless（api/*.js）
      │  pg
      ▼
PostgreSQL（自建）—— 8 张表
```

- 前端为纯静态 HTML/CSS/JS，无构建步骤，由 Vercel 直接托管。
- `api/*` 为 Vercel Serverless 函数，负责读写 PostgreSQL。
- 数据加载：页面加载时 `data-loader.js` 请求 `/api/config?page=<slug>` 动态渲染（URL 首段即 slug：`/` → main、`/whisper` → whisper、`/test` → test）；配置接口 `no-store`，改动即时生效。

---

## 🛠️ 技术栈

- 前端：原生 HTML / CSS / JavaScript（零框架、零构建）
- 图标：Font Awesome 6（自托管）
- 字体：Bebas Neue / DM Sans / Noto Sans SC（自托管）
- 后端：Vercel Serverless Functions（Node.js）
- 数据库：PostgreSQL（自建）
- 认证：JWT（`jsonwebtoken`）+ `bcryptjs`
- 依赖：`pg`、`jsonwebtoken`、`bcryptjs`

---

## 🗂️ 项目结构

```
├── index.html            # 唯一页面模板（按 URL slug 渲染所有页面）
├── style.css             # 通用样式
├── data-loader.js        # 数据加载与渲染（按 URL 识别页面 slug）
├── admin/
│   ├── index.html        # 管理面板登录页
│   ├── admin.html        # 管理面板
│   ├── admin.js          # 管理逻辑（显式保存模型）
│   └── admin.css         # 「橙墨系统」样式
├── api/
│   ├── auth.js           # POST /api/auth 登录
│   ├── config.js         # GET /api/config?page= 公开配置
│   ├── db.js             # PostgreSQL 连接池
│   └── admin/            # 后台 CRUD
│       ├── pages.js  links.js  gallery.js  pet.js
│       ├── translations.js  site-config.js
│       ├── change-password.js  import.js
├── assets/
│   ├── scripts/          # keygen / easter-egg / hint-popup / gallery / pet / i18n / qrcode-popup / anti-inspect
│   ├── icons/  images/  pets/  qrcodes/  fonts/  fontawesome/
└── scripts/
    └── migrate.js        # 可选：显式初始化（API 首次访问已自动建表）
```

---

## 🗄️ 数据模型（PostgreSQL）

| 表 | 用途 |
|---|---|
| `pages` | 页面（slug / 标题 / 背景 / 启用 / 排序） |
| `site_config` | 站点键值（avatar / username / favicon + egg_* / key_* + 自定义键） |
| `links` | 链接（所属页面 / 图标 / 跳转 / 二维码 / 备注 / 启停 / i18n 键） |
| `gallery_images` | 相册图片 |
| `pet_config` + `pet_messages` | 宠物（每页一只）与多语言语录 |
| `translations` | 多语言文本 |
| `admin_users` | 管理员（用户名 / 密码哈希） |

---

## � API 接口

> 管理接口均需在请求头携带 `Authorization: Bearer <token>`（token 通过 `/api/auth` 登录获取）；增删改类接口用 `?id=` 指定目标记录。

### 公开接口
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/config?page=main\|whisper` | 获取指定页面的公开配置（页面、站点配置、链接、相册、宠物、翻译），无认证 |

### 认证
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth` | 管理员登录，Body `{ username, password }`，成功返回 `{ token, username }` |

### 管理接口（需登录）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET / POST / PUT / DELETE | `/api/admin/pages` | 页面 CRUD |
| GET / POST / PUT / DELETE | `/api/admin/links` | 链接 CRUD（GET 可 `?page_id=` 过滤） |
| GET / POST / PUT / DELETE | `/api/admin/gallery` | 相册 CRUD（GET 可 `?page_id=` 过滤） |
| GET / POST / PUT / DELETE | `/api/admin/pet` | 宠物 CRUD（GET 可 `?page_id=` 过滤） |
| GET / POST / PUT / DELETE | `/api/admin/translations` | 翻译 CRUD |
| GET / PUT / DELETE | `/api/admin/site-config` | 站点配置：GET 返回全部键值；PUT 批量 upsert `{ key: value }`；DELETE `?key=` 删除单个键 |
| POST | `/api/admin/import` | 事务式整库导入（Body 为导出备份 JSON，幂等可重复执行） |
| POST | `/api/admin/change-password` | 修改密码 / 用户名，Body `{ oldPassword, newPassword?, newUsername? }` |

---

## �🛠️ 管理面板

入口：`/admin/`（默认管理员 `admin`，首次登录后请立即修改密码）。

- **显式保存模型**：所有增 / 删 / 改 / 排序先落在本地工作副本，顶部「保存全部(N)」统一提交；带「未保存」角标、撤销、离开提醒。
- **标签页**：链接 / 相册 / 宠物 / 翻译 / 页面 / 设置。
- **设置**：站点配置（头像 / 用户名 / favicon）、自定义配置键值、彩蛋设置、密钥设置、修改用户名 / 密码。
- **导出 / 导入**：备份为 JSON；导入通过事务接口整库重建（幂等，可重复导入）。
- **⌘K 命令面板**：`Ctrl/⌘ + K` 快速跳转与操作；`Ctrl/⌘ + S` 保存。
- **退出登录**：顶栏「退出」。

---

## 🔑 密钥与彩蛋

- **彩蛋**（管理面板 → 设置 → 彩蛋设置）：配置 启用 / 点击次数 / 时间窗口（毫秒）/ 跳转目标；跳转目标是耳语页时，自动带上当前有效密钥，彩蛋永远能进。
- **密钥**（管理面板 → 设置 → 密钥设置）：配置 启用 / 更换周期（每小时 / 每天 / 每周 / 每月 / 永不更换）/ 盐值 / 永久密钥；当前有效密钥实时显示，可一键复制「耳语页链接」或「主页入口链接（含密钥）」。
  - 用永久密钥访问时，地址栏**瞬间变为当前轮换密钥**，不暴露永久密钥。
  - 主页带有效密钥访问，会弹出「如何用彩蛋进入耳语页」的提示弹窗。

---

## 🚀 部署方式（GitHub + Vercel + 自建 PostgreSQL）

1. 把代码推到 GitHub。
2. 在 Vercel 导入仓库，自动识别 `api/*` 为 Serverless 函数。
3. 配置环境变量（Vercel → Project → Settings → Environment Variables）：

   ```
   DB_HOST      数据库主机
   DB_PORT      数据库端口（默认 5432）
   DB_NAME      数据库名
   DB_USER      数据库用户
   DB_PASSWORD  数据库密码
   JWT_SECRET   登录令牌密钥（生产环境务必自定义）
   ```

   （也可用 `DATABASE_URL` 完整连接串；`api/db.js` 优先读拆分变量。）

4. 推送后 Vercel 自动部署。后台入口 `https://你的域名/admin/`。

   **无需手动建表**：任意 API 首次被调用时自动建表（`api/db.js` 的惰性 `ensureSchema`）——首次打开首页或后台登录页即完成初始化：创建 8 张表、一个空白基础页 `main`，并在无管理员账号时创建默认管理员 `admin`（密码可用 `ADMIN_PASSWORD` 环境变量指定，默认 `admin`，登录后请立即修改）。

   > 可选：想在部署前本地显式初始化，仍可执行
   > `DB_HOST=... DB_NAME=... DB_USER=... DB_PASSWORD=... node scripts/migrate.js`（幂等，可重复跑）。

5. 站点内容（链接 / 相册 / 宠物 / 翻译 / 设置）登录后台添加即可，或直接用「导入」功能从备份 JSON 恢复。

> ⚠️ 注意：Vercel 免费版函数运行在美东区域，自建数据库必须公网可达，否则 API 会连不上库。

---

## 🔒 安全注意

- **立即修改默认管理员密码**（管理面板 → 设置 → 账号设置）。
- 生产环境务必设置 `JWT_SECRET`（默认值仅用于本地开发）。
- 耳语页密钥的目的是「挡住静态爬取」，不是高安全等级认证，请勿存放敏感内容。
- 数据库凭据只放 Vercel 环境变量，**绝不写入代码 / 提交**。

---

## 📄 许可

MIT
