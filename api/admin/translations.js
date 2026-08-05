/**
 * /api/admin/translations — 翻译文本管理 CRUD
 */
const { query } = require('../db');
const { verifyToken } = require('../auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    switch (req.method) {
      case 'GET': {
        const { rows } = await query('SELECT * FROM translations ORDER BY key, language');
        return res.status(200).json(rows);
      }
      case 'POST': {
        const { key, language, value } = req.body;
        const { rows } = await query(
          `INSERT INTO translations (key, language, value)
           VALUES ($1, $2, $3) RETURNING *`,
          [key, language, value]
        );
        return res.status(201).json(rows[0]);
      }
      case 'PUT': {
        const { id } = req.query;
        const { key, language, value } = req.body;
        const { rows } = await query(
          'UPDATE translations SET key=$1, language=$2, value=$3 WHERE id=$4 RETURNING *',
          [key, language, value, id]
        );
        return res.status(200).json(rows[0]);
      }
      case 'DELETE': {
        const { id } = req.query;
        await query('DELETE FROM translations WHERE id = $1', [id]);
        return res.status(204).end();
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Translations API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
