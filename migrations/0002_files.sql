-- 0002_files.sql — 上传文件元数据（R2 对象注册表）
-- key 为 R2 对象 key（uploads/YYYY/MM/随机名.后缀），图片字段存 /files/<key> 路径

CREATE TABLE IF NOT EXISTS files (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
