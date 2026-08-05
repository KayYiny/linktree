/**
 * /api/admin/pages — 页面管理 CRUD
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
        const { rows } = await query('SELECT * FROM pages ORDER BY sort_order');
        return res.status(200).json(rows);
      }
      case 'POST': {
        const { slug, title, background_image, is_active, sort_order } = req.body;
        const { rows } = await query(
          `INSERT INTO pages (slug, title, background_image, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [slug, title, background_image, is_active ?? true, sort_order ?? 0]
        );
        return res.status(201).json(rows[0]);
      }
      case 'PUT': {
        const { id } = req.query;
        const { slug, title, background_image, is_active, sort_order } = req.body;
        const { rows } = await query(
          `UPDATE pages SET slug=$1, title=$2, background_image=$3, is_active=$4, sort_order=$5
           WHERE id=$6 RETURNING *`,
          [slug, title, background_image, is_active, sort_order, id]
        );
        return res.status(200).json(rows[0]);
      }
      case 'DELETE': {
        const { id } = req.query;
        await query('DELETE FROM pages WHERE id = $1', [id]);
        return res.status(204).end();
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Pages API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
