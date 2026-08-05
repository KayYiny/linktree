/**
 * data-loader.js — 从数据库 API 加载页面配置并动态渲染
 * 页面加载时调用 /api/config?page=xxx，用返回的 JSON 构建 DOM
 */
(function () {
  'use strict';

  var API_BASE = '/api/config';

  /** 获取当前页面 slug */
  function getPageSlug() {
    var path = window.location.pathname;
    if (path.indexOf('/whisper') !== -1) return 'whisper';
    return 'main';
  }

  /** 加载配置并渲染 */
  async function loadAndRender() {
    var slug = getPageSlug();

    // 1. 从 API 获取配置
    var config;
    try {
      var res = await fetch(API_BASE + '?page=' + slug);
      if (!res.ok) throw new Error('API error ' + res.status);
      config = await res.json();
    } catch (e) {
      console.error('[data-loader] Failed to load config:', e);
      return; // 加载失败，保持 HTML 原样（兜底）
    }

    // 2. 渲染站点配置
    renderSiteConfig(config.site);

    // 3. 渲染页面背景
    if (config.page && config.page.background_image) {
      document.body.style.setProperty('--bg-image', "url('" + config.page.background_image + "')");
      document.body.style.background = 'var(--bg) var(--bg-image) center/cover fixed no-repeat';
    }

    // 4. 渲染链接
    renderLinks(config.links);

    // 5. 渲染宠物
    renderPet(config.pet);

    // 6. 渲染相册图片（设置到 window.__galleryImages 供 gallery.js 使用）
    renderGallery(config.gallery);

    // 7. 加载翻译文本
    loadTranslations(config.translations);

    // 8. 通知其他脚本：配置已加载完成
    document.dispatchEvent(new Event('configloaded'));
  }

  /** 渲染站点配置（头像、用户名） */
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

  /** 渲染链接按钮 */
  function renderLinks(links) {
    if (!links || !links.length) return;

    var linksEl = document.getElementById('links');
    if (!linksEl) return;

    linksEl.innerHTML = '';
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var a = document.createElement('a');
      a.className = 'link' + (link.qr_code ? ' img-popup-trigger' : '');

      // 设置 data-img 和 data-url（QR 弹窗用）
      if (link.qr_code) {
        a.setAttribute('data-img', link.qr_code);
      }
      if (link.url) {
        a.setAttribute('data-url', link.url);
      }

      // 弹窗提示
      if (link.popup_note) {
        a.setAttribute('data-note', link.popup_note);
      }

      // 跳转链接
      if (link.url) {
        a.href = link.url;
        a.target = '_blank';
      } else {
        a.href = 'javascript:void(0)';
      }

      // 入场动画延迟
      a.style.animationDelay = (0.10 + i * 0.08) + 's';

      // 内部结构
      a.innerHTML =
        '<span class="link-icon"><img src="' + link.icon + '" class="brand-icon" alt="' + link.label + '"></span>' +
        '<span class="link-label">' + link.label + '</span>';

      linksEl.appendChild(a);
    }
  }

  /** 渲染宠物 */
  function renderPet(pet) {
    if (!pet) return;

    var petEl = document.getElementById('pet');
    if (!petEl) return;

    // 清空现有内容，保留 pet-bubble
    var bubble = document.getElementById('petBubble');
    petEl.innerHTML = '';
    if (bubble) petEl.appendChild(bubble);

    // 判断是视频还是图片
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

    // 设置宠物消息 key
    if (pet.type) {
      window.__petMessagesKey = 'pet.' + pet.type;
    }

    // 设置宠物消息（多语言）
    if (pet.messages) {
      window.__petMessages = null; // 清除，让 pet.js 从 i18n 获取
      // 用数据库中的消息覆盖默认的 i18n 消息
      for (var lang in pet.messages) {
        if (pet.messages.hasOwnProperty(lang)) {
          window.__petMessages = pet.messages[lang];
          break; // 先用第一个语言，i18n 切换时会更新
        }
      }
    }
  }

  /** 渲染相册图片 */
  function renderGallery(gallery) {
    if (!gallery || !gallery.length) return;
    window.__galleryImages = gallery.map(function (img) {
      return { src: img.src };
    });
  }

  /** 加载翻译文本到 i18n 系统 */
  function loadTranslations(translations) {
    if (!translations || typeof window.__ !== 'function') return;

    // 将数据库翻译注入到 i18n 的 dict 中
    // i18n.js 的 dict 是闭包变量，我们通过覆盖 __ 函数的方式注入
    // 但更好的方式是：在 i18n.js 中提供一个 setTranslations 方法
    // 这里我们直接修改 dict 对象（因为 i18n.js 的 dict 在闭包中无法直接访问）

    // 替代方案：将翻译文本存储到 window，让 i18n.js 读取
    window.__dbTranslations = translations;

    // 触发语言刷新
    if (typeof window.applyI18n === 'function') {
      window.applyI18n();
    }
  }

  // 页面加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndRender);
  } else {
    loadAndRender();
  }
})();
