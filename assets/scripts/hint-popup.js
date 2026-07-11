/**
 * Hint Popup — 隐藏入口提示弹窗
 *
 * 在 URL 后添加 ?hint 参数访问主页面时，
 * 自动弹出提示窗口，告知用户如何通过彩蛋
 * 进入隐藏页面（whisper/）。
 *
 * 用法：
 *   https://example.com/?hint
 */
(function () {
  'use strict';

  // ---- 检测 URL 参数 ----
  var params = new URLSearchParams(window.location.search);
  if (!params.has('hint')) return;

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
  var showTimer = setTimeout(function () {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }, 600);

  // ---- 关闭弹窗 ----
  function closeHintPopup() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
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
