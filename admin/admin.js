/**
 * admin.js — 管理面板逻辑（重写版）
 */
(function () {
  'use strict';

  // ---- 认证检查 ----
  var token = localStorage.getItem('admin_token');
  if (!token) { window.location.href = '/admin/'; return; }

  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };

  var pagesCache = [];
  var allTranslations = [];

  // ---- API 封装 ----
  async function api(url, method, body) {
    var opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(url, opts);
    if (res.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/';
      return null;
    }
    if (res.status === 204) return null;
    return await res.json();
  }

  function showToast(msg, isError) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.style.display = 'block';
    setTimeout(function () { toast.style.display = 'none'; }, 2500);
  }

  function esc(s) {
    return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
  }

  // ==================== 标签页 ====================
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      this.classList.add('active');
      document.getElementById('panel-' + this.dataset.tab).classList.add('active');
    });
  });

  // ==================== 页面列表 ====================
  async function loadPages() {
    pagesCache = await api('/api/admin/pages', 'GET') || [];
    ['linkPageFilter', 'galleryPageFilter', 'petPageFilter'].forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var cur = sel.value;
      sel.innerHTML = '<option value="">全部页面</option>';
      pagesCache.forEach(function (p) {
        sel.innerHTML += '<option value="' + p.id + '">' + esc(p.slug) + ' — ' + esc(p.title || '') + '</option>';
      });
      if (cur) sel.value = cur;
    });
  }

  // ==================== 链接管理 ====================
  var linksData = [];

  async function loadLinks() {
    await loadPages();
    var pid = document.getElementById('linkPageFilter').value;
    linksData = await api('/api/admin/links' + (pid ? '?page_id=' + pid : ''), 'GET') || [];
    renderLinks();
  }

  function renderLinks() {
    var list = document.getElementById('linksList');
    list.innerHTML = '';
    linksData.forEach(function (link, idx) {
      var d = document.createElement('div');
      d.className = 'link-card';
      d.dataset.id = link.id;
      d.innerHTML =
        '<div class="link-preview">' +
          '<img src="' + esc(link.icon) + '" onerror="this.src=\'data:image/svg+xml,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' viewBox=\\\'0 0 24 24\\\'><text y=\\\'18\\\' font-size=\\\'18\\\'>🔗</text></svg>\'">' +
          '<span>' + esc(link.label) + '</span></div>' +
        '<div class="link-form">' +
          '<div class="form-row">' +
            '<div class="form-group"><label>显示名称</label><input data-field="label" value="' + esc(link.label) + '"></div>' +
            '<div class="form-group"><label>多语言键(可选)</label><input data-field="i18n_key" value="' + esc(link.i18n_key || '') + '"></div></div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>图标</label><input data-field="icon" value="' + esc(link.icon || '') + '"></div>' +
            '<div class="form-group"><label>跳转链接(可选)</label><input data-field="url" value="' + esc(link.url || '') + '"></div></div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>二维码图片(可选)</label><input data-field="qr_code" value="' + esc(link.qr_code || '') + '"></div>' +
            '<div class="form-group"><label>备注(可选)</label><input data-field="popup_note" value="' + esc(link.popup_note || '') + '"></div></div>' +
          '<div class="form-group"><label>备注多语言键(可选)</label><input data-field="note_i18n_key" value="' + esc(link.note_i18n_key || '') + '"></div>' +
        '</div>' +
        '<div class="link-actions">' +
          '<button class="btn-icon" data-action="up"' + (idx === 0 ? ' disabled' : '') + '>&#8593;</button>' +
          '<button class="btn-icon" data-action="down"' + (idx === linksData.length - 1 ? ' disabled' : '') + '>&#8595;</button>' +
          '<button class="btn-icon btn-danger" data-action="delete">&times;</button></div>';
      list.appendChild(d);
    });

    list.querySelectorAll('.btn-icon').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(this.closest('.link-card').dataset.id);
        var action = this.dataset.action;
        if (action === 'delete') deleteLink(id);
        else moveLink(id, action === 'up' ? -1 : 1);
      });
    });
  }

  function moveLink(id, dir) {
    var i = linksData.findIndex(function (l) { return l.id === id; });
    var j = i + dir;
    if (j < 0 || j >= linksData.length) return;
    var tmp = linksData[i]; linksData[i] = linksData[j]; linksData[j] = tmp;
    linksData.forEach(function (l, k) { l.sort_order = k; });
    renderLinks();
  }

  async function deleteLink(id) {
    if (!confirm('确定删除？')) return;
    await api('/api/admin/links?id=' + id, 'DELETE');
    showToast('已删除'); loadLinks();
  }

  document.getElementById('linkPageFilter').addEventListener('change', loadLinks);
  document.getElementById('addLinkBtn').addEventListener('click', async function () {
    var pid = pagesCache.length ? pagesCache[0].id : 1;
    await api('/api/admin/links', 'POST', { page_id: pid, label: '新链接', sort_order: linksData.length });
    showToast('已添加'); loadLinks();
  });

  // ==================== 相册管理 ====================
  var galleryData = [];

  async function loadGallery() {
    await loadPages();
    var pid = document.getElementById('galleryPageFilter').value;
    galleryData = await api('/api/admin/gallery' + (pid ? '?page_id=' + pid : ''), 'GET') || [];
    renderGallery();
  }

  function renderGallery() {
    var list = document.getElementById('galleryList');
    list.innerHTML = '';
    galleryData.forEach(function (img) {
      var d = document.createElement('div');
      d.className = 'gallery-item';
      d.innerHTML = '<img src="' + esc(img.src) + '" onerror="this.style.display=\'none\'">' +
        '<div class="gallery-item-actions"><button class="btn-icon btn-danger" data-id="' + img.id + '">&times;</button></div>';
      list.appendChild(d);
    });
    list.querySelectorAll('.btn-icon').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('确定删除？')) return;
        await api('/api/admin/gallery?id=' + this.dataset.id, 'DELETE');
        showToast('已删除'); loadGallery();
      });
    });
  }

  document.getElementById('galleryPageFilter').addEventListener('change', loadGallery);
  document.getElementById('addGalleryBtn').addEventListener('click', async function () {
    var src = prompt('请输入图片 URL：');
    if (!src) return;
    var pid = pagesCache.length ? pagesCache[0].id : 1;
    await api('/api/admin/gallery', 'POST', { page_id: pid, src: src, sort_order: galleryData.length });
    showToast('已添加'); loadGallery();
  });

  // ==================== 宠物管理 ====================
  var petData = [];

  async function loadPet() {
    await loadPages();
    var pid = document.getElementById('petPageFilter').value;
    petData = await api('/api/admin/pet' + (pid ? '?page_id=' + pid : ''), 'GET') || [];
    renderPet();
  }

  function renderPet() {
    var list = document.getElementById('petList');
    list.innerHTML = '';
    var seen = {};
    petData.forEach(function (p) {
      if (seen[p.id]) return;
      seen[p.id] = true;
      var zh = [], en = [];
      petData.filter(function (x) { return x.id === p.id; }).forEach(function (x) {
        if (x.language === 'zh-CN' && x.messages) zh = x.messages;
        if (x.language === 'en' && x.messages) en = x.messages;
      });
      var d = document.createElement('div');
      d.className = 'card';
      d.style.padding = '1rem';
      d.dataset.id = p.id;
      d.innerHTML =
        '<div class="form-row">' +
          '<div class="form-group"><label>所属页面</label><select data-field="page_id">' +
            pagesCache.map(function (pg) { return '<option value="' + pg.id + '"' + (pg.id == p.page_id ? ' selected' : '') + '>' + esc(pg.slug) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="form-group"><label>宠物类型</label><input data-field="pet_type" value="' + esc(p.pet_type || '') + '"></div></div>' +
        '<div class="form-group"><label>宠物图片/视频 URL</label><input data-field="pet_image" value="' + esc(p.pet_image || '') + '"></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>中文语录（每行一条）</label><textarea data-field="messages_zh" rows="4">' + esc(zh.join('\n')) + '</textarea></div>' +
          '<div class="form-group"><label>英文语录（每行一条）</label><textarea data-field="messages_en" rows="4">' + esc(en.join('\n')) + '</textarea></div></div>' +
        '<div style="margin-top:0.8rem"><button class="btn-icon btn-danger" data-action="delete">&times;</button></div>';
      list.appendChild(d);
    });
    list.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('确定删除？')) return;
        await api('/api/admin/pet?id=' + this.closest('.card').dataset.id, 'DELETE');
        showToast('已删除'); loadPet();
      });
    });
  }

  document.getElementById('petPageFilter').addEventListener('change', loadPet);
  document.getElementById('addPetBtn').addEventListener('click', async function () {
    var pid = pagesCache.length ? pagesCache[0].id : 1;
    await api('/api/admin/pet', 'POST', { page_id: pid, pet_image: 'assets/pets/pet.webm', pet_type: 'cat', messages: { 'zh-CN': ['你好！'], 'en': ['Hello!'] } });
    showToast('已添加'); loadPet();
  });

  // ==================== 翻译管理 ====================
  async function loadTranslations() {
    allTranslations = await api('/api/admin/translations', 'GET') || [];
    renderTranslations();
  }

  function renderTranslations() {
    var sv = (document.getElementById('transSearch').value || '').toLowerCase();
    var grouped = {};
    allTranslations.forEach(function (t) {
      if (sv && t.key.toLowerCase().indexOf(sv) === -1) return;
      if (!grouped[t.key]) grouped[t.key] = { id_zh: null, id_en: null, zh: '', en: '' };
      if (t.language === 'zh-CN') { grouped[t.key].id_zh = t.id; grouped[t.key].zh = t.value; }
      if (t.language === 'en') { grouped[t.key].id_en = t.id; grouped[t.key].en = t.value; }
    });

    var list = document.getElementById('transList');
    var html = '<table class="data-table"><thead><tr><th>Key</th><th>中文</th><th>English</th><th>操作</th></tr></thead><tbody>';
    Object.keys(grouped).sort().forEach(function (key) {
      var g = grouped[key];
      html += '<tr data-key="' + esc(key) + '">' +
        '<td><input data-field="key" value="' + esc(key) + '"></td>' +
        '<td><input data-field="zh" value="' + esc(g.zh) + '"></td>' +
        '<td><input data-field="en" value="' + esc(g.en) + '"></td>' +
        '<td><button class="btn-icon btn-danger" data-action="delete">&times;</button></td></tr>';
    });
    html += '</tbody></table>';
    list.innerHTML = html;

    list.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var key = this.closest('tr').dataset.key;
        if (!confirm('确定删除「' + key + '」？')) return;
        var items = allTranslations.filter(function (t) { return t.key === key; });
        for (var i = 0; i < items.length; i++) {
          await api('/api/admin/translations?id=' + items[i].id, 'DELETE');
        }
        showToast('已删除'); loadTranslations();
      });
    });
  }

  document.getElementById('transSearch').addEventListener('input', renderTranslations);
  document.getElementById('addTransBtn').addEventListener('click', async function () {
    var key = prompt('请输入翻译 key：');
    if (!key) return;
    await api('/api/admin/translations', 'POST', { key: key, language: 'zh-CN', value: '' });
    await api('/api/admin/translations', 'POST', { key: key, language: 'en', value: '' });
    showToast('已添加'); loadTranslations();
  });

  // ==================== 设置 ====================
  async function loadSiteConfig() {
    var config = await api('/api/admin/site-config', 'GET');
    if (!config) return;
    var form = document.getElementById('siteConfigForm');
    form.avatar.value = config.avatar || '';
    form.username.value = config.username || '';
    form.favicon.value = config.favicon || '';
  }

  document.getElementById('siteConfigForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    await api('/api/admin/site-config', 'PUT', {
      avatar: this.avatar.value,
      username: this.username.value,
      favicon: this.favicon.value
    });
    showToast('站点配置已保存');
  });

  document.getElementById('changePasswordForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (this.newPassword.value !== this.confirmPassword.value) {
      showToast('两次输入的密码不一致', true); return;
    }
    var res = await api('/api/admin/change-password', 'POST', {
      oldPassword: this.oldPassword.value,
      newPassword: this.newPassword.value
    });
    if (res && res.success) {
      showToast('密码修改成功');
      this.reset();
    } else {
      showToast(res?.error || '修改失败', true);
    }
  });

  // ==================== 保存所有修改 ====================
  document.getElementById('saveBtn').addEventListener('click', async function () {
    var errors = [];

    // 保存链接
    var linkCards = document.querySelectorAll('#linksList .link-card');
    for (var i = 0; i < linkCards.length; i++) {
      var card = linkCards[i];
      var id = parseInt(card.dataset.id);
      var data = { sort_order: i };
      card.querySelectorAll('[data-field]').forEach(function (input) {
        data[input.dataset.field] = input.value || null;
      });
      var res = await api('/api/admin/links?id=' + id, 'PUT', data);
      if (!res) errors.push('链接 #' + id);
    }

    // 保存宠物
    var petCards = document.querySelectorAll('#petList .card');
    for (var j = 0; j < petCards.length; j++) {
      var pcard = petCards[j];
      var pid = parseInt(pcard.dataset.id);
      var pdata = {};
      pcard.querySelectorAll('[data-field]').forEach(function (input) {
        var field = input.dataset.field;
        if (field === 'messages_zh' || field === 'messages_en') return;
        pdata[field] = input.value || null;
      });
      // 处理语录
      var messages = {};
      var zhEl = pcard.querySelector('[data-field="messages_zh"]');
      var enEl = pcard.querySelector('[data-field="messages_en"]');
      if (zhEl && zhEl.value.trim()) messages['zh-CN'] = zhEl.value.split('\n').filter(function (l) { return l.trim(); });
      if (enEl && enEl.value.trim()) messages['en'] = enEl.value.split('\n').filter(function (l) { return l.trim(); });
      pdata.messages = messages;
      var pres = await api('/api/admin/pet?id=' + pid, 'PUT', pdata);
      if (!pres) errors.push('宠物 #' + pid);
    }

    // 保存翻译
    var transRows = document.querySelectorAll('#transList .data-table tbody tr');
    for (var k = 0; k < transRows.length; k++) {
      var row = transRows[k];
      var oldKey = row.dataset.key;
      var newKey = row.querySelector('[data-field="key"]').value;
      var zhVal = row.querySelector('[data-field="zh"]').value;
      var enVal = row.querySelector('[data-field="en"]').value;
      // 更新中文
      var zhItem = allTranslations.find(function (t) { return t.key === oldKey && t.language === 'zh-CN'; });
      if (zhItem) {
        await api('/api/admin/translations?id=' + zhItem.id, 'PUT', { key: newKey, language: 'zh-CN', value: zhVal });
      }
      // 更新英文
      var enItem = allTranslations.find(function (t) { return t.key === oldKey && t.language === 'en'; });
      if (enItem) {
        await api('/api/admin/translations?id=' + enItem.id, 'PUT', { key: newKey, language: 'en', value: enVal });
      }
    }

    if (errors.length) {
      showToast('部分保存失败: ' + errors.join(', '), true);
    } else {
      showToast('全部保存成功！');
    }
    // 重新加载
    loadLinks(); loadGallery(); loadPet(); loadTranslations();
  });

  // ==================== 导出 ====================
  document.getElementById('exportBtn').addEventListener('click', async function () {
    var data = {
      pages: await api('/api/admin/pages', 'GET'),
      links: await api('/api/admin/links', 'GET'),
      gallery: await api('/api/admin/gallery', 'GET'),
      pet: await api('/api/admin/pet', 'GET'),
      translations: await api('/api/admin/translations', 'GET'),
      siteConfig: await api('/api/admin/site-config', 'GET'),
      exportedAt: new Date().toISOString()
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'linktree-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); URL.revokeObjectURL(url);
    showToast('导出成功');
  });

  // ==================== 导入 ====================
  document.getElementById('importBtn').addEventListener('click', function () {
    document.getElementById('importFileInput').click();
  });

  document.getElementById('importFileInput').addEventListener('change', async function (e) {
    var file = e.target.files[0];
    if (!file) return;
    try {
      var text = await file.text();
      var data = JSON.parse(text);
      if (!confirm('确定导入备份数据？这将覆盖现有数据。')) return;

      // 导入站点配置
      if (data.siteConfig) await api('/api/admin/site-config', 'PUT', data.siteConfig);

      // 导入翻译
      if (data.translations) {
        for (var t of data.translations) {
          await api('/api/admin/translations', 'POST', { key: t.key, language: t.language, value: t.value });
        }
      }

      showToast('导入成功！刷新页面查看效果。');
      setTimeout(function () { location.reload(); }, 1500);
    } catch (err) {
      showToast('导入失败: ' + err.message, true);
    }
    this.value = '';
  });

  // ==================== 初始化 ====================
  loadPages().then(function () {
    loadLinks();
    loadGallery();
    loadPet();
    loadTranslations();
    loadSiteConfig();
  });

})();
