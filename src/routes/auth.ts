/**
 * POST /api/auth — 管理员登录，返回 JWT token
 * Body: { username, password }
 *
 * 登录失败锁定：连续失败 MAX_FAILS 次锁定 LOCK_MS 毫秒（单管理员单行表）
 */
import { Hono } from 'hono';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { AppEnv } from '../lib/env';
import { getJwtSecret } from '../middleware/auth';
import * as repo from '../db/repo';

// 登录失败锁定参数
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const routes = new Hono<AppEnv>();

routes.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Username and password required' }, 400);
  const { username, password } = parsed.data;

  try {
    const admin = await repo.getAdmin(c.env.DB);
    if (!admin || admin.username !== username) {
      // 用户名不匹配：与密码错误同响应，避免枚举
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // 锁定中
    if (admin.lockout_until && new Date(admin.lockout_until) > new Date()) {
      return c.json({ error: '尝试次数过多，请 15 分钟后再试' }, 423);
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (valid) {
      await repo.resetLoginFailures(c.env.DB);
      const token = await new SignJWT({ userId: admin.id, username: admin.username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('12h')
        .sign(new TextEncoder().encode(getJwtSecret(c.env)));
      return c.json({ token, username: admin.username });
    }

    // 密码错误：计数，达到上限锁定
    const newFail = (admin.login_failed || 0) + 1;
    const lockUntil = newFail >= MAX_FAILS ? new Date(Date.now() + LOCK_MS).toISOString() : null;
    await repo.recordLoginFailure(c.env.DB, newFail, lockUntil);
    return c.json({ error: 'Invalid credentials' }, 401);
  } catch (err) {
    console.error('Auth error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default routes;
