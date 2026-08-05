/**
 * site-data — 站点数据加载与渲染
 *
 * 从 /api/config 拉取最新配置（链接 + 相册），失败时回退到内置默认值
 * （纯静态部署 / 本地直接打开也能正常显示默认内容）。
 *
 * 职责：
 *   - 渲染链接到 #links（保留原有 data-img / data-url / data-note / data-i18n 行为）
 *   - 设置 window.__galleryImages 供 gallery.js 使用
 *   - 渲染完成后重新执行 applyI18n，让动态元素的翻译生效
 *
 * 注意：链接为异步动态渲染，qrcode-popup.js 已改为事件委托，gallery.js 在
 * 点击相册时才读取数据，因此不受时序影响。
 */
(function () {
  'use strict';

  // ---- 内置默认数据（与改造前 index.html 硬编码内容一致） ----
  var DEFAULT_LINKS = [
    {
      label: 'QQ', labelKey: 'brand.qq',
      icon: 'assets/icons/qq.svg',
      url: 'https://qm.qq.com/q/KbsdxQ17W0',
      qr: 'assets/qrcodes/qq.jpg',
      note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
    },
    {
      label: 'WeChat', labelKey: 'brand.wechat',
      icon: 'assets/icons/wechat.svg',
      qr: 'assets/qrcodes/wechat.jpg',
      note: '使用微信长按识别', noteKey: 'popup.note.wechat',
    },
    {
      label: 'Bilibili', labelKey: 'brand.bilibili',
      icon: 'assets/icons/bilibili.svg',
      url: 'http://space.bilibili.com/430552995',
      qr: 'assets/qrcodes/bilibili.jpg',
      note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
    },
    {
      label: 'TikTok', labelKey: 'brand.tiktok',
      icon: 'assets/icons/tiktok.svg',
      url: 'https://www.douyin.com/user/MS4wLjABAAAAYuXxtdsArkxgZpoGgQHE1Z2e5mvPeP4UCSezKlzUiALP4vyL0yqLi0vjneoLi5wz',
      qr: 'assets/qrcodes/douyin.jpg',
      note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
    },
    {
      label: 'RED', labelKey: 'brand.xiaohongshu',
      icon: 'assets/icons/xiaohongshu.svg',
      url: 'http://xhslink.com/m/3qScrydPm6Z',
      qr: 'assets/qrcodes/xiaohongshu.jpg',
      note: '点击上方按钮直接访问', noteKey: 'popup.note.visit',
    },
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

  /** 判断图标是图片路径还是 Font Awesome 类名 */
  function isImagePath(str) {
    return /\.(svg|png|jpe?g|webp|gif|ico|avif)([?#].*)?$/i.test(String(str).trim());
  }

  function renderLinks(links) {
    var container = document.getElementById('links');
    if (!container) return;
    container.innerHTML = '';

    for (var i = 0; i < links.length; i++) {
      var link = links[i] || {};

      var a = document.createElement('a');
      a.className = 'link img-popup-trigger';
      if (link.qr) a.setAttribute('data-img', link.qr);
      if (link.url) a.setAttribute('data-url', link.url);
      // 有跳转链接但没有二维码时，直接在新标签页打开
      if (link.url && !link.qr) {
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener';
      }
      if (link.note) a.setAttribute('data-note', link.note);
      if (link.noteKey) a.setAttribute('data-i18n-note', link.noteKey);

      // 图标：图片路径 或 Font Awesome 类
      var iconSpan = document.createElement('span');
      iconSpan.className = 'link-icon';
      if (link.icon) {
        if (isImagePath(link.icon)) {
          var img = document.createElement('img');
          img.src = link.icon;
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

      // 标签：有 i18n 键则交给 applyI18n 翻译
      var labelSpan = document.createElement('span');
      labelSpan.className = 'link-label';
      if (link.labelKey) labelSpan.setAttribute('data-i18n', link.labelKey);
      labelSpan.textContent = link.label || '';
      a.appendChild(labelSpan);

      // 入场动画延迟（与原有交错节奏一致）
      a.style.animationDelay = (0.10 + i * 0.08) + 's';

      container.appendChild(a);
    }
  }

  function loadAndRender() {
    var links = DEFAULT_LINKS;
    var gallery = DEFAULT_GALLERY;

    function done() {
      renderLinks(links);
      window.__galleryImages = gallery;
      // 重新应用 i18n，让动态渲染的 data-i18n / data-i18n-note 生效
      if (window.applyI18n) window.applyI18n();
    }

    // 同源下拉取最新配置；失败（静态部署/离线）则静默使用默认值
    fetch('api/config', { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('config request failed: ' + res.status);
        return res.json();
      })
      .then(function (cfg) {
        if (cfg) {
          if (Array.isArray(cfg.links)) links = cfg.links;
          if (Array.isArray(cfg.gallery)) gallery = cfg.gallery;
        }
      })
      .catch(function () { /* 回退默认值 */ })
      .then(done);
  }

  loadAndRender();
})();
