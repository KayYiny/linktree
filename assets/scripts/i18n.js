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

    /* ── 语言切换按钮（不再使用，由 applyI18n 动态生成） ── */

    /* ── 宠物：默认气泡（pet.js 兜底） ── */
    'pet.default': {
      'zh-CN': [
        '揪一下~ 🐾',
        '今天心情不错！',
        '好想吃小鱼干 🐟',
        '要抱抱！🤗',
        '飞一个~ 🦋',
      ],
      'en': [
        'Poke~ 🐾',
        'Feeling good today!',
        'Want some dried fish 🐟',
        'Need hugs! 🤗',
        'Fly~ 🦋',
      ],
    },

    /* ── 隐藏入口提示弹窗 ── */
    'hint.title':
      { 'zh-CN': '🔍 发现秘密通道',
        'en':     '🔍 Secret Passage Found' },

    'hint.body':
      { 'zh-CN': '猛戳底部页脚文字五次！',
        'en':     'Rapidly tap the footer text at the bottom 5 times!' },

    'hint.detail':
      { 'zh-CN': '以非常快的速度在页脚版权文字上连续点击 5 次（比双击还要快），就能瞬间解锁隐藏空间 ✦',
        'en':     'Click the footer copyright text 5 times extremely fast — even faster than a double-click. Do it right and the hidden space will unlock instantly ✦' },

    'hint.close':
      { 'zh-CN': '我试试！',
        'en':     'Let me try!' },

    /* ── 分享入口按钮（whisper 页面） ── */
    'share.button':
      { 'zh-CN': '分享入口',
        'en':     'Share' },

    /* ── 宠物默认文案（通用，无个性化）：数据库 pet.messages 未配置时作为兜底 ── */
  };

  /* ======================== 内部状态 ======================== */
  var currentLang = 'zh-CN';
  var fallbackLang = 'en';
  var SUPPORTED_LANGS = { 'zh-CN': true, 'en': true };

  /* ======================== 核心函数 ======================== */

  /** 翻译 —— 支持普通字符串和数组
   *  优先从数据库翻译 (window.__dbTranslations) 获取，fallback 到硬编码 dict
   */
  function __(key) {
    // 1. 优先使用数据库翻译
    var dbTrans = window.__dbTranslations;
    if (dbTrans && dbTrans[key]) {
      var dbVal = dbTrans[key][currentLang];
      if (dbVal !== undefined && dbVal !== null) return dbVal;
      var dbFb = dbTrans[key][fallbackLang];
      if (dbFb !== undefined && dbFb !== null) return dbFb;
    }
    // 2. fallback 到硬编码 dict
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

  /** 更新 window.__petMessages 为当前语言的版本
   *  优先取数据库宠物语录（__petMessagesByLang），否则回落通用 pet.default */
  function updatePetMessages() {
    var byLang = window.__petMessagesByLang;
    if (byLang && typeof byLang === 'object') {
      window.__petMessages = byLang[currentLang] || byLang[fallbackLang] || [];
      return;
    }
    window.__petMessages = __('pet.default');
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
