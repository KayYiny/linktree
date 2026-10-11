/**
 * POST /api/admin/change-password — 修改管理员密码 / 用户名
 * Body: { oldPassword, newPassword?, newUsername? }（newPassword 与 newUsername 至少给一个）
 */
import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { AppEnv } from '../../lib/env';
import * as repo from '../../db/repo';

const schema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(4).optional(),
  newUsername: z.string().min(1).optional(),
});

const routes = new Hono<AppEnv>();

routes.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: '请提供当前密码' }, 400);
  const { oldPassword, newPassword, newUsername } = parsed.data;

  if (!newPassword && !newUsername) {
    return c.json({ error: '请填写新密码或新用户名' }, 400);
  }

  try {
    const admin = await repo.getAdmin(c.env.DB);
    if (!admin) return c.json({ error: '用户不存在' }, 404);

    const valid = await bcrypt.compare(oldPassword, admin.password_hash);
    if (!valid) return c.json({ error: '当前密码错误' }, 401);

    if (newPassword) {
      const newHash = await bcrypt.hash(newPassword, 10);
      await repo.updateAdminPassword(c.env.DB, newHash);
    }

    let resultUsername = admin.username;
    if (newUsername && newUsername !== admin.username) {
      await repo.updateAdminUsername(c.env.DB, newUsername);
      resultUsername = newUsername;
    }

    return c.json({ success: true, username: resultUsername });
  } catch (err) {
    // 用户名唯一约束冲突等
    console.error('Change password error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default routes;
