/**
 * auth.ts — JWT 校验中间件（jose HS256，Workers Web Crypto）
 */
import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import type { AppEnv } from '../lib/env';

export function getJwtSecret(env: { JWT_SECRET?: string }): string {
  // 本地开发缺省值；生产必须用 `wrangler secret put JWT_SECRET` 配置
  return env.JWT_SECRET || 'linktree-dev-secret-change-in-prod';
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(getJwtSecret(c.env)));
    c.set('user', { userId: Number(payload.userId), username: String(payload.username) });
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});
