/**
 * index.ts — Hono 入口（Cloudflare Worker）
 *
 * 路由分发：
 *   /api/*   → Hono API（JWT 认证、whisper 密钥门禁、CRUD）
 *   其余路径 → 页面 slug（/whisper 等）返回 index.html；
 *              静态文件（public/）由 [assets] 层先行命中，不会走到这里
 */
import { Hono } from 'hono';
import type { Env } from './lib/env';
import { ensureAdmin } from './db/init';
import authRoutes from './routes/auth';
import configRoutes from './routes/config';
import adminRoutes from './routes/admin';

const app = new Hono<{ Bindings: Env }>();

// 任意 API 请求前确保管理员账号存在（幂等，每实例仅执行一次）
app.use('/api/*', async (c, next) => {
  await ensureAdmin(c.env.DB, c.env);
  await next();
});

app.route('/api/auth', authRoutes);
app.route('/api/config', configRoutes);
app.route('/api/admin', adminRoutes);

// API 未匹配路径 → JSON 404
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// 上传文件公开访问：/files/<key> → R2（长缓存；SVG 加 sandbox 头防脚本执行）
app.get('/files/*', async (c) => {
  const key = c.req.path.replace(/^\/files\//, '');
  if (!key) return c.json({ error: 'Not found' }, 404);
  const obj = await c.env.FILES.get(key);
  if (!obj) return c.json({ error: 'Not found' }, 404);
  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (key.endsWith('.svg')) headers.set('Content-Security-Policy', 'sandbox');
  return new Response(obj.body, { headers });
});

// 页面 slug（/whisper、/test 等）→ index.html（与旧版 rewrite 等价）
app.all('*', async (c) => {
  const res = await c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url)));
  return new Response(res.body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

export default app;
