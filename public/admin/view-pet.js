/**
 * view-pet.js — 宠物管理：每页一只，单语语录编辑
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

  // ==================== 宠物管理（每页一只） ====================
  function renderPet() {
    var pid = document.getElementById('petPageFilter').value;
    var pages = S.pages.filter(function (p) {
      return !p._deleted && (!pid || String(p.id) === String(pid));
    });
    var wrap = document.getElementById('petList');
    wrap.innerHTML = '';
    if (!pages.length) {
      wrap.innerHTML = '<p class="empty-tip">当前没有可管理的页面。</p>';
      return;
    }
    pages.forEach(function (pg) {
      var pet = S.pets.find(function (x) { return !x._deleted && String(x.page_id) === String(pg.id); });
      var section = document.createElement('div');
      if (pet) {
        var msgs = Array.isArray(pet.messages) ? pet.messages : [];
        var card = document.createElement('div');
        card.className = 'card pet-card' + (pet._dirty ? ' dirty' : '');
        card.innerHTML =
          '<div class="card-head">' +
            '<span class="dirty-badge"' + (pet._dirty ? '' : ' style="display:none"') + '>● 未保存</span>' +
            '<span class="card-title">' + esc(pg.slug) + ' · 宠物</span>' +
            '<div class="card-head-actions">' +
              '<label class="switch" title="显示/隐藏"><input type="checkbox" data-field="is_active"' + (pet.is_active === false ? '' : ' checked') + '><span class="switch-slider"></span></label>' +
              '<button class="btn-icon btn-danger" data-action="delete" title="删除">&times;</button>' +
            '</div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>宠物类型</label><input data-field="pet_type" value="' + esc(pet.pet_type || '') + '"></div>' +
            '<div class="form-group"><label>图片/视频 URL</label><div class="icon-url-row"><input data-field="pet_image" value="' + esc(pet.pet_image || '') + '"><button type="button" class="btn btn-ghost" data-upload="video" title="上传图片/视频后自动填入"><i class="fas fa-upload"></i></button></div></div>' +
          '</div>' +
          '<div class="form-group"><label>语录（每行一条）</label><textarea data-field="messages" rows="6">' + esc(msgs.join('\n')) + '</textarea></div>';
        section.appendChild(card);

        var badge = card.querySelector('.dirty-badge');
        function mark() {
          pet._dirty = true;
          card.classList.add('dirty');
          badge.style.display = '';
          updateDirtyUI();
        }
        card.querySelectorAll('[data-field]').forEach(function (input) {
          if (input.dataset.field === 'messages') {
            input.addEventListener('input', function () {
              pet.messages = input.value.split('\n').map(function (l) { return l.replace(/\r$/, ''); }).filter(function (l) { return l.trim(); });
              mark();
            });
          } else if (input.type === 'checkbox') {
            input.addEventListener('change', function () { pet[input.dataset.field] = input.checked; mark(); });
          } else {
            input.addEventListener('input', function () { pet[input.dataset.field] = input.value; mark(); });
          }
        });
        card.querySelector('[data-action="delete"]').addEventListener('click', function () {
          if (!confirm('确定删除该宠物？')) return;
          pet._deleted = true; pet._dirty = true;
          updateDirtyUI(); renderPet();
        });
      } else {
        var empty = document.createElement('div');
        empty.className = 'card pet-empty';
        empty.innerHTML =
          '<div class="card-head"><span class="card-title">' + esc(pg.slug) + ' · 暂无宠物</span></div>' +
          '<button class="btn btn-primary" data-addpet="' + pg.id + '"><i class="fas fa-plus"></i> 为此页添加宠物</button>';
        section.appendChild(empty);
        empty.querySelector('[data-addpet]').addEventListener('click', function () {
          S.pets.push({
            id: nextNewId(), page_id: pg.id, pet_image: '', pet_type: '', is_active: true,
            messages: ['你好！'],
            _new: true, _deleted: false, _dirty: true
          });
          updateDirtyUI(); renderPet();
        });
      }
      wrap.appendChild(section);
    });
  }

  document.getElementById('petPageFilter').addEventListener('change', function () { renderPet(); updateSysBar(); });

  // ---- 模块导出 ----

  A.renderPet = renderPet;

})();
