/**
 * Vercel Serverless Function — 站点配置读写
 *
 * GET  /api/config  → 返回 { links, gallery }（不含口令）
 * PUT  /api/config  → 校验口令后写入 { links, gallery, adminPassword }
 *
 * 数据持久化到 Vercel Blob：
 *   在 Vercel 项目 → Storage → Create Database → Blob 创建后，
 *   会自动生成 BLOB_READ_WRITE_TOKEN 环境变量，本函数无需额外配置。
 */
import { put, get } from '@vercel/blob';

const BLOB_PATH = 'site-config.json';
const DEFAULT_PASSWORD = 'admin123'; // 首次默认口令，登录后请在管理页「设置」中修改

/* ---- 内置默认数据（与改造前的 index.html 硬编码内容一致） ---- */
const DEFAULT_LINKS = [
  {
    label: 'QQ', labelKey: 'brand.qq',
    icon: 'assets/icons/qq.svg',
    url: 'https://qm.qq.com/q/KbsdxQ17W0',
    qr: 'assets/qrcodes/qq.jpg',
    note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
  },
  {
    label: 'WeChat', labelKey: 'brand.wechat',
    icon: 'assets/icons/wechat.svg',
    qr: 'assets/qrcodes/wechat.jpg',
    note: '使用微信长按识别', noteKey: 'popup.note.wechat',
  },
  {
    label: 'Bilibili', labelKey: 'brand.bilibili',
    icon: 'assets/icons/bilibili.svg',
    url: 'http://space.bilibili.com/430552995',
    qr: 'assets/qrcodes/bilibili.jpg',
    note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
  },
  {
    label: 'TikTok', labelKey: 'brand.tiktok',
    icon: 'assets/icons/tiktok.svg',
    url: 'https://www.douyin.com/user/MS4wLjABAAAAYuXxtdsArkxgZpoGgQHE1Z2e5mvPeP4UCSezKlzUiALP4vyL0yqLi0vjneoLi5wz',
    qr: 'assets/qrcodes/douyin.jpg',
    note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
  },
  {
    label: 'RED', labelKey: 'brand.xiaohongshu',
    icon: 'assets/icons/xiaohongshu.svg',
    url: 'http://xhslink.com/m/3qScrydPm6Z',
    qr: 'assets/qrcodes/xiaohongshu.jpg',
    note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
  },
];

const DEFAULT_GALLERY = [
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94ce4ba9.png' },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94d412a4.png' },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94f43386.png' },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe951955ae.png' },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe9528ce69.png' },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe95313dc8.png' },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe953c3b1c.png' },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe953c6082.jpeg' },
  { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe95454f88.jpeg' },
];

/** 从 Blob 读取配置；不存在或损坏时返回 null */
async function readConfig() {
  try {
    const res = await get(BLOB_PATH);
    if (!res || res.statusCode !== 200) return null;
    const text = await new Response(res.stream).text();
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** 写入配置到 Blob */
async function writeConfig(cfg) {
  await put(BLOB_PATH, JSON.stringify(cfg, null, 2), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export default async function handler(req, res) {
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

    const stored = await readConfig();
    const links = stored && Array.isArray(stored.links) ? stored.links : DEFAULT_LINKS;
    const gallery = stored && Array.isArray(stored.gallery) ? stored.gallery : DEFAULT_GALLERY;
    // 配置不常变：允许 CDN 边缘缓存 60s，访客从就近节点读取，避免跨区调用函数；
    // 后台保存后最迟 60s 内全站生效（后台自己读取时带时间戳绕过缓存）
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ links, gallery });
    return;
  }

  if (req.method === 'PUT') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const password = String(body.password || '');
    const stored = await readConfig();
    const expected = (stored && stored.adminPassword) || DEFAULT_PASSWORD;

    if (password !== expected) {
      res.status(401).json({ ok: false, error: '口令错误' });
      return;
    }

    const next = {
      links: Array.isArray(body.links)
        ? body.links
        : stored && Array.isArray(stored.links) ? stored.links : DEFAULT_LINKS,
      gallery: Array.isArray(body.gallery)
        ? body.gallery
        : stored && Array.isArray(stored.gallery) ? stored.gallery : DEFAULT_GALLERY,
      adminPassword:
        (body.newPassword && String(body.newPassword).trim()) ||
        (stored && stored.adminPassword) ||
        DEFAULT_PASSWORD,
    };

    await writeConfig(next);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ ok: false, error: 'Method Not Allowed' });
}
