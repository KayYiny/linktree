/**
 * db.js — PostgreSQL 连接池 + 惰性自动建表
 * 使用环境变量配置，Vercel 部署时在控制台设置。
 * 任意 API 首次被调用时会自动执行 ensureSchema() 建表（幂等），
 * 因此部署后无需手动运行迁移脚本。
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// 建表 + 幂等补列 + 基础骨架（惰性初始化，进程内只执行一次）
// schema 版本号：已初始化过的库（site_config 记录了该版本）跳过全部 DDL，
// 避免每个 Serverless 冷启动实例都跑一遍建表 SQL
const SCHEMA_VERSION = '3';
let schemaReady = null;

async function runSchemaInit() {
  const client = await pool.connect();
  try {
    // 版本短路：表已建且版本一致 → 直接跳过 DDL（每次冷启动只多 1 条轻量查询）
    try {
      const { rows: verRows } = await client.query(
        "SELECT value FROM site_config WHERE key = 'schema_version'"
      );
      if (verRows.length && verRows[0].value === SCHEMA_VERSION) return;
    } catch (e) {
      // site_config 表尚不存在（全新库）→ 忽略，走完整建表
    }

    await client.query('BEGIN');

    // ==================== 建表 ====================

    await client.query(`
      CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(200),
        background_image TEXT,
        is_active BOOLEAN DEFAULT true,
        gallery_enabled BOOLEAN DEFAULT true,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS site_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS links (
        id SERIAL PRIMARY KEY,
        page_id INT REFERENCES pages(id),
        label VARCHAR(100) NOT NULL,
        url TEXT,
        icon TEXT,
        qr_code TEXT,
        popup_note VARCHAR(200),
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        i18n_key VARCHAR(200),
        note_i18n_key VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 兼容已存在的旧库：幂等补列（新库由上方建表直接包含）
    await client.query('ALTER TABLE links ADD COLUMN IF NOT EXISTS i18n_key VARCHAR(200);');
    await client.query('ALTER TABLE links ADD COLUMN IF NOT EXISTS note_i18n_key VARCHAR(200);');
    await client.query('ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;');
    await client.query('ALTER TABLE pet_config ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;');
    await client.query('ALTER TABLE pages ADD COLUMN IF NOT EXISTS gallery_enabled BOOLEAN DEFAULT true;');
    await client.query('ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS login_failed INT DEFAULT 0;');
    await client.query('ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMPTZ;');

    await client.query(`
      CREATE TABLE IF NOT EXISTS gallery_images (
        id SERIAL PRIMARY KEY,
        page_id INT REFERENCES pages(id),
        src TEXT NOT NULL,
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 回退清理：移除已废弃的 image_key 列（幂等，仅清理一次）
    await client.query('ALTER TABLE gallery_images DROP COLUMN IF EXISTS image_key;');

    await client.query(`
      CREATE TABLE IF NOT EXISTS pet_config (
        id SERIAL PRIMARY KEY,
        page_id INT REFERENCES pages(id) UNIQUE,
        pet_image TEXT NOT NULL,
        pet_type VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pet_messages (
        id SERIAL PRIMARY KEY,
        pet_config_id INT REFERENCES pet_config(id),
        language VARCHAR(10) NOT NULL,
        messages JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(pet_config_id, language)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS translations (
        id SERIAL PRIMARY KEY,
        key VARCHAR(200) NOT NULL,
        language VARCHAR(10) NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(key, language)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ==================== 基础骨架（无个性化数据） ====================

    // 只创建一个空白的默认主页，保证部署后首页可访问；具体内容由后台添加或导入
    await client.query(`
      INSERT INTO pages (slug, title, sort_order)
      VALUES ('main', 'My Links', 1)
      ON CONFLICT (slug) DO NOTHING;
    `);

    // 示例占位资源（assets/demo/ 下的 SVG，纯占位，非个性化内容）：
    // 仅当对应字段为空时填入，保证全新部署的首页不至于全空白；
    // 用户配置后不会被覆盖（键存在则跳过、背景非空则跳过）
    await client.query(`
      UPDATE pages SET background_image = 'assets/demo/background.svg'
      WHERE slug = 'main' AND (background_image IS NULL OR background_image = '');
    `);
    await client.query(`
      INSERT INTO site_config (key, value) VALUES
        ('avatar',   'assets/demo/avatar.svg'),
        ('favicon',  'assets/demo/favicon.svg'),
        ('username', 'Linktree')
      ON CONFLICT (key) DO NOTHING;
    `);

    // 默认管理员：仅在完全没有管理员账号时创建，避免覆盖已有密码
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM admin_users');
    if (rows[0].n === 0) {
      const defaultPassword = process.env.ADMIN_PASSWORD || 'admin';
      const hash = await bcrypt.hash(defaultPassword, 10);
      await client.query(
        `INSERT INTO admin_users (username, password_hash) VALUES ('admin', $1)`,
        [hash]
      );
    }

    // 记录 schema 版本，后续冷启动实例据此短路跳过建表
    await client.query(
      `INSERT INTO site_config (key, value) VALUES ('schema_version', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [SCHEMA_VERSION]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 惰性初始化：进程内只执行一次；失败后允许下次调用重试
 */
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = runSchemaInit().catch((err) => {
      schemaReady = null; // 失败则清空，下次重试
      throw err;
    });
  }
  return schemaReady;
}

/**
 * 执行查询（首次调用会自动建表）
 * @param {string} text - SQL 语句
 * @param {Array} params - 参数
 * @returns {Promise<QueryResult>}
 */
async function query(text, params) {
  await ensureSchema();
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

module.exports = { pool, query, ensureSchema, SCHEMA_VERSION };
