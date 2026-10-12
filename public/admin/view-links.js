/**
 * view-links.js — 链接管理：列表渲染、增删改排序、图标选取入口
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

  // ==================== 链接管理 ====================
  function visibleLinks() {
    var pid = document.getElementById('linkPageFilter').value;
    var list = S.links.filter(function (l) { return !l._deleted; });
    if (pid) list = list.filter(function (l) { return String(l.page_id) === String(pid); });
    return list;
  }

  function renderLinks() {
    var list = visibleLinks();
    var pid = document.getElementById('linkPageFilter').value;
    document.getElementById('linkFilterHint').textContent =
      '共 ' + list.length + ' 条' + (pid ? '（页面：' + pageName(pid) + '）' : '');

    var wrap = document.getElementById('linksList');
    wrap.innerHTML = '';

    list.forEach(function (link) {
      var edge = pageEdge(S.links, link, function (x) { return x.page_id; });
      var card = document.createElement('div');
      card.className = 'card link-card' + (link._dirty ? ' dirty' : '');
      card.dataset.id = link.id;
      card.innerHTML =
        '<div class="card-head">' +
          '<span class="dirty-badge"' + (link._dirty ? '' : ' style="display:none"') + '>● 未保存</span>' +
          '<span class="card-title">' + esc(link.label || '新链接') + '</span>' +
          '<div class="card-head-actions">' +
            '<label class="switch" title="启用/停用"><input type="checkbox" data-field="is_active"' + (link.is_active ? ' checked' : '') + '><span class="switch-slider"></span></label>' +
            '<button class="btn-icon" data-action="up"' + (edge.first ? ' disabled' : '') + ' title="上移">&#8593;</button>' +
            '<button class="btn-icon" data-action="down"' + (edge.last ? ' disabled' : '') + ' title="下移">&#8595;</button>' +
            '<button class="btn-icon btn-danger" data-action="delete" title="删除">&times;</button>' +
          '</div>' +
        '</div>' +
        '<div class="link-form">' +
          '<div class="form-row">' +
            '<div class="form-group"><label>所属页面</label><select data-field="page_id">' + pageOptions(link.page_id) + '</select></div>' +
            '<div class="form-group"><label>名称</label><input data-field="label" value="' + esc(link.label || '') + '"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>图标 URL</label><div class="icon-url-row"><input data-field="icon" value="' + esc(link.icon || '') + '" placeholder="https://cdn.simpleicons.org/github"><button type="button" class="btn btn-primary icon-picker-btn" data-action="open-simple-icons" title="从 Simple Icons 挑选品牌图标">SI</button><button type="button" class="btn btn-ghost" data-upload title="上传图片后自动填入"><i class="fas fa-upload"></i></button></div></div>' +
            '<div class="form-group"><label>跳转链接(可选)</label><input data-field="url" value="' + esc(link.url || '') + '"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>二维码图片(可选)</label><div class="icon-url-row"><input data-field="qr_code" value="' + esc(link.qr_code || '') + '"><button type="button" class="btn btn-ghost" data-upload title="上传图片后自动填入"><i class="fas fa-upload"></i></button></div></div>' +
            '<div class="form-group"><label>备注(可选)</label><input data-field="popup_note" value="' + esc(link.popup_note || '') + '"></div>' +
          '</div>' +
        '</div>';
      wrap.appendChild(card);
      bindEntityCard(card, link, S.links, function (x) { return x.page_id; }, '该链接');
      // 名称输入时同步卡片标题
      var labelInput = card.querySelector('[data-field="label"]');
      if (labelInput) labelInput.addEventListener('input', function () {
        var title = card.querySelector('.card-title');
        if (title) title.textContent = labelInput.value || '新链接';
      });
      var siBtn = card.querySelector('[data-action="open-simple-icons"]');
      if (siBtn) siBtn.addEventListener('click', function () { A.openSimpleIcons(link, card); });
    });
  }

  // 通用卡片事件绑定：字段编辑 / 启停开关 / 上移下移 / 删除
  function bindEntityCard(card, item, arr, getPage, name) {
    var badge = card.querySelector('.dirty-badge');
    function mark() {
      item._dirty = true;
      card.classList.add('dirty');
      if (badge) badge.style.display = '';
      updateDirtyUI();
    }
    card.querySelectorAll('[data-field]').forEach(function (input) {
      if (input.type === 'checkbox') {
        input.addEventListener('change', function () { item[input.dataset.field] = input.checked; mark(); });
      } else {
        input.addEventListener('input', function () { item[input.dataset.field] = input.value; mark(); });
      }
    });
    card.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.dataset.action;
        if (action === 'delete') {
          if (!confirm('确定删除' + name + '？')) return;
          item._deleted = true; item._dirty = true;
          updateDirtyUI();
          A.renderAll();
        } else if (action === 'up' || action === 'down') {
          moveWithinPage(arr, item.id, action, getPage);
          A.renderAll();
        }
      });
    });
  }

  document.getElementById('linkPageFilter').addEventListener('change', function () { renderLinks(); updateSysBar(); });
  document.getElementById('addLinkBtn').addEventListener('click', function () {
    var pid = document.getElementById('linkPageFilter').value || firstPageId();
    if (!pid) { showToast('请先创建页面', true); return; }
    S.links.push({
      id: nextNewId(), page_id: pid, label: '新链接',
      url: '', icon: '', qr_code: '', popup_note: '',
      is_active: true, sort_order: 0,
      _new: true, _deleted: false, _dirty: true
    });
    updateDirtyUI(); renderLinks();
  });

  // ---- 模块导出 ----

  A.renderLinks = renderLinks; A.bindEntityCard = bindEntityCard;

})();
