-- 0003_pages_key_required.sql — 每页独立的「访问需密钥」开关
-- 与设置里的密钥总开关（key_enabled）配合：总开关开启时，key_required=1 的页面才要求 ?k=

ALTER TABLE pages ADD COLUMN key_required INTEGER DEFAULT 0;
