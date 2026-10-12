/**
 * api.test.ts — 接口测试（vitest-pool-workers，真实 Workers 运行时）
 *
 * 覆盖 spec 第 9 节：/api/config 形状与空状态、whisper 门禁、登录/错误密码/锁定、
 * CRUD 冒烟、zod 校验 400、site-config 白名单、永久密钥不下发。
 */
/// <reference types="@cloudflare/vitest-pool-workers" />
import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, test } from 'vitest';
import keygen from '../src/lib/keygen';
import { MAX_IMAGE_BYTES } from '../src/lib/uploads';
import migration0001 from '../migrations/0001_init.sql?raw';
import migration0002 from '../migrations/0002_files.sql?raw';
import migration0003 from '../migrations/0003_pages_key_required.sql?raw';
const ADMIN_PW = (env as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD || 'admin';

const jsonHeaders = { 'Content-Type': 'application/json' };

async function api(path: string, init?: RequestInit) {
  return SELF.fetch('http://localhost' + path, init);
}

async function login(username = 'admin', password = ADMIN_PW) {
  const res = await api('/api/auth', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  return res;
}

async function authedToken(): Promise<string> {
  const res = await login();
  expect(res.status).toBe(200);
  const body = (await res.json()) as { token: string };
  return body.token;
}

beforeAll(async () => {
  // 应用全部迁移（去掉注释行后按 ; 切分执行）
  for (const sql of [migration0001, migration0002, migration0003]) {
    const stmts = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of stmts) await env.DB.prepare(stmt).run();
  }
  // 预热：触发 ensureAdmin 惰性创建管理员（此后登录用例直接可用）
  await SELF.fetch('http://localhost/api/config?page=main');
});

describe('GET /api/config', () => {
  test('空库空状态：合法空结构', async () => {
    const res = await api('/api/config?page=main');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.page).toMatchObject({ slug: 'main' });
    expect(body.links).toEqual([]);
    expect(body.gallery).toEqual([]);
    expect(body.pet).toBeNull();
    // 永久密钥永不下发
    expect((body.site as Record<string, unknown>).key_permanent).toBeUndefined();
  });

  test('未知页面返回 404', async () => {
    const res = await api('/api/config?page=nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('密钥门禁（页面开关 + 设置总开关）', () => {
  const SALT = 'gate-test-salt';

  beforeAll(async () => {
    const token = await authedToken();
    // 建需密钥的 whisper 页 + 开启总开关（盐值固定便于计算预期密钥）
    const res = await api('/api/admin/pages', {
      method: 'POST',
      headers: { ...jsonHeaders, Authorization: 'Bearer ' + token },
      body: JSON.stringify({ slug: 'whisper', title: '耳语页', key_required: true }),
    });
    expect(res.status).toBe(201);
    await api('/api/admin/site-config', {
      method: 'PUT',
      headers: { ...jsonHeaders, Authorization: 'Bearer ' + token },
      body: JSON.stringify({ key_enabled: '1', key_salt: SALT, key_permanent: 'perm-key-test' }),
    });
  });

  test('需密钥页面：无密钥 / 错误密钥 → 404（伪装成页面不存在）', async () => {
    expect((await api('/api/config?page=whisper')).status).toBe(404);
    expect((await api('/api/config?page=whisper&k=xxxxxx')).status).toBe(404);
  });

  test('有效轮换密钥 → 200，key_valid 为 true', async () => {
    const k = keygen.currentKey('daily', SALT);
    const res = await api('/api/config?page=whisper&k=' + k);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { site: Record<string, unknown> };
    expect(body.site.key_valid).toBe(true);
  });

  test('永久密钥 → 200，且永久密钥不下发', async () => {
    const res = await api('/api/config?page=whisper&k=perm-key-test');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { site: Record<string, unknown> };
    expect(body.site.key_valid).toBe(true);
    expect(body.site.key_permanent).toBeUndefined();
  });

  test('未开「访问需密钥」的页面不受总开关影响', async () => {
    const token = await authedToken();
    const headers = { ...jsonHeaders, Authorization: 'Bearer ' + token };
    const res = await api('/api/admin/pages', {
      method: 'POST',
      headers,
      body: JSON.stringify({ slug: 'open-page', title: '公开页', key_required: false }),
    });
    expect(res.status).toBe(201);
    expect((await api('/api/config?page=open-page')).status).toBe(200);
    await api('/api/admin/pages?id=' + ((await res.json()) as { id: number }).id, { method: 'DELETE', headers });
  });

  test('彩蛋目标为需密钥页面时，egg_target 自动带当前密钥', async () => {
    const token = await authedToken();
    const headers = { ...jsonHeaders, Authorization: 'Bearer ' + token };
    await api('/api/admin/site-config', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ egg_target: '/whisper' }),
    });
    const body = (await (await api('/api/config?page=main')).json()) as { site: Record<string, string> };
    const expected = '/whisper?k=' + keygen.currentKey('daily', SALT);
    expect(body.site.egg_target).toBe(expected);
  });

  test('关闭总开关后无需密钥即可访问', async () => {
    const token = await authedToken();
    await api('/api/admin/site-config', {
      method: 'PUT',
      headers: { ...jsonHeaders, Authorization: 'Bearer ' + token },
      body: JSON.stringify({ key_enabled: '0' }),
    });
    expect((await api('/api/config?page=whisper')).status).toBe(200);
  });
});

describe('登录与锁定', () => {
  test('错误密码 → 401', async () => {
    const res = await login('admin', 'definitely-wrong');
    expect(res.status).toBe(401);
  });

  test('正确登录 → 返回 token', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; username: string };
    expect(body.token).toBeTruthy();
    expect(body.username).toBe('admin');
  });

  test('连续失败 5 次后锁定 → 423', async () => {
    for (let i = 0; i < 5; i++) await login('admin', 'definitely-wrong');
    const res = await login('admin', 'definitely-wrong');
    expect(res.status).toBe(423);
    // 解锁，避免影响后续用例
    await env.DB.prepare('UPDATE admin SET login_failed = 0, lockout_until = NULL').run();
  });
});

describe('管理 CRUD 与校验', () => {
  test('无 token → 401', async () => {
    expect((await api('/api/admin/links')).status).toBe(401);
    expect((await api('/api/config?page=main&k=x')).status).toBe(200); // 公开接口不受影响
  });

  test('链接 CRUD 闭环（page_id 数字字符串被接受）', async () => {
    const token = await authedToken();
    const headers = { ...jsonHeaders, Authorization: 'Bearer ' + token };

    // 建（故意传字符串数字，模拟后台下拉框取值）
    const create = await api('/api/admin/links', {
      method: 'POST',
      headers,
      body: JSON.stringify({ page_id: '1', label: '测试链接', url: 'https://example.com', sort_order: '0' }),
    });
    expect(create.status).toBe(201);
    const link = (await create.json()) as { id: number };
    expect(link.id).toBeTruthy();

    // 前台可见
    const config = (await (await api('/api/config?page=main')).json()) as {
      links: { label: string }[];
    };
    expect(config.links.map((l) => l.label)).toContain('测试链接');

    // 改
    const update = await api('/api/admin/links?id=' + link.id, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ page_id: 1, label: '改过的链接', url: 'https://example.com' }),
    });
    expect(update.status).toBe(200);

    // 删
    const del = await api('/api/admin/links?id=' + link.id, { method: 'DELETE', headers });
    expect(del.status).toBe(204);
    const config2 = (await (await api('/api/config?page=main')).json()) as {
      links: { label: string }[];
    };
    expect(config2.links.map((l) => l.label)).not.toContain('改过的链接');
  });

  test('zod 校验：非法请求体 → 400', async () => {
    const token = await authedToken();
    const headers = { ...jsonHeaders, Authorization: 'Bearer ' + token };
    const res = await api('/api/admin/links', {
      method: 'POST',
      headers,
      body: JSON.stringify({ page_id: 1 }), // 缺 label
    });
    expect(res.status).toBe(400);
    const res2 = await api('/api/admin/links', { method: 'POST', headers, body: 'not-json' });
    expect(res2.status).toBe(400);
  });

  test('宠物 CRUD：单语语录数组', async () => {
    const token = await authedToken();
    const headers = { ...jsonHeaders, Authorization: 'Bearer ' + token };
    const create = await api('/api/admin/pet', {
      method: 'POST',
      headers,
      body: JSON.stringify({ page_id: 1, pet_image: 'assets/pets/cat.gif', pet_type: 'cat', messages: ['你好', '摸摸我'] }),
    });
    expect(create.status).toBe(201);
    const pet = (await create.json()) as { id: number; messages: string[] };
    expect(pet.messages).toEqual(['你好', '摸摸我']);

    const config = (await (await api('/api/config?page=main')).json()) as {
      pet: { messages: string[] } | null;
    };
    expect(config.pet).not.toBeNull();
    expect(config.pet!.messages).toEqual(['你好', '摸摸我']);

    await api('/api/admin/pet?id=' + pet.id, { method: 'DELETE', headers });
  });

  test('site-config 白名单：未知键被忽略', async () => {
    const token = await authedToken();
    const headers = { ...jsonHeaders, Authorization: 'Bearer ' + token };
    await api('/api/admin/site-config', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ username: 'HuoLin', hacker_key: 'x' }),
    });
    const cfg = (await (await api('/api/admin/site-config', { headers })).json()) as Record<string, string>;
    expect(cfg.username).toBe('HuoLin');
    expect(cfg.hacker_key).toBeUndefined();
  });

  test('gallery CRUD 冒烟', async () => {
    const token = await authedToken();
    const headers = { ...jsonHeaders, Authorization: 'Bearer ' + token };
    const create = await api('/api/admin/gallery', {
      method: 'POST',
      headers,
      body: JSON.stringify({ page_id: 1, src: 'assets/demo/test.png' }),
    });
    expect(create.status).toBe(201);
    const img = (await create.json()) as { id: number };
    const del = await api('/api/admin/gallery?id=' + img.id, { method: 'DELETE', headers });
    expect(del.status).toBe(204);
  });
});

describe('文件上传与文件库', () => {
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

  async function upload(bytes: Uint8Array, name: string, type: string) {
    const token = await authedToken();
    const fd = new FormData();
    fd.append('file', new File([bytes], name, { type }));
    return api('/api/admin/files', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: fd,
    });
  }

  test('上传合法图片 → 201，返回 /files/ 地址', async () => {
    const res = await upload(pngBytes, 'test.png', 'image/png');
    expect(res.status).toBe(201);
    const body = (await res.json()) as { key: string; url: string };
    expect(body.url).toBe('/files/' + body.key);
  });

  test('/files/ 公开访问：内容与缓存头正确', async () => {
    const token = await authedToken();
    const list = (await (await api('/api/admin/files', { headers: { Authorization: 'Bearer ' + token } })).json()) as {
      files: { key: string; mime: string }[];
    };
    const key = list.files[0].key;
    const res = await api('/files/' + key);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age=31536000');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  test('SVG 响应带 CSP sandbox 安全头', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const res = await upload(svg, 'test.svg', 'image/svg+xml');
    expect(res.status).toBe(201);
    const body = (await res.json()) as { key: string };
    const pub = await api('/files/' + body.key);
    expect(pub.headers.get('Content-Security-Policy')).toBe('sandbox');
  });

  test('类型白名单与大小限制在后端生效', async () => {
    const bad = await upload(new Uint8Array([1, 2, 3]), 'evil.txt', 'text/plain');
    expect(bad.status).toBe(415);
    const big = await upload(new Uint8Array(MAX_IMAGE_BYTES + 1), 'big.png', 'image/png');
    expect(big.status).toBe(413);
  });

  test('文件库：使用判定（被头像引用 → 使用中）', async () => {
    const token = await authedToken();
    const headers = { ...jsonHeaders, Authorization: 'Bearer ' + token };
    const up = (await (await upload(pngBytes, 'avatar.png', 'image/png')).json()) as { key: string; url: string };

    // 初始应为未使用
    let list = (await (await api('/api/admin/files', { headers })).json()) as {
      files: { key: string; used_by: string[] }[];
      total_bytes: number;
      quota_bytes: number;
    };
    expect(list.files.find((f) => f.key === up.key)!.used_by).toEqual([]);
    expect(list.total_bytes).toBeGreaterThan(0);
    expect(list.quota_bytes).toBeGreaterThan(list.total_bytes);

    // 设为头像后 → 使用中标注「头像」
    await api('/api/admin/site-config', { method: 'PUT', headers, body: JSON.stringify({ avatar: up.url }) });
    list = (await (await api('/api/admin/files', { headers })).json()) as typeof list;
    expect(list.files.find((f) => f.key === up.key)!.used_by).toContain('头像');

    // 删除文件（被引用也允许，仅前端二次确认）
    const del = await api('/api/admin/files?key=' + encodeURIComponent(up.key), { method: 'DELETE', headers });
    expect(del.status).toBe(204);
    const gone = await api('/files/' + up.key);
    expect(gone.status).toBe(404);

    // 还原头像配置
    await api('/api/admin/site-config', { method: 'PUT', headers, body: JSON.stringify({ avatar: '' }) });
  });
});
