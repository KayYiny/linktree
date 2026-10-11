/**
 * /api/admin/pet — 宠物管理 CRUD（需登录）
 * 单语语录：messages 为字符串数组，随宠物整体读写（无单独语录表）
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../lib/env';
import * as repo from '../../db/repo';

const petSchema = z.object({
  page_id: z.coerce.number().nullable(),
  pet_image: z.string().min(1),
  pet_type: z.string().nullable().optional(),
  messages: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

const routes = new Hono<AppEnv>();

routes.get('/', async (c) => {
  const pageId = c.req.query('page_id') ? Number(c.req.query('page_id')) : undefined;
  return c.json(await repo.listPets(c.env.DB, pageId));
});

routes.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  const parsed = petSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400);
  return c.json(await repo.createPet(c.env.DB, parsed.data), 201);
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
  const parsed = petSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400);
  const row = await repo.updatePet(c.env.DB, id, parsed.data);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

routes.delete('/', async (c) => {
  const id = Number(c.req.query('id'));
  if (!id) return c.json({ error: 'Missing id' }, 400);
  await repo.deletePet(c.env.DB, id);
  return c.body(null, 204);
});

export default routes;
