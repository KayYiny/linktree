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

  async function loadAndRender() {
    var slug = getPageSlug();
    try {
      var res = await fetch(API_BASE + '?page=' + slug);
      if (!res.ok) throw new Error('API error ' + res.status);
      cachedConfig = await res.json();
    } catch (e) {
      console.error('[data-loader] Failed to load config:', e);
      return;
    }
    renderAll(cachedConfig);
  }

  function renderAll(config) {
    renderSiteConfig(config.site);
    if (config.page && config.page.background_image) {
      document.body.style.setProperty('--bg-image', "url('" + config.page.background_image + "')");
      document.body.style.background = 'var(--bg) var(--bg-image) center/cover fixed no-repeat';
    }
    renderLinks(config.links, config.translations);
    renderPet(config.pet);
    renderGallery(config.gallery);
    loadTranslations(config.translations);
    document.dispatchEvent(new Event('configloaded'));
  }

  function renderSiteConfig(site) {
    if (!site) return;
    var profileEl = document.getElementById('profilePicture');
    if (profileEl && site.avatar) {
      profileEl.innerHTML = '<img src="' + site.avatar + '" alt="头像">';
    }
    var nameEl = document.getElementById('userName');
    if (nameEl && site.username) {
      nameEl.textContent = site.username;
    }
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

      if (link.qr_code) a.setAttribute('data-img', link.qr_code);
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
        '<span class="link-icon"><img src="' + link.icon + '" class="brand-icon" alt="' + label + '"></span>' +
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
    if (ext === 'webm' || ext === 'mp4') {
      var video = document.createElement('video');
      video.src = pet.image;
      video.alt = '宠物';
      video.id = 'petImage';
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      petEl.appendChild(video);
    } else {
      var img = document.createElement('img');
      img.src = pet.image;
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
    window.__galleryImages = gallery.map(function (img) { return { src: img.src }; });
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

  // 语言切换时重新渲染链接
  document.addEventListener('languagechange', function () {
    if (cachedConfig) renderLinks(cachedConfig.links, cachedConfig.translations);
  });
})();
