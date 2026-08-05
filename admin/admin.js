/**
 * admin.js — 管理面板逻辑
 */
(function () {
  'use strict';

  var token = localStorage.getItem('admin_token');
  var username = localStorage.getItem('admin_username');
  if (!token) { window.location.href = 'index.html'; return; }

  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };

  // ---- 初始化 ----
  document.getElementById('adminUser').textContent = username || 'admin';

  // ---- 退出登录 ----
  document.getElementById('logoutBtn').addEventListener('click', function () {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    window.location.href = 'index.html';
  });

  // ---- 侧边栏导航 ----
  var navItems = document.querySelectorAll('.nav-item');
  var sections = document.querySelectorAll('.admin-section');
  navItems.forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      var section = this.getAttribute('data-section');
      navItems.forEach(function (n) { n.classList.remove('active'); });
      sections.forEach(function (s) { s.classList.remove('active'); });
      this.classList.add('active');
      document.getElementById('section-' + section).classList.add('active');
      // 加载数据
      if (section === 'site-config') loadSiteConfig();
      else if (section === 'links') loadLinks();
      else if (section === 'gallery') loadGallery();
      else if (section === 'pet') loadPet();
      else if (section === 'translations') loadTranslations();
    });
  });

  // ---- Toast 提示 ----
  function showToast(msg, isError) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.style.display = 'block';
    setTimeout(function () { toast.style.display = 'none'; }, 2000);
  }

  // ---- API 请求封装 ----
  async function api(url, method, body) {
    var opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(url, opts);
    if (res.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = 'index.html';
      return null;
    }
    if (res.status === 204) return null;
    return await res.json();
  }

  // ==================== 页面列表 ====================
  var pagesCache = [];

  async function loadPages() {
    pagesCache = await api('/api/admin/pages', 'GET') || [];
    // 填充所有页面选择器
    var selectors = ['linkPageFilter', 'galleryPageFilter', 'petPageFilter',
                     'linkForm', 'galleryForm', 'petForm'];
    selectors.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      // 找到 page_id 的 select
      var select = el.querySelector('select[name="page_id"]') || el;
      if (select.tagName !== 'SELECT') return;
      var current = select.value;
      select.innerHTML = '';
      pagesCache.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.slug + ' — ' + (p.title || '');
        select.appendChild(opt);
      });
      if (current) select.value = current;
    });
    // 填充 filter 选择器
    ['linkPageFilter', 'galleryPageFilter', 'petPageFilter'].forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var current = sel.value;
      sel.innerHTML = '<option value="">全部页面</option>';
      pagesCache.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.slug;
        sel.appendChild(opt);
      });
      if (current) sel.value = current;
    });
  }

  // ==================== 站点配置 ====================
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
    var data = {
      avatar: this.avatar.value,
      username: this.username.value,
      favicon: this.favicon.value
    };
    await api('/api/admin/site-config', 'PUT', data);
    showToast('保存成功！');
  });

  // ==================== 链接管理 ====================
  async function loadLinks() {
    await loadPages();
    var pageId = document.getElementById('linkPageFilter').value;
    var url = '/api/admin/links' + (pageId ? '?page_id=' + pageId : '');
    var links = await api(url, 'GET') || [];
    var list = document.getElementById('linksList');
    list.innerHTML = '';
    links.forEach(function (link) {
      var item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML =
        '<span class="list-item-label">' + escHtml(link.label) + '</span>' +
        '<span class="list-item-sub">' + escHtml(link.url || '无链接') + '</span>' +
        '<div class="list-item-actions">' +
        '<button class="btn-edit" data-id="' + link.id + '">编辑</button>' +
        '<button class="btn-delete" data-id="' + link.id + '">删除</button>' +
        '</div>';
      list.appendChild(item);
    });
    // 绑定事件
    list.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () { editLink(this.dataset.id, links); });
    });
    list.querySelectorAll('.btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteLink(this.dataset.id); });
    });
  }

  document.getElementById('linkPageFilter').addEventListener('change', loadLinks);
  document.getElementById('addLinkBtn').addEventListener('click', function () {
    document.getElementById('linkEditorTitle').textContent = '添加链接';
    document.getElementById('linkForm').reset();
    document.getElementById('linkForm').id_input && (document.getElementById('linkForm').id_input.value = '');
    document.getElementById('linkEditor').style.display = 'block';
  });
  document.getElementById('cancelLinkBtn').addEventListener('click', function () {
    document.getElementById('linkEditor').style.display = 'none';
  });

  function editLink(id, links) {
    var link = links.find(function (l) { return l.id == id; });
    if (!link) return;
    var form = document.getElementById('linkForm');
    form.querySelector('input[name="id"]').value = link.id;
    form.querySelector('select[name="page_id"]').value = link.page_id;
    form.label.value = link.label || '';
    form.url.value = link.url || '';
    form.icon.value = link.icon || '';
    form.qr_code.value = link.qr_code || '';
    form.popup_note.value = link.popup_note || '';
    form.sort_order.value = link.sort_order || 0;
    document.getElementById('linkEditorTitle').textContent = '编辑链接';
    document.getElementById('linkEditor').style.display = 'block';
  }

  async function deleteLink(id) {
    if (!confirm('确定删除这个链接？')) return;
    await api('/api/admin/links?id=' + id, 'DELETE');
    showToast('已删除');
    loadLinks();
  }

  document.getElementById('linkForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = this.querySelector('input[name="id"]').value;
    var data = {
      page_id: parseInt(this.page_id.value),
      label: this.label.value,
      url: this.url.value || null,
      icon: this.icon.value || null,
      qr_code: this.qr_code.value || null,
      popup_note: this.popup_note.value || null,
      sort_order: parseInt(this.sort_order.value) || 0,
      is_active: true
    };
    if (id) {
      await api('/api/admin/links?id=' + id, 'PUT', data);
    } else {
      await api('/api/admin/links', 'POST', data);
    }
    showToast('保存成功！');
    document.getElementById('linkEditor').style.display = 'none';
    loadLinks();
  });

  // ==================== 相册管理 ====================
  async function loadGallery() {
    await loadPages();
    var pageId = document.getElementById('galleryPageFilter').value;
    var url = '/api/admin/gallery' + (pageId ? '?page_id=' + pageId : '');
    var images = await api(url, 'GET') || [];
    var list = document.getElementById('galleryList');
    list.innerHTML = '';
    images.forEach(function (img) {
      var item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML =
        '<img src="' + escHtml(img.src) + '" style="width:40px;height:40px;object-fit:cover;border:1px solid #000;border-radius:4px;">' +
        '<span class="list-item-sub">' + escHtml(img.src) + '</span>' +
        '<div class="list-item-actions">' +
        '<button class="btn-edit" data-id="' + img.id + '">编辑</button>' +
        '<button class="btn-delete" data-id="' + img.id + '">删除</button>' +
        '</div>';
      list.appendChild(item);
    });
    list.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () { editGallery(this.dataset.id, images); });
    });
    list.querySelectorAll('.btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteGallery(this.dataset.id); });
    });
  }

  document.getElementById('galleryPageFilter').addEventListener('change', loadGallery);
  document.getElementById('addGalleryBtn').addEventListener('click', function () {
    document.getElementById('galleryEditorTitle').textContent = '添加图片';
    document.getElementById('galleryForm').reset();
    document.getElementById('galleryForm').querySelector('input[name="id"]').value = '';
    document.getElementById('galleryEditor').style.display = 'block';
  });
  document.getElementById('cancelGalleryBtn').addEventListener('click', function () {
    document.getElementById('galleryEditor').style.display = 'none';
  });

  function editGallery(id, images) {
    var img = images.find(function (i) { return i.id == id; });
    if (!img) return;
    var form = document.getElementById('galleryForm');
    form.querySelector('input[name="id"]').value = img.id;
    form.querySelector('select[name="page_id"]').value = img.page_id;
    form.src.value = img.src;
    form.sort_order.value = img.sort_order || 0;
    document.getElementById('galleryEditorTitle').textContent = '编辑图片';
    document.getElementById('galleryEditor').style.display = 'block';
  }

  async function deleteGallery(id) {
    if (!confirm('确定删除这张图片？')) return;
    await api('/api/admin/gallery?id=' + id, 'DELETE');
    showToast('已删除');
    loadGallery();
  }

  document.getElementById('galleryForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = this.querySelector('input[name="id"]').value;
    var data = {
      page_id: parseInt(this.page_id.value),
      src: this.src.value,
      sort_order: parseInt(this.sort_order.value) || 0
    };
    if (id) {
      await api('/api/admin/gallery?id=' + id, 'PUT', data);
    } else {
      await api('/api/admin/gallery', 'POST', data);
    }
    showToast('保存成功！');
    document.getElementById('galleryEditor').style.display = 'none';
    loadGallery();
  });

  // ==================== 宠物管理 ====================
  async function loadPet() {
    await loadPages();
    var pageId = document.getElementById('petPageFilter').value;
    var url = '/api/admin/pet' + (pageId ? '?page_id=' + pageId : '');
    var pets = await api(url, 'GET') || [];
    var list = document.getElementById('petList');
    list.innerHTML = '';
    // 按 page_id 去重显示
    var seen = {};
    pets.forEach(function (p) {
      if (seen[p.id]) return;
      seen[p.id] = true;
      var item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML =
        '<span class="list-item-label">' + escHtml(p.pet_type || 'pet') + '</span>' +
        '<span class="list-item-sub">' + escHtml(p.pet_image) + '</span>' +
        '<div class="list-item-actions">' +
        '<button class="btn-edit" data-id="' + p.id + '">编辑</button>' +
        '<button class="btn-delete" data-id="' + p.id + '">删除</button>' +
        '</div>';
      list.appendChild(item);
    });
    list.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () { editPet(this.dataset.id, pets); });
    });
    list.querySelectorAll('.btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function () { deletePet(this.dataset.id); });
    });
  }

  document.getElementById('petPageFilter').addEventListener('change', loadPet);
  document.getElementById('addPetBtn').addEventListener('click', function () {
    document.getElementById('petEditorTitle').textContent = '添加宠物';
    document.getElementById('petForm').reset();
    document.getElementById('petForm').querySelector('input[name="id"]').value = '';
    document.getElementById('petEditor').style.display = 'block';
  });
  document.getElementById('cancelPetBtn').addEventListener('click', function () {
    document.getElementById('petEditor').style.display = 'none';
  });

  function editPet(id, pets) {
    var pet = pets.find(function (p) { return p.id == id; });
    if (!pet) return;
    var form = document.getElementById('petForm');
    form.querySelector('input[name="id"]').value = pet.id;
    form.querySelector('select[name="page_id"]').value = pet.page_id;
    form.pet_type.value = pet.pet_type || '';
    form.pet_image.value = pet.pet_image || '';
    // 收集语录
    var zhMsgs = [], enMsgs = [];
    pets.filter(function (p) { return p.id == id; }).forEach(function (p) {
      if (p.language === 'zh-CN' && p.messages) zhMsgs = p.messages;
      if (p.language === 'en' && p.messages) enMsgs = p.messages;
    });
    form.messages_zh.value = (zhMsgs || []).join('\n');
    form.messages_en.value = (enMsgs || []).join('\n');
    document.getElementById('petEditorTitle').textContent = '编辑宠物';
    document.getElementById('petEditor').style.display = 'block';
  }

  async function deletePet(id) {
    if (!confirm('确定删除这个宠物配置？')) return;
    await api('/api/admin/pet?id=' + id, 'DELETE');
    showToast('已删除');
    loadPet();
  }

  document.getElementById('petForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = this.querySelector('input[name="id"]').value;
    var messages = {};
    var zhLines = this.messages_zh.value.split('\n').filter(function (l) { return l.trim(); });
    var enLines = this.messages_en.value.split('\n').filter(function (l) { return l.trim(); });
    if (zhLines.length) messages['zh-CN'] = zhLines;
    if (enLines.length) messages['en'] = enLines;

    var data = {
      page_id: parseInt(this.page_id.value),
      pet_image: this.pet_image.value,
      pet_type: this.pet_type.value,
      messages: messages
    };
    if (id) {
      await api('/api/admin/pet?id=' + id, 'PUT', data);
    } else {
      await api('/api/admin/pet', 'POST', data);
    }
    showToast('保存成功！');
    document.getElementById('petEditor').style.display = 'none';
    loadPet();
  });

  // ==================== 翻译管理 ====================
  var allTranslations = [];

  async function loadTranslations() {
    allTranslations = await api('/api/admin/translations', 'GET') || [];
    renderTranslations(allTranslations);
  }

  function renderTranslations(list) {
    var searchVal = (document.getElementById('transSearch').value || '').toLowerCase();
    var filtered = list.filter(function (t) {
      return !searchVal || t.key.toLowerCase().indexOf(searchVal) !== -1;
    });
    var unique = {};
    filtered.forEach(function (t) {
      if (!unique[t.key]) unique[t.key] = { key: t.key, zh: '', en: '' };
      if (t.language === 'zh-CN') unique[t.key].zh = t.value;
      if (t.language === 'en') unique[t.key].en = t.value;
    });
    var listEl = document.getElementById('transList');
    listEl.innerHTML = '';
    Object.values(unique).forEach(function (t) {
      var item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML =
        '<span class="list-item-label">' + escHtml(t.key) + '</span>' +
        '<span class="list-item-sub">' + escHtml(t.zh || t.en) + '</span>' +
        '<div class="list-item-actions">' +
        '<button class="btn-edit" data-key="' + escAttr(t.key) + '">编辑</button>' +
        '<button class="btn-delete" data-key="' + escAttr(t.key) + '">删除</button>' +
        '</div>';
      listEl.appendChild(item);
    });
    listEl.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () { editTranslation(this.dataset.key); });
    });
    listEl.querySelectorAll('.btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteTranslation(this.dataset.key); });
    });
  }

  document.getElementById('transSearch').addEventListener('input', function () {
    renderTranslations(allTranslations);
  });
  document.getElementById('addTransBtn').addEventListener('click', function () {
    document.getElementById('transEditorTitle').textContent = '添加翻译';
    document.getElementById('transForm').reset();
    document.getElementById('transForm').querySelector('input[name="id"]').value = '';
    document.getElementById('transEditor').style.display = 'block';
  });
  document.getElementById('cancelTransBtn').addEventListener('click', function () {
    document.getElementById('transEditor').style.display = 'none';
  });

  function editTranslation(key) {
    var items = allTranslations.filter(function (t) { return t.key === key; });
    var zh = items.find(function (t) { return t.language === 'zh-CN'; });
    var en = items.find(function (t) { return t.language === 'en'; });
    var form = document.getElementById('transForm');
    form.querySelector('input[name="id"]').value = (zh || en || {}).id || '';
    form.key.value = key;
    form.language.value = 'zh-CN';
    form.value.value = (zh || en || {}).value || '';
    document.getElementById('transEditorTitle').textContent = '编辑翻译';
    document.getElementById('transEditor').style.display = 'block';
  }

  async function deleteTranslation(key) {
    if (!confirm('确定删除「' + key + '」的所有翻译？')) return;
    var items = allTranslations.filter(function (t) { return t.key === key; });
    for (var i = 0; i < items.length; i++) {
      await api('/api/admin/translations?id=' + items[i].id, 'DELETE');
    }
    showToast('已删除');
    loadTranslations();
  }

  document.getElementById('transForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = this.querySelector('input[name="id"]').value;
    var data = {
      key: this.key.value,
      language: this.language.value,
      value: this.value.value
    };
    if (id) {
      await api('/api/admin/translations?id=' + id, 'PUT', data);
    } else {
      await api('/api/admin/translations', 'POST', data);
    }
    showToast('保存成功！');
    document.getElementById('transEditor').style.display = 'none';
    loadTranslations();
  });

  // ==================== 工具函数 ====================
  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return escHtml(s).replace(/'/g, '&#39;');
  }

  // 初始加载站点配置
  loadSiteConfig();
})();
