/**
 * /api/admin/site-config — 站点配置（需登录，仅固定键）
 * GET 返回全部键值；PUT 批量 upsert { key: value }；无 DELETE（自由键值编辑器已砍掉）
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../lib/env';
import * as repo from '../../db/repo';

// 允许后台写入的固定键（自由键值编辑器已砍掉，其它键一律忽略）
const FIXED_KEYS = [
  'avatar',
  'username',
  'favicon',
  'footer',
  'powered',
  'egg_enabled',
  'egg_clicks',
  'egg_timeout',
  'egg_target',
  'key_enabled',
  'key_rotation',
  'key_salt',
  'key_permanent',
];

const routes = new Hono<AppEnv>();

routes.get('/', async (c) => c.json(await repo.getAllConfig(c.env.DB)));

routes.put('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  if (!body || typeof body !== 'object') return c.json({ error: 'Invalid request body' }, 400);

  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (!FIXED_KEYS.includes(key)) continue;
    entries[key] = value == null ? '' : String(value);
  }

  if (Object.keys(entries).length) await repo.upsertConfig(c.env.DB, entries);
  return c.json({ success: true });
});

export default routes;
