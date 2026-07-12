/**
 * Hint Popup — 隐藏入口提示弹窗
 *
 * URL 参数机制：
 *   ?ref_id      — 永久参数（你自己用。页面自动将地址栏换成当日密钥，不刷页面）
 *   ?<6位密钥>    — 每日轮询参数（分享给朋友，次日过期）
 *
 * 两者均弹出彩蛋触发方法的提示窗口。
 */
(function () {
  'use strict';

  // ponytail: 简单哈希 + 固定盐值。读了 JS 的人能算出任意一天密钥，
  // 目的是挡住静态爬取，不是防逆向。
  var SALT = 'hul_ref_2024';

  function _hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  function getDailySecret() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return _hash(y + '-' + m + '-' + day + SALT).slice(0, 6);
  }

  // 暴露给其他脚本（easter egg / whisper 页面校验）
  window.__getDailySecret = getDailySecret;

  // ---- 检测 URL 参数 ----
  var secret = getDailySecret();
  var params = new URLSearchParams(window.location.search);
  var shouldShow = false;

  if (params.has('ref_id')) {
    // 永久参数 → 地址栏换成当日密钥，不留历史记录
    window.history.replaceState(
      null, '',
      window.location.pathname + '?' + secret + window.location.hash
    );
    shouldShow = true;
  } else if (params.has(secret)) {
    shouldShow = true;
  }

  if (!shouldShow) return;

  // 确保 i18n 已加载
  if (typeof window.__ !== 'function') {
    console.warn('[HintPopup] i18n not loaded, aborting');
    return;
  }
  var __ = window.__;

  function getCloseText() {
    return (window.getLang && window.getLang() === 'en') ? 'Let me try!' : '我试试！';
  }

  // ---- 创建弹窗 DOM ----
  var overlay = document.createElement('div');
  overlay.className = 'img-popup-overlay';
  overlay.id = 'hintPopup';
  overlay.innerHTML =
    '<div class="img-popup-card hint-card">'
      + '<div class="hint-emoji">🔍</div>'
      + '<div class="hint-title">' + __('hint.title') + '</div>'
      + '<div class="hint-body">' + __('hint.body') + '</div>'
      + '<div class="hint-detail">' + __('hint.detail').replace(/\n/g, '<br>') + '</div>'
      + '<div class="hint-footer">'
        + '<span class="img-popup-close hint-close-btn" id="hintPopupClose">' + getCloseText() + '</span>'
      + '</div>'
    + '</div>';
  document.body.appendChild(overlay);

  // ---- 显示弹窗（延迟一小段让页面先渲染） ----
  setTimeout(function () {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }, 600);

  // ---- 关闭弹窗 ----
  function closeHintPopup() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    window.history.replaceState(null, '', window.location.pathname);
  }

  // 关闭按钮
  var closeBtn = document.getElementById('hintPopupClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeHintPopup);
  }

  // 点击背景关闭
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeHintPopup();
  });

  // ESC 关闭
  document.addEventListener('keydown', function onEsc(e) {
    if (overlay.classList.contains('active') && e.key === 'Escape') {
      closeHintPopup();
    }
  });

  // 语言切换时更新文字
  document.addEventListener('languagechange', function () {
    var titleEl = overlay.querySelector('.hint-title');
    var bodyEl = overlay.querySelector('.hint-body');
    var detailEl = overlay.querySelector('.hint-detail');
    var closeBtnEl = document.getElementById('hintPopupClose');
    if (titleEl) titleEl.textContent = __('hint.title');
    if (bodyEl) bodyEl.textContent = __('hint.body');
    if (detailEl) detailEl.innerHTML = __('hint.detail').replace(/\n/g, '<br>');
    if (closeBtnEl) closeBtnEl.textContent = getCloseText();
  });

})();
