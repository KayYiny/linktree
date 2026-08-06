/**
 * POST /api/admin/upload
 * 上传图片到兰空图床（Lsky Pro），返回可访问的图片 URL
 * Body: { filename: string, base64: string }
 *
 * Lsky 配置来源（优先级从高到低）：
 *   1. 环境变量 LSKY_URL / LSKY_EMAIL / LSKY_PASSWORD（推荐，更安全）
 *   2. 数据库 site_config 的 lsky_url / lsky_email / lsky_password（后台「设置 → 图床设置」）
 *
 * 依赖 Lsky Pro v1 API：
 *   POST {base}/api/v1/tokens   { email, password } → data.token
 *   POST {base}/api/v1/upload   multipart(file) + Bearer token → data{key, extension, ...}
 */
const { query } = require('../db');
const { verifyToken } = require('../auth');

const CONFIG_KEYS = ['lsky_url', 'lsky_email', 'lsky_password'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { filename, base64 } = req.body || {};
  if (!filename || !base64) {
    return res.status(400).json({ error: '缺少 filename 或 base64' });
  }

  // ---- 读取图床配置（环境变量优先，否则 site_config） ----
  let base = process.env.LSKY_URL;
  let email = process.env.LSKY_EMAIL;
  let password = process.env.LSKY_PASSWORD;
  if (!base || !email || !password) {
    try {
      const { rows } = await query('SELECT key, value FROM site_config WHERE key = ANY($1)', [CONFIG_KEYS]);
      const cfg = {};
      for (const r of rows) cfg[r.key] = r.value;
      base = base || cfg.lsky_url;
      email = email || cfg.lsky_email;
      password = password || cfg.lsky_password;
    } catch (e) {
      /* 表不存在等情况交给下方统一报错 */
    }
  }
  if (!base || !email || !password) {
    return res.status(400).json({
      error: '未配置图床。请在「设置 → 图床设置」填写 Lsky 地址 / 邮箱 / 密码，或在环境变量配置 LSKY_URL / LSKY_EMAIL / LSKY_PASSWORD'
    });
  }
  base = String(base).replace(/\/+$/, '');

  try {
    // ---- 1. 获取 Token ----
    const tRes = await fetch(base + '/api/v1/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const tJson = await tRes.json().catch(() => ({}));
    if (!tRes.ok || !tJson.data || !tJson.data.token) {
      throw new Error('获取图床 Token 失败：' + (tJson.message || tJson.msg || ('HTTP ' + tRes.status)));
    }
    const token = tJson.data.token;

    // ---- 2. 上传图片 ----
    const buf = Buffer.from(base64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buf]), filename);
    const uRes = await fetch(base + '/api/v1/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: form
    });
    const uJson = await uRes.json().catch(() => ({}));
    if (!uRes.ok || uJson.status !== true || !uJson.data) {
      throw new Error('上传图床失败：' + (uJson.message || uJson.msg || ('HTTP ' + uRes.status)));
    }
    const d = uJson.data;

    // ---- 3. 解析图片 URL ----
    let url = null;
    if (d.links) {
      if (typeof d.links === 'string') url = d.links;
      else if (d.links.url) url = d.links.url;
      else if (Array.isArray(d.links) && d.links[0]) {
        url = typeof d.links[0] === 'string' ? d.links[0] : (d.links[0].url || null);
      }
    }
    if (!url && d.url) url = d.url;
    if (!url && d.key && d.extension) url = base + '/i/' + d.key + '.' + d.extension;
    if (!url) throw new Error('无法解析图床返回的图片 URL');

    return res.status(200).json({ url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
