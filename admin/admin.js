/**
 * admin.js — 管理面板逻辑（重做版 · 显式保存模型）
 *
 * 设计要点：
 * 1. 所有增/删/改/排序都先落在本地「工作副本」，不触发任何写库；
 *    统一由顶部「保存全部(N)」批量提交。
 * 2. 每个被修改的条目显示「● 未保存」角标，保存按钮实时显示待保存数量。
 * 3. 「撤销全部」从服务器重新拉取，放弃所有本地修改。
 * 4. 有未保存改动时离开页面会弹窗提醒（beforeunload）。
 * 5. 排序号保存时按 page_id 分组重算，杜绝跨页排序错乱。
 * 6. 导出/导入字段对称：导出全量，导入走事务式 /api/admin/import 整库重建。
 */
(function () {
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
    links: [],   // {id, page_id, label, url, icon, qr_code, popup_note, i18n_key, note_i18n_key, is_active, sort_order, _new, _deleted, _dirty}
    gallery: [], // {id, page_id, src, sort_order, _new, _deleted, _dirty}
    pets: [],    // {id, page_id, pet_image, pet_type, messages:{'zh-CN':[],'en':[]}, _new, _deleted, _dirty}
    trans: [],   // {key, zh, en, id_zh, id_en, _new, _deleted, _dirty}
    site: { avatar: '', username: '', favicon: '', footer: '', extra: [] }, // extra: {key, value, _new, _deleted, _dirty}
    siteDirty: false,
    egg: { enabled: true, clicks: '5', timeout: '2000', target: '' }, // 彩蛋配置
    eggDirty: false,
    key: { enabled: true, rotation: 'daily', salt: '', permanent: '' }, // 密钥设置
    keyDirty: false
  };
  var newSeq = 1;
  var lastSaveTime = null; // SYS 状态行：上次保存时间

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
      updateSysBar();
    });
  });

  // ==================== 脏标记 / 保存按钮 ====================
  function dirtyCount() {
    var n = 0;
    ['pages', 'links', 'gallery', 'pets', 'trans'].forEach(function (k) {
      S[k].forEach(function (it) { if (it._dirty) n++; });
    });
    S.site.extra.forEach(function (it) { if (it._dirty) n++; });
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
    if (ls) ls.textContent = lastSaveTime || '—';
  }

  function setSaving(on) {
    document.getElementById('saveBtn').disabled = on;
    document.getElementById('saveBtn').innerHTML = on
      ? '<i class="fas fa-spinner fa-spin"></i> 保存中…'
      : '<i class="fas fa-save"></i> 保存全部';
    document.getElementById('revertBtn').disabled = on;
    document.getElementById('exportBtn').disabled = on;
    document.getElementById('importBtn').disabled = on;
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

  // ==================== 全量加载 ====================
  async function loadAll() {
    var results = await Promise.all([
      api('/api/admin/pages', 'GET'),
      api('/api/admin/links', 'GET'),
      api('/api/admin/gallery', 'GET'),
      api('/api/admin/pet', 'GET'),
      api('/api/admin/translations', 'GET'),
      api('/api/admin/site-config', 'GET')
    ]);
    var pages = results[0], links = results[1], gallery = results[2], pets = results[3], trans = results[4], site = results[5];

    S.pages = (pages || []).map(function (p) { return Object.assign({ _new: false, _deleted: false, _dirty: false }, p); });
    S.links = (links || []).map(function (l) { return Object.assign({ _new: false, _deleted: false, _dirty: false }, l); });
    S.gallery = (gallery || []).map(function (g) { return Object.assign({ _new: false, _deleted: false, _dirty: false }, g); });

    // pets: JOIN 行 -> 归一化（每只宠物一个对象，messages 按语言聚合）
    var petsBy = {};
    (pets || []).forEach(function (r) {
      if (!petsBy[r.id]) petsBy[r.id] = { id: r.id, page_id: r.page_id, pet_image: r.pet_image, pet_type: r.pet_type, messages: {} };
      if (r.language && r.messages !== null && r.messages !== undefined) {
        petsBy[r.id].messages[r.language] = typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages;
      }
    });
    S.pets = Object.keys(petsBy).map(function (k) {
      return Object.assign({ _new: false, _deleted: false, _dirty: false }, petsBy[k]);
    });

    // trans: 行 -> 按 key 分组
    var transBy = {};
    (trans || []).forEach(function (r) {
      if (!transBy[r.key]) transBy[r.key] = { key: r.key, zh: '', en: '', id_zh: null, id_en: null, _new: false, _deleted: false, _dirty: false };
      if (r.language === 'zh-CN') { transBy[r.key].id_zh = r.id; transBy[r.key].zh = r.value; }
      if (r.language === 'en') { transBy[r.key].id_en = r.id; transBy[r.key].en = r.value; }
    });
    S.trans = Object.keys(transBy).map(function (k) { return transBy[k]; });

    // links: 从翻译回显中英文名（方案A：表单只填中文名/英文名，键自动生成）
    S.links.forEach(function (l) {
      if (l.i18n_key) {
        var lt = transBy[l.i18n_key];
        l.label_zh = (lt && lt.zh) ? lt.zh : (l.label || '');
        l.label_en = (lt && lt.en) ? lt.en : '';
        l._autoKey = l.i18n_key.indexOf('link_') === 0;
      } else {
        l.label_zh = l.label || '';
        l.label_en = '';
        l._autoKey = false;
      }
    });

    // site
    var cfg = site || {};
    var managedKeys = ['avatar', 'username', 'favicon', 'footer', 'schema_version', 'egg_enabled', 'egg_clicks', 'egg_timeout', 'egg_target', 'key_enabled', 'key_rotation', 'key_salt', 'key_permanent'];
    S.site = {
      avatar: cfg.avatar || '',
      username: cfg.username || '',
      favicon: cfg.favicon || '',
      footer: cfg.footer || '',
      extra: Object.keys(cfg).filter(function (k) { return managedKeys.indexOf(k) === -1; })
        .map(function (k) { return { key: k, value: cfg[k] == null ? '' : String(cfg[k]), _new: false, _deleted: false, _dirty: false }; })
    };
    S.siteDirty = false;
    S.egg = {
      enabled: cfg.egg_enabled !== '0',
      clicks: cfg.egg_clicks != null ? String(cfg.egg_clicks) : '5',
      timeout: cfg.egg_timeout != null ? String(cfg.egg_timeout) : '2000',
      target: cfg.egg_target || ''
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
    renderLinks(); renderGallery(); renderPet(); renderTrans(); renderPages(); renderSite(); renderEgg(); renderKey();
  }

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

    // 重建翻译键下拉提示（datalist），列出翻译管理中所有可用键
    var oldDl = document.getElementById('i18nKeyOptions');
    if (oldDl && oldDl.parentNode) oldDl.parentNode.removeChild(oldDl);
    var dl = document.createElement('datalist');
    dl.id = 'i18nKeyOptions';
    S.trans.forEach(function (t) {
      if (t._deleted) return;
      var opt = document.createElement('option');
      opt.value = t.key;
      dl.appendChild(opt);
    });
    document.body.appendChild(dl);

    list.forEach(function (link) {
      var edge = pageEdge(S.links, link, function (x) { return x.page_id; });
      var card = document.createElement('div');
      card.className = 'card link-card' + (link._dirty ? ' dirty' : '');
      card.dataset.id = link.id;
      card.innerHTML =
        '<div class="card-head">' +
          '<span class="dirty-badge"' + (link._dirty ? '' : ' style="display:none"') + '>● 未保存</span>' +
          '<span class="card-title">' + esc(link.label_zh || link.label || '新链接') + '</span>' +
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
            '<div class="form-group"><label>中文名</label><input data-field="label_zh" value="' + esc(link.label_zh || '') + '"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>英文名(可选，留空=中英相同)</label><input data-field="label_en" value="' + esc(link.label_en || '') + '"></div>' +
            '<div class="form-group"><label>图标 URL</label><div class="icon-url-row"><input data-field="icon" value="' + esc(link.icon || '') + '" placeholder="https://cdn.simpleicons.org/github"><button type="button" class="btn btn-primary icon-picker-btn" data-action="open-simple-icons" title="从 Simple Icons 挑选品牌图标">SI</button></div></div>' +
          '</div>' +
          '<div class="sec-hint" style="margin-bottom:8px">翻译键：' + esc(link.i18n_key || '自动生成') + '（保存时自动写入翻译，无需手动填）</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>跳转链接(可选)</label><input data-field="url" value="' + esc(link.url || '') + '"></div>' +
            '<div class="form-group"><label>二维码图片(可选)</label><input data-field="qr_code" value="' + esc(link.qr_code || '') + '"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>备注(可选)</label><input data-field="popup_note" value="' + esc(link.popup_note || '') + '"></div>' +
            '<div class="form-group"><label>备注多语言键(可选)</label><input data-field="note_i18n_key" list="i18nKeyOptions" value="' + esc(link.note_i18n_key || '') + '"></div>' +
          '</div>' +
        '</div>';
      wrap.appendChild(card);
      bindEntityCard(card, link, S.links, function (x) { return x.page_id; }, '该链接');
      // 中文名输入时同步内部 label（前端 fallback）与卡片标题
      var zhInput = card.querySelector('[data-field="label_zh"]');
      if (zhInput) zhInput.addEventListener('input', function () {
        link.label = zhInput.value;
        var title = card.querySelector('.card-title');
        if (title) title.textContent = zhInput.value || '新链接';
      });
      var siBtn = card.querySelector('[data-action="open-simple-icons"]');
      if (siBtn) siBtn.addEventListener('click', function () { openSimpleIcons(link, card); });
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
        input.addEventListener('change', function () { item.is_active = input.checked; mark(); });
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
          renderAll();
        } else if (action === 'up' || action === 'down') {
          moveWithinPage(arr, item.id, action, getPage);
          renderAll();
        }
      });
    });
  }

  document.getElementById('linkPageFilter').addEventListener('change', function () { renderLinks(); updateSysBar(); });
  document.getElementById('addLinkBtn').addEventListener('click', function () {
    var pid = document.getElementById('linkPageFilter').value || firstPageId();
    if (!pid) { showToast('请先创建页面', true); return; }
    S.links.push({
      id: nextNewId(), page_id: pid, label: '新链接', label_zh: '新链接', label_en: '',
      url: '', icon: '', qr_code: '', popup_note: '', i18n_key: '', note_i18n_key: '',
      is_active: true, sort_order: 0, _autoKey: false,
      _new: true, _deleted: false, _dirty: true
    });
    updateDirtyUI(); renderLinks();
  });

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
      bindEntityCard(d, img, S.gallery, function (x) { return x.page_id; }, '该图片');
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
        var zh = (pet.messages && pet.messages['zh-CN']) || [];
        var en = (pet.messages && pet.messages['en']) || [];
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
            '<div class="form-group"><label>图片/视频 URL</label><input data-field="pet_image" value="' + esc(pet.pet_image || '') + '"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>中文语录（每行一条）</label><textarea data-field="messages_zh" rows="5">' + esc(zh.join('\n')) + '</textarea></div>' +
            '<div class="form-group"><label>英文语录（每行一条）</label><textarea data-field="messages_en" rows="5">' + esc(en.join('\n')) + '</textarea></div>' +
          '</div>';
        section.appendChild(card);

        var badge = card.querySelector('.dirty-badge');
        function mark() {
          pet._dirty = true;
          card.classList.add('dirty');
          badge.style.display = '';
          updateDirtyUI();
        }
        card.querySelectorAll('[data-field]').forEach(function (input) {
          if (input.dataset.field === 'messages_zh' || input.dataset.field === 'messages_en') {
            input.addEventListener('input', function () {
              var lang = input.dataset.field === 'messages_zh' ? 'zh-CN' : 'en';
              if (!pet.messages) pet.messages = {};
              pet.messages[lang] = input.value.split('\n').map(function (l) { return l.replace(/\r$/, ''); }).filter(function (l) { return l.trim(); });
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
            messages: { 'zh-CN': ['你好！'], 'en': ['Hello!'] },
            _new: true, _deleted: false, _dirty: true
          });
          updateDirtyUI(); renderPet();
        });
      }
      wrap.appendChild(section);
    });
  }

  document.getElementById('petPageFilter').addEventListener('change', function () { renderPet(); updateSysBar(); });

  // ==================== 翻译管理 ====================
  function renderTrans() {
    var sv = (document.getElementById('transSearch').value || '').toLowerCase();
    var rows = S.trans.filter(function (t) { return !t._deleted && (!sv || t.key.toLowerCase().indexOf(sv) !== -1); });
    rows.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });

    var wrap = document.getElementById('transList');
    var html = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Key</th><th>中文</th><th>English</th><th></th></tr></thead><tbody>';
    rows.forEach(function (t) {
      html += '<tr class="' + (t._dirty ? 'dirty' : '') + '" data-key="' + esc(t.key) + '">' +
        '<td><input class="t-key" value="' + esc(t.key) + '"></td>' +
        '<td><input class="t-zh" value="' + esc(t.zh) + '"></td>' +
        '<td><input class="t-en" value="' + esc(t.en) + '"></td>' +
        '<td><button class="btn-icon btn-danger" data-action="delete" title="删除">&times;</button></td></tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;

    var trs = wrap.querySelectorAll('tbody tr');
    Array.prototype.forEach.call(trs, function (tr) {
      var key = tr.dataset.key;
      var item = S.trans.find(function (t) { return !t._deleted && t.key === key; });
      if (!item) return;
      var kIn = tr.querySelector('.t-key'), zhIn = tr.querySelector('.t-zh'), enIn = tr.querySelector('.t-en');
      function mark() {
        item._dirty = true;
        tr.classList.add('dirty');
        updateDirtyUI();
      }
      kIn.addEventListener('input', function () { item.key = kIn.value; mark(); });
      zhIn.addEventListener('input', function () { item.zh = zhIn.value; mark(); });
      enIn.addEventListener('input', function () { item.en = enIn.value; mark(); });
      tr.querySelector('[data-action="delete"]').addEventListener('click', function () {
        if (!confirm('确定删除翻译「' + item.key + '」（中英一起删除）？')) return;
        item._deleted = true; item._dirty = true;
        updateDirtyUI(); renderTrans();
      });
    });
  }

  document.getElementById('transSearch').addEventListener('input', renderTrans);

  function addTrans() {
    var input = document.getElementById('transNewKey');
    var key = input.value.trim();
    if (!key) { showToast('请先输入翻译 key', true); return; }
    if (S.trans.some(function (t) { return !t._deleted && t.key.toLowerCase() === key.toLowerCase(); })) {
      showToast('该 key 已存在', true); return;
    }
    S.trans.push({ key: key, zh: '', en: '', id_zh: null, id_en: null, _new: true, _deleted: false, _dirty: true });
    input.value = '';
    updateDirtyUI(); renderTrans();
  }
  document.getElementById('transAddConfirm').addEventListener('click', addTrans);
  document.getElementById('transNewKey').addEventListener('keydown', function (e) { if (e.key === 'Enter') addTrans(); });

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
        '<div class="form-group"><label>背景图片 URL</label><input data-field="background_image" value="' + esc(p.background_image || '') + '"></div>';
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
          input.addEventListener('change', function () { p.is_active = input.checked; mark(); });
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
    fillPageFilters();
    renderAll();
  }

  function addPage() {
    var input = document.getElementById('pageNewSlug');
    var slug = input.value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!slug) { showToast('请先输入页面 slug', true); return; }
    if (S.pages.some(function (p) { return !p._deleted && p.slug.toLowerCase() === slug; })) {
      showToast('该 slug 已存在', true); return;
    }
    S.pages.push({
      id: nextNewId(), slug: slug, title: slug, background_image: '',
      is_active: true, sort_order: S.pages.length,
      _new: true, _deleted: false, _dirty: true
    });
    input.value = '';
    fillPageFilters(); updateDirtyUI(); renderAll();
  }
  document.getElementById('pageAddConfirm').addEventListener('click', addPage);
  document.getElementById('pageNewSlug').addEventListener('keydown', function (e) { if (e.key === 'Enter') addPage(); });

  // ==================== 设置：站点配置 ====================
  function renderSite() {
    var f = document.getElementById('siteConfigForm');
    f.avatar.value = S.site.avatar || '';
    f.username.value = S.site.username || '';
    f.favicon.value = S.site.favicon || '';
    f.footer.value = S.site.footer || '';

    var wrap = document.getElementById('extraKeysList');
    wrap.innerHTML = '';
    S.site.extra.filter(function (e) { return !e._deleted; }).forEach(function (e) {
      var row = document.createElement('div');
      row.className = 'extra-key-row' + (e._dirty ? ' dirty' : '');
      row.innerHTML =
        '<input class="ek-key" value="' + esc(e.key) + '" placeholder="键名">' +
        '<input class="ek-value" value="' + esc(e.value) + '" placeholder="值">' +
        '<button class="btn-icon btn-danger" data-action="delete" title="删除">&times;</button>';
      wrap.appendChild(row);
      var kIn = row.querySelector('.ek-key'), vIn = row.querySelector('.ek-value');
      function mark() {
        e._dirty = true;
        row.classList.add('dirty');
        updateDirtyUI();
      }
      kIn.addEventListener('input', function () { e.key = kIn.value; mark(); });
      vIn.addEventListener('input', function () { e.value = vIn.value; mark(); });
      row.querySelector('[data-action="delete"]').addEventListener('click', function () {
        if (!confirm('确定删除配置项「' + e.key + '」？')) return;
        e._deleted = true;
        updateDirtyUI(); renderSite();
      });
    });
  }

  // 站点基础字段（批量保存的一部分）
  (function () {
    var f = document.getElementById('siteConfigForm');
    ['avatar', 'username', 'favicon', 'footer'].forEach(function (name) {
      f[name].addEventListener('input', function () {
        S.site[name] = f[name].value;
        S.siteDirty = true;
        updateDirtyUI();
      });
    });
  })();

  function addExtraKey() {
    var input = document.getElementById('extraKeyNew');
    var key = input.value.trim();
    if (!key) { showToast('请先输入配置键名', true); return; }
    if (S.site.extra.some(function (e) { return !e._deleted && e.key === key; }) ||
        ['avatar', 'username', 'favicon', 'footer', 'schema_version', 'egg_enabled', 'egg_clicks', 'egg_timeout', 'egg_target', 'key_enabled', 'key_rotation', 'key_salt', 'key_permanent'].indexOf(key) !== -1) {
      showToast('该键已存在', true); return;
    }
    S.site.extra.push({ key: key, value: '', _new: true, _deleted: false, _dirty: true });
    input.value = '';
    updateDirtyUI(); renderSite();
  }
  document.getElementById('extraKeyAddConfirm').addEventListener('click', addExtraKey);
  document.getElementById('extraKeyNew').addEventListener('keydown', function (e) { if (e.key === 'Enter') addExtraKey(); });

  // ==================== 设置：彩蛋（Easter Egg） ====================
  function renderEgg() {
    var f = document.getElementById('eggConfigForm');
    if (!f) return;
    f.eggEnabled.checked = !!S.egg.enabled;
    f.eggClicks.value = S.egg.clicks;
    f.eggTimeout.value = S.egg.timeout;
    f.eggTarget.value = S.egg.target;
  }
  (function () {
    var f = document.getElementById('eggConfigForm');
    if (!f) return;
    function mark() {
      S.eggDirty = true;
      updateDirtyUI();
    }
    f.eggEnabled.addEventListener('change', function () { S.egg.enabled = f.eggEnabled.checked; mark(); });
    f.eggClicks.addEventListener('input', function () { S.egg.clicks = f.eggClicks.value; mark(); });
    f.eggTimeout.addEventListener('input', function () { S.egg.timeout = f.eggTimeout.value; mark(); });
    f.eggTarget.addEventListener('input', function () { S.egg.target = f.eggTarget.value; mark(); });
  })();

  // ==================== 设置：密钥（耳语页 ?k= 访问控制） ====================
  function renderKey() {
    var f = document.getElementById('keyConfigForm');
    if (!f) return;
    f.keyEnabled.checked = !!S.key.enabled;
    f.keyRotation.value = S.key.rotation;
    f.keySalt.value = S.key.salt;
    f.keyPermanent.value = S.key.permanent;
    updateKeyCurrent();
  }
  function updateKeyCurrent() {
    var el = document.getElementById('keyCurrent');
    if (!el) return;
    el.textContent = window.__keygen ? window.__keygen.currentKey(S.key.rotation || 'daily', S.key.salt || '') : '——';
  }
  (function () {
    var f = document.getElementById('keyConfigForm');
    if (!f) return;
    function mark() {
      S.keyDirty = true;
      updateDirtyUI();
      updateKeyCurrent();
    }
    f.keyEnabled.addEventListener('change', function () { S.key.enabled = f.keyEnabled.checked; mark(); });
    f.keyRotation.addEventListener('change', function () { S.key.rotation = f.keyRotation.value; mark(); });
    f.keySalt.addEventListener('input', function () { S.key.salt = f.keySalt.value; mark(); });
    f.keyPermanent.addEventListener('input', function () { S.key.permanent = f.keyPermanent.value; mark(); });
    document.getElementById('keyCopyBtn').addEventListener('click', function () {
      if (!window.__keygen) { showToast('密钥模块未加载', true); return; }
      var k = window.__keygen.currentKey(S.key.rotation || 'daily', S.key.salt || '');
      var link = window.location.origin + '/whisper/?k=' + k;
      if (navigator.clipboard) navigator.clipboard.writeText(link);
      showToast('已复制耳语页链接（含当前密钥）');
    });
    document.getElementById('keyCopyMainBtn').addEventListener('click', function () {
      if (!window.__keygen) { showToast('密钥模块未加载', true); return; }
      var k = window.__keygen.currentKey(S.key.rotation || 'daily', S.key.salt || '');
      var link = window.location.origin + '/?k=' + k;
      if (navigator.clipboard) navigator.clipboard.writeText(link);
      showToast('已复制主页入口链接（含密钥），打开后提示如何用彩蛋进入耳语页');
    });
  })();

  // ==================== 设置：修改用户名 / 密码（即时生效） ====================
  document.getElementById('changeUsernameForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    try {
      var res = await api('/api/admin/change-password', 'POST', {
        oldPassword: this.oldPassword.value,
        newUsername: this.newUsername.value.trim()
      });
      if (res && res.success) {
        var name = res.username || this.newUsername.value.trim();
        localStorage.setItem('admin_username', name);
        document.getElementById('loginUser').textContent = '@' + name;
        showToast('用户名已修改为 ' + name);
        this.reset();
      } else {
        showToast((res && res.error) || '修改失败', true);
      }
    } catch (err) {
      showToast(err.message || '修改失败', true);
    }
  });

  document.getElementById('changePasswordForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (this.newPassword.value !== this.confirmPassword.value) {
      showToast('两次输入的新密码不一致', true); return;
    }
    try {
      var res = await api('/api/admin/change-password', 'POST', {
        oldPassword: this.oldPassword.value,
        newPassword: this.newPassword.value
      });
      if (res && res.success) {
        showToast('密码修改成功');
        this.reset();
      } else {
        showToast((res && res.error) || '修改失败', true);
      }
    } catch (err) {
      showToast(err.message || '修改失败', true);
    }
  });

  // ==================== 保存全部（批量提交） ====================
  // 依赖顺序：先建/改页面（新页面 id 供子内容引用）→ 子内容 → 删页面 → 翻译 → 站点配置
  async function saveAll() {
    var errs = [];
    setSaving(true);
    try {
      await savePagesPhase1(errs); // 新建 + 更新页面，重映射子内容 page_id
      await savePets(errs);
      await saveGallery(errs);
      await saveLinks(errs);
      await savePagesPhase2(errs); // 删除页面（子内容已删）
      await saveTrans(errs);
      await saveSite(errs);
    } catch (err) {
      errs.push(err.message);
    }
    setSaving(false);
    if (errs.length) {
      showToast('保存完成，但有 ' + errs.length + ' 处失败：' + errs.slice(0, 3).join('；'), true, 4500);
    } else {
      showToast('全部保存成功！');
      lastSaveTime = new Date().toTimeString().slice(0, 5);
    }
    try { await loadAll(); } catch (e) { /* 已提示 */ }
  }

  // 按 page_id 分组重算 sort_order（仅作用于非删除条目）
  function assignSort(arr, getPage) {
    var byPage = {};
    arr.forEach(function (it) {
      if (it._deleted) return;
      var k = String(getPage(it));
      (byPage[k] = byPage[k] || []).push(it);
    });
    Object.keys(byPage).forEach(function (k) {
      byPage[k].forEach(function (it, i) { it.sort_order = i; });
    });
  }

  async function savePagesPhase1(errs) {
    var arr = S.pages;
    var touched = arr.some(function (p) { return p._dirty; });
    if (!touched) return;
    try {
      // 新建页面（先生成真实 id，并重映射子内容引用）
      for (var it of arr) {
        if (it._new && !it._deleted) {
          if (!it.slug || !it.slug.trim()) {
            errs.push('页面「' + (it.title || '未命名') + '」的 slug 为空，已跳过');
            continue;
          }
          var res = await api('/api/admin/pages', 'POST', {
            slug: it.slug, title: it.title || '', background_image: it.background_image || null,
            is_active: it.is_active, sort_order: it.sort_order, gallery_enabled: it.gallery_enabled !== false
          });
          if (res && res.id != null) {
            var oldId = String(it.id);
            ['links', 'gallery', 'pets'].forEach(function (k) {
              S[k].forEach(function (c) { if (String(c.page_id) === oldId) c.page_id = res.id; });
            });
            it.id = res.id;
            it._new = false;
          }
        }
      }
      // 更新已有页面
      assignSort(arr, function () { return 0; });
      for (var it2 of arr) {
        if (!it2._new && !it2._deleted && it2._dirty) {
          await api('/api/admin/pages?id=' + it2.id, 'PUT', {
            slug: it2.slug, title: it2.title || '', background_image: it2.background_image || null,
            is_active: it2.is_active, sort_order: it2.sort_order, gallery_enabled: it2.gallery_enabled !== false
          });
          it2._dirty = false;
        }
      }
    } catch (e) { errs.push('页面：' + e.message); }
  }

  async function savePagesPhase2(errs) {
    var arr = S.pages;
    try {
      for (var it of arr) {
        if (it._deleted && !it._new && it.id != null) {
          await api('/api/admin/pages?id=' + it.id, 'DELETE');
        }
      }
    } catch (e) { errs.push('删除页面：' + e.message); }
  }

  async function savePets(errs) {
    var arr = S.pets;
    if (!arr.some(function (p) { return p._dirty; })) return;
    try {
      for (var it of arr) if (it._deleted && !it._new && it.id != null) await api('/api/admin/pet?id=' + it.id, 'DELETE');
      for (var it of arr) if (it._new && !it._deleted) {
        var res = await api('/api/admin/pet', 'POST', {
          page_id: it.page_id, pet_image: it.pet_image || '', pet_type: it.pet_type || '', messages: it.messages || {},
          is_active: it.is_active !== false
        });
        if (res && res.id != null) it.id = res.id;
      }
      for (var it of arr) if (!it._new && !it._deleted && it._dirty) {
        await api('/api/admin/pet?id=' + it.id, 'PUT', {
          pet_image: it.pet_image || '', pet_type: it.pet_type || '', messages: it.messages || {},
          is_active: it.is_active !== false
        });
      }
    } catch (e) { errs.push('宠物：' + e.message); }
  }

  async function saveGallery(errs) {
    var arr = S.gallery;
    if (!arr.some(function (g) { return g._dirty; })) return;
    try {
      for (var it of arr) if (it._deleted && !it._new && it.id != null) await api('/api/admin/gallery?id=' + it.id, 'DELETE');
      assignSort(arr, function (g) { return g.page_id; });
      for (var it of arr) if (it._new && !it._deleted) {
        if (!it.src || !it.src.trim()) { errs.push('相册：存在空图片地址，已跳过'); continue; }
        await api('/api/admin/gallery', 'POST', { page_id: it.page_id, src: it.src, sort_order: it.sort_order, is_active: it.is_active !== false });
      }
      for (var it of arr) if (!it._new && !it._deleted && it._dirty) {
        await api('/api/admin/gallery?id=' + it.id, 'PUT', { page_id: it.page_id, src: it.src, sort_order: it.sort_order, is_active: it.is_active !== false });
      }
    } catch (e) { errs.push('相册：' + e.message); }
  }

  // 自动生成翻译键 + 把链接的中英文名同步进翻译表（方案A：用户不感知键）
  function genAutoKey() {
    return 'link_' + Math.random().toString(36).slice(2, 10);
  }
  function syncLinkTrans() {
    S.links.forEach(function (l) {
      if (l._deleted) return;
      if (!l.i18n_key) { l.i18n_key = genAutoKey(); l._autoKey = true; }
      if (l.label_zh == null && l.label_en == null) return;
      var t = S.trans.find(function (x) { return !x._deleted && x.key === l.i18n_key; });
      var zh = (l.label_zh != null && l.label_zh !== '') ? l.label_zh : l.label;
      var en = l.label_en || '';
      if (!t) {
        S.trans.push({ key: l.i18n_key, zh: zh || '', en: en || '', id_zh: null, id_en: null, _new: true, _deleted: false, _dirty: true });
      } else {
        if (zh && zh !== t.zh) { t.zh = zh; t._dirty = true; }
        if (en && en !== t.en) { t.en = en; t._dirty = true; }
      }
    });
  }

  async function saveLinks(errs) {
    var arr = S.links;
    if (!arr.some(function (l) { return l._dirty; })) return;
    syncLinkTrans();
    // 收集将被删除的自动键翻译（孤儿），删除链接后交给 saveTrans 一并清理
    var orphanKeys = [];
    arr.forEach(function (it) {
      if (it._deleted && it.i18n_key && it.i18n_key.indexOf('link_') === 0) {
        var stillUsed = arr.some(function (x) { return !x._deleted && x.i18n_key === it.i18n_key; });
        if (!stillUsed) orphanKeys.push(it.i18n_key);
      }
    });
    try {
      for (var it of arr) if (it._deleted && !it._new && it.id != null) await api('/api/admin/links?id=' + it.id, 'DELETE');
      orphanKeys.forEach(function (k) {
        var t = S.trans.find(function (x) { return !x._deleted && x.key === k; });
        if (t) { t._deleted = true; t._dirty = true; }
      });
      assignSort(arr, function (l) { return l.page_id; });
      for (var it of arr) if (it._new && !it._deleted) {
        await api('/api/admin/links', 'POST', {
          page_id: it.page_id, label: it.label_zh || it.label || '链接', url: it.url || null, icon: it.icon || null,
          qr_code: it.qr_code || null, popup_note: it.popup_note || null,
          i18n_key: it.i18n_key || null, note_i18n_key: it.note_i18n_key || null,
          is_active: it.is_active, sort_order: it.sort_order
        });
      }
      for (var it of arr) if (!it._new && !it._deleted && it._dirty) {
        await api('/api/admin/links?id=' + it.id, 'PUT', {
          page_id: it.page_id, label: it.label_zh || it.label || '链接', url: it.url || null, icon: it.icon || null,
          qr_code: it.qr_code || null, popup_note: it.popup_note || null,
          i18n_key: it.i18n_key || null, note_i18n_key: it.note_i18n_key || null,
          is_active: it.is_active, sort_order: it.sort_order
        });
      }
    } catch (e) { errs.push('链接：' + e.message); }
  }

  async function saveTrans(errs) {
    var arr = S.trans;
    if (!arr.some(function (t) { return t._dirty; })) return;
    try {
      for (var t of arr) if (t._deleted) {
        if (t.id_zh) await api('/api/admin/translations?id=' + t.id_zh, 'DELETE');
        if (t.id_en) await api('/api/admin/translations?id=' + t.id_en, 'DELETE');
      }
      for (var t of arr) if (t._new && !t._deleted) {
        if (!t.key || !t.key.trim()) { errs.push('翻译：存在空 key，已跳过'); continue; }
        if (t.zh) { var r1 = await api('/api/admin/translations', 'POST', { key: t.key, language: 'zh-CN', value: t.zh }); if (r1 && r1.id) t.id_zh = r1.id; }
        if (t.en) { var r2 = await api('/api/admin/translations', 'POST', { key: t.key, language: 'en', value: t.en }); if (r2 && r2.id) t.id_en = r2.id; }
      }
      for (var t of arr) if (!t._new && !t._deleted && t._dirty) {
        if (!t.key || !t.key.trim()) { errs.push('翻译：存在空 key，已跳过'); continue; }
        if (t.id_zh) await api('/api/admin/translations?id=' + t.id_zh, 'PUT', { key: t.key, language: 'zh-CN', value: t.zh });
        else if (t.zh) { var r3 = await api('/api/admin/translations', 'POST', { key: t.key, language: 'zh-CN', value: t.zh }); if (r3 && r3.id) t.id_zh = r3.id; }
        if (t.id_en) await api('/api/admin/translations?id=' + t.id_en, 'PUT', { key: t.key, language: 'en', value: t.en });
        else if (t.en) { var r4 = await api('/api/admin/translations', 'POST', { key: t.key, language: 'en', value: t.en }); if (r4 && r4.id) t.id_en = r4.id; }
      }
    } catch (e) { errs.push('翻译：' + e.message); }
  }

  async function saveSite(errs) {
    try {
      var body = {};
      if (S.siteDirty) {
        body.avatar = S.site.avatar || '';
        body.username = S.site.username || '';
        body.favicon = S.site.favicon || '';
        body.footer = S.site.footer || '';
      }
      if (S.eggDirty) {
        body.egg_enabled = S.egg.enabled ? '1' : '0';
        body.egg_clicks = String(S.egg.clicks || '5');
        body.egg_timeout = String(S.egg.timeout || '2000');
        body.egg_target = S.egg.target || '';
      }
      if (S.keyDirty) {
        body.key_enabled = S.key.enabled ? '1' : '0';
        body.key_rotation = S.key.rotation || 'daily';
        body.key_salt = S.key.salt || '';
        body.key_permanent = S.key.permanent || '';
      }
      S.site.extra.forEach(function (e) {
        if (e._dirty && !e._deleted) body[e.key] = e.value || '';
      });
      for (var e of S.site.extra) {
        if (e._deleted && !e._new) {
          await api('/api/admin/site-config?key=' + encodeURIComponent(e.key), 'DELETE');
        }
      }
      if (Object.keys(body).length) await api('/api/admin/site-config', 'PUT', body);
    } catch (e) { errs.push('站点配置：' + e.message); }
  }

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

  // ==================== 顶部按钮 ====================
  document.getElementById('saveBtn').addEventListener('click', saveAll);

  document.getElementById('revertBtn').addEventListener('click', async function () {
    if (dirtyCount() === 0) { showToast('当前没有未保存修改'); return; }
    if (!confirm('放弃所有未保存修改并从服务器重新加载？')) return;
    setSaving(true);
    try { await loadAll(); showToast('已撤销全部修改'); }
    catch (e) { showToast('撤销失败：' + e.message, true); }
    setSaving(false);
  });

  document.getElementById('exportBtn').addEventListener('click', function () {
    var data = {
      pages: S.pages.filter(function (p) { return !p._deleted; }).map(function (p) {
        return { id: p.id, slug: p.slug, title: p.title, background_image: p.background_image, is_active: p.is_active, gallery_enabled: p.gallery_enabled !== false, sort_order: p.sort_order };
      }),
      links: S.links.filter(function (l) { return !l._deleted; }).map(function (l) {
        return { page_id: l.page_id, label: l.label, url: l.url, icon: l.icon, qr_code: l.qr_code, popup_note: l.popup_note, i18n_key: l.i18n_key, note_i18n_key: l.note_i18n_key, is_active: l.is_active, sort_order: l.sort_order };
      }),
      gallery: S.gallery.filter(function (g) { return !g._deleted; }).map(function (g) {
        return { page_id: g.page_id, src: g.src, sort_order: g.sort_order, is_active: g.is_active !== false };
      }),
      pet: S.pets.filter(function (p) { return !p._deleted; }).map(function (p) {
        return { page_id: p.page_id, pet_image: p.pet_image, pet_type: p.pet_type, is_active: p.is_active !== false, messages: p.messages || {} };
      }),
      translations: [],
      siteConfig: {}
    };
    S.trans.filter(function (t) { return !t._deleted; }).forEach(function (t) {
      if (t.zh) data.translations.push({ key: t.key, language: 'zh-CN', value: t.zh });
      if (t.en) data.translations.push({ key: t.key, language: 'en', value: t.en });
    });
    data.siteConfig = {
      avatar: S.site.avatar, username: S.site.username, favicon: S.site.favicon, footer: S.site.footer,
      egg_enabled: S.egg.enabled ? '1' : '0',
      egg_clicks: S.egg.clicks, egg_timeout: S.egg.timeout, egg_target: S.egg.target,
      key_enabled: S.key.enabled ? '1' : '0',
      key_rotation: S.key.rotation, key_salt: S.key.salt, key_permanent: S.key.permanent
    };
    S.site.extra.filter(function (e) { return !e._deleted; }).forEach(function (e) { data.siteConfig[e.key] = e.value; });

    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'linktree-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('导出成功（' + Object.keys(data).reduce(function (n, k) { return n + (Array.isArray(data[k]) ? data[k].length : 0); }, 0) + ' 条记录）');
  });

  document.getElementById('importBtn').addEventListener('click', function () {
    document.getElementById('importFileInput').click();
  });

  document.getElementById('importFileInput').addEventListener('change', async function (e) {
    var file = e.target.files[0];
    if (!file) return;
    try {
      var text = await file.text();
      var data = JSON.parse(text);
      if (!confirm('导入将重建全部数据（页面/链接/相册/宠物/翻译/站点配置），当前未保存修改会丢失。确定？')) {
        this.value = ''; return;
      }
      setSaving(true);
      try {
        var res = await api('/api/admin/import', 'POST', data);
        if (res && res.success) {
          showToast('导入成功！' + JSON.stringify(res.counts || {}));
          await loadAll();
        } else {
          showToast((res && res.error) || '导入失败', true);
        }
      } finally {
        setSaving(false);
      }
    } catch (err) {
      showToast('导入失败：' + err.message, true);
    }
    this.value = '';
  });

  // ==================== ⌘K 命令面板（签名） ====================
  var cmdOverlay = document.getElementById('cmdPalette');
  var cmdInput = document.getElementById('cmdInput');
  var cmdList = document.getElementById('cmdList');
  var cmdItems = [];
  var cmdActive = 0;

  function buildCmdItems() {
    cmdItems = [];
    document.querySelectorAll('.tab[data-tab]').forEach(function (t) {
      var sp = t.querySelector('span');
      var label = sp ? sp.textContent.trim() : t.textContent.trim();
      cmdItems.push({ label: label, hint: '跳转面板', run: function () { t.click(); } });
    });
    cmdItems.push({
      label: '保存全部', hint: 'Ctrl/⌘ + S',
      run: function () { var b = document.getElementById('saveBtn'); if (b && !b.disabled) b.click(); }
    });
    cmdItems.push({
      label: '撤销未保存修改', hint: '',
      run: function () { var b = document.getElementById('revertBtn'); if (b) b.click(); }
    });
    cmdItems.push({
      label: '导出备份', hint: '',
      run: function () { var b = document.getElementById('exportBtn'); if (b) b.click(); }
    });
    cmdItems.push({
      label: '导入备份', hint: '',
      run: function () { var b = document.getElementById('importBtn'); if (b) b.click(); }
    });
    cmdItems.push({
      label: '返回主页', hint: '',
      run: function () { window.location.href = '/'; }
    });
    cmdItems.push({
      label: '退出登录', hint: '',
      run: function () {
        if (!confirm('确定退出登录？')) return;
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        window.location.href = '/admin/';
      }
    });
  }

  function renderCmdList(q) {
    var query = (q || '').toLowerCase().trim();
    var shown = cmdItems.filter(function (it) {
      return !query || it.label.toLowerCase().indexOf(query) !== -1;
    });
    cmdList.innerHTML = '';
    if (!shown.length) {
      var empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = '没有匹配的操作';
      cmdList.appendChild(empty);
      cmdActive = -1;
      return;
    }
    shown.forEach(function (it, i) {
      var li = document.createElement('li');
      li.textContent = it.label;
      var hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = it.hint;
      li.appendChild(hint);
      li.addEventListener('click', function () {
        cmdOverlay.classList.remove('open');
        it.run();
      });
      li.addEventListener('mousemove', function () { setCmdActive(i); });
      cmdList.appendChild(li);
    });
    cmdActive = 0;
    setCmdActive(0);
  }

  function setCmdActive(i) {
    cmdActive = i;
    var lis = cmdList.querySelectorAll('li');
    Array.prototype.forEach.call(lis, function (li, idx) {
      li.classList.toggle('active', idx === i);
    });
    var el = lis[i];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  function openCmd() {
    cmdOverlay.classList.add('open');
    cmdInput.value = '';
    renderCmdList('');
    cmdInput.focus();
  }
  function closeCmd() {
    cmdOverlay.classList.remove('open');
  }

  cmdInput.addEventListener('input', function () { renderCmdList(cmdInput.value); });
  cmdInput.addEventListener('keydown', function (e) {
    var lis = cmdList.querySelectorAll('li');
    if (e.key === 'Escape') { e.preventDefault(); closeCmd(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCmdActive(Math.min(cmdActive + 1, Math.max(lis.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCmdActive(Math.max(cmdActive - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      var el = lis[cmdActive];
      if (el && !el.classList.contains('empty')) {
        closeCmd();
        el.click();
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    var key = (e.key || '').toLowerCase();
    if ((e.metaKey || e.ctrlKey) && key === 'k') {
      e.preventDefault();
      if (cmdOverlay.classList.contains('open')) closeCmd();
      else openCmd();
    } else if ((e.metaKey || e.ctrlKey) && key === 's') {
      e.preventDefault();
      var sb = document.getElementById('saveBtn');
      if (sb && !sb.disabled) sb.click();
    } else if (key === '/' && !cmdOverlay.classList.contains('open')) {
      var t = e.target;
      var tag = t && t.tagName ? t.tagName.toLowerCase() : '';
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select' && !(t && t.isContentEditable)) {
        e.preventDefault();
        openCmd();
      }
    }
  });

  buildCmdItems();

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
})();
