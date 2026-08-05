/**
 * migrate.js — 数据库迁移脚本
 * 创建表结构 + 插入初始数据（从当前硬编码中提取）
 *
 * 用法：DB_HOST=xxx DB_PORT=5432 DB_NAME=linktree DB_USER=xxx DB_PASSWORD=xxx node scripts/migrate.js
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ==================== 建表 ====================

    await client.query(`
      CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(200),
        background_image TEXT,
        is_active BOOLEAN DEFAULT true,
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

    // ==================== 插入初始数据 ====================

    // 页面
    await client.query(`
      INSERT INTO pages (slug, title, background_image, sort_order)
      VALUES
        ('main', '火林 · 这是我的名片', 'assets/images/bg.jpg', 1),
        ('whisper', '火林 · 这是我的秘密 ✦', 'assets/images/Puppy_Play_Pride_Flag.svg', 2)
      ON CONFLICT (slug) DO NOTHING;
    `);

    // 站点配置
    const siteConfigs = [
      ['avatar', 'assets/images/avatar.webp'],
      ['username', 'HUOLIN'],
      ['favicon', 'assets/images/favicon.svg'],
    ];
    for (const [key, value] of siteConfigs) {
      await client.query(
        `INSERT INTO site_config (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );
    }

    // 获取页面 ID
    const { rows: pages } = await client.query('SELECT id, slug FROM pages');
    const pageMap = {};
    for (const p of pages) pageMap[p.slug] = p.id;

    // ---- 主页链接 ----
    const mainLinks = [
      { label: 'QQ', icon: 'assets/icons/qq.svg', qr: 'assets/qrcodes/qq.jpg', url: 'https://qm.qq.com/q/KbsdxQ17W0', note: '点击上方按钮直接访问' },
      { label: 'WeChat', icon: 'assets/icons/wechat.svg', qr: 'assets/qrcodes/wechat.jpg', url: null, note: '使用微信长按识别' },
      { label: 'Bilibili', icon: 'assets/icons/bilibili.svg', qr: 'assets/qrcodes/bilibili.jpg', url: 'http://space.bilibili.com/430552995', note: '点击上方按钮直接访问' },
      { label: 'TikTok', icon: 'assets/icons/tiktok.svg', qr: 'assets/qrcodes/douyin.jpg', url: 'https://www.douyin.com/user/MS4wLjABAAAAYuXxtdsArkxgZpoGgQHE1Z2e5mvPeP4UCSezKlzUiALP4vyL0yqLi0vjneoLi5wz', note: '点击上方按钮直接访问' },
      { label: 'RED', icon: 'assets/icons/xiaohongshu.svg', qr: 'assets/qrcodes/xiaohongshu.jpg', url: 'http://xhslink.com/m/3qScrydPm6Z', note: '点击上方按钮直接访问' },
    ];
    for (let i = 0; i < mainLinks.length; i++) {
      const l = mainLinks[i];
      await client.query(
        `INSERT INTO links (page_id, label, url, icon, qr_code, popup_note, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [pageMap['main'], l.label, l.url, l.icon, l.qr, l.note, i]
      );
    }

    // ---- whisper 链接 ----
    const whisperLinks = [
      { label: 'X (Twitter)', icon: 'assets/icons/x.svg', url: 'https://x.com/PuppyHuoLin' },
      { label: 'Instagram', icon: 'assets/icons/instagram.svg', url: 'https://www.instagram.com/puppyhuolin' },
      { label: 'Bluesky', icon: 'assets/icons/bluesky.svg', url: 'https://bsky.app/profile/slave.puppyhuolin.com' },
    ];
    for (let i = 0; i < whisperLinks.length; i++) {
      const l = whisperLinks[i];
      await client.query(
        `INSERT INTO links (page_id, label, url, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [pageMap['whisper'], l.label, l.url, l.icon, i]
      );
    }

    // ---- 主页相册 ----
    const mainGallery = [
      'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94ce4ba9.png',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94d412a4.png',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94f43386.png',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3fe951955ae.png',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3fe9528ce69.png',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3fe95313dc8.png',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3fe953c3b1c.png',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3fe953c6082.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3fe95454f88.jpeg',
    ];
    for (let i = 0; i < mainGallery.length; i++) {
      await client.query(
        'INSERT INTO gallery_images (page_id, src, sort_order) VALUES ($1, $2, $3)',
        [pageMap['main'], mainGallery[i], i]
      );
    }

    // ---- whisper 相册 ----
    const whisperGallery = [
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaea0b40a.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaea1e097.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaea14236.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaeb27737.jpg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaeb4363d.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaeb48f88.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaec29530.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaec4d018.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaecaa10f.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaed3901a.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaed6d08b.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaeda74ca.jpg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaee552e8.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaeea84d8.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaee9e885.jpg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaef528ed.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaef981e7.jpg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaefd8b6e.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaf05a9dc.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feaf09c8c7.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3a12cc4.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb39f272d.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3b01490.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3b40ee0.jpg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3b447c9.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3c408dc.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3c84e71.jpg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3d143f6.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3d42142.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3daee7b.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb3c2382b.jpeg',
      'https://lsky.puppyis.cool/i/2026/06/27/6a3feb39eb878.jpeg',
    ];
    for (let i = 0; i < whisperGallery.length; i++) {
      await client.query(
        'INSERT INTO gallery_images (page_id, src, sort_order) VALUES ($1, $2, $3)',
        [pageMap['whisper'], whisperGallery[i], i]
      );
    }

    // ---- 宠物配置 ----
    await client.query(
      `INSERT INTO pet_config (page_id, pet_image, pet_type)
       VALUES ($1, $2, $3), ($4, $5, $6)
       ON CONFLICT (page_id) DO NOTHING`,
      [pageMap['main'], 'assets/pets/pet.webm', 'cat', pageMap['whisper'], 'assets/pets/pet1.webp', 'dog']
    );

    // 获取宠物配置 ID
    const { rows: pets } = await client.query('SELECT id, page_id FROM pet_config');
    const petMap = {};
    for (const p of pets) petMap[p.page_id] = p.id;

    // ---- 宠物语录 ----
    const petMsgs = {
      'cat': {
        'zh-CN': [
          '嗷呜～ 你吵醒本王午睡了…',
          '看什么看，没见过帅老虎吗？🐯',
          '别戳了！再戳我咬你哦… 呜…',
          '摸我脑袋？好吧，允许你摸三下，不能再多！',
          '我的条纹是不是特别好看？嘻嘻~',
          '今天阳光不错，趴在这儿不想动… zzz',
          '想吃鱼… 最好是烤的那种 🐟',
          '吼——（其实是打哈欠）',
          '你手机里是不是藏了小鱼干？',
          '尾巴给你玩一下，但别扯疼我！',
          '我是大猫猫，不是大狗狗！哼～',
          '蹭蹭你～ 嗯… 你身上有我的味道了～',
          '这座小站是我的领地！你也是我的！',
          '发现一只野生大佬！嗷~',
          '本王飞一个～ 🦋（其实根本飞不起来）',
          '饿了… 快投喂本王！不然我生气了！',
          '你喜欢我吗？喜欢的话… 允许你当我的铲屎官…',
        ],
        'en': [
          'Ow~ You woke me from my nap…',
          "What are you looking at? Never seen a cool tiger before? 🐯",
          'Stop poking! I will bite you… hmph…',
          'Pet my head? Fine, three pets. No more!',
          'Are my stripes gorgeous? Hehe~',
          'Nice sunshine. Gonna lie here… zzz',
          'Want fish… grilled would be nice 🐟',
          'Roar—— (actually just yawning)',
          'Are you hiding dried fish in your phone?',
          'You can play with my tail, but do not pull it!',
          "I'm a big cat, not a big dog! Hmph~",
          'Nuzzling you~ You smell like me now~',
          'This site is MY territory! And you are mine too!',
          'Spotted a wild boss! Ow~',
          "I can fly~ 🦋 (OK I can't actually fly)",
          "Hungry… Feed me NOW! Or I'll get mad!",
          'Do you like me? If so… I will let you be my servant…',
        ],
      },
      'dog': {
        'zh-CN': [
          '主人… 你终于来啦🥺 ',
          '汪！今天主人有没有想我？',
          '摸摸头～ 再多摸摸嘛～ 我会乖乖的…',
          '主人累了吗？我可以给你暖脚哦 🐾',
          '请尽情使唤吧… 我是可爱小狗…',
          '嘿嘿，又被你抓到啦～ 好幸福…',
          '你的手指好温暖… 再摸摸我好不好…',
          '想一直被主人拴着，哪里都不去…',
          '主人～ 看看我嘛，我比电视好看一万倍！✨',
          '呜… 请多戳戳我… 你的触碰让我开心到尾巴都摇断了…',
          '只属于你的乖狗狗，每天都会摇尾巴等你回来…',
          '请让我钻进你怀里… 那里是最安全的小窝…',
          '主人身上有我的味道，你是不是同意永远不离开我？',
          '我愿意被主人揉乱毛毛，然后说"好乖"… 呜…',
          '想变成主人口袋里的小狗，24小时都能被你偷摸…',
          '主人，今夜请好好抱着我睡觉… 我会用肚子贴着你…',
        ],
        'en': [
          'Master… you are finally here🥺',
          'Woof! Did you miss me today?',
          'Pat my head~ A little more~ I will be good…',
          'Are you tired? I can warm your feet 🐾',
          'Order me around… I am your good little dog…',
          'Hehe, you caught me again~ So happy…',
          'Your fingers are so warm… pet me more…',
          'I want to stay with you forever, never leave…',
          'Master~ Look at me! I am way better than TV! ✨',
          'Woo… poke me more… your touch makes my tail wag nonstop…',
          'Your one and only good dog, wagging my tail waiting for you…',
          'Let me curl up in your arms… that is the safest nest…',
          'I smell like you now… does that mean you will never leave me?',
          "I would let you mess up my fur and say 'good boy'… woo…",
          'I wanna be a pocket dog, sneaked pets 24/7…',
          'Master, hold me tight tonight… I will press my belly against you…',
        ],
      },
    };

    for (const [petType, langs] of Object.entries(petMsgs)) {
      const petConfigId = petMap[pageMap[petType === 'cat' ? 'main' : 'whisper']];
      if (!petConfigId) continue;
      for (const [lang, msgs] of Object.entries(langs)) {
        await client.query(
          `INSERT INTO pet_messages (pet_config_id, language, messages)
           VALUES ($1, $2, $3)
           ON CONFLICT (pet_config_id, language) DO UPDATE SET messages = $3`,
          [petConfigId, lang, JSON.stringify(msgs)]
        );
      }
    }

    // ---- 翻译文本 ----
    const translations = [
      ['page.title.main', 'zh-CN', '火林 · 这是我的名片'],
      ['page.title.main', 'en', 'HuoLin · My Card'],
      ['page.title.whisper', 'zh-CN', '火林 · 这是我的秘密 ✦'],
      ['page.title.whisper', 'en', 'HuoLin · My Secret ✦'],
      ['album.label', 'zh-CN', '相册'],
      ['album.label', 'en', 'Album'],
      ['brand.qq', 'zh-CN', 'QQ'],
      ['brand.qq', 'en', 'QQ'],
      ['brand.wechat', 'zh-CN', '微信'],
      ['brand.wechat', 'en', 'WeChat'],
      ['brand.bilibili', 'zh-CN', '哔哩哔哩'],
      ['brand.bilibili', 'en', 'Bilibili'],
      ['brand.tiktok', 'zh-CN', '抖音'],
      ['brand.tiktok', 'en', 'TikTok'],
      ['brand.xiaohongshu', 'zh-CN', '小红书'],
      ['brand.xiaohongshu', 'en', 'RED'],
      ['brand.x', 'zh-CN', 'X（推特）'],
      ['brand.x', 'en', 'X (Twitter)'],
      ['brand.instagram', 'zh-CN', 'Instagram'],
      ['brand.instagram', 'en', 'Instagram'],
      ['brand.bluesky', 'zh-CN', '蓝天'],
      ['brand.bluesky', 'en', 'Bluesky'],
      ['gallery.title', 'zh-CN', '📷 相册'],
      ['gallery.title', 'en', '📷 Album'],
      ['gallery.prev', 'zh-CN', '上一页'],
      ['gallery.prev', 'en', 'Prev'],
      ['gallery.next', 'zh-CN', '下一页'],
      ['gallery.next', 'en', 'Next'],
      ['gallery.back', 'zh-CN', '返回'],
      ['gallery.back', 'en', 'Back'],
      ['popup.visit', 'zh-CN', '访问'],
      ['popup.visit', 'en', 'Visit'],
      ['popup.note.visit', 'zh-CN', '点击上方按钮直接访问'],
      ['popup.note.visit', 'en', 'Click the button above to visit'],
      ['popup.note.wechat', 'zh-CN', '使用微信长按识别'],
      ['popup.note.wechat', 'en', 'Long press to scan on WeChat'],
      ['share.button', 'zh-CN', '分享入口'],
      ['share.button', 'en', 'Share'],
      ['hint.title', 'zh-CN', '🔍 发现秘密通道'],
      ['hint.title', 'en', '🔍 Secret Passage Found'],
      ['hint.body', 'zh-CN', '猛戳底部「© 2026 HuoLin」五次！'],
      ['hint.body', 'en', 'Rapidly tap 「© 2026 HuoLin」at the bottom 5 times!'],
      ['hint.detail', 'zh-CN', '以非常快的速度在版权文字上连续点击 5 次（比双击还要快），就能瞬间解锁隐藏空间 ✦'],
      ['hint.detail', 'en', 'Click the copyright text 5 times extremely fast — even faster than a double-click. Do it right and the hidden space will unlock instantly ✦'],
      ['hint.close', 'zh-CN', '我试试！'],
      ['hint.close', 'en', 'Let me try!'],
    ];

    for (const [key, lang, value] of translations) {
      await client.query(
        `INSERT INTO translations (key, language, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (key, language) DO UPDATE SET value = $3`,
        [key, lang, value]
      );
    }

    // ---- 默认管理员（密码：admin） ----
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin';
    const hash = await bcrypt.hash(defaultPassword, 10);
    await client.query(
      `INSERT INTO admin_users (username, password_hash)
       VALUES ('admin', $1)
       ON CONFLICT (username) DO UPDATE SET password_hash = $1`,
      [hash]
    );

    await client.query('COMMIT');
    console.log('✅ 迁移完成！所有表已创建，初始数据已插入。');
    console.log(`   默认管理员：admin / ${defaultPassword}`);
    console.log('   请尽快修改管理员密码！');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移失败：', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
