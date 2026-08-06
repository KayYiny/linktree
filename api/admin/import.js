/**
 * POST /api/admin/import
 * 事务式整库导入（与导出格式对称，幂等可重复执行）
 * Body: { pages?, links?, gallery?, pet?, translations?, siteConfig? }
 */
const { pool, ensureSchema } = require('../db');
const { verifyToken } = require('../auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  const data = req.body || {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid backup data' });
  }

  // 直接使用 pool 的路径也要先确保表结构已建（其他接口经 query 已自动触发）
  await ensureSchema();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 清空全部业务数据（按外键顺序）
    await client.query('DELETE FROM pet_messages');
    await client.query('DELETE FROM pet_config');
    await client.query('DELETE FROM gallery_images');
    await client.query('DELETE FROM links');
    await client.query('DELETE FROM pages');
    await client.query('DELETE FROM translations');
    await client.query('DELETE FROM site_config');

    const counts = { pages: 0, links: 0, gallery: 0, pet: 0, translations: 0, siteConfig: 0 };

    // 2. 页面（记录 old id -> new id 映射）
    const pageIdMap = {};
    let firstPageId = null;
    const pages = Array.isArray(data.pages) ? data.pages : [];
    for (const p of pages) {
      const { rows } = await client.query(
        `INSERT INTO pages (slug, title, background_image, is_active, sort_order, gallery_enabled)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [p.slug, p.title ?? '', p.background_image ?? null, p.is_active ?? true, p.sort_order ?? 0, p.gallery_enabled ?? true]
      );
      pageIdMap[p.id] = rows[0].id;
      if (firstPageId === null) firstPageId = rows[0].id;
      counts.pages++;
    }
    // 若没有页面数据，建一个默认 main 页兜底（避免后续无主数据）
    if (firstPageId === null) {
      const { rows } = await client.query(
        `INSERT INTO pages (slug, title, is_active, sort_order) VALUES ('main', 'Main', true, 1) RETURNING id`
      );
      firstPageId = rows[0].id;
    }
    const mapPage = (oldId) => (oldId != null && pageIdMap[oldId] != null ? pageIdMap[oldId] : firstPageId);

    // 3. 链接
    if (Array.isArray(data.links)) {
      for (const l of data.links) {
        await client.query(
          `INSERT INTO links (page_id, label, url, icon, qr_code, popup_note, sort_order, is_active, i18n_key, note_i18n_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [mapPage(l.page_id), l.label ?? '链接', l.url ?? null, l.icon ?? null, l.qr_code ?? null,
           l.popup_note ?? null, l.sort_order ?? 0, l.is_active ?? true, l.i18n_key ?? null, l.note_i18n_key ?? null]
        );
        counts.links++;
      }
    }

    // 4. 相册
    if (Array.isArray(data.gallery)) {
      for (const g of data.gallery) {
        await client.query(
          'INSERT INTO gallery_images (page_id, src, sort_order, is_active, image_key) VALUES ($1,$2,$3,$4,$5)',
          [mapPage(g.page_id), g.src, g.sort_order ?? 0, g.is_active ?? true, g.image_key || null]
        );
        counts.gallery++;
      }
    }

    // 5. 宠物（兼容 JOIN 展开行 与 归一化 messages 对象两种格式）
    const petItems = [];
    if (Array.isArray(data.pet)) {
      const byId = {};
      for (const row of data.pet) {
        if (!byId[row.id]) {
          byId[row.id] = { id: row.id, page_id: row.page_id, pet_image: row.pet_image, pet_type: row.pet_type, is_active: row.is_active !== false, messages: {} };
        }
        if (row.language && row.messages !== undefined && row.messages !== null) {
          byId[row.id].messages[row.language] = typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages;
        } else if (row.messages && typeof row.messages === 'object' && !row.language) {
          byId[row.id].messages = row.messages;
        }
      }
      for (const id of Object.keys(byId)) petItems.push(byId[id]);
    }
    for (const pet of petItems) {
      const { rows } = await client.query(
        'INSERT INTO pet_config (page_id, pet_image, pet_type, is_active) VALUES ($1,$2,$3,$4) RETURNING id',
        [mapPage(pet.page_id), pet.pet_image ?? '', pet.pet_type ?? '', pet.is_active !== false]
      );
      const petId = rows[0].id;
      if (pet.messages && typeof pet.messages === 'object') {
        for (const [lang, msgs] of Object.entries(pet.messages)) {
          const arr = Array.isArray(msgs) ? msgs : [];
          await client.query(
            'INSERT INTO pet_messages (pet_config_id, language, messages) VALUES ($1,$2,$3)',
            [petId, lang, JSON.stringify(arr)]
          );
        }
      }
      counts.pet++;
    }

    // 6. 翻译
    if (Array.isArray(data.translations)) {
      for (const t of data.translations) {
        if (!t.key || !t.language) continue;
        await client.query(
          'INSERT INTO translations (key, language, value) VALUES ($1,$2,$3)',
          [t.key, t.language, t.value ?? '']
        );
        counts.translations++;
      }
    }

    // 7. 站点配置（兼容对象 {key:value} 与数组行两种格式）
    const siteEntries = Array.isArray(data.siteConfig)
      ? data.siteConfig.map((s) => [s.key, s.value])
      : Object.entries(data.siteConfig || {});
    for (const [key, value] of siteEntries) {
      if (key == null) continue;
      await client.query(
        `INSERT INTO site_config (key, value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value == null ? '' : String(value)]
      );
      counts.siteConfig++;
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, counts });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import API error:', err);
    return res.status(500).json({ error: 'Import failed: ' + err.message });
  } finally {
    client.release();
  }
};
