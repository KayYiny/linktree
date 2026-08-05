/**
 * GET /api/config?page=main|whisper
 * 返回该页面的完整配置（公开接口，无需认证）
 */
const { query } = require('./db');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pageSlug = req.query.page || 'main';

  try {
    // 1. 页面信息
    const { rows: pageRows } = await query(
      'SELECT slug, title, background_image FROM pages WHERE slug = $1 AND is_active = true',
      [pageSlug]
    );
    if (!pageRows.length) return res.status(404).json({ error: 'Page not found' });
    const page = pageRows[0];

    // 2. 站点配置
    const { rows: configRows } = await query('SELECT key, value FROM site_config');
    const site = {};
    for (const r of configRows) site[r.key] = r.value;

    // 3. 链接
    const { rows: links } = await query(
      `SELECT label, url, icon, qr_code, popup_note
       FROM links WHERE page_id = (SELECT id FROM pages WHERE slug = $1)
       AND is_active = true ORDER BY sort_order`,
      [pageSlug]
    );

    // 4. 相册
    const { rows: gallery } = await query(
      `SELECT src FROM gallery_images
       WHERE page_id = (SELECT id FROM pages WHERE slug = $1)
       ORDER BY sort_order`,
      [pageSlug]
    );

    // 5. 宠物
    const { rows: petRows } = await query(
      `SELECT pc.pet_image, pc.pet_type, pm.language, pm.messages
       FROM pet_config pc
       LEFT JOIN pet_messages pm ON pm.pet_config_id = pc.id
       WHERE pc.page_id = (SELECT id FROM pages WHERE slug = $1)`,
      [pageSlug]
    );

    let pet = null;
    if (petRows.length) {
      pet = { image: petRows[0].pet_image, type: petRows[0].pet_type, messages: {} };
      for (const r of petRows) {
        if (r.language && r.messages) pet.messages[r.language] = r.messages;
      }
    }

    // 6. 翻译文本
    const { rows: transRows } = await query('SELECT key, language, value FROM translations');
    const translations = {};
    for (const r of transRows) {
      if (!translations[r.key]) translations[r.key] = {};
      translations[r.key][r.language] = r.value;
    }

    return res.status(200).json({
      page,
      site,
      links,
      gallery,
      pet,
      translations,
    });
  } catch (err) {
    console.error('Config API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
