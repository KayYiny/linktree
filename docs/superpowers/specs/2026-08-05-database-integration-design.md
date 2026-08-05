# Linktree 数据库集成设计

## 概述

将 Linktree 静态页面改造为数据库驱动的动态页面。所有可自定义内容（链接、头像、宠物、相册、翻译文本等）从远程 PostgreSQL 数据库加载，CSS 主题和 JS 功能脚本保持硬编码不变。

## 架构

```
用户浏览器
    │
    ├── GET / ──────────→ Vercel 静态 HTML
    │                        │
    │                        ├── JS 启动时调用 → GET /api/config?page=main
    │                        │                    ↓
    │                        │              Vercel Serverless Functions
    │                        │                    ↓
    │                        │              PostgreSQL (用户自有服务器)
    │                        │
    │                        └── 渲染：链接、头像、宠物、相册...
    │
    ├── GET /whisper/ ──→ Vercel 静态 HTML（同上，page=whisper）
    │
    └── GET /admin ─────→ 管理面板（密码保护，新粗野主义风格）
                             │
                             └── 调用 → POST /api/auth, GET/POST/PUT/DELETE /api/...
```

**技术栈**：
- 前端：纯 HTML + CSS + JS（无框架）
- 后端：Vercel Serverless Functions（Node.js）
- 数据库：用户自有 PostgreSQL 服务器
- 认证：JWT（管理面板）

## 数据库表结构

### 1. pages — 页面定义

```sql
CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,  -- 'main', 'whisper'
  title VARCHAR(200),
  background_image TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. site_config — 全局站点配置

```sql
CREATE TABLE site_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,  -- 'avatar', 'username', 'favicon', 'logo'
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

初始数据：
- `avatar` → 当前头像 URL
- `username` → "HUOLIN"
- `favicon` → favicon URL
- `logo` → 网站 logo URL

### 3. links — 链接按钮

```sql
CREATE TABLE links (
  id SERIAL PRIMARY KEY,
  page_id INT REFERENCES pages(id),
  label VARCHAR(100) NOT NULL,
  url TEXT,
  icon TEXT,
  qr_code TEXT,
  popup_note VARCHAR(200),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. gallery_images — 相册图片

```sql
CREATE TABLE gallery_images (
  id SERIAL PRIMARY KEY,
  page_id INT REFERENCES pages(id),
  src TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. pet_config — 宠物配置

```sql
CREATE TABLE pet_config (
  id SERIAL PRIMARY KEY,
  page_id INT REFERENCES pages(id) UNIQUE,
  pet_image TEXT NOT NULL,
  pet_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. pet_messages — 宠物语录

```sql
CREATE TABLE pet_messages (
  id SERIAL PRIMARY KEY,
  pet_config_id INT REFERENCES pet_config(id),
  language VARCHAR(10) NOT NULL,
  messages JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pet_config_id, language)
);
```

### 7. translations — i18n 翻译文本

```sql
CREATE TABLE translations (
  id SERIAL PRIMARY KEY,
  key VARCHAR(200) NOT NULL,
  language VARCHAR(10) NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key, language)
);
```

### 8. admin_users — 管理员账号

```sql
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API 接口设计

### 读取接口（前端公开调用）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/config?page=main` | 获取该页面完整配置 |

返回格式：
```json
{
  "page": { "slug": "main", "title": "...", "background": "..." },
  "site": { "avatar": "...", "username": "HUOLIN", "favicon": "..." },
  "links": [ { "label": "QQ", "url": "...", "icon": "...", "qr_code": "..." } ],
  "gallery": [ { "src": "..." } ],
  "pet": { "image": "...", "messages": { "zh-CN": [...], "en": [...] } },
  "translations": { "brand.qq": { "zh-CN": "QQ", "en": "QQ" } }
}
```

### 管理接口（需 JWT 认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth` | 登录，返回 JWT |
| `GET/POST` | `/api/admin/pages` | 页面列表 / 创建 |
| `PUT/DELETE` | `/api/admin/pages/:id` | 更新 / 删除页面 |
| `GET/POST` | `/api/admin/links?page_id=1` | 链接列表 / 创建 |
| `PUT/DELETE` | `/api/admin/links/:id` | 更新 / 删除链接 |
| `GET/POST` | `/api/admin/gallery?page_id=1` | 相册列表 / 创建 |
| `PUT/DELETE` | `/api/admin/gallery/:id` | 更新 / 删除图片 |
| `GET/POST` | `/api/admin/pet?page_id=1` | 宠物配置 / 创建 |
| `PUT/DELETE` | `/api/admin/pet/:id` | 更新 / 删除宠物 |
| `GET/POST` | `/api/admin/translations` | 翻译列表 / 创建 |
| `PUT/DELETE` | `/api/admin/translations/:id` | 更新 / 删除翻译 |
| `GET/PUT` | `/api/admin/site-config` | 站点配置读写 |

## 前端改造

### 核心变化

1. **HTML 精简**：只保留 `<div id="...">` 容器，移除所有硬编码数据
2. **新增 `data-loader.js`**：页面加载时调用 API，动态构建 DOM
3. **i18n.js 改造**：翻译文本从数据库加载，不再硬编码
4. **CSS 不变**：所有样式保持原样
5. **JS 功能脚本不变**：pet.js、gallery.js 等只改数据来源

### 数据加载流程

```
页面加载
  → data-loader.js 调用 /api/config?page=xxx
  → 获取 JSON 响应
  → 动态渲染：头像、用户名、链接、宠物、相册
  → 加载翻译文本到 i18n 系统
  → 其他 JS 脚本正常初始化
```

## 管理面板

### 访问方式

- 路径：`/admin`
- 认证：密码登录 → JWT token

### 页面结构

```
/admin/
├── index.html          ← 登录页
├── admin.html          ← 管理面板主页
├── admin.css           ← 样式（复用主站新粗野主义主题）
└── admin.js            ← 逻辑
```

### 布局

```
┌─────────────────────────────────────────────┐
│  🔧 Linktree 管理面板           [退出登录]  │
├──────────┬──────────────────────────────────┤
│ 📄 页面   │                                  │
│ 🔗 链接   │  当前编辑内容区域                  │
│ 🖼️ 相册   │  （表单 / 列表 / 编辑器）          │
│ 🐾 宠物   │                                  │
│ 🌐 翻译   │                                  │
│ ⚙️ 站点   │                                  │
└──────────┴──────────────────────────────────┘
```

### 功能模块

1. **页面管理**：查看/编辑页面配置（背景图、标题等）
2. **链接管理**：添加/编辑/删除链接，设置图标、二维码、跳转 URL、排序
3. **相册管理**：添加/删除图片，调整顺序
4. **宠物管理**：设置宠物图片，编辑各语言语录
5. **翻译管理**：编辑 i18n 键值对
6. **站点配置**：修改头像、用户名、logo 等全局设置

### 视觉风格

- 复用主站 `style.css` 中的新粗野主义主题变量
- 粗边框、角标装饰、高对比度配色
- 字体与主站一致

## 项目结构

```
linktree/
├── index.html              ← 主页（精简 HTML）
├── style.css               ← 主题样式（不变）
├── whisper/
│   └── index.html          ← 隐藏页
├── admin/
│   ├── index.html          ← 登录页
│   ├── admin.html          ← 管理面板
│   ├── admin.css           ← 管理面板样式
│   └── admin.js            ← 管理面板逻辑
├── api/                    ← Vercel Serverless Functions
│   ├── config.js           ← 页面配置读取
│   ├── auth.js             ← 登录认证
│   ├── db.js               ← 数据库连接池
│   └── admin/
│       ├── pages.js
│       ├── links.js
│       ├── gallery.js
│       ├── pet.js
│       ├── translations.js
│       └── site-config.js
├── assets/                 ← 静态资源（不变）
├── data-loader.js          ← 前端数据加载与渲染
├── package.json            ← 依赖（pg）
└── vercel.json             ← Vercel 部署配置
```

## 环境变量

在 Vercel 控制台设置（不进代码）：

```
DB_HOST=服务器IP
DB_PORT=5432
DB_NAME=linktree
DB_USER=用户名
DB_PASSWORD=密码
ADMIN_PASSWORD=管理面板密码
JWT_SECRET=随机密钥
```

## 设计决策

### 图片存储策略
头像、宠物图片、二维码等图片以 **URL 形式**存储在数据库中。图片文件本身仍存放在 `assets/` 目录或外部图床（如 lsky.puppyis.cool）。管理面板提供 URL 输入框，用户粘贴图片链接即可。

### 保持硬编码的内容
以下内容不迁移到数据库，保持硬编码：
- **CSS 主题**：新粗野主义样式、配色、字体
- **JS 功能脚本**：pet.js、gallery.js、easter-egg.js 等交互逻辑
- **whisper 页面密钥校验**：安全相关逻辑，不应暴露到数据库
- **Anti-Inspect 防护脚本**：安全功能

### 迁移到数据库的内容
- 头像、用户名、favicon、logo、背景图
- 链接按钮（label、url、icon、qr_code、排序）
- 相册图片列表
- 宠物图片、宠物语录（多语言）
- i18n 翻译文本（品牌名、UI 标签等）
- 彩蛋配置（点击次数、触发动作等）

## 部署流程

1. 代码推送到 GitHub
2. Vercel 自动部署
3. 配置环境变量
4. 运行数据库迁移脚本（建表 + 插入初始数据）
5. 访问 `/admin` 登录，开始管理内容

## 扩展性

**添加新功能**（如"公告"模块）：
1. 数据库加表
2. Vercel 加 API 文件
3. 管理面板加管理页
4. 前端加展示组件

**修改现有功能**（如给链接加"描述"字段）：
1. 数据库加列
2. API 自动返回新字段
3. 前端渲染时显示

内容和代码分离：代码只负责"怎么展示"，数据决定"展示什么"。修改内容不需要重新部署。
