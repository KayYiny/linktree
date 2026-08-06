/**
 * migrate.js — 数据库初始化脚本（可选）
 * 现在任意 API 首次被调用时会自动建表（见 api/db.js 的 ensureSchema），
 * 部署后无需再手动运行本脚本。它仅供本地显式初始化 / 排查用：
 * 跑一次即确保 8 张表 + 空白基础页 + 默认管理员存在（幂等，可重复执行）。
 *
 * 用法：DB_HOST=xxx DB_PORT=5432 DB_NAME=xxx DB_USER=xxx DB_PASSWORD=xxx node scripts/migrate.js
 */
const { pool, ensureSchema } = require('../api/db');

async function migrate() {
  try {
    await ensureSchema();
    console.log('✅ 数据库结构已就绪（8 张表 + 空白基础页已确保存在）。');
    console.log(`   若此前无管理员账号，已创建默认管理员：admin / ${process.env.ADMIN_PASSWORD || 'admin'}`);
    console.log('   站点内容请登录管理后台添加，或用「导入」功能从备份恢复。');
    console.log('   请尽快修改默认管理员密码！');
  } catch (err) {
    console.error('❌ 初始化失败：', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
