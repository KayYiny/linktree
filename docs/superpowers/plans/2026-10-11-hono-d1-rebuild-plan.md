# Linktree 重构实现计划：Hono + Cloudflare D1

日期：2026-10-11
依据：[2026-10-11-hono-d1-rebuild-design.md](../specs/2026-10-11-hono-d1-rebuild-design.md)
状态：待用户确认后执行

## 总览

| 阶段 | 内容 | 产出 |
|------|------|------|
| 0 | 脚手架 | wrangler/tsconfig/依赖/迁移 SQL，本地可跑 |
| 1 | 数据访问层 | `repo.ts` + 管理员惰性初始化 |
| 2 | 认证与密钥 | keygen 单一来源、JWT 中间件、登录/锁定/改密 |
| 3 | 公开 API | `/api/config`（含 whisper 门禁、空状态） |
| 4 | 管理 API | 5 组 CRUD + zod 校验 |
| 5 | 前端删减改造 | 静态文件迁 `public/`，删 i18n/导入导出/多管理员 |
| 6 | 测试 | vitest 单测 + 接口测试全绿 |
| 7 | 部署与清理 | 上线、备份任务、README、旧文件清理 |

阶段按顺序执行；阶段内任务从上到下。每个任务以「验收」通过为完成标准。

---

## Phase 0 — 脚手架

### T0.1 项目骨架
- 更新 `package.json`：移除 `pg` / `jsonwebtoken` / `bcryptjs` 中前两者；新增 `hono`、`zod`、`jose`、`bcryptjs`；devDeps：`wrangler`、`typescript`、`vitest`、`@cloudflare/vitest-pool-workers`、`@cloudflare/workers-types`
- 新建 `tsconfig.json`（strict、ESNext、types 含 `@cloudflare/workers-types`、`allowJs` 开启）
- 新建 `wrangler.toml`：`main = "src/index.ts"`、`assets = { directory = "public" }`、D1 绑定 `DB`、vars（`ADMIN_PASSWORD` 默认走 secret）
- 更新 `.gitignore`：加 `.wrangler/`、`dist/`、`.dev.vars`

### T0.2 迁移 SQL
- 新建 `migrations/0001_init.sql`：6 张表（spec 第 4 节字段）、外键 `ON DELETE CASCADE`、种子**仅**空白 `main` 页 + `site_config` 功能开关默认值（彩蛋/密钥关闭）

**验收**：`wrangler d1 migrations apply linktree --local` 成功；`wrangler dev` 启动无报错。

## Phase 1 — 数据访问层

### T1.1 `src/db/repo.ts`
- 全部 SQL 集中于此，D1 prepared statements；按表分组：pages / links / gallery / pet / siteConfig / admin
- 时间统一 ISO 字符串写入 `created_at` / `updated_at`

### T1.2 管理员惰性初始化
- `ensureAdmin()`：`admin` 表为空时创建默认账号，密码取 `ADMIN_PASSWORD`（缺省 `admin`），首次任意 API 请求触发（幂等）

**验收**：本地空库请求任意 API 后，`admin` 行存在且哈希合法。

## Phase 2 — 认证与密钥

### T2.1 keygen 单一来源
- 整理 `public/assets/scripts/keygen.js` 为纯函数（导出 `isValid` / `currentKey`，无 DOM 依赖）
- `src/lib/keygen.ts` 仅 re-export 该 JS 模块（esbuild `allowJs`）

### T2.2 `src/middleware/auth.ts`
- `jose` HS256 校验 `Authorization: Bearer`，失效 → 401

### T2.3 `src/routes/auth.ts`
- `POST /api/auth`：bcrypt 比对、登录锁定（5 次失败锁 15 分钟 → 423）、成功签发 12h JWT

### T2.4 `src/routes/admin/change-password.ts`
- `POST /api/admin/change-password`：`{ oldPassword, newPassword?, newUsername? }`

**验收**：curl 登录取 token；错 5 次触发 423；改密后旧 token 行为符合 spec。

## Phase 3 — 公开 API

### T3.1 `src/routes/config.ts`
- `GET /api/config?page=&k=`：页面/链接/相册/宠物/站点配置组装；whisper 门禁（无效 `k` → 404）；`key_valid` 回传；`key_permanent` 删除；**空库返回合法空结构**

**验收**：空库 `GET /api/config?page=main` → 200 空结构；whisper 无 `k` → 404；带有效 `k` → 200。

## Phase 4 — 管理 API

### T4.1 CRUD 路由（均挂 JWT 中间件 + zod 校验）
- `src/routes/admin/pages.ts`、`links.ts`、`gallery.ts`、`pet.ts`（语录随宠物整体读写）、`site-config.ts`（GET/PUT 固定键）

**验收**：持 token curl 全部 CRUD 冒烟通过；无 token → 401；非法 body → 400。

## Phase 5 — 前端删减改造

### T5.1 静态迁移
- 现有 `index.html`、`style.css`、`data-loader.js`、`admin/`、`assets/` 移入 `public/`

### T5.2 `data-loader.js`
- 删翻译/i18n 加载逻辑；宠物语录改单语数组（`pet.messages` 由 `{lang: [...]}` 变 `[...]`）

### T5.3 `admin/admin.js` + `admin/admin.html`
- 删：翻译标签页、链接 `i18n_key` / `note_i18n_key` 字段、导出/导入按钮、自定义键值编辑器、多管理员相关 UI
- 宠物编辑简化为单语语录列表

### T5.4 i18n 清理
- 删 `assets/scripts/i18n.js`；`index.html` 去掉其引用；全局 grep `i18n_key` / `translations` 清零

**验收**：本地 `wrangler dev` 手动清单——空库空白主页正常渲染；后台录入链接/相册/宠物后前台即时生效；彩蛋跳转、密钥复制链接、⌘K 面板可用；无 i18n 残留报错。

## Phase 6 — 测试

### T6.1 测试配置
- vitest + `@cloudflare/vitest-pool-workers`，绑定指向临时 D1

### T6.2 keygen 单测
- 各轮换周期、永久密钥、时间桶边界

### T6.3 接口测试
- `/api/config` 形状与空状态、whisper 门禁、登录/错误密码/锁定、CRUD 冒烟、zod 400

**验收**：`npm test` 全绿。

## Phase 7 — 部署与清理

### T7.1 生产部署
- `wrangler d1 create linktree` → `migrations apply` → `secret put JWT_SECRET` → `wrangler deploy` → Dashboard 绑定自定义域名

### T7.2 自动备份
- GitHub Actions：每月 `wrangler d1 export` 提交 `backups/`（或上传 Artifact）

### T7.3 文档与旧物清理
- README 重写部署章节（Supabase/Vercel → D1/Cloudflare）
- 删除：`api/`、`vercel.json`、`scripts/migrate.js`、`.env`、`data-loader.js` 根目录副本（如已移入 public）、旧 Node 依赖

### T7.4 切换与验收
- 域名从 Vercel 切至 Cloudflare Worker；国内多时段实测；生产手动清单全过

**验收**：生产环境手动清单通过，`wrangler d1 export` 备份可用。

---

## 完成定义（DoD）

1. `npm test` 全绿（单测 + 接口测试）。
2. 本地与生产手动清单全过（空白渲染、后台全流程、彩蛋、密钥、⌘K）。
3. 全局 grep 无 `i18n` / `translations` / `jsonwebtoken` / `pg` 残留。
4. README 与实际部署方式一致。
5. 域名切换后国内不开代理可访问。
