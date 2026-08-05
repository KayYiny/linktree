/**
 * data-loader.js — 从数据库 API 加载页面配置并动态渲染
 */
(function () {
  'use strict';

  var API_BASE = '/api/config';
  var cachedConfig = null;

  function getPageSlug() {
    var path = window.location.pathname;
    if (path.indexOf('/whisper') !== -1) return 'whisper';
    return 'main';
  }

  // 相对资源路径解析：数据库里存的是相对根目录的路径（如 assets/images/avatar.webp），
  // 在耳语页等子目录页面需补 '../'，否则会解析成 /whisper/assets/... 404。
  function resolvePath(p) {
    if (!p) return p;
    if (p.indexOf('//') === 0 || /^[a-z][a-z0-9+.-]*:/i.test(p)) return p; // // 或 https: 等协议
    if (p.indexOf('data:') === 0) return p;
    if (p.indexOf('/') === 0) return p; // 绝对路径
    if (getPageSlug() === 'whisper') return '../' + p;
    return p;
  }

  function hideLoading() {
    var el = document.getElementById('siteLoading');
    if (el) el.style.display = 'none';
  }

  async function loadAndRender() {
    var slug = getPageSlug();
    try {
      var res = await fetch(API_BASE + '?page=' + slug);
      if (!res.ok) throw new Error('API error ' + res.status);
      cachedConfig = await res.json();
    } catch (e) {
      console.error('[data-loader] Failed to load config:', e);
      hideLoading(); // 失败也收起，避免卡在加载弹窗
      return;
    }
    renderAll(cachedConfig);
    hideLoading();
  }

  function renderAll(config) {
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
  }

  // 彩蛋配置：从 site.egg_* 注入 window.__eggConfig（easter-egg.js 读取）
  function applyEggConfig(site) {
    if (!site) return;
    window.__eggConfig = {
      enabled: site.egg_enabled === '0' ? false : true,
      clicks: parseInt(site.egg_clicks, 10) || 5,
      timeout: parseInt(site.egg_timeout, 10) || 2000,
      target: site.egg_target || 'whisper/'
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
        '<span class="link-icon"><img src="' + resolvePath(link.icon) + '" class="brand-icon" alt="' + label + '"></span>' +
        '<span class="link-label">' + label + '</span>';

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

    if (pet.type) window.__petMessagesKey = 'pet.' + pet.type;

    if (pet.messages) {
      window.__petMessages = null;
      for (var lang in pet.messages) {
        if (pet.messages.hasOwnProperty(lang)) {
          window.__petMessages = pet.messages[lang];
          break;
        }
      }
    }
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

  // 语言切换时重新渲染链接
  document.addEventListener('languagechange', function () {
    if (cachedConfig) renderLinks(cachedConfig.links, cachedConfig.translations);
  });
})();
