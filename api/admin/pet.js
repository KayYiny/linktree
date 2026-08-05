/**
 * /api/admin/pet — 宠物配置管理 CRUD
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
        let sql = `
          SELECT pc.*, pm.language, pm.messages
          FROM pet_config pc
          LEFT JOIN pet_messages pm ON pm.pet_config_id = pc.id
        `;
        const params = [];
        if (page_id) {
          sql += ' WHERE pc.page_id = $1';
          params.push(page_id);
        }
        const { rows } = await query(sql, params);
        return res.status(200).json(rows);
      }
      case 'POST': {
        const { page_id, pet_image, pet_type, messages, is_active } = req.body;
        const { rows } = await query(
          'INSERT INTO pet_config (page_id, pet_image, pet_type, is_active) VALUES ($1, $2, $3, $4) RETURNING *',
          [page_id, pet_image, pet_type, is_active ?? true]
        );
        const petConfig = rows[0];
        // 插入消息
        if (messages && typeof messages === 'object') {
          for (const [lang, msgs] of Object.entries(messages)) {
            await query(
              'INSERT INTO pet_messages (pet_config_id, language, messages) VALUES ($1, $2, $3)',
              [petConfig.id, lang, JSON.stringify(msgs)]
            );
          }
        }
        return res.status(201).json(petConfig);
      }
      case 'PUT': {
        const { id } = req.query;
        const { pet_image, pet_type, messages, is_active } = req.body;
        const { rows } = await query(
          'UPDATE pet_config SET pet_image=$1, pet_type=$2, is_active=$3 WHERE id=$4 RETURNING *',
          [pet_image, pet_type, is_active ?? true, id]
        );
        // 更新消息
        if (messages && typeof messages === 'object') {
          for (const [lang, msgs] of Object.entries(messages)) {
            await query(
              `INSERT INTO pet_messages (pet_config_id, language, messages)
               VALUES ($1, $2, $3)
               ON CONFLICT (pet_config_id, language) DO UPDATE SET messages = $3`,
              [id, lang, JSON.stringify(msgs)]
            );
          }
        }
        return res.status(200).json(rows[0]);
      }
      case 'DELETE': {
        const { id } = req.query;
        await query('DELETE FROM pet_messages WHERE pet_config_id = $1', [id]);
        await query('DELETE FROM pet_config WHERE id = $1', [id]);
        return res.status(204).end();
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Pet API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
