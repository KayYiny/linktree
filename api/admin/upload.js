/**
 * POST /api/admin/upload
 * 上传图片到兰空图床（Lsky Pro），返回可访问的图片 URL 与图床 key
 * Body: { filename: string, base64: string }
 *
 * 依赖 lib/lsky.js 共享模块（配置来源：环境变量优先，否则 site_config）。
 */
const { uploadImage } = require('../../lib/lsky');
const { verifyToken } = require('../auth');

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

  try {
    const { url, key } = await uploadImage(filename, base64);
    return res.status(200).json({ url, key });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
