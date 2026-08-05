/**
 * POST /api/admin/change-password
 * 修改管理员密码
 */
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { verifyToken } = require('../auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '请提供当前密码和新密码' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: '新密码至少4个字符' });
  }

  try {
    // 获取当前密码哈希
    const { rows } = await query(
      'SELECT id, password_hash FROM admin_users WHERE id = $1',
      [user.userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证当前密码
    const valid = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: '当前密码错误' });
    }

    // 更新密码
    const newHash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE admin_users SET password_hash = $1 WHERE id = $2',
      [newHash, user.userId]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
