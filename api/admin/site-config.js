/**
 * /api/admin/site-config — 站点配置管理
 */
const { query } = require('../db');
const { verifyToken } = require('../auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    switch (req.method) {
      case 'GET': {
        const { rows } = await query('SELECT key, value FROM site_config');
        const config = {};
        for (const r of rows) config[r.key] = r.value;
        return res.status(200).json(config);
      }
      case 'PUT': {
        const updates = req.body; // { key: value, ... }
        for (const [key, value] of Object.entries(updates)) {
          await query(
            `INSERT INTO site_config (key, value)
             VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [key, value]
          );
        }
        return res.status(200).json({ success: true });
      }
      case 'DELETE': {
        const { key } = req.query;
        if (!key) return res.status(400).json({ error: 'Missing key' });
        await query('DELETE FROM site_config WHERE key = $1', [key]);
        return res.status(204).end();
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Site config API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
