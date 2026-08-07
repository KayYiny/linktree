/**
 * POST /api/auth
 * 登录认证，返回 JWT token
 * Body: { username, password }
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'linktree-dev-secret-change-in-prod';
const JWT_EXPIRES = '7d';

// 登录失败锁定：连续失败 MAX_FAILS 次锁定 LOCK_MS 毫秒
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const { rows } = await query(
      'SELECT id, username, password_hash, login_failed, lockout_until FROM admin_users WHERE username = $1',
      [username]
    );

    if (!rows.length) {
      // 用户名不存在：不区分响应，避免枚举
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    // 锁定中（登录失败锁定，见文件头注释）
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      return res.status(429).json({ error: '尝试次数过多，请 15 分钟后再试' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (valid) {
      await query(
        'UPDATE admin_users SET login_failed = 0, lockout_until = NULL WHERE id = $1',
        [user.id]
      );
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );
      return res.status(200).json({ token, username: user.username });
    }

    // 密码错误：计数，达到上限锁定
    const newFail = (user.login_failed || 0) + 1;
    const lockUntil = newFail >= MAX_FAILS ? new Date(Date.now() + LOCK_MS) : null;
    await query(
      'UPDATE admin_users SET login_failed = $1, lockout_until = $2 WHERE id = $3',
      [newFail, lockUntil, user.id]
    );
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 导出 JWT 验证辅助函数供其他 API 使用
module.exports.verifyToken = function verifyToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};
