/**
 * /api/admin/admin-users — 管理员账号导出（仅 GET，仅供备份用）
 * 返回全部管理员记录（含密码哈希），供导出备份使用。
 */
const { query } = require('../db');
const { verifyToken } = require('../auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rows } = await query('SELECT id, username, password_hash, login_failed, lockout_until FROM admin_users ORDER BY id');
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Admin users API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};