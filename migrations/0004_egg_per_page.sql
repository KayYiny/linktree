-- 0004_egg_per_page.sql — 彩蛋跳转目标改为按页设置
-- 设置里的彩蛋配置只留总开关 + 点击次数 + 时间窗口；
-- 每个页面的「彩蛋跳转目标」存 pages.egg_target（留空 = 该页彩蛋不生效）
-- 旧的全局 egg_target 迁移到 main 页，保持既有行为

ALTER TABLE pages ADD COLUMN egg_target TEXT;

UPDATE pages SET egg_target = (SELECT value FROM site_config WHERE key = 'egg_target')
WHERE slug = 'main'
  AND (SELECT value FROM site_config WHERE key = 'egg_target') IS NOT NULL;

DELETE FROM site_config WHERE key = 'egg_target';
