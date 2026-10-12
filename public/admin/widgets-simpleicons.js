/**
 * widgets-simpleicons.js — Simple Icons 品牌图标选择弹窗
 */

(function () {

  'use strict';

  var A = window.Admin;
  var S = A.S, token = A.token, headers = A.headers,
      api = A.api, showToast = A.showToast, esc = A.esc, nextNewId = A.nextNewId,
      dirtyCount = A.dirtyCount, updateDirtyUI = A.updateDirtyUI, updateSysBar = A.updateSysBar,
      setSaving = A.setSaving, pageName = A.pageName, firstPageId = A.firstPageId,
      pageOptions = A.pageOptions, fillPageFilters = A.fillPageFilters,
      moveWithinPage = A.moveWithinPage, pageEdge = A.pageEdge;

  // ==================== Simple Icons 图标选择弹窗 ====================
  var siTarget = null; // 当前等待填图标的 { link, card }
  var siLoaded = false; // 内嵌页是否已加载完成
  var siLoadTimer = null;
  // 打开时重置加载指示：网络慢时先显示加载动画，加载完自动隐藏
  function resetSiLoading() {
    siLoaded = false;
    var load = document.getElementById('siLoading');
    if (load) {
      load.className = 'si-loading';
      load.style.display = 'flex';
    }
    clearTimeout(siLoadTimer);
    siLoadTimer = setTimeout(function () {
      if (!siLoaded) {
        var l = document.getElementById('siLoading');
        if (l) l.classList.add('error'); // 超时 → 提示可用「在新窗口打开」兜底
      }
    }, 15000);
  }
  function markSiLoaded() {
    siLoaded = true;
    clearTimeout(siLoadTimer);
    var load = document.getElementById('siLoading');
    if (load) load.style.display = 'none';
  }
  function openSimpleIcons(link, card) {
    siTarget = { link: link, card: card };
    var ov = document.getElementById('siOverlay');
    if (!ov) return;
    ov.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    resetSiLoading();
  }
  // 内嵌页加载完成 → 隐藏加载提示
  var siFrameEl = document.getElementById('siFrame');
  if (siFrameEl) siFrameEl.addEventListener('load', markSiLoaded);
  function closeSimpleIcons() {
    var ov = document.getElementById('siOverlay');
    if (ov) ov.style.display = 'none';
    document.body.style.overflow = '';
    siTarget = null;
  }
  // 把品牌名转成 Simple Icons CDN URL 并填入当前图标准入框
  function fillSimpleIcon() {
    var nameInput = document.getElementById('siNameInput');
    var name = nameInput ? nameInput.value.trim() : '';
    if (!name) { showToast('请先输入品牌名', true); return; }
    if (!/^[a-zA-Z0-9\-_.]+$/.test(name)) { showToast('品牌名似乎无效，请只输入名称（如 github）', true); return; }
    var url = 'https://cdn.simpleicons.org/' + encodeURIComponent(name.toLowerCase());
    if (siTarget && siTarget.card) {
      var iconInput = siTarget.card.querySelector('[data-field="icon"]');
      if (iconInput) {
        iconInput.value = url;
        siTarget.link.icon = url;
        siTarget.link._dirty = true;
        var badge = siTarget.card.querySelector('.dirty-badge');
        if (badge) badge.style.display = '';
        siTarget.card.classList.add('dirty');
        updateDirtyUI();
      }
    }
    closeSimpleIcons();
    showToast('已填入图标 URL：' + url);
  }
  document.getElementById('siClose').addEventListener('click', closeSimpleIcons);
  document.getElementById('siFillBtn').addEventListener('click', fillSimpleIcon);
  document.getElementById('siNameInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); fillSimpleIcon(); } });
  document.getElementById('siOverlay').addEventListener('click', function (e) { if (e.target === this) closeSimpleIcons(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSimpleIcons(); });
  // 从剪贴板读取品牌名（内嵌 iframe 跨域时官网复制按钮可能失效，此按钮兜底）
  function pasteSimpleIconName() {
    var nameInput = document.getElementById('siNameInput');
    if (!nameInput) return;
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      showToast('当前浏览器不支持读取剪贴板，请在新窗口打开官网复制后手动粘贴', true);
      return;
    }
    navigator.clipboard.readText().then(function (text) {
      text = (text || '').trim();
      if (!text) { showToast('剪贴板是空的，请先在官网复制品牌名', true); return; }
      nameInput.value = text;
      showToast('已从剪贴板读取：' + text);
    }).catch(function () {
      showToast('无法读取剪贴板，请在新窗口打开官网复制后手动粘贴', true);
    });
  }
  document.getElementById('siPasteBtn').addEventListener('click', pasteSimpleIconName);
  document.getElementById('siOpenBtn').addEventListener('click', function () {
    window.open('https://simpleicons.org', '_blank', 'noopener');
  });

  // ---- 模块导出 ----

  A.openSimpleIcons = openSimpleIcons;

})();
