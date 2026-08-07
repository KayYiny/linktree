/**
 * /api/admin/links — 链接管理 CRUD
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
        let sql = 'SELECT * FROM links';
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
        const { page_id, label, url, icon, qr_code, popup_note, sort_order, is_active, i18n_key, note_i18n_key } = req.body;
        const { rows } = await query(
          `INSERT INTO links (page_id, label, url, icon, qr_code, popup_note, sort_order, is_active, i18n_key, note_i18n_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [page_id, label, url, icon, qr_code, popup_note, sort_order ?? 0, is_active ?? true, i18n_key, note_i18n_key]
        );
        return res.status(201).json(rows[0]);
      }
      case 'PUT': {
        const { id } = req.query;
        const { page_id, label, url, icon, qr_code, popup_note, sort_order, is_active, i18n_key, note_i18n_key } = req.body;
        // 固定列名，与其它 admin PUT 一致（列名来自请求体是注入风险）
        const { rows } = await query(
          `UPDATE links SET page_id=$1, label=$2, url=$3, icon=$4, qr_code=$5, popup_note=$6,
           sort_order=$7, is_active=$8, i18n_key=$9, note_i18n_key=$10
           WHERE id=$11 RETURNING *`,
          [page_id, label, url, icon, qr_code, popup_note, sort_order ?? 0, is_active ?? true, i18n_key, note_i18n_key, id]
        );
        return res.status(200).json(rows[0]);
      }
      case 'DELETE': {
        const { id } = req.query;
        await query('DELETE FROM links WHERE id = $1', [id]);
        return res.status(204).end();
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Links API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
