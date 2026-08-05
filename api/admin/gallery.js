/**
 * /api/admin/gallery — 相册图片管理 CRUD
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
        const { page_id } = req.query;
        let sql = 'SELECT * FROM gallery_images';
        const params = [];
        if (page_id) {
          sql += ' WHERE page_id = $1';
          params.push(page_id);
        }
        sql += ' ORDER BY sort_order';
        const { rows } = await query(sql, params);
        return res.status(200).json(rows);
      }
      case 'POST': {
        const { page_id, src, sort_order } = req.body;
        const { rows } = await query(
          'INSERT INTO gallery_images (page_id, src, sort_order) VALUES ($1, $2, $3) RETURNING *',
          [page_id, src, sort_order ?? 0]
        );
        return res.status(201).json(rows[0]);
      }
      case 'PUT': {
        const { id } = req.query;
        const { page_id, src, sort_order } = req.body;
        const { rows } = await query(
          'UPDATE gallery_images SET page_id=$1, src=$2, sort_order=$3 WHERE id=$4 RETURNING *',
          [page_id, src, sort_order, id]
        );
        return res.status(200).json(rows[0]);
      }
      case 'DELETE': {
        const { id } = req.query;
        await query('DELETE FROM gallery_images WHERE id = $1', [id]);
        return res.status(204).end();
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Gallery API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
