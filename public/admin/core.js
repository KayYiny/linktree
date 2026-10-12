/**
 * core.js — 共享核心：状态、API 封装、提示、脏标记、页面工具、标签页
 */

(function () {

  var A = window.Admin = {};

  'use strict';

  // ---- 认证 ----
  var token = localStorage.getItem('admin_token');
  if (!token) { window.location.href = '/admin/'; return; }

  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };

  // ---- 本地工作副本状态 ----
  var S = {
    pages: [],   // {id, slug, title, background_image, is_active, sort_order, _new, _deleted, _dirty}
    links: [],   // {id, page_id, label, url, icon, qr_code, popup_note, is_active, sort_order, _new, _deleted, _dirty}
    gallery: [], // {id, page_id, src, sort_order, _new, _deleted, _dirty}
    pets: [],    // {id, page_id, pet_image, pet_type, messages:[], _new, _deleted, _dirty}
    site: { avatar: '', username: '', favicon: '', footer: '' },
    siteDirty: false,
    egg: { enabled: true, clicks: '5', timeout: '2000' }, // 彩蛋配置（总开关 + 参数，跳转目标在页面卡片）
    eggDirty: false,
    key: { enabled: true, rotation: 'daily', salt: '', permanent: '' }, // 密钥设置
    keyDirty: false
  };
  var newSeq = 1;
  A.lastSaveTime = null; // SYS 状态行：上次保存时间

  // ---- API 封装 ----
  async function api(url, method, body) {
    var opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(url, opts);
    if (res.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/';
      throw new Error('未登录或登录已过期');
    }
    if (res.status === 204) return null;
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }

  function showToast(msg, isError, ms) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.style.display = 'block';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.style.display = 'none'; }, ms || 2600);
  }

  function esc(s) {
    return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function nextNewId() { return 'new-' + (newSeq++); }

  // ==================== 标签页 ====================
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      this.classList.add('active');
      document.getElementById('panel-' + this.dataset.tab).classList.add('active');
      if (this.dataset.tab === 'files') A.loadFiles();
      updateSysBar();
    });
  });

  // ==================== 脏标记 / 保存按钮 ====================
  function dirtyCount() {
    var n = 0;
    ['pages', 'links', 'gallery', 'pets'].forEach(function (k) {
      S[k].forEach(function (it) { if (it._dirty) n++; });
    });
    if (S.siteDirty) n++;
    if (S.eggDirty) n++;
    if (S.keyDirty) n++;
    return n;
  }

  function updateDirtyUI() {
    var n = dirtyCount();
    var btn = document.getElementById('saveBtn');
    btn.disabled = n === 0;
    btn.innerHTML = n > 0
      ? '<i class="fas fa-save"></i> 保存全部 (' + n + ')'
      : '<i class="fas fa-save"></i> 保存全部';
    updateSysBar();
  }

  function markDirty() { updateDirtyUI(); }

  // ==================== 顶栏「上次保存」 ====================
  function updateSysBar() {
    var ls = document.getElementById('sysLastSave');
    if (ls) ls.textContent = A.lastSaveTime || '—';
  }

  function setSaving(on) {
    document.getElementById('saveBtn').disabled = on;
    document.getElementById('saveBtn').innerHTML = on
      ? '<i class="fas fa-spinner fa-spin"></i> 保存中…'
      : '<i class="fas fa-save"></i> 保存全部';
    document.getElementById('revertBtn').disabled = on;
    if (!on) updateDirtyUI();
  }

  window.addEventListener('beforeunload', function (e) {
    if (dirtyCount() > 0) { e.preventDefault(); e.returnValue = ''; }
  });

  // ==================== 页面相关工具 ====================
  function pageName(id) {
    var p = S.pages.find(function (x) { return String(x.id) === String(id); });
    return p ? (p.slug || '?') : '?';
  }

  function firstPageId() {
    var p = S.pages.find(function (x) { return !x._deleted; });
    return p ? String(p.id) : '';
  }

  function pageOptions(selected) {
    return S.pages.filter(function (p) { return !p._deleted; }).map(function (p) {
      return '<option value="' + p.id + '"' + (String(p.id) === String(selected) ? ' selected' : '') + '>' +
        esc(p.slug) + (p._new ? ' (新)' : '') + '</option>';
    }).join('');
  }

  function fillPageFilters() {
    var opts = '<option value="">全部页面</option>' + S.pages.filter(function (p) { return !p._deleted; }).map(function (p) {
      return '<option value="' + p.id + '">' + esc(p.slug) + (p._new ? ' (新)' : '') + '</option>';
    }).join('');
    ['linkPageFilter', 'galleryPageFilter', 'petPageFilter'].forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var cur = sel.value;
      sel.innerHTML = opts;
      if (cur && S.pages.some(function (p) { return String(p.id) === cur; })) sel.value = cur;
      else sel.value = '';
    });
  }

  // 页内移动：只与同页相邻项交换（避免跨页交换）
  function moveWithinPage(arr, id, dir, getPage) {
    var i = arr.findIndex(function (x) { return String(x.id) === String(id); });
    if (i < 0) return;
    var step = dir === 'up' ? -1 : 1;
    var k = i + step;
    while (k >= 0 && k < arr.length && String(getPage(arr[k])) !== String(getPage(arr[i]))) k += step;
    if (k < 0 || k >= arr.length) return;
    var tmp = arr[i]; arr[i] = arr[k]; arr[k] = tmp;
    arr[i]._dirty = true; arr[k]._dirty = true;
    updateDirtyUI();
  }

  // 判断某条目是否是同页第一条 / 最后一条（用于上移/下移禁用）
  function pageEdge(arr, item, getPage) {
    var pid = String(getPage(item));
    var same = arr.filter(function (x) { return !x._deleted && String(getPage(x)) === pid; });
    return {
      first: same.length && String(same[0].id) === String(item.id),
      last: same.length && String(same[same.length - 1].id) === String(item.id)
    };
  }

  // ---- 模块导出 ----

  A.token = token; A.headers = headers; A.S = S; A.api = api; A.showToast = showToast; A.esc = esc; A.nextNewId = nextNewId; A.dirtyCount = dirtyCount; A.updateDirtyUI = updateDirtyUI; A.updateSysBar = updateSysBar; A.setSaving = setSaving; A.pageName = pageName; A.firstPageId = firstPageId; A.pageOptions = pageOptions; A.fillPageFilters = fillPageFilters; A.moveWithinPage = moveWithinPage; A.pageEdge = pageEdge;

})();
