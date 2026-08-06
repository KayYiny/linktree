/**
 * lib/lsky.js — Lsky Pro 图床 API 封装（共享）
 * 提供：图床配置读取、token 获取、上传、删除
 *
 * 配置优先级：环境变量 LSKY_URL / LSKY_EMAIL / LSKY_PASSWORD
 *            → site_config 的 lsky_url / lsky_email / lsky_password（后台「设置 → 图床设置」）
 */
const { query } = require('../api/db');

const CONFIG_KEYS = ['lsky_url', 'lsky_email', 'lsky_password'];

/** 读取图床配置，未配置则抛错 */
async function getConfig() {
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
    } catch (e) { /* 交给下方统一报错 */ }
  }
  if (!base || !email || !password) {
    const err = new Error('未配置图床。请在「设置 → 图床设置」填写 Lsky 地址 / 邮箱 / 密码，或在环境变量配置 LSKY_URL / LSKY_EMAIL / LSKY_PASSWORD');
    err.code = 'NO_CONFIG';
    throw err;
  }
  return { base: String(base).replace(/\/+$/, ''), email, password };
}

/** 获取 Bearer token */
async function getToken() {
  const { base, email, password } = await getConfig();
  const tRes = await fetch(base + '/api/v1/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const tJson = await tRes.json().catch(() => ({}));
  if (!tRes.ok || !tJson.data || !tJson.data.token) {
    throw new Error('获取图床 Token 失败：' + (tJson.message || tJson.msg || ('HTTP ' + tRes.status)));
  }
  return { base, token: tJson.data.token };
}

/** 上传图片，返回 { url, key } */
async function uploadImage(filename, base64) {
  const { base, token } = await getToken();
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
  return { url, key: d.key || null };
}

/** 删除图床图片（key 为空则跳过）；404 视为已删除 */
async function deleteImage(key) {
  if (!key) return false;
  const { base, token } = await getToken();
  const dRes = await fetch(base + '/api/v1/images/' + encodeURIComponent(key), {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (dRes.status === 404) return true;
  if (!dRes.ok) {
    const dJson = await dRes.json().catch(() => ({}));
    throw new Error('删除图床图片失败：' + (dJson.message || dJson.msg || ('HTTP ' + dRes.status)));
  }
  return true;
}

module.exports = { getConfig, getToken, uploadImage, deleteImage };
