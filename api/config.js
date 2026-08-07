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
      'SELECT slug, title, background_image, gallery_enabled FROM pages WHERE slug = $1 AND is_active = true',
      [pageSlug]
    );
    if (!pageRows.length) return res.status(404).json({ error: 'Page not found' });
    const page = pageRows[0];

    // 2-6. 站点配置/链接/宠物/翻译互不依赖（只依赖 pageSlug），并行查询
    //      相册依赖 page.gallery_enabled，单独串行执行
    const [configRes, linksRes, petRes, transRes] = await Promise.all([
      query('SELECT key, value FROM site_config'),
      query(
        `SELECT label, url, icon, qr_code, popup_note, i18n_key, note_i18n_key
         FROM links WHERE page_id = (SELECT id FROM pages WHERE slug = $1)
         AND is_active = true ORDER BY sort_order`,
        [pageSlug]
      ),
      query(
        `SELECT pc.pet_image, pc.pet_type, pm.language, pm.messages
         FROM pet_config pc
         LEFT JOIN pet_messages pm ON pm.pet_config_id = pc.id
         WHERE pc.page_id = (SELECT id FROM pages WHERE slug = $1)
         AND pc.is_active = true`,
        [pageSlug]
      ),
      query('SELECT key, language, value FROM translations'),
    ]);

    const site = {};
    for (const r of configRes.rows) site[r.key] = r.value;

    const links = linksRes.rows;

    let pet = null;
    if (petRes.rows.length) {
      pet = { image: petRes.rows[0].pet_image, type: petRes.rows[0].pet_type, messages: {} };
      for (const r of petRes.rows) {
        if (r.language && r.messages) pet.messages[r.language] = r.messages;
      }
    }

    const translations = {};
    for (const r of transRes.rows) {
      if (!translations[r.key]) translations[r.key] = {};
      translations[r.key][r.language] = r.value;
    }

    // 相册（整页关闭则不返回任何图片）
    let gallery = [];
    if (page.gallery_enabled !== false) {
      const { rows: g } = await query(
        `SELECT src FROM gallery_images
         WHERE page_id = (SELECT id FROM pages WHERE slug = $1)
         AND is_active = true ORDER BY sort_order`,
        [pageSlug]
      );
      gallery = g;
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
