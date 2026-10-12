/**
 * view-gallery.js — 相册管理：网格渲染、批量显隐/删除、整页开关
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

  // ==================== 相册管理 ====================
  function visibleGallery() {
    var pid = document.getElementById('galleryPageFilter').value;
    var list = S.gallery.filter(function (g) { return !g._deleted; });
    if (pid) list = list.filter(function (g) { return String(g.page_id) === String(pid); });
    return list;
  }

  function renderGallery() {
    var list = visibleGallery();
    document.getElementById('galleryFilterHint').textContent = '共 ' + list.length + ' 张';

    // 整页相册开关（基于当前过滤的页面）
    var pid = document.getElementById('galleryPageFilter').value;
    var page = null;
    if (pid) page = S.pages.find(function (p) { return !p._deleted && String(p.id) === String(pid); });
    var swBox = document.getElementById('galleryPageSwitchBox');
    if (page) {
      swBox.style.display = '';
      document.getElementById('gallerySwitchLabel').textContent = '/' + page.slug + ' · 整页相册';
      document.getElementById('galleryPageEnabled').checked = page.gallery_enabled !== false;
      document.getElementById('gallerySwitchHint').textContent =
        page.gallery_enabled === false ? '该页相册已整体隐藏（图片数据保留，随时可开）' : '关闭后该页相册整体隐藏（图片数据保留）';
    } else {
      swBox.style.display = 'none';
    }

    var wrap = document.getElementById('galleryList');
    wrap.innerHTML = '';
    list.forEach(function (img) {
      var edge = pageEdge(S.gallery, img, function (x) { return x.page_id; });
      var d = document.createElement('div');
      d.className = 'gallery-item' + (img._selected ? ' selected' : '') + (img._dirty ? ' dirty' : '');
      d.innerHTML =
        '<button class="gallery-check" type="button" title="选择">' + (img._selected ? '<i class="fas fa-check"></i>' : '') + '</button>' +
        '<div class="gallery-thumb"><img src="' + esc(img.src) + '" onerror="this.style.visibility=\'hidden\'"></div>' +
        '<div class="gallery-body">' +
          '<div class="gallery-head-row">' +
            '<label class="switch" title="显示/隐藏"><input type="checkbox" data-field="is_active"' + (img.is_active === false ? '' : ' checked') + '><span class="switch-slider"></span></label>' +
            '<span class="gallery-status">' + (img.is_active === false ? '已隐藏' : '显示中') + '</span>' +
          '</div>' +
          '<input class="gallery-src" data-field="src" value="' + esc(img.src || '') + '" placeholder="图片 URL">' +
          '<div class="gallery-actions">' +
            '<button class="btn-icon" data-action="up"' + (edge.first ? ' disabled' : '') + ' title="上移">&#8593;</button>' +
            '<button class="btn-icon" data-action="down"' + (edge.last ? ' disabled' : '') + ' title="下移">&#8595;</button>' +
            '<button class="btn-icon btn-danger" data-action="delete" title="删除">&times;</button>' +
          '</div>' +
        '</div>';
      wrap.appendChild(d);
      A.bindEntityCard(d, img, S.gallery, function (x) { return x.page_id; }, '该图片');
      // 选择圆点：点击切换选中
      var check = d.querySelector('.gallery-check');
      check.addEventListener('click', function (e) { e.stopPropagation(); toggleGallerySelect(img); });
      // 点击卡片空白处也切换选中
      d.addEventListener('click', function (e) {
        if (e.target.closest('input, button, a, label')) return;
        toggleGallerySelect(img);
      });
    });
    updateGallerySelHint();
  }

  function toggleGallerySelect(img) {
    img._selected = !img._selected;
    renderGallery();
  }

  function updateGallerySelHint() {
    var sel = S.gallery.filter(function (g) { return !g._deleted && g._selected; }).length;
    var el = document.getElementById('gallerySelHint');
    if (el) el.textContent = sel ? '已选 ' + sel + ' 张' : '';
  }

  document.getElementById('galleryPageFilter').addEventListener('change', function () { renderGallery(); updateSysBar(); });

  // 整页相册开关：切到选中页面的 gallery_enabled
  document.getElementById('galleryPageEnabled').addEventListener('change', function () {
    var pid = document.getElementById('galleryPageFilter').value;
    var page = S.pages.find(function (p) { return !p._deleted && String(p.id) === String(pid); });
    if (!page) return;
    page.gallery_enabled = this.checked;
    page._dirty = true;
    renderGallery();
    updateDirtyUI();
  });

  // 批量操作（仅作用于当前过滤页面的图片）
  document.getElementById('gallerySelectAll').addEventListener('click', function () {
    visibleGallery().forEach(function (g) { g._selected = true; });
    renderGallery();
  });
  document.getElementById('gallerySelectInvert').addEventListener('click', function () {
    visibleGallery().forEach(function (g) { g._selected = !g._selected; });
    renderGallery();
  });
  document.getElementById('galleryBatchHide').addEventListener('click', function () {
    var sel = visibleGallery().filter(function (g) { return g._selected; });
    if (!sel.length) { showToast('请先选择图片', true); return; }
    sel.forEach(function (g) { g.is_active = false; g._dirty = true; });
    showToast('已隐藏 ' + sel.length + ' 张（记得保存）');
    renderGallery(); updateDirtyUI();
  });
  document.getElementById('galleryBatchShow').addEventListener('click', function () {
    var sel = visibleGallery().filter(function (g) { return g._selected; });
    if (!sel.length) { showToast('请先选择图片', true); return; }
    sel.forEach(function (g) { g.is_active = true; g._dirty = true; });
    showToast('已显示 ' + sel.length + ' 张（记得保存）');
    renderGallery(); updateDirtyUI();
  });
  document.getElementById('galleryBatchDelete').addEventListener('click', function () {
    var sel = visibleGallery().filter(function (g) { return g._selected; });
    if (!sel.length) { showToast('请先选择图片', true); return; }
    if (!confirm('确定删除选中的 ' + sel.length + ' 张图片？')) return;
    sel.forEach(function (g) { g._deleted = true; g._dirty = true; });
    renderGallery(); updateDirtyUI();
  });

  function addGallery() {
    var pid = document.getElementById('galleryPageFilter').value || firstPageId();
    if (!pid) { showToast('请先创建页面', true); return; }
    var input = document.getElementById('galleryNewSrc');
    var src = input.value.trim();
    if (!src) { showToast('请先输入图片 URL', true); return; }
    S.gallery.push({ id: nextNewId(), page_id: pid, src: src, sort_order: 0, is_active: true, _new: true, _deleted: false, _dirty: true });
    input.value = '';
    updateDirtyUI(); renderGallery();
  }
  document.getElementById('galleryAddConfirm').addEventListener('click', addGallery);
  document.getElementById('galleryNewSrc').addEventListener('keydown', function (e) { if (e.key === 'Enter') addGallery(); });

  // ---- 模块导出 ----

  A.renderGallery = renderGallery;

})();
