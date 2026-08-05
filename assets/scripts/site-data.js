/**
 * site-data — 站点配置加载与应用（主页 / 耳语页共用）
 *
 * 从 /api/config 拉取最新配置，应用：
 *   - 站点信息：名字 / 头像 / logo / 背景 / 标题 / 版权 / 相册·分享开关
 *   - 宠物：开关 / 资源 / 类型 / 自定义台词
 *   - 彩蛋：开关 / 点击次数 / 间隔 / 跳转目标
 *   - 链接（含 enabled 开关）与相册（含 enabled 开关）
 *   - 将完整配置挂到 window.__siteConfig，供 secret / hint-popup 等使用
 *
 * 主页优先用默认值立即渲染（避免加载空窗），配置就绪后无缝替换；
 * 耳语页正文在校验通过前隐藏，配置就绪后渲染。
 * 渲染完成后派发 'site-config-ready' 事件。
 */
(function () {
  'use strict';

  // 当前页面：main / whisper
  var PAGE = /whisper/.test(window.location.pathname) ? 'whisper' : 'main';

  // ---- 内置默认数据（主页静态回退，与改造前硬编码一致） ----
  var DEFAULT_LINKS = [
    { label: 'QQ', labelKey: 'brand.qq', icon: 'assets/icons/qq.svg', url: 'https://qm.qq.com/q/KbsdxQ17W0', qr: 'assets/qrcodes/qq.jpg', note: '点击上方按钮直接访问', noteKey: 'popup.note.visit' },
    { label: 'WeChat', labelKey: 'brand.wechat', icon: 'assets/icons/wechat.svg', qr: 'assets/qrcodes/wechat.jpg', note: '使用微信长按识别', noteKey: 'popup.note.wechat' },
    { label: 'Bilibili', labelKey: 'brand.bilibili', icon: 'assets/icons/bilibili.svg', url: 'http://space.bilibili.com/430552995', qr: 'assets/qrcodes/bilibili.jpg', note: '点击上方按钮直接访问', noteKey: 'popup.note.visit' },
    { label: 'TikTok', labelKey: 'brand.tiktok', icon: 'assets/icons/tiktok.svg', url: 'https://www.douyin.com/user/MS4wLjABAAAAYuXxtdsArkxgZpoGgQHE1Z2e5mvPeP4UCSezKlzUiALP4vyL0yqLi0vjneoLi5wz', qr: 'assets/qrcodes/douyin.jpg', note: '点击上方按钮直接访问', noteKey: 'popup.note.visit' },
    { label: 'RED', labelKey: 'brand.xiaohongshu', icon: 'assets/icons/xiaohongshu.svg', url: 'http://xhslink.com/m/3qScrydPm6Z', qr: 'assets/qrcodes/xiaohongshu.jpg', note: '点击上方按钮直接访问', noteKey: 'popup.note.visit' },
  ];

  var DEFAULT_GALLERY = [
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94ce4ba9.png' },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94d412a4.png' },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe94f43386.png' },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe951955ae.png' },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe9528ce69.png' },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe95313dc8.png' },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe953c3b1c.png' },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe953c6082.jpeg' },
    { src: 'https://lsky.puppyis.cool/i/2026/06/27/6a3fe95454f88.jpeg' },
  ];

  function $(sel) { return document.querySelector(sel); }

  function isImagePath(str) {
    return /\.(svg|png|jpe?g|webp|gif|ico|avif)([?#].*)?$/i.test(String(str).trim());
  }

  /** 仅保留 enabled !== false 的条目 */
  function enabledOnly(arr) {
    return (arr || []).filter(function (x) { return x && x.enabled !== false; });
  }

  /** 资源路径解析：耳语页在子目录，相对路径需加 ../（绝对/外链原样返回） */
  function resolvePath(p) {
    if (!p) return p;
    if (/^(https?:|data:|blob:)/i.test(p)) return p;
    if (p.charAt(0) === '/') return p;
    if (PAGE === 'whisper' && p.indexOf('../') !== 0) return '../' + p;
    return p;
  }

  // ---- 渲染链接 ----
  function renderLinks(links) {
    var container = document.getElementById('links');
    if (!container) return;
    container.innerHTML = '';

    for (var i = 0; i < links.length; i++) {
      var link = links[i] || {};

      var a = document.createElement('a');
      a.className = 'link img-popup-trigger';
      if (link.qr) a.setAttribute('data-img', resolvePath(link.qr));
      if (link.url) a.setAttribute('data-url', link.url);
      // 有跳转链接但没有二维码时，直接在新标签页打开
      if (link.url && !link.qr) {
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener';
      }
      if (link.note) a.setAttribute('data-note', link.note);
      if (link.noteKey) a.setAttribute('data-i18n-note', link.noteKey);

      var iconSpan = document.createElement('span');
      iconSpan.className = 'link-icon';
      if (link.icon) {
        if (isImagePath(link.icon)) {
          var img = document.createElement('img');
          img.src = resolvePath(link.icon);
          img.className = 'brand-icon';
          img.alt = link.label || '';
          iconSpan.appendChild(img);
        } else {
          var fa = document.createElement('i');
          fa.className = link.icon;
          iconSpan.appendChild(fa);
        }
      }
      a.appendChild(iconSpan);

      var labelSpan = document.createElement('span');
      labelSpan.className = 'link-label';
      if (link.labelKey) labelSpan.setAttribute('data-i18n', link.labelKey);
      labelSpan.textContent = link.label || '';
      a.appendChild(labelSpan);

      a.style.animationDelay = (0.10 + i * 0.08) + 's';
      container.appendChild(a);
    }
  }

  // ---- 站点信息 + 模块开关 ----
  function applySite(site) {
    if (!site) return;
    var nameEl = $('#userName');
    if (nameEl && site.name) nameEl.textContent = site.name;
    var av = $('#profilePicture img');
    if (av && site.avatar) av.src = resolvePath(site.avatar);
    var fav = document.querySelector('link[rel="icon"]');
    if (fav && site.favicon) fav.href = resolvePath(site.favicon);
    if (site.background) {
      document.body.style.setProperty('--bg-image', 'url(' + resolvePath(site.background) + ')');
    }
    var ht = $('#hashtag');
    if (ht && site.copyright) ht.textContent = site.copyright;

    var albumBtn = document.querySelector('.album-btn.gallery-trigger');
    if (albumBtn) albumBtn.style.display = site.showAlbum === false ? 'none' : '';
    var shareBtn = document.getElementById(PAGE === 'whisper' ? 'shareLinkBtn' : 'shareMainBtn');
    if (shareBtn) shareBtn.style.display = site.showShare === false ? 'none' : '';
  }

  // ---- 标题（按语言，覆盖 i18n 默认值） ----
  function applyTitles() {
    var cfg = window.__siteConfig || {};
    var isEn = window.getLang ? window.getLang() === 'en' : false;
    if (PAGE === 'whisper') {
      var w = cfg.whisper || {};
      document.title = isEn ? (w.titleEn || '') : (w.titleZh || '');
    } else {
      var s = cfg.site || {};
      document.title = isEn ? (s.titleEn || '') : (s.titleZh || '');
    }
  }

  // ---- 宠物：开关 / 资源 / 类型 / 台词 ----
  function applyPet(pet) {
    if (!pet) return;
    var petWrap = $('#pet');
    if (!petWrap) return;
    if (pet.enabled === false) { petWrap.style.display = 'none'; return; }
    petWrap.style.display = '';

    var zh = pet.messages && pet.messages['zh-CN'];
    var en = pet.messages && pet.messages.en;
    if (Array.isArray(zh) && zh.length && Array.isArray(en) && en.length) {
      window.__petMessagesCustom = { 'zh-CN': zh, en: en };
    }

    if (pet.src) {
      var old = document.getElementById('petImage');
      var newEl;
      if (pet.type === 'video') {
        newEl = document.createElement('video');
        newEl.src = resolvePath(pet.src);
        newEl.autoplay = true;
        newEl.loop = true;
        newEl.muted = true;
        newEl.playsInline = true;
      } else {
        newEl = document.createElement('img');
        newEl.src = resolvePath(pet.src);
      }
      newEl.id = 'petImage';
      newEl.alt = '宠物';
      if (old && old.parentNode) old.parentNode.replaceChild(newEl, old);
    }
  }

  // ---- 彩蛋 ----
  function applyEgg(egg) {
    var e = egg || {};
    var isWhisper = PAGE === 'whisper';
    window.__eggConfig = {
      enabled: e.enabled !== false,
      clicks: Number(e.clicks) || 5,
      timeout: Number(e.timeout) || 200,
      action: function () {
        if (e.enabled === false) return;
        if (isWhisper) { window.location.href = '../'; return; }
        var target = e.target || 'whisper/';
        var secret = window.__getDailySecret ? window.__getDailySecret() : '';
        var sep = target.indexOf('?') >= 0 ? '&' : '?';
        window.location.href = target + sep + 'k=' + secret;
      }
    };
  }

  // ---- 相册数据（仅保留启用项） ----
  function setGallery(gallery) {
    window.__galleryImages = enabledOnly(gallery);
  }

  function loadAndRender() {
    var isMain = PAGE === 'main';

    // 主页：先用默认值立即渲染（避免加载空窗）
    if (isMain) {
      renderLinks(DEFAULT_LINKS);
      setGallery(DEFAULT_GALLERY);
      if (window.applyI18n) window.applyI18n();
    }

    fetch('/api/config', { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('config request failed: ' + res.status);
        return res.json();
      })
      .then(function (cfg) {
        if (!cfg) return;
        window.__siteConfig = cfg;

        var links, gallery, pet, egg, siteCfg;
        if (PAGE === 'whisper') {
          var w = cfg.whisper || {};
          links = w.links; gallery = w.gallery; pet = w.pet; egg = cfg.egg;
          // 复制 site，背景改用耳语页自己的
          siteCfg = {};
          if (cfg.site) for (var k in cfg.site) if (cfg.site.hasOwnProperty(k)) siteCfg[k] = cfg.site[k];
          if (w.background) siteCfg.background = w.background;
        } else {
          links = cfg.links; gallery = cfg.gallery; pet = cfg.pet; egg = cfg.egg;
          siteCfg = cfg.site || {};
        }

        applyEgg(egg);
        applyPet(pet);
        applySite(siteCfg);
        applyTitles();

        // 主页若与默认值一致则跳过重绘，避免重复入场动画
        var sameAsDefault = isMain &&
          JSON.stringify(links || []) === JSON.stringify(DEFAULT_LINKS) &&
          JSON.stringify(gallery || []) === JSON.stringify(DEFAULT_GALLERY);
        if (!sameAsDefault) {
          renderLinks(enabledOnly(links));
          setGallery(gallery);
        }

        if (window.applyI18n) window.applyI18n();
        applyTitles();
        window.dispatchEvent(new CustomEvent('site-config-ready'));
      })
      .catch(function () {
        // 静态/离线：主页保持默认值；耳语页无配置可用
        if (!isMain) {
          window.__siteConfig = {};
          window.dispatchEvent(new CustomEvent('site-config-ready'));
        }
      });
  }

  // 语言切换时刷新标题
  document.addEventListener('languagechange', function () {
    applyTitles();
  });

  loadAndRender();
})();
