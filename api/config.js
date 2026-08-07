/**
 * GET /api/config?page=main|whisper&k=
 * 返回该页面的完整配置（公开接口，无需认证）
 *
 * 密钥门禁：耳语页（whisper）启用密钥时，服务端校验 ?k= 命中当前轮换密钥或永久密钥，
 * 否则返回 404（与「页面不存在」一致，避免枚举探测）。
 * 校验通过后才下发内容，且永久密钥（key_permanent）不再下发到客户端。
 */
const { query } = require('./db');
const keygen = require('../assets/scripts/keygen');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pageSlug = req.query.page || 'main';

  try {
    // 1. 站点配置先行（密钥门禁依据，其余查询互不依赖）
    const { rows: configRows } = await query('SELECT key, value FROM site_config');
    const site = {};
    for (const r of configRows) site[r.key] = r.value;

    const k = req.query.k || '';
    const rotation = site.key_rotation || 'daily';
    const salt = site.key_salt || '';
    const permanent = site.key_permanent || '';

    // 2. 耳语页密钥门禁（key 基于 UTC 时间桶，见 keygen.js 头注释）
    if (pageSlug === 'whisper' && site.key_enabled !== '0' && !keygen.isValid(k, rotation, salt, permanent)) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // 3. 客户端需要知道本次 ?k= 是否有效（主页提示弹窗、地址栏归一化用）
    if (k) site.key_valid = keygen.isValid(k, rotation, salt, permanent);
    // 永久密钥只用于服务端校验，不下发到客户端
    delete site.key_permanent;

    // 4. 页面信息 / 链接 / 宠物 / 翻译互不依赖，并行查询
    //    相册依赖 page.gallery_enabled，单独串行执行
    const [pageRes, linksRes, petRes, transRes] = await Promise.all([
      query(
        'SELECT slug, title, background_image, gallery_enabled FROM pages WHERE slug = $1 AND is_active = true',
        [pageSlug]
      ),
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

    if (!pageRes.rows.length) return res.status(404).json({ error: 'Page not found' });
    const page = pageRes.rows[0];

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
