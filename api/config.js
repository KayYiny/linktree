/**
 * Vercel Serverless Function — 站点配置读写（PostgreSQL 存储）
 *
 * GET  /api/config  → 返回站点全部配置（不含口令，无 CDN 缓存，改动即时生效）
 * PUT  /api/config  → 校验口令后写入配置
 *
 * 配置存于 PostgreSQL 单行表 site_config（自动建表）。
 * 连接参数从环境变量读取（Vercel 项目 → Settings → Environment Variables）：
 *   DATABASE_URL 或 POSTGRES_URL = postgres://用户名:密码@主机:端口/数据库名
 *     - 用 Vercel Postgres：在 Storage 创建后自动生成，无需手动填
 *     - 用自建 Postgres：填你的连接串，且需可从公网访问（Vercel 函数在美东）
 *   若你的库不需要 SSL，设置环境变量 PGSSL=false
 *
 * 配置结构：
 *   site    — 站点基础信息（名字/标题/头像/logo/背景/版权/模块开关）
 *   pet     — 主页宠物（开关/资源/类型/自定义台词）
 *   egg     — 主页彩蛋（开关/点击次数/间隔/跳转目标）
 *   whisper — 耳语页（开关/标题/背景/密钥盐/参数名/宠物/链接/相册）
 *   links   — 主页链接（含 enabled 开关）
 *   gallery — 主页相册（含 enabled 开关）
 */
import { Pool } from 'pg';

const DEFAULT_PASSWORD = 'admin123'; // 首次默认口令，登录后请在管理页「设置」中修改

const PG_TABLE = 'site_config';

/** PostgreSQL 连接配置：
 *  1) 优先用完整连接串 DATABASE_URL / POSTGRES_URL（最省事，推荐）
 *  2) 否则用拆分变量：PGHOST / PGUSER / PGPASSWORD / PGDATABASE / PGPORT
 *     —— 主机/端口/库名在代码里有默认值，Vercel 里只需填 PGUSER + PGPASSWORD 即可
 */
const PG_DEFAULT_HOST = '47.112.180.235'; // 默认主机（可用 PGHOST 覆盖）
const PG_DEFAULT_PORT = 5432;             // 默认端口（可用 PGPORT 覆盖）
const PG_DEFAULT_DB = 'linktree';         // 默认数据库名（可用 PGDATABASE 覆盖）

let pool = null;
let useSsl = process.env.PGSSL !== 'false'; // 默认尝试 SSL，PGSSL=false 强制不用
let sslResolved = false; // 是否已确定 SSL 模式（避免反复切换）

function buildPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  const cfg = {
    max: 5,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 8000, // 8s 连不上直接报错，避免 Vercel 函数 10s 超时
  };
  if (url) {
    cfg.connectionString = url;
  } else {
    cfg.host = process.env.PGHOST || PG_DEFAULT_HOST;
    cfg.port = parseInt(process.env.PGPORT, 10) || PG_DEFAULT_PORT;
    cfg.database = process.env.PGDATABASE || PG_DEFAULT_DB;
    cfg.user = process.env.PGUSER || '';
    cfg.password = process.env.PGPASSWORD || '';
  }
  if (useSsl) cfg.ssl = { rejectUnauthorized: false };
  return new Pool(cfg);
}

function getPool() {
  if (!pool) pool = buildPool();
  return pool;
}

async function resetPool() {
  try { if (pool) await pool.end(); } catch (e) { /* ignore */ }
  pool = null;
}

/** 统一查询入口：首次连接失败时自动切换为明文重试一次（覆盖各种“不支持 SSL”报错） */
async function dbQuery(text, params) {
  try {
    return await getPool().query(text, params);
  } catch (err) {
    // 首次失败（无论错误类型）→ 切明文重试一次；若服务端确实没开 SSL 则成功
    if (!sslResolved) {
      useSsl = false;
      sslResolved = true;
      await resetPool();
      return await getPool().query(text, params);
    }
    throw err;
  }
}

async function initSchema() {
  await dbQuery(
    'CREATE TABLE IF NOT EXISTS "' + PG_TABLE + '" (' +
      'id INTEGER PRIMARY KEY, ' +
      'data JSONB NOT NULL, ' +
      'updated_at TIMESTAMPTZ DEFAULT now()' +
    ')'
  );
}

/** 从 PostgreSQL 读取配置；不存在或出错时返回 null */
async function readConfig() {
  try {
    await initSchema();
    const { rows } = await dbQuery(
      'SELECT data FROM "' + PG_TABLE + '" WHERE id = 1'
    );
    if (!rows || !rows.length) return null;
    const raw = rows[0].data;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** 写入配置到 PostgreSQL（单行 UPSERT） */
async function writeConfig(cfg) {
  await initSchema();
  const data = JSON.stringify(cfg);
  await dbQuery(
    'INSERT INTO "' + PG_TABLE + '" (id, data) VALUES (1, $1) ' +
    'ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
    [data]
  );
}

/* ================= 内置默认数据（与原硬编码内容一致） ================= */

const DEFAULT_SITE = {
  name: 'HUOLIN',
  titleZh: '火林 · 这是我的名片',
  titleEn: 'HuoLin · My Card',
  avatar: 'assets/images/avatar.webp',
  favicon: 'assets/images/favicon.svg',
  background: 'assets/images/bg.jpg',
  copyright: '© 2026 HuoLin',
  showAlbum: true, // 相册入口开关
  showShare: true, // 分享入口开关
};

const DEFAULT_PET = {
  enabled: true,
  src: 'assets/pets/pet.webm',
  type: 'video', // video | image
  // 自定义台词：messages.zh-CN / messages.en，留空则回退 i18n 内置语录（pet.cat）
  messages: { 'zh-CN': [], en: [] },
};

const DEFAULT_EGG = {
  enabled: true,
  clicks: 5,
  timeout: 200,       // 点击间隔（毫秒）
  target: 'whisper/', // 彩蛋跳转目标（相对路径，自动附加当日密钥）
};

const DEFAULT_WHISPER_PET = {
  enabled: true,
  src: 'assets/pets/pet1.webp',
  type: 'image',
  messages: { 'zh-CN': [], en: [] },
};

const DEFAULT_WHISPER = {
  enabled: true,
  titleZh: '火林 · 这是我的秘密 ✦',
  titleEn: 'HuoLin · My Secret ✦',
  background: 'assets/images/Puppy_Play_Pride_Flag.svg',
  salt: 'hul_ref_2024', // 每日密钥盐
  secretLen: 6,         // 密钥长度
  refParam: 'ref_id',   // 永久入口参数名
  pet: DEFAULT_WHISPER_PET,
  links: [
    { label: 'X', labelKey: 'brand.x', icon: 'assets/icons/x.svg', url: 'https://x.com/PuppyHuoLin', enabled: true },
    { label: 'Instagram', labelKey: 'brand.instagram', icon: 'assets/icons/instagram.svg', url: 'https://www.instagram.com/puppyhuolin', enabled: true },
    { label: 'Bluesky', labelKey: 'brand.bluesky', icon: 'assets/icons/bluesky.svg', url: 'https://bsky.app/profile/slave.puppyhuolin.com', enabled: true },
  ],
  gallery: [
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaea0b40a.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaea1e097.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaea14236.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaeb27737.jpg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaeb4363d.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaeb48f88.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaec29530.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaec4d018.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaecaa10f.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaed3901a.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaed6d08b.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaeda74ca.jpg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaee552e8.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaeea84d8.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaee9e885.jpg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaef528ed.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaef981e7.jpg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaefd8b6e.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaf05a9dc.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feaf09c8c7.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3a12cc4.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb39f272d.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3b01490.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3b40ee0.jpg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3b447c9.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3c408dc.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3c84e71.jpg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3d143f6.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3d42142.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3daee7b.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3c2382b.jpeg', enabled: true },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3feb39eb878.jpeg', enabled: true },
  ],
};

const DEFAULT_LINKS = [
  {
    label: 'QQ', labelKey: 'brand.qq', enabled: true,
    icon: 'assets/icons/qq.svg',
    url: 'https://qm.qq.com/q/KbsdxQ17W0',
    qr: 'assets/qrcodes/qq.jpg',
    note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
  },
  {
    label: 'WeChat', labelKey: 'brand.wechat', enabled: true,
    icon: 'assets/icons/wechat.svg',
    qr: 'assets/qrcodes/wechat.jpg',
    note: '使用微信长按识别', noteKey: 'popup.note.wechat',
  },
  {
    label: 'Bilibili', labelKey: 'brand.bilibili', enabled: true,
    icon: 'assets/icons/bilibili.svg',
    url: 'http://space.bilibili.com/430552995',
    qr: 'assets/qrcodes/bilibili.jpg',
    note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
  },
  {
    label: 'TikTok', labelKey: 'brand.tiktok', enabled: true,
    icon: 'assets/icons/tiktok.svg',
    url: 'https://www.douyin.com/user/MS4wLjABAAAAYuXxtdsArkxgZpoGgQHE1Z2e5mvPeP4UCSezKlzUiALP4vyL0yqLi0vjneoLi5wz',
    qr: 'assets/qrcodes/douyin.jpg',
    note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
  },
  {
    label: 'RED', labelKey: 'brand.xiaohongshu', enabled: true,
    icon: 'assets/icons/xiaohongshu.svg',
    url: 'http://xhslink.com/m/3qScrydPm6Z',
    qr: 'assets/qrcodes/xiaohongshu.jpg',
    note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
  },
];

const DEFAULT_GALLERY = [
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94ce4ba9.png', enabled: true },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94d412a4.png', enabled: true },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94f43386.png', enabled: true },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe951955ae.png', enabled: true },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe9528ce69.png', enabled: true },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe95313dc8.png', enabled: true },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe953c3b1c.png', enabled: true },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe953c6082.jpeg', enabled: true },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe95454f88.jpeg', enabled: true },
];

/** 递归合并：stored（或 body）覆盖 defaults，数组整体覆盖 */
function mergeObj(base, over) {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (typeof base === 'object' && base !== null) {
    if (typeof over !== 'object' || over === null || Array.isArray(over)) return over;
    const out = { ...base };
    for (const k of Object.keys(over)) {
      if (over[k] === undefined) continue;
      out[k] = k in base ? mergeObj(base[k], over[k]) : over[k];
    }
    return out;
  }
  return over;
}

export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    // 兜底：任何未捕获异常都返回 JSON 错误，避免 Vercel 返回纯文本 500 页面（前端解析会报 not valid JSON）
    console.error('[/api/config] handler error:', err);
    res.status(500).json({ ok: false, error: '服务端错误：' + String((err && err.message) || err) });
  }
}

async function handleRequest(req, res) {
  // 预检请求（同源部署一般用不到，保险起见支持）
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // 口令校验（登录用）：GET /api/config?verify=口令（不缓存）
    if (req.query && req.query.verify !== undefined) {
      const stored = await readConfig();
      const expected = (stored && stored.adminPassword) || DEFAULT_PASSWORD;
      res.setHeader('Cache-Control', 'no-store');
      if (String(req.query.verify) === expected) {
        res.status(200).json({ ok: true });
      } else {
        res.status(401).json({ ok: false, error: '口令错误' });
      }
      return;
    }

    const stored = (await readConfig()) || {};
    const config = {
      site: mergeObj(DEFAULT_SITE, stored.site),
      pet: mergeObj(DEFAULT_PET, stored.pet),
      egg: mergeObj(DEFAULT_EGG, stored.egg),
      whisper: mergeObj(DEFAULT_WHISPER, stored.whisper),
      links: Array.isArray(stored.links) ? stored.links : DEFAULT_LINKS,
      gallery: Array.isArray(stored.gallery) ? stored.gallery : DEFAULT_GALLERY,
    };
    // 不做 CDN 缓存：保证保存后改动对所有访客立即生效（无缓存延迟）
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(config);
    return;
  }

  if (req.method === 'PUT') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const password = String(body.password || '');
    const stored = (await readConfig()) || {};
    const expected = stored.adminPassword || DEFAULT_PASSWORD;

    if (password !== expected) {
      res.status(401).json({ ok: false, error: '口令错误' });
      return;
    }

    const next = {
      site: mergeObj(DEFAULT_SITE, body.site !== undefined ? body.site : stored.site),
      pet: mergeObj(DEFAULT_PET, body.pet !== undefined ? body.pet : stored.pet),
      egg: mergeObj(DEFAULT_EGG, body.egg !== undefined ? body.egg : stored.egg),
      whisper: mergeObj(DEFAULT_WHISPER, body.whisper !== undefined ? body.whisper : stored.whisper),
      links: Array.isArray(body.links) ? body.links : Array.isArray(stored.links) ? stored.links : DEFAULT_LINKS,
      gallery: Array.isArray(body.gallery) ? body.gallery : Array.isArray(stored.gallery) ? stored.gallery : DEFAULT_GALLERY,
      adminPassword:
        (body.newPassword && String(body.newPassword).trim()) ||
        stored.adminPassword ||
        DEFAULT_PASSWORD,
    };

    await writeConfig(next);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Method Not Allowed' });
}
