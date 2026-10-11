/**
 * GET /api/config?page=<slug>&k= — 获取指定页面的公开配置（无需认证）
 *
 * 密钥门禁：耳语页（whisper）启用密钥时，服务端校验 ?k= 命中当前轮换密钥或永久密钥，
 * 否则返回 404（与「页面不存在」一致，避免枚举探测）。
 * 校验通过后才下发内容，且永久密钥（key_permanent）只用于服务端校验，不下发客户端。
 */
import { Hono } from 'hono';
import type { AppEnv } from '../lib/env';
import keygen from '../lib/keygen';
import * as repo from '../db/repo';

const routes = new Hono<AppEnv>();

routes.get('/', async (c) => {
  const pageSlug = c.req.query('page') || 'main';
  const k = c.req.query('k') || '';

  try {
    // 1. 站点配置先行（密钥门禁依据）
    const site = await repo.getAllConfig(c.env.DB);

    // 2. 耳语页密钥门禁（key 基于 UTC 时间桶，见 keygen.js 头注释）
    const rotation = site.key_rotation || 'daily';
    const salt = site.key_salt || '';
    const permanent = site.key_permanent || '';

    if (pageSlug === 'whisper' && site.key_enabled !== '0' && !keygen.isValid(k, rotation, salt, permanent)) {
      return c.json({ error: 'Page not found' }, 404);
    }

    // 3. 客户端需要知道本次 ?k= 是否有效（主页提示弹窗、地址栏归一化用）
    //    保持布尔形状（与旧接口一致）：key_valid 只在携带 k 时出现
    const siteOut: Record<string, unknown> = { ...site };
    if (k) siteOut.key_valid = keygen.isValid(k, rotation, salt, permanent);
    // 永久密钥只用于服务端校验，不下发到客户端
    delete siteOut.key_permanent;

    // 4. 页面 / 链接 / 宠物（相册依赖 page.gallery_enabled，单独串行）
    const page = await repo.getPageBySlug(c.env.DB, pageSlug);
    if (!page || !page.is_active) return c.json({ error: 'Page not found' }, 404);

    const [links, pets] = await Promise.all([
      repo.listLinks(c.env.DB, page.id),
      repo.listPets(c.env.DB, page.id),
    ]);

    let gallery: { src: string }[] = [];
    if (page.gallery_enabled) {
      gallery = (await repo.listGallery(c.env.DB, page.id))
        .filter((g) => g.is_active)
        .map((g) => ({ src: g.src }));
    }

    const petRow = pets.find((p) => p.is_active);
    const pet = petRow
      ? { image: petRow.pet_image, type: petRow.pet_type, messages: petRow.messages }
      : null;

    return c.json({
      page: {
        slug: page.slug,
        title: page.title,
        background_image: page.background_image,
        gallery_enabled: page.gallery_enabled,
      },
      site: siteOut,
      links: links
        .filter((l) => l.is_active)
        .map((l) => ({
          label: l.label,
          url: l.url,
          icon: l.icon,
          qr_code: l.qr_code,
          popup_note: l.popup_note,
        })),
      gallery,
      pet,
    });
  } catch (err) {
    console.error('Config API error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default routes;
