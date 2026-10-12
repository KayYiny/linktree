/**
 * /api/admin/pages — 页面管理 CRUD（需登录）
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../lib/env';
import * as repo from '../../db/repo';

const pageSchema = z.object({
  slug: z.string().min(1),
  title: z.string().nullable().optional(),
  background_image: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  gallery_enabled: z.boolean().optional(),
  key_required: z.boolean().optional(),
  sort_order: z.coerce.number().optional(),
});

const routes = new Hono<AppEnv>();

routes.get('/', async (c) => c.json(await repo.listPages(c.env.DB)));

routes.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  const parsed = pageSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400);
  try {
    return c.json(await repo.createPage(c.env.DB, parsed.data), 201);
  } catch (err) {
    console.error('Pages API error:', err);
    return c.json({ error: 'slug 已存在' }, 409);
  }
});

routes.put('/', async (c) => {
  const id = Number(c.req.query('id'));
  if (!id) return c.json({ error: 'Missing id' }, 400);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  const parsed = pageSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400);
  try {
    const row = await repo.updatePage(c.env.DB, id, parsed.data);
    if (!row) return c.json({ error: 'Not found' }, 404);
    return c.json(row);
  } catch (err) {
    console.error('Pages API error:', err);
    return c.json({ error: 'slug 已存在' }, 409);
  }
});

routes.delete('/', async (c) => {
  const id = Number(c.req.query('id'));
  if (!id) return c.json({ error: 'Missing id' }, 400);
  await repo.deletePage(c.env.DB, id);
  return c.body(null, 204);
});

export default routes;
