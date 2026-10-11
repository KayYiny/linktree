-- 0001_init.sql — 初始表结构 + 完全空白种子
-- 种子仅含运行必需品：空白 main 页（不设首页会 404）+ 功能开关默认值（彩蛋/密钥关闭）
-- 默认管理员账号由 Worker 首次运行时惰性创建（迁移 SQL 拿不到 ADMIN_PASSWORD 运行时变量）

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT,
  background_image TEXT,
  is_active INTEGER DEFAULT 1,
  gallery_enabled INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT,
  icon TEXT,
  qr_code TEXT,
  popup_note TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS gallery_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
  src TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- messages 为 JSON 文本数组（单语语录），如 ["你好","摸摸我"]
CREATE TABLE IF NOT EXISTS pet_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER UNIQUE REFERENCES pages(id) ON DELETE CASCADE,
  pet_image TEXT NOT NULL,
  pet_type TEXT,
  messages TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 单管理员（单行表，CHECK 保证只有一行）
CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  login_failed INTEGER DEFAULT 0,
  lockout_until TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 种子：空白 main 页 + 功能开关默认值（其余内容由后台录入）
INSERT INTO pages (slug, title, sort_order) VALUES ('main', 'My Links', 1);

INSERT INTO site_config (key, value) VALUES
  ('egg_enabled', '0'),
  ('key_enabled', '0');
