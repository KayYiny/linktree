/**
 * Hint Popup — 隐藏入口提示弹窗
 *
 * URL 参数机制：
 *   ?<refParam>  — 永久参数（默认 ref_id，可在后台改；页面自动把地址栏换成当日密钥）
 *   ?<6位密钥>    — 每日轮询参数（分享给朋友，次日过期）
 *
 * 每日密钥由 secret.js 计算，盐/长度/参数名均可在后台配置；
 * 等待 site-config-ready（site-data.js 拉取配置完成）后再判定。
 */
(function () {
  'use strict';

  function getRefParam() {
    var w = (window.__siteConfig && window.__siteConfig.whisper) || {};
    return w.refParam || 'ref_id';
  }

  function showHint() {
    // 确保 i18n 已加载
    if (typeof window.__ !== 'function') {
      console.warn('[HintPopup] i18n not loaded, aborting');
      return;
    }
    var __ = window.__;

    function getCloseText() {
      return (window.getLang && window.getLang() === 'en') ? 'Let me try!' : '我试试！';
    }

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

    setTimeout(function () {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }, 600);

    function closeHintPopup() {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      window.history.replaceState(null, '', window.location.pathname);
    }

    var closeBtn = document.getElementById('hintPopupClose');
    if (closeBtn) closeBtn.addEventListener('click', closeHintPopup);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeHintPopup();
    });

    document.addEventListener('keydown', function onEsc(e) {
      if (overlay.classList.contains('active') && e.key === 'Escape') {
        closeHintPopup();
      }
    });

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
  }

  function evaluate() {
    var secret = window.__getDailySecret ? window.__getDailySecret() : '';
    var refParam = getRefParam();
    var params = new URLSearchParams(window.location.search);
    var shouldShow = false;

    if (params.has(refParam)) {
      // 永久参数 → 地址栏换成当日密钥，不留历史记录
      window.history.replaceState(
        null, '',
        window.location.pathname + '?' + secret + window.location.hash
      );
      shouldShow = true;
    } else if (secret && params.has(secret)) {
      shouldShow = true;
    }

    if (shouldShow) showHint();
  }

  // 配置就绪后判定；若已就绪立即判定
  if (window.__siteConfig) {
    evaluate();
  } else {
    window.addEventListener('site-config-ready', evaluate);
  }
})();
