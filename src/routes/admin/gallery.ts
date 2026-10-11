/**
 * /api/admin/gallery — 相册管理 CRUD（需登录）
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../lib/env';
import * as repo from '../../db/repo';

const gallerySchema = z.object({
  page_id: z.coerce.number().nullable(),
  src: z.string().min(1),
  sort_order: z.coerce.number().optional(),
  is_active: z.boolean().optional(),
});

const routes = new Hono<AppEnv>();

routes.get('/', async (c) => {
  const pageId = c.req.query('page_id') ? Number(c.req.query('page_id')) : undefined;
  return c.json(await repo.listGallery(c.env.DB, pageId));
});

routes.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  const parsed = gallerySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400);
  return c.json(await repo.createGallery(c.env.DB, parsed.data), 201);
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
  const parsed = gallerySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400);
  const row = await repo.updateGallery(c.env.DB, id, parsed.data);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

routes.delete('/', async (c) => {
  const id = Number(c.req.query('id'));
  if (!id) return c.json({ error: 'Missing id' }, 400);
  await repo.deleteGallery(c.env.DB, id);
  return c.body(null, 204);
});

export default routes;
