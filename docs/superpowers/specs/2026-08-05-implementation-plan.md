# Linktree 数据库集成 — 实现计划

基于设计文档：`docs/superpowers/specs/2026-08-05-database-integration-design.md`

## 阶段一：基础设施搭建

### 1.1 初始化项目依赖
- 创建 `package.json`
- 安装依赖：`pg`（PostgreSQL 驱动）、`jsonwebtoken`（JWT 认证）、`bcryptjs`（密码哈希）
- 创建 `vercel.json` 配置

### 1.2 数据库连接层
- 创建 `api/db.js`：PostgreSQL 连接池
- 使用环境变量配置连接参数
- 导出查询辅助函数

### 1.3 数据库迁移脚本
- 创建 `scripts/migrate.js`：建表 + 插入初始数据
- 从当前 HTML 中提取现有数据作为初始值
- 支持重复执行（CREATE IF NOT EXISTS）

## 阶段二：后端 API 开发

### 2.1 公开读取接口
- `api/config.js`：GET /api/config?page=xxx
  - 查询 pages、site_config、links、gallery_images、pet_config、pet_messages、translations
  - 返回整合后的 JSON

### 2.2 认证接口
- `api/auth.js`：POST /api/auth
  - 验证用户名密码
  - 返回 JWT token
  - 密码用 bcrypt 哈希存储

### 2.3 管理接口（CRUD）
- `api/admin/pages.js`：页面管理
- `api/admin/links.js`：链接管理
- `api/admin/gallery.js`：相册管理
- `api/admin/pet.js`：宠物管理
- `api/admin/translations.js`：翻译管理
- `api/admin/site-config.js`：站点配置管理

每个接口实现：
- JWT 认证中间件
- GET（列表）、POST（创建）、PUT（更新）、DELETE（删除）
- 输入验证
- 错误处理

## 阶段三：前端改造

### 3.1 数据加载器
- 创建 `data-loader.js`
- 页面加载时调用 `/api/config?page=xxx`
- 动态构建 DOM：头像、用户名、链接、宠物、相册
- 加载翻译文本到 i18n 系统

### 3.2 HTML 精简
- 修改 `index.html`：移除硬编码数据，只保留容器 div
- 修改 `whisper/index.html`：同上
- 保留所有 CSS 引用和 JS 脚本引用

### 3.3 i18n.js 改造
- 翻译文本从数据库加载（通过 data-loader.js）
- 移除硬编码的 dict 对象
- 保留翻译引擎逻辑

## 阶段四：管理面板

### 4.1 登录页
- 创建 `admin/index.html`
- 密码输入框 + 登录按钮
- 调用 POST /api/auth
- JWT 存入 localStorage

### 4.2 管理面板主页
- 创建 `admin/admin.html`
- 侧边栏导航：页面、链接、相册、宠物、翻译、站点配置
- 内容区：表单 / 列表 / 编辑器

### 4.3 管理面板样式
- 创建 `admin/admin.css`
- 复用主站新粗野主义主题变量
- 粗边框、角标装饰、高对比度配色

### 4.4 管理面板逻辑
- 创建 `admin/admin.js`
- 各模块的 CRUD 操作
- 表单验证
- 列表展示和排序

## 阶段五：测试与部署

### 5.1 本地测试
- 本地运行 Vercel Dev
- 测试所有 API 接口
- 测试前端数据加载
- 测试管理面板功能

### 5.2 数据迁移
- 运行迁移脚本创建表
- 插入当前硬编码数据作为初始值
- 验证数据完整性

### 5.3 部署
- 推送到 GitHub
- Vercel 自动部署
- 配置环境变量
- 验证线上功能

## 文件清单

### 新增文件
```
package.json
vercel.json
api/db.js
api/config.js
api/auth.js
api/admin/pages.js
api/admin/links.js
api/admin/gallery.js
api/admin/pet.js
api/admin/translations.js
api/admin/site-config.js
data-loader.js
admin/index.html
admin/admin.html
admin/admin.css
admin/admin.js
scripts/migrate.js
```

### 修改文件
```
index.html          ← 精简 HTML，移除硬编码数据
whisper/index.html  ← 同上
assets/scripts/i18n.js  ← 翻译文本从数据库加载
```

### 不变文件
```
style.css                    ← 主题样式
assets/scripts/pet.js        ← 宠物交互逻辑
assets/scripts/gallery.js    ← 相册逻辑
assets/scripts/easter-egg.js ← 彩蛋逻辑
assets/scripts/anti-inspect.js ← 安全防护
assets/fonts/                ← 字体
assets/fontawesome/          ← 图标库
```

## 实现顺序

1. **阶段一**（基础设施）→ 2. **阶段二**（后端 API）→ 3. **阶段三**（前端改造）→ 4. **阶段四**（管理面板）→ 5. **阶段五**（测试部署）

每个阶段完成后可以独立测试，确保功能正常再进入下一阶段。
