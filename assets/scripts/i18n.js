/**
 * i18n — 轻量多语言引擎
 * 无框架依赖，支持 data-i18n / data-i18n-note 绑定 & 宠物消息
 * 默认简体中文，可通过语言切换按钮切换至英文
 *
 * 编辑翻译时，zh-CN / en 上下紧挨，方便对照修改。
 */
(function () {
  'use strict';

  /* ======================== 翻译数据 ========================
     每条目格式： 'key': { 'zh-CN': '中文', 'en': 'English' }
     数组条目：  'key': { 'zh-CN': [...], 'en': [...] }
     ========================================================== */
  var dict = {

    /* ── 页面标题 ── */
    'page.title.main':
      { 'zh-CN': '火林 · 这是我的名片',
        'en':     'HuoLin · My Card' },

    'page.title.whisper':
      { 'zh-CN': '火林 · 这是我的秘密 ✦',
        'en':     'HuoLin · My Secret ✦' },

    /* ── Album 按钮标签 ── */
    'album.label':
      { 'zh-CN': '相册',
        'en':     'Album' },

    /* ── 品牌标签 ── */
    'brand.qq':
      { 'zh-CN': 'QQ',
        'en':     'QQ' },

    'brand.wechat':
      { 'zh-CN': '微信',
        'en':     'WeChat' },

    'brand.bilibili':
      { 'zh-CN': '哔哩哔哩',
        'en':     'Bilibili' },

    'brand.tiktok':
      { 'zh-CN': '抖音',
        'en':     'TikTok' },

    'brand.xiaohongshu':
      { 'zh-CN': '小红书',
        'en':     'RED' },

    'brand.x':
      { 'zh-CN': 'X（推特）',
        'en':     'X (Twitter)' },

    'brand.instagram':
      { 'zh-CN': 'Instagram',
        'en':     'Instagram' },

    'brand.bluesky':
      { 'zh-CN': '蓝天',
        'en':     'Bluesky' },

    /* ── 图库 ── */
    'gallery.title':
      { 'zh-CN': '📷 相册',
        'en':     '📷 Album' },

    'gallery.prev':
      { 'zh-CN': '上一页',
        'en':     'Prev' },

    'gallery.next':
      { 'zh-CN': '下一页',
        'en':     'Next' },

    'gallery.back':
      { 'zh-CN': '返回',
        'en':     'Back' },

    /* ── QR 弹窗 ── */
    'popup.visit':
      { 'zh-CN': '访问',
        'en':     'Visit' },

    'popup.note.visit':
      { 'zh-CN': '点击上方按钮直接访问',
        'en':     'Click the button above to visit' },

    'popup.note.wechat':
      { 'zh-CN': '使用微信长按识别',
        'en':     'Long press to scan on WeChat' },

    'popup.loading':
      { 'zh-CN': '二维码加载中…',
        'en':     'QR code loading…' },

    'popup.loadFailed':
      { 'zh-CN': '二维码加载失败',
        'en':     'QR code failed to load' },

    /* ── 语言切换按钮（不再使用，由 applyI18n 动态生成） ── */

    /* ── 宠物：默认气泡（pet.js 兜底） ── */
    'pet.default': {
      'zh-CN': [
        '揪一下~ 🐾',
        '今天心情不错！',
        '咕噜咕噜~',
        '戳我干嘛呀？',
        '好想吃小鱼干 🐟',
        '看我跳一跳！',
        '晚安世界 🌙',
        '要抱抱！🤗',
        '嘿嘿，又被你抓到了',
        '喜欢你的主页 ✨',
        '我是小跟屁虫~',
        '好闲呀… zzz',
        '你今天真好看 💕',
        '再戳就生气了！哼！',
        '飞一个~ 🦋',
        '发现野生大佬！',
        '摇尾巴 ing 🌀',
        '待机中，请稍候 ⏳',
      ],
      'en': [
        'Poke~ 🐾',
        'Feeling good today!',
        'Purr purr~',
        "Why're you poking me?",
        'Want some dried fish 🐟',
        'Watch me jump!',
        'Good night world 🌙',
        'Need hugs! 🤗',
        'Hehe, you caught me',
        'Love your page ✨',
        "I'm your little shadow~",
        'So bored… zzz',
        'You look great today 💕',
        'One more poke and I will be mad! Hmph!',
        'Fly~ 🦋',
        'Spotted a wild big shot!',
        'Wagging tail ing 🌀',
        'Standing by, please wait ⏳',
      ],
    },

    /* ── 宠物：猫猫页面（index.html） ── */
    'pet.cat': {
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

    /* ── 隐藏入口提示弹窗 ── */
    'hint.title':
      { 'zh-CN': '🔍 发现秘密通道',
        'en':     '🔍 Secret Passage Found' },

    'hint.body':
      { 'zh-CN': '猛戳底部「© 2026 HuoLin」五次！',
        'en':     'Rapidly tap 「© 2026 HuoLin」at the bottom 5 times!' },

    'hint.detail':
      { 'zh-CN': '以非常快的速度在版权文字上连续点击 5 次（比双击还要快），就能瞬间解锁隐藏空间 ✦',
        'en':     'Click the copyright text 5 times extremely fast — even faster than a double-click. Do it right and the hidden space will unlock instantly ✦' },

    'hint.close':
      { 'zh-CN': '我试试！',
        'en':     'Let me try!' },

    /* ── 分享入口按钮（whisper 页面） ── */
    'share.button':
      { 'zh-CN': '分享入口',
        'en':     'Share' },

    /* ── 宠物：狗狗页面（whisper/index.html） ── */
    'pet.dog': {
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

  /* ======================== 内部状态 ======================== */
  var currentLang = 'zh-CN';
  var fallbackLang = 'en';
  var SUPPORTED_LANGS = { 'zh-CN': true, 'en': true };

  /* ======================== 核心函数 ======================== */

  /** 翻译 —— 支持普通字符串和数组 */
  function __(key) {
    var entry = dict[key];
    if (!entry) return key;
    var val = entry[currentLang];
    if (val !== undefined && val !== null) return val;
    // fallback 兜底
    var fb = entry[fallbackLang];
    return fb !== undefined && fb !== null ? fb : key;
  }

  /** 获取当前语言代码 */
  function getLang() {
    return currentLang;
  }

  /** 切换语言并刷新页面 */
  function setLanguage(lang) {
    if (lang === currentLang) return;
    if (!SUPPORTED_LANGS[lang]) return;
    currentLang = lang;
    try { localStorage.setItem('i18n_lang', lang); } catch (e) { /* ignore */ }
    applyI18n();
    // 触发自定义事件，供 gallery/pet 等监听
    var evt = document.createEvent('Event');
    evt.initEvent('languagechange', true, false);
    document.dispatchEvent(evt);
  }

  /** 刷新所有 data-i18n 绑定 */
  function applyI18n() {
    // ---- <title> ----
    var titleEl = document.querySelector('title');
    if (titleEl && titleEl.hasAttribute('data-i18n')) {
      titleEl.textContent = __(titleEl.getAttribute('data-i18n'));
    }

    // ---- data-i18n 元素（文本替换） ----
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      if (!key) continue;
      if (el.tagName === 'TITLE') continue;
      el.textContent = __(key);
    }

    // ---- data-i18n-note → 同步到 data-note ----
    var noteNodes = document.querySelectorAll('[data-i18n-note]');
    for (var j = 0; j < noteNodes.length; j++) {
      var nEl = noteNodes[j];
      var nKey = nEl.getAttribute('data-i18n-note');
      if (nKey) {
        nEl.setAttribute('data-note', __(nKey));
      }
    }

    // ---- 语言切换按钮：当前语言居左 ──
    var switchBtn = document.getElementById('langSwitch');
    if (switchBtn) {
      switchBtn.textContent = currentLang === 'zh-CN' ? '中文 / EN' : 'EN / 中文';
    }

    // ---- 宠物消息：更新 window.__petMessages ----
    updatePetMessages();
  }

  /** 更新 window.__petMessages 为当前语言的版本 */
  function updatePetMessages() {
    // 后台自定义台词优先（site-data.js 注入 window.__petMessagesCustom）
    if (window.__petMessagesCustom) {
      var arr = window.__petMessagesCustom[currentLang] ||
        window.__petMessagesCustom['en'] ||
        window.__petMessagesCustom['zh-CN'];
      if (Array.isArray(arr) && arr.length) {
        window.__petMessages = arr;
        return;
      }
    }
    var key = window.__petMessagesKey || 'pet.default';
    var msgs = __(key);
    if (Array.isArray(msgs)) {
      window.__petMessages = msgs;
    }
  }

  /** 检测初始语言 */
  function detectLanguage() {
    // 1. localStorage 优先
    try {
      var saved = localStorage.getItem('i18n_lang');
      if (saved) return saved;
    } catch (e) { /* ignore */ }

    // 2. 浏览器语言
    var navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (navLang.startsWith('en')) return 'en';

    // 3. 默认中文
    return 'zh-CN';
  }

  /* ======================== 初始化 ======================== */
  currentLang = detectLanguage();
  applyI18n();

  // 暴露到全局
  window.__ = __;
  window.getLang = getLang;
  window.setLanguage = setLanguage;
  window.applyI18n = applyI18n;

})();
