/**
 * /api/admin/files — 上传文件管理（需登录）
 *
 * POST   multipart 上传（字段名 file）：类型白名单 + 大小上限 + 配额守卫
 * GET    文件列表（含使用标注）+ 总用量
 * DELETE ?key= 删除文件（R2 对象 + 元数据行）
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../lib/env';
import * as repo from '../../db/repo';
import {
  checkUpload,
  buildObjectKey,
  fileKeyFromUrl,
  QUOTA_BYTES,
  QUOTA_GUARD_BYTES,
} from '../../lib/uploads';

const routes = new Hono<AppEnv>();

routes.post('/', async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  const entry = form.get('file');
  if (!entry || typeof entry === 'string') return c.json({ error: '缺少 file 字段' }, 400);
  const file = entry as File;

  try {
    const total = await repo.sumFileBytes(c.env.DB);
    const check = checkUpload(file.type, file.size, total);
    if (!check.ok) return c.json({ error: check.error }, check.status as 400);

    const buf = await file.arrayBuffer();
    // 实际字节数复检（防御伪造的 size）
    const finalCheck = checkUpload(file.type, buf.byteLength, total);
    if (!finalCheck.ok) return c.json({ error: finalCheck.error }, finalCheck.status as 400);

    const key = buildObjectKey(finalCheck.ext);
    await c.env.FILES.put(key, buf, { httpMetadata: { contentType: file.type } });
    await repo.createFile(c.env.DB, {
      key,
      name: file.name || key.split('/').pop() || key,
      size: buf.byteLength,
      mime: file.type,
    });

    return c.json({ key, url: '/files/' + key, name: file.name, size: buf.byteLength, mime: file.type }, 201);
  } catch (err) {
    console.error('Upload error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

routes.get('/', async (c) => {
  try {
    const [files, usage, total] = await Promise.all([
      repo.listFiles(c.env.DB),
      repo.scanFileReferences(c.env.DB),
      repo.sumFileBytes(c.env.DB),
    ]);
    return c.json({
      files: files.map((f) => ({
        ...f,
        url: '/files/' + f.key,
        used_by: usage.get(f.key) || [],
      })),
      total_bytes: total,
      quota_bytes: QUOTA_BYTES,
      guard_bytes: QUOTA_GUARD_BYTES,
    });
  } catch (err) {
    console.error('Files list error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

routes.delete('/', async (c) => {
  const key = c.req.query('key') || '';
  if (!key) return c.json({ error: 'Missing key' }, 400);
  try {
    const row = await repo.getFile(c.env.DB, key);
    if (!row) return c.json({ error: 'Not found' }, 404);
    await c.env.FILES.delete(key);
    await repo.deleteFile(c.env.DB, key);
    return c.body(null, 204);
  } catch (err) {
    console.error('File delete error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default routes;
