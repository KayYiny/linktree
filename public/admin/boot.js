/**
 * boot.js — 启动：全量加载、渲染编排、顶栏按钮、初始化
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

  // ==================== 全量加载 ====================
  async function loadAll() {
    var results = await Promise.all([
      api('/api/admin/pages', 'GET'),
      api('/api/admin/links', 'GET'),
      api('/api/admin/gallery', 'GET'),
      api('/api/admin/pet', 'GET'),
      api('/api/admin/site-config', 'GET')
    ]);
    var pages = results[0], links = results[1], gallery = results[2], pets = results[3], site = results[4];

    S.pages = (pages || []).map(function (p) { return Object.assign({ _new: false, _deleted: false, _dirty: false }, p); });
    S.links = (links || []).map(function (l) { return Object.assign({ _new: false, _deleted: false, _dirty: false }, l); });
    S.gallery = (gallery || []).map(function (g) { return Object.assign({ _new: false, _deleted: false, _dirty: false }, g); });

    // pets: API 已返回单语语录数组（messages: []）
    S.pets = (pets || []).map(function (p) {
      return Object.assign({ _new: false, _deleted: false, _dirty: false }, p, {
        messages: Array.isArray(p.messages) ? p.messages : []
      });
    });

    // site（仅固定键；自定义键值编辑器已移除）
    var cfg = site || {};
    S.site = {
      avatar: cfg.avatar || '',
      username: cfg.username || '',
      favicon: cfg.favicon || '',
      footer: cfg.footer || ''
    };
    S.siteDirty = false;
    S.egg = {
      enabled: cfg.egg_enabled !== '0',
      clicks: cfg.egg_clicks != null ? String(cfg.egg_clicks) : '5',
      timeout: cfg.egg_timeout != null ? String(cfg.egg_timeout) : '2000'
    };
    S.eggDirty = false;
    S.key = {
      enabled: cfg.key_enabled !== '0',
      rotation: cfg.key_rotation || 'daily',
      salt: cfg.key_salt || '',
      permanent: cfg.key_permanent || ''
    };
    S.keyDirty = false;

    fillPageFilters();
    renderAll();
    updateDirtyUI();
  }

  function renderAll() {
    A.renderLinks(); A.renderGallery(); A.renderPet(); A.renderPages(); A.renderSite(); A.renderEgg(); A.renderKey();
  }

  // ==================== 顶部按钮 ====================
  document.getElementById('saveBtn').addEventListener('click', A.saveAll);

  document.getElementById('revertBtn').addEventListener('click', async function () {
    if (dirtyCount() === 0) { showToast('当前没有未保存修改'); return; }
    if (!confirm('放弃所有未保存修改并从服务器重新加载？')) return;
    setSaving(true);
    try { await loadAll(); showToast('已撤销全部修改'); }
    catch (e) { showToast('撤销失败：' + e.message, true); }
    setSaving(false);
  });

  // ==================== 初始化 ====================
  document.getElementById('loginUser').textContent = '@' + (localStorage.getItem('admin_username') || '');

  document.getElementById('logoutBtn').addEventListener('click', function () {
    if (!confirm('确定退出登录？')) return;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    window.location.href = '/admin/';
  });

  loadAll().catch(function (e) {
    showToast('加载失败：' + e.message, true, 4000);
  });

  // ---- 模块导出 ----

  A.loadAll = loadAll; A.renderAll = renderAll;

})();
