/**
 * data-loader.js — 从数据库 API 加载页面配置并动态渲染
 */
(function () {
  'use strict';

  var API_BASE = '/api/config';
  var cachedConfig = null;

  function getPageSlug() {
    var path = window.location.pathname || '/';
    if (path === '/' || path === '') return 'main';
    var seg = path.replace(/^\/+|\/+$/g, '').split('/')[0];
    return seg || 'main';
  }

  // 相对资源路径解析：数据库里存的是相对根目录的路径（如 assets/images/avatar.webp），
  // 主站（/）原样返回；子目录页面（如 /whisper、/test）需补 '../'，否则会解析成 /whisper/assets/... 404。
  function resolvePath(p) {
    if (!p) return p;
    if (p.indexOf('//') === 0 || /^[a-z][a-z0-9+.-]*:/i.test(p)) return p; // // 或 https: 等协议
    if (p.indexOf('data:') === 0) return p;
    if (p.indexOf('/') === 0) return p; // 绝对路径
    if (getPageSlug() === 'main') return p;
    return '../' + p;
  }

  function hideLoading() {
    var el = document.getElementById('siteLoading');
    if (el) el.style.display = 'none';
  }

  // HTML 转义（与 admin.js esc 一致；渲染 DB 内容进 innerHTML 前必须转义）
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 耳语页密钥校验：?k= 需命中当前轮换密钥或永久密钥，否则跳回首页
  function gateWhisper(site) {
    if (getPageSlug() !== 'whisper') return true;
    if (!site || site.key_enabled === '0') return true; // 未启用密钥则放行
    var k = new URLSearchParams(window.location.search).get('k') || '';
    if (!window.__keygen) return true; // 兜底：keygen 未加载则放行
    return window.__keygen.isValid(
      k,
      site.key_rotation || 'daily',
      site.key_salt || '',
      site.key_permanent || ''
    );
  }

  async function loadAndRender() {
    var slug = getPageSlug();
    try {
      var res = await fetch(API_BASE + '?page=' + slug);
      if (!res.ok) throw new Error('API error ' + res.status);
      cachedConfig = await res.json();
    } catch (e) {
      console.error('[data-loader] Failed to load config:', e);
      if (slug !== 'main') { window.location.replace('/'); return; } // 未知/无效页面回首页
      hideLoading(); // 主站失败也收起，避免卡在加载弹窗
      return;
    }
    if (!gateWhisper(cachedConfig.site)) {
      location.replace('../'); // 密钥无效 → 跳回首页
      return;
    }
    normalizeKeyUrl(cachedConfig.site);
    renderAll(cachedConfig);
    hideLoading();
  }

  // 用永久密钥（或非当前轮换密钥）访问时，地址栏瞬间换成当前有效轮换密钥，不暴露永久密钥
  // 仅在密钥有效（命中永久密钥）时转换；无效密钥保留原样
  function normalizeKeyUrl(site) {
    if (!site || !window.__keygen) return;
    var k = new URLSearchParams(window.location.search).get('k');
    if (!k) return;
    var rot = window.__keygen.currentKey(site.key_rotation || 'daily', site.key_salt || '');
    if (k === rot) return;
    var ok = window.__keygen.isValid(k, site.key_rotation || 'daily', site.key_salt || '', site.key_permanent || '');
    if (!ok) return;
    window.history.replaceState(null, '', window.location.pathname + '?k=' + rot + window.location.hash);
  }

  function renderAll(config) {
    if (config.page && config.page.title) document.title = config.page.title;
    renderSiteConfig(config.site);
    if (config.page && config.page.background_image) {
      var bg = resolvePath(config.page.background_image);
      document.body.style.setProperty('--bg-image', "url('" + bg + "')");
      document.body.style.background = 'var(--bg) var(--bg-image) center/cover fixed no-repeat';
    }
    renderLinks(config.links, config.translations);
    renderPet(config.pet);
    renderGallery(config.gallery);
    loadTranslations(config.translations);
    applyEggConfig(config.site);
    window.__dbConfig = config; // 供 hint-popup 等读取密钥配置
    document.dispatchEvent(new Event('configloaded'));
  }

  function renderSiteConfig(site) {
    if (!site) return;
    var profileEl = document.getElementById('profilePicture');
    if (profileEl && site.avatar) {
      profileEl.innerHTML = '<img src="' + resolvePath(site.avatar) + '" alt="头像">';
    }
    var nameEl = document.getElementById('userName');
    if (nameEl && site.username) {
      nameEl.textContent = site.username;
    }
    var footEl = document.getElementById('hashtag');
    if (footEl && site.footer) footEl.textContent = site.footer;
    var pwEl = document.getElementById('poweredBy');
    if (pwEl && site.powered) pwEl.textContent = site.powered;
  }

  // 彩蛋配置：从 site.egg_* 注入 window.__eggConfig（easter-egg.js 读取）
  function applyEggConfig(site) {
    if (!site) return;
    var target = site.egg_target || '';
    // 若跳转目标是耳语页且密钥开启，自动带上当前有效密钥（彩蛋永远能进）
    if (target.indexOf('whisper') !== -1 && site.key_enabled !== '0' && window.__keygen) {
      var k = window.__keygen.currentKey(site.key_rotation || 'daily', site.key_salt || '');
      target += (target.indexOf('?') === -1 ? '?' : '&') + 'k=' + k;
    }
    window.__eggConfig = {
      enabled: site.egg_enabled === '0' ? false : true,
      clicks: parseInt(site.egg_clicks, 10) || 5,
      timeout: parseInt(site.egg_timeout, 10) || 2000,
      target: target
    };
  }

  function renderLinks(links, translations) {
    if (!links || !links.length) return;
    var linksEl = document.getElementById('links');
    if (!linksEl) return;

    linksEl.innerHTML = '';
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var a = document.createElement('a');
      a.className = 'link' + (link.qr_code ? ' img-popup-trigger' : '');

      if (link.qr_code) a.setAttribute('data-img', resolvePath(link.qr_code));
      if (link.url) a.setAttribute('data-url', link.url);

      // 弹窗提示（优先 i18n key）
      var note = link.popup_note || '';
      if (link.note_i18n_key && translations && translations[link.note_i18n_key]) {
        var lang = (window.getLang && window.getLang()) || 'zh-CN';
        note = translations[link.note_i18n_key][lang] || translations[link.note_i18n_key]['en'] || note;
      }
      if (note) a.setAttribute('data-note', note);

      if (link.url) {
        a.href = link.url;
        a.target = '_blank';
      } else {
        a.href = 'javascript:void(0)';
      }

      a.style.animationDelay = (0.10 + i * 0.08) + 's';

      // 链接标签（优先 i18n key）
      var label = link.label || '';
      if (link.i18n_key && translations && translations[link.i18n_key]) {
        var lang2 = (window.getLang && window.getLang()) || 'zh-CN';
        label = translations[link.i18n_key][lang2] || translations[link.i18n_key]['en'] || label;
      }

      a.innerHTML =
        '<span class="link-icon"><img src="' + esc(resolvePath(link.icon)) + '" class="brand-icon" alt="' + esc(label) + '"></span>' +
        '<span class="link-label">' + esc(label) + '</span>';

      linksEl.appendChild(a);
    }
  }

  function renderPet(pet) {
    if (!pet) return;
    var petEl = document.getElementById('pet');
    if (!petEl) return;

    var bubble = document.getElementById('petBubble');
    petEl.innerHTML = '';
    if (bubble) petEl.appendChild(bubble);

    var ext = pet.image.split('.').pop().toLowerCase();
    var petSrc = resolvePath(pet.image);
    if (ext === 'webm' || ext === 'mp4') {
      var video = document.createElement('video');
      video.src = petSrc;
      video.alt = '宠物';
      video.id = 'petImage';
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      petEl.appendChild(video);
    } else {
      var img = document.createElement('img');
      img.src = petSrc;
      img.alt = '宠物';
      img.id = 'petImage';
      petEl.appendChild(img);
    }

    // 宠物语录：数据库 messages 优先（按语言存 __petMessagesByLang，i18n 语言切换时读取）；
    // 无数据库语录时回落通用 pet.default。pet.type 仅是自由填写的元数据，不参与文案选择
    window.__petMessagesByLang = pet.messages && typeof pet.messages === 'object' ? pet.messages : null;
  }

  function renderGallery(gallery) {
    if (!gallery || !gallery.length) return;
    window.__galleryImages = gallery.map(function (img) { return { src: resolvePath(img.src) }; });
  }

  function loadTranslations(translations) {
    if (!translations) return;
    window.__dbTranslations = translations;
    if (typeof window.applyI18n === 'function') window.applyI18n();
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndRender);
  } else {
    loadAndRender();
  }

  // 兜底：即使脚本/网络异常，加载弹窗最多显示 10 秒后自动收起
  setTimeout(hideLoading, 10000);

  // 语言切换时重新渲染链接；渲染完派发 linksreloaded，通知 qrcode-popup 等依赖方重新绑定
  document.addEventListener('languagechange', function () {
    if (cachedConfig) {
      renderLinks(cachedConfig.links, cachedConfig.translations);
      document.dispatchEvent(new Event('linksreloaded'));
    }
  });
})();
