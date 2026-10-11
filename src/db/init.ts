/**
 * init.ts — 管理员惰性初始化
 *
 * 迁移 SQL 拿不到运行时的 ADMIN_PASSWORD，因此默认管理员由 Worker 首次运行时创建
 * （沿用旧版"首次访问自动初始化"习惯）：admin 表为空时创建账号，幂等，仅执行一次。
 */
import bcrypt from 'bcryptjs';
import * as repo from './repo';

let ready: Promise<void> | null = null;

export function ensureAdmin(db: D1Database, env: { ADMIN_PASSWORD?: string }): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const existing = await repo.getAdmin(db);
      if (!existing) {
        const hash = await bcrypt.hash(env.ADMIN_PASSWORD || 'admin', 10);
        await repo.createAdmin(db, 'admin', hash);
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
