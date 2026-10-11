/**
 * /api/admin/* — 管理接口聚合（全部需 JWT 登录）
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../lib/env';
import { requireAuth } from '../../middleware/auth';
import pages from './pages';
import links from './links';
import gallery from './gallery';
import pet from './pet';
import siteConfig from './site-config';
import changePassword from './change-password';

const routes = new Hono<AppEnv>();

routes.use('*', requireAuth);
routes.route('/pages', pages);
routes.route('/links', links);
routes.route('/gallery', gallery);
routes.route('/pet', pet);
routes.route('/site-config', siteConfig);
routes.route('/change-password', changePassword);

export default routes;
