import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        // 接口测试共享同一份数据（ensureAdmin/登录锁定等跨请求状态），
        // 关闭按测试回滚的隔离存储
        isolatedStorage: false,
      },
    },
  },
});
