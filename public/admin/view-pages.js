/**
 * view-pages.js — 页面管理：slug/标题/背景/需密钥/彩蛋目标，卡片式编辑
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

  // ==================== 页面管理 ====================
  function renderPages() {
    var list = S.pages.filter(function (p) { return !p._deleted; });
    var wrap = document.getElementById('pagesList');
    wrap.innerHTML = '';
    list.forEach(function (p) {
      var edge = pageEdge(S.pages, p, function () { return 0; });
      var card = document.createElement('div');
      card.className = 'card page-card' + (p._dirty ? ' dirty' : '');
      card.innerHTML =
        '<div class="card-head">' +
          '<span class="dirty-badge"' + (p._dirty ? '' : ' style="display:none"') + '>● 未保存</span>' +
          '<span class="card-title">/' + esc(p.slug || '') + '</span>' +
          '<div class="card-head-actions">' +
            '<label class="switch" title="启用/停用"><input type="checkbox" data-field="is_active"' + (p.is_active ? ' checked' : '') + '><span class="switch-slider"></span></label>' +
            '<button class="btn-icon" data-action="up"' + (edge.first ? ' disabled' : '') + ' title="上移">&#8593;</button>' +
            '<button class="btn-icon" data-action="down"' + (edge.last ? ' disabled' : '') + ' title="下移">&#8595;</button>' +
            '<button class="btn-icon btn-danger" data-action="delete" title="删除">&times;</button>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Slug（URL 路径）</label><input data-field="slug" value="' + esc(p.slug) + '"></div>' +
          '<div class="form-group"><label>标题</label><input data-field="title" value="' + esc(p.title || '') + '"></div>' +
        '</div>' +
        '<div class="form-group"><label>背景图片 URL</label><div class="icon-url-row"><input data-field="background_image" value="' + esc(p.background_image || '') + '"><button type="button" class="btn btn-ghost" data-upload title="上传图片后自动填入"><i class="fas fa-upload"></i></button></div></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>访问需密钥</label><label class="switch"><input type="checkbox" data-field="key_required"' + (p.key_required ? ' checked' : '') + '><span class="switch-slider"></span></label></div>' +
          '<div class="form-group"><label>彩蛋跳转目标</label><input data-field="egg_target" value="' + esc(p.egg_target || '') + '" placeholder="如 /whisper 或任意 URL，留空则本页彩蛋不生效"></div>' +
        '</div>';
      wrap.appendChild(card);

      var badge = card.querySelector('.dirty-badge');
      function mark() {
        p._dirty = true;
        card.classList.add('dirty');
        badge.style.display = '';
        updateDirtyUI();
      }
      card.querySelectorAll('[data-field]').forEach(function (input) {
        if (input.type === 'checkbox') {
          input.addEventListener('change', function () { p[input.dataset.field] = input.checked; mark(); });
        } else {
          input.addEventListener('input', function () { p[input.dataset.field] = input.value; mark(); });
        }
      });
      card.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var action = btn.dataset.action;
          if (action === 'delete') deletePage(p);
          else if (action === 'up' || action === 'down') {
            moveWithinPage(S.pages, p.id, action, function () { return 0; });
            renderPages();
          }
        });
      });
    });
  }

  function deletePage(p) {
    var childCount = 0;
    ['links', 'gallery', 'pets'].forEach(function (k) {
      S[k].forEach(function (it) { if (String(it.page_id) === String(p.id) && !it._deleted) childCount++; });
    });
    var msg = '确定删除页面「' + p.slug + '」？' + (childCount ? ' 其下 ' + childCount + ' 条内容（链接/相册/宠物）将一并删除。' : '');
    if (!confirm(msg)) return;
    p._deleted = true; p._dirty = true;
    // 级联删除子内容
    ['links', 'gallery', 'pets'].forEach(function (k) {
      S[k].forEach(function (it) {
        if (String(it.page_id) === String(p.id)) { it._deleted = true; it._dirty = true; }
      });
    });
    // 页面排序变化 → 全部标记
    S.pages.forEach(function (x) { if (!x._deleted) x._dirty = true; });
    updateDirtyUI();
    A.fillPageFilters();
    A.renderAll();
  }

  function addPage() {
    var input = document.getElementById('pageNewSlug');
    var slug = input.value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!slug) { showToast('请先输入页面 slug', true); return; }
    if (S.pages.some(function (p) { return !p._deleted && p.slug.toLowerCase() === slug; })) {
      showToast('该 slug 已存在', true); return;
    }
    S.pages.push({
      id: nextNewId(), slug: slug, title: slug, background_image: '', key_required: false, egg_target: '',
      is_active: true, sort_order: S.pages.length,
      _new: true, _deleted: false, _dirty: true
    });
    input.value = '';
    A.fillPageFilters(); updateDirtyUI(); A.renderAll();
  }
  document.getElementById('pageAddConfirm').addEventListener('click', addPage);
  document.getElementById('pageNewSlug').addEventListener('keydown', function (e) { if (e.key === 'Enter') addPage(); });

  // ---- 模块导出 ----

  A.renderPages = renderPages;

})();
