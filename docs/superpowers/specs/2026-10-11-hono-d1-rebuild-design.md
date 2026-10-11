# Linktree 重构设计：Hono + Cloudflare D1

日期：2026-10-11
状态：已获用户逐节确认，待用户审阅本文档

## 1. 背景与目标

现状：前端为单一模板 `index.html` + `data-loader.js` 客户端渲染，后端为 Vercel Node.js Serverless（`api/*.js`）+ Supabase PostgreSQL，带完整管理后台。

痛点：

1. 部署在 Vercel 上，国内访客不开代理难以访问（目标访客以国内为主）。
2. 技术栈希望去 Node.js 化，数据改存 SQLite。

目标：

- 后端重写为 **Hono + TypeScript**，运行于 **Cloudflare Workers**（单一 Worker，静态资源由 Workers Static Assets 托管）。
- 数据库改为 **Cloudflare D1（托管 SQLite）**，部署时用迁移建表。
- 绑定**自定义域名**，国内访客不开代理可访问（Cloudflare 免费版线路，接受"能用但不保证快"）。
- 前端保持现状风格与交互（零构建），仅做删减性改动。
- 现有功能 1:1 迁移，砍掉第 5 节列出的四项。

## 2. 非目标

- 不做 SSR / 不引入前端框架，公开页维持"静态模板 + JS 拉接口渲染"。
- 不迁移旧数据（Supabase 现有内容由用户在新后台重新录入）。
- 不做多管理员、多语言、数据导入导出 UI（见第 5 节）。
- 不追求国内访问"快"，只要求"不开代理可顺畅打开"。

## 3. 总体架构

```
浏览器（现有 index.html / admin，风格与交互不变）
   │  fetch /api/*
   ▼
Cloudflare Worker（Hono + TypeScript，单应用）
   ├── /api/*     → Hono 路由（JWT 认证、whisper 密钥门禁、CRUD）
   ├── 其余路径   → Workers Static Assets（public/ 下全部静态文件）
   └── D1（SQLite）── 6 张表
```

- 一次 `wrangler deploy` 全部上线；绑定自定义域名后国内可访问。
- 密钥门禁（whisper 页 `?k=` 校验）保留在服务端，未授权内容不下发。

### 目录结构

```
├── src/
│   ├── index.ts            # Hono 入口：挂载路由 + 静态资源兜底
│   ├── routes/
│   │   ├── auth.ts         # POST /api/auth
│   │   ├── config.ts       # GET /api/config?page=&k=
│   │   └── admin/          # pages / links / gallery / pet / site-config / change-password
│   ├── db/
│   │   ├── schema.sql      # 建表 SQL（与 migrations/ 对应）
│   │   └── repo.ts         # 数据访问层（所有 SQL 集中在此）
│   ├── middleware/auth.ts  # JWT 校验中间件
│   └── lib/keygen.ts       # 引入 public/assets/scripts/keygen.js（算法唯一实现在该 JS 文件）
├── public/                 # 静态资源，零构建
│   ├── index.html  style.css  data-loader.js
│   ├── admin/  assets/
├── migrations/             # D1 迁移 SQL（wrangler d1 migrations apply）
├── tests/                  # vitest（@cloudflare/vitest-pool-workers）
├── wrangler.toml           # Worker + D1 + 自定义域名配置
```

### 关键技术选择

| 选择 | 理由 |
|------|------|
| JWT 用 `jose`（替代 `jsonwebtoken`） | Workers 运行时只有 Web Crypto，`jsonwebtoken` 依赖 Node crypto 无法运行；`jose` 为 Workers 官方推荐 |
| 密码哈希保留 `bcryptjs` | 纯 JS 实现，Workers 兼容 |
| 请求校验用 `zod` | 所有写接口统一请求体校验 |
| 前端零构建 | `public/` 均为原文件；仅 `src/` 经 wrangler 内置 esbuild 编译 |
| keygen 单一来源 | 密钥算法同时被服务端校验与前端地址栏归一化使用。**唯一实现放在纯 JS 文件 `public/assets/scripts/keygen.js`**，服务端 `src/lib/keygen.ts` 经 esbuild `allowJs` 直接 import 它（前端零构建不受影响），避免两处逻辑漂移 |

## 4. 数据模型（D1 / SQLite，6 张表）

| 表 | 字段 | 说明 |
|----|------|------|
| `pages` | `id`, `slug`(UNIQUE), `title`, `background_image`, `is_active`, `gallery_enabled`, `sort_order`, `created_at` | 多页面，字段与现状一致 |
| `site_config` | `key`(UNIQUE), `value`, `updated_at` | 保持键值对存储（彩蛋 `egg_*`、密钥 `key_*` 为动态配置）；后台设置页只编辑固定项，砍掉自由键值编辑器 |
| `links` | `id`, `page_id`(FK), `label`, `url`, `icon`, `qr_code`, `popup_note`, `sort_order`, `is_active`, `created_at` | 去掉 `i18n_key` / `note_i18n_key`，文案直接写 |
| `gallery_images` | `id`, `page_id`(FK), `src`, `sort_order`, `is_active`, `created_at` | 与现状一致 |
| `pet_config` | `id`, `page_id`(FK, UNIQUE), `pet_image`, `pet_type`, `messages`(JSON 文本数组，如 `["你好","摸摸我"]`), `is_active`, `created_at` | 原 `pet_messages` 多语言语录简化为单语语录数组，少一张表少一次 JOIN |
| `admin` | `id`, `username`, `password_hash`, `login_failed`, `lockout_until`, `created_at` | 单管理员（单行表），保留登录失败锁定 |

方言与迁移注意：

- `SERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`；`BOOLEAN` → `0/1`；`TIMESTAMPTZ` → `TEXT`（ISO 字符串）。
- 外键 `ON DELETE CASCADE`（删页面级联删除其链接/相册/宠物）。
- 建表不再用运行时 `ensureSchema`，改为部署时 `wrangler d1 migrations apply`。
- 种子数据分两步：空白 `main` 页写入初始迁移；默认管理员账号在 **Worker 首次运行时惰性创建**（迁移 SQL 拿不到运行时的 `ADMIN_PASSWORD` 环境变量，沿用现有"首次访问自动初始化"习惯），初始密码由 `ADMIN_PASSWORD` 指定（默认 `admin`，登录后提示修改）。

### 配置键沿用

`username`、`avatar`、`favicon`、`egg_enabled` / `egg_clicks` / `egg_window` / `egg_target`、`key_enabled` / `key_rotation` / `key_salt` / `key_permanent` 等键名不变，前端读取逻辑不改。

## 5. 功能范围

保留：多页面、密钥系统（轮换/永久密钥、地址栏归一化）、彩蛋、虚拟宠物（单语语录）、相册、管理后台（⌘K 命令面板、显式保存模型、加载过渡弹窗、品牌图标选取器）、默认管理员自动初始化、登录失败锁定、修改用户名/密码。

砍掉：

1. **JSON 导出/导入**：由 `wrangler d1 export` + Time Travel（7 天回滚）替代，备份能力更强（详见第 10 节）。
2. **多管理员账号**：`admin_users` 多账号简化为单行 `admin` 表。
3. **双语 i18n**：删除 `translations` 表、`i18n_key` 字段、前端 `assets/scripts/i18n.js` 与所有翻译逻辑。
4. **自定义配置键值编辑器**：设置页只留固定项；`/api/admin/site-config` 的 DELETE 接口一并移除。

## 6. API 设计

保持现有路径与 JSON 形状，前端改动最小化：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/config?page=<slug>&k=` | 公开配置；响应形状与现状一致，仅去掉 `translations`、宠物语录改单语数组；whisper 页密钥门禁照搬（无效 `k` 返回 404 防枚举探测）；`key_permanent` 永不下发 |
| POST | `/api/auth` | 登录，返回 `{ token, username }` |
| GET/POST/PUT/DELETE | `/api/admin/pages` | 页面 CRUD |
| GET/POST/PUT/DELETE | `/api/admin/links` | 链接 CRUD（`?page_id=` 过滤） |
| GET/POST/PUT/DELETE | `/api/admin/gallery` | 相册 CRUD |
| GET/POST/PUT/DELETE | `/api/admin/pet` | 宠物 CRUD（语录随宠物一起读写） |
| GET/PUT | `/api/admin/site-config` | 设置读写（仅固定键） |
| POST | `/api/admin/change-password` | 修改用户名/密码，Body `{ oldPassword, newPassword?, newUsername? }` |

移除：`/api/admin/import`、`/api/admin/translations`、`/api/admin/admin-users`、`site-config` 的 DELETE。

## 7. 认证与安全

| 项 | 方案 |
|----|------|
| 登录令牌 | JWT（`jose`，HS256），有效期 12 小时，`Authorization: Bearer` 头，用法与现有 `admin.js` 一致 |
| 密码 | `bcryptjs` 哈希，沿用现有强度要求 |
| 登录锁定 | 连续 5 次失败锁定 15 分钟（`login_failed` / `lockout_until`） |
| CORS | 前后端同域，不再需要 `Access-Control-Allow-Origin: *` |
| 输入校验 | 所有写接口 zod 校验请求体，非法输入统一 400 |
| 密钥门禁 | whisper 页 `?k=` 校验在 `/api/config` 服务端完成；永久密钥只用于服务端校验 |

## 8. 错误处理

- 统一 JSON 错误格式 `{ "error": "..." }`；状态码：400 校验失败 / 401 未登录或过期 / 404 不存在（含密钥门禁伪装）/ 423 登录锁定 / 500 服务器错误。
- 500 不泄露内部细节；D1 错误细节仅进 Workers 日志（`wrangler tail` 查看）。
- 前端沿用现有路径：401 → 跳转登录页。

## 9. 测试

框架：vitest + `@cloudflare/vitest-pool-workers`（真实 Workers 运行时）。

1. 单元测试：keygen 密钥轮换/校验（各周期、永久密钥、时间桶边界）。
2. 接口测试：`/api/config` 公开响应形状；whisper 无密钥 → 404；登录成功/密码错误/锁定；各 CRUD 冒烟；zod 校验 → 400。
3. 手动验收清单：管理后台全流程（增删改排序 → 保存 → 前台生效）、彩蛋跳转、密钥复制链接、⌘K 面板。

## 10. 部署与运维

```bash
wrangler login
wrangler d1 create linktree               # 创建数据库，database_id 写入 wrangler.toml
wrangler d1 migrations apply linktree     # 建表 + 种子数据
wrangler secret put JWT_SECRET
wrangler deploy
```

- 自定义域名：Cloudflare Dashboard → Workers → Custom Domains 绑定（域名 DNS 托管在 Cloudflare）；上线后国内实测验收。
- 自动部署：支持 Git 集成（推送自动部署），与现有 Vercel 体验一致。
- 备份：`wrangler d1 export --output=backup.sql`，可配 GitHub Actions 每月定时备份到仓库；Time Travel 提供 7 天内任意时间点回滚。
- 旧环境清理：新站验证通过后域名从 Vercel 切至 Cloudflare；删除 `api/`（Node）、`vercel.json`、`scripts/migrate.js`、`.env`（Supabase 连接串）、`package.json` 中 Node 依赖；历史保留于 git。
- 文档：README 部署章节由 Supabase/Vercel 重写为 D1/Cloudflare。

## 11. 前端改动清单（删减性）

| 文件 | 改动 |
|------|------|
| `data-loader.js` | 移除翻译/i18n 加载逻辑；宠物语录改单语数组 |
| `admin/admin.js` | 移除翻译标签页、链接 i18n_key 字段、导出/导入按钮、自定义键值编辑器、多管理员相关；宠物编辑简化为单语语录列表 |
| `admin/admin.html` | 删除对应 UI 元素 |
| `assets/scripts/i18n.js` | 整个删除 |
| `index.html` / `style.css` | 结构不变，仅去掉 i18n 脚本引用 |
| `assets/scripts/keygen.js` | 抽为纯函数模块，服务端与前端共享同一份逻辑 |

## 12. 风险与对策

| 风险 | 对策 |
|------|------|
| Cloudflare 免费版国内访问不稳定（晚高峰抖动） | 上线后国内多时段实测；若不达标，可迁移到国内云 + SQLite（数据库为单文件 / D1 可导出 SQL，迁移成本低） |
| D1 免费额度（日 10 万读 / 5 万写） | 个人站点流量远低于额度；超限再升付费 |
| `bcryptjs` 纯 JS 在 Workers 上偏慢 | 登录是低频操作，单次约 100ms 可接受；如不可接受改用 Web Crypto PBKDF2 |
| 前端删减 i18n 时遗漏死代码 | 第 9 节测试 + 手动清单覆盖；`i18n_key` 全局 grep 清理 |
