# 管理后台重做设计（显式保存模型）

> 日期：2026-08-06
> 状态：已确认（用户拍板：显式保存 + 补齐核心缺口 + 保留深色 Neo-Brutalism）

## 背景与问题

现有管理后台（`admin/admin.html` + `admin/admin.js`）使用逻辑存在系统性缺陷：

1. **保存机制自相矛盾**：新增/删除即时写库，但字段编辑与排序要等顶部「保存」按钮。删除/移动触发的重新加载会**冲掉所有未保存的内联编辑**。
2. **导出 ≠ 导入**：导出打包全部数据，导入却只还原站点配置和翻译；翻译重复导入撞 `UNIQUE(key, language)` 报错。
3. **「全部页面」过滤下排序错乱**：跨页混排保存时 `sort_order` 全局重排。
4. **新增宠物永远塞给第一个页面**，而 `pet_config.page_id` 有唯一约束，同页第二只直接 500 且无提示。
5. **有 `is_active` 但界面无法停用**，只能删除；`/api/admin/pages` 有完整 CRUD 却没有页面管理 UI。
6. **schema 与代码不一致**：仓库 `scripts/migrate.js` 建的 `links` 表缺 `i18n_key`/`note_i18n_key` 列（线上库已有这两列，但新库重跑 migrate 会缺失，需补）。
7. **改动无标记、无未保存提示、无撤销**，刷新即丢。

## 核心设计：统一「显式保存」模型

- 所有增/删/改/排序**先落在本地工作副本**，不触发任何写库。
- 顶部统一按钮 **「保存全部(N)」** 批量提交（N = 待保存条目数，实时刷新；无改动时禁用）。
- 每个被修改的条目显示 **「● 未保存」角标**。
- **「撤销全部」** 从服务端重新拉取，放弃所有本地修改。
- **`beforeunload` 提醒**：存在未保存改动时，离开页面弹确认。
- 保存按条目汇总失败原因并 toast，不静默吞错。

### 数据加载与渲染

- 进入面板时一次性拉全量数据（不做服务端过滤）：`/api/admin/pages`、`/api/admin/links`、`/api/admin/gallery`、`/api/admin/pet`、`/api/admin/translations`、`/api/admin/site-config`。
- 各标签页的「页面过滤」下拉**仅控制显示**，工作副本始终持有全量数据，保证整页保存安全。
- 结构变化（增/删/排序）重建该标签列表；字段输入事件直接改状态，不重建 DOM（避免焦点丢失）。

### 保存语义（每个标签）

- **链接/相册/宠物/页面**：存在 `_new` → POST；存在 `_deleted` → DELETE；其余 → PUT（写入全部可编辑字段）。
- **排序号**：保存时**按 `page_id` 分组重算 `sort_order`**（0..n-1），彻底消除跨页排序错乱。
- **宠物**：贴合 `pet_config.page_id UNIQUE`，模型为「每页一只宠物」；按页展示，缺省可添加。
- **翻译**：按 key 分组（zh/en 两行）；key 重命名对两种语言联动；删除整组；新增创建 zh+en 两行。
- **站点配置**：整组 key/value 全量 PUT（接口天然 upsert）。

## 功能结构（标签页）

| 标签页 | 内容 |
|---|---|
| 链接管理 | 卡片内联编辑（label/i18n_key/icon/url/qr_code/popup_note/note_i18n_key）+ 启用/停用开关 + 上移下移/删除/新增 + 未保存角标 |
| 相册管理 | 网格 + 图片 URL 内联编辑 + 上移下移/删除/新增 + 未保存角标 |
| 宠物管理 | 每页一只宠物卡片（pet_type/pet_image/中英语录）+ 新增/删除 + 未保存角标 |
| 翻译管理 | 表格（key/中文/English）+ 搜索 + 增删改 + key 重命名联动 + 未保存角标 |
| 页面管理（新） | 页面卡片（slug/title/background_image/is_active/排序）+ 新增/重命名/停用/删除（删除时先删其下 links/gallery/pet，再删页面，强提示） |
| 设置 | 站点配置（avatar/username/favicon）+ 自定义站点键值（任意 key/value，便于扩展 copyright/showAlbum 等）+ 修改用户名 + 修改密码 |

## 后端变更

### `scripts/migrate.js`
- `links` 建表补上 `i18n_key VARCHAR(200)`、`note_i18n_key VARCHAR(200)`。
- 末尾追加**幂等补列**（兼容已存在的库）：
  ```sql
  ALTER TABLE links ADD COLUMN IF NOT EXISTS i18n_key VARCHAR(200);
  ALTER TABLE links ADD COLUMN IF NOT EXISTS note_i18n_key VARCHAR(200);
  ```

### 新增 `api/admin/import.js`
- `POST /api/admin/import`，需要 JWT。
- Body：导出备份 JSON `{ pages, links, gallery, pet, translations, siteConfig }`。
- 在**单个事务**内按外键顺序重建：删 `pet_messages` → `pet_config` → `gallery_images` → `links` → `pages` → `translations` → `site_config` → 依序插入导入数据；`pet` 数组中的 `messages` 展开写回 `pet_messages`。
- 幂等：重复导入不会撞唯一约束。
- 失败整体回滚。

### `api/admin/change-password.js`
- 扩展支持修改用户名：请求体 `{ oldPassword, newPassword?, newUsername? }`。
- 校验旧密码后：更新 `admin_users.password_hash`（如给新密码）与 `username`（如给新用户名，校验唯一性）。
- 响应 `{ success: true, username? }`。

### `api/config.js` / `api/db.js` / 其余 CRUD
- 不动（CRUD 已满足；生产库 schema 已含缺列）。

## 前端变更

- `admin/admin.html`：重写结构（6 个标签页 + 顶部保存/撤销/导出/导入/返回）。
- `admin/admin.js`：重写为「工作副本 + 脏标记 + 批量保存」架构。
- `admin/admin.css`：沿用现有深色 Neo-Brutalism 设计令牌，新增脏标记角标、开关（toggle）、页面卡片等组件样式。
- `admin/index.html`（登录页）：微调文案与跳转，逻辑基本保留。

## 导出/导入

- **导出**：客户端把全量数据打包 JSON 下载（保留现有实现，补上 siteConfig 已有）。
- **导入**：选择 JSON 文件 → 强确认 → `POST /api/admin/import` 事务式整库重建 → 成功后重新拉取全量。
- 导出/导入字段对称，修复原「导不出链接/相册/宠物/页面」问题。

## 文件清单

| 文件 | 动作 |
|---|---|
| `docs/superpowers/specs/2026-08-06-admin-panel-redesign-design.md` | 新增（本文档） |
| `scripts/migrate.js` | 修改：补列 + 幂等 ALTER |
| `api/admin/import.js` | 新增：事务整库导入 |
| `api/admin/change-password.js` | 修改：支持改用户名 |
| `admin/admin.html` | 重写 |
| `admin/admin.js` | 重写 |
| `admin/admin.css` | 修改：新增组件样式 |
| `admin/index.html` | 修改：微调 |

## 成功标准

1. 任一标签内「增/删/改/排序」后，其他未保存修改**不再被冲掉**。
2. 保存按钮实时显示待保存数量；未保存时离开有提醒；撤销可一键还原。
3. 保存后各页面内顺序正确（不跨页错乱）。
4. 每页只能有一只宠物，不会因唯一约束 500。
5. 导出文件可完整导回（含页面/链接/相册/宠物/翻译/站点配置），重复导入不报错。
6. 可停用/启用链接与页面；可管理页面；可改用户名。
