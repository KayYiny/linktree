/**
 * env.ts — Worker 环境变量与全局类型
 */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** R2 图片/视频存储桶 */
  FILES: R2Bucket;
  /** JWT 签名密钥（wrangler secret put JWT_SECRET；本地用 .dev.vars） */
  JWT_SECRET: string;
  /** 初始管理员密码（默认 admin，仅首次创建账号时使用） */
  ADMIN_PASSWORD?: string;
}

export interface AuthUser {
  userId: number;
  username: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { user: AuthUser };
};
