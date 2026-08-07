/**
 * Hint Popup — 主页面密钥入口提示弹窗
 *
 * 访问主页且 URL 带 ?k= 密钥时：
 *   - 密钥有效（当前轮换密钥 或 永久密钥）→ 弹出「如何用彩蛋进入耳语页」的提示
 *   - 密钥无效 → 弹出「密钥无效」提示
 * 关闭后把 ?k= 从地址栏清掉。
 *
 * 依赖：keygen.js（校验）、data-loader 的 configloaded 事件（密钥配置）、i18n.js
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var k = params.get('k');
  if (!k) return;

  // 仅主页（根路径）触发，其他页面不弹
  var path = window.location.pathname || '/';
  var slug = path.replace(/^\/+|\/+$/g, '').split('/')[0] || 'main';
  if (slug !== 'main') return;

  var overlay = null;
  var type = null; // 'hint' | 'invalid'

  function isEn() { return (window.getLang && window.getLang()) === 'en'; }
  function L(zh, en) { return isEn() ? en : zh; }

  function content() {
    var __ = window.__ || function (s) { return s; };
    if (type === 'invalid') {
      return {
        emoji: '🚫',
        title: L('密钥无效', 'Invalid Key'),
        body: L('该密钥无效或已过期。', 'This key is invalid or has expired.'),
        detail: L('可向分享者索要最新密钥，或从主页通过彩蛋进入耳语页。', 'Ask for the latest key, or use the easter egg on the homepage.'),
        close: L('知道了', 'Got it')
      };
    }
    return {
      emoji: '🔍',
      title: __('hint.title'),
      body: __('hint.body'),
      detail: __('hint.detail').replace(/\n/g, '<br>'),
      close: L('我试试！', 'Let me try!')
    };
  }

  function render() {
    var c = content();
    overlay.innerHTML =
      '<div class="img-popup-card hint-card">'
        + '<div class="hint-emoji">' + c.emoji + '</div>'
        + '<div class="hint-title">' + c.title + '</div>'
        + '<div class="hint-body">' + c.body + '</div>'
        + '<div class="hint-detail">' + c.detail + '</div>'
        + '<div class="hint-footer"><span class="img-popup-close hint-close-btn" id="hintPopupClose">' + c.close + '</span></div>'
      + '</div>';
    var btn = document.getElementById('hintPopupClose');
    if (btn) btn.addEventListener('click', closeHint);
  }

  function closeHint() {
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    setTimeout(function () { if (overlay) overlay.remove(); overlay = null; }, 250);
  }

  document.addEventListener('configloaded', function () {
    var site = (window.__dbConfig && window.__dbConfig.site) || {};
    // 密钥有效性由服务端判定（key_valid，基于请求时的原始 ?k=），客户端不接触永久密钥
    type = site.key_valid === true ? 'hint' : 'invalid';
    if (overlay || !window.__) return;

    overlay = document.createElement('div');
    overlay.className = 'img-popup-overlay';
    overlay.id = 'hintPopup';
    document.body.appendChild(overlay); // 先入文档，render 才能绑定关闭按钮
    render();

    setTimeout(function () {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }, 600);

    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeHint(); });
    document.addEventListener('keydown', function onEsc(e) {
      if (overlay && overlay.classList.contains('active') && e.key === 'Escape') closeHint();
    });
    document.addEventListener('languagechange', function () { if (overlay) render(); });
  });
})();
