/**
 * Admin — 站点管理后台
 *
 * 管理「链接 / 相册（主页与耳语页）/ 站点信息 / 宠物 / 彩蛋 / 耳语页」，
 * 数据经 api/config 持久化到 Vercel Blob，保存后所有访客立即看到最新内容。
 * 支持导出 / 导入 JSON 备份，数据随时可迁移。
 */
(function () {
  'use strict';

  // ---- 状态 ----
  var state = {
    site: {}, pet: {}, egg: {}, whisper: {},
    links: [], gallery: [],
  };
  var activePage = 'main'; // 'main' | 'whisper'
  var password = '';
  var loaded = false;

  // ---- DOM 引用 ----
  function $(sel) { return document.querySelector(sel); }

  var loginView = $('#loginView');
  var appView = $('#appView');
  var loginForm = $('#loginForm');
  var pwdInput = $('#pwdInput');
  var loginHint = $('#loginHint');
  var loginBtn = $('#loginBtn');
  var banner = $('#banner');
  var saveStatus = $('#saveStatus');
  var linksList = $('#linksList');
  var galleryList = $('#galleryList');
  var saveBtn = $('#saveBtn');

  // ---- 提示 ----
  function toast(msg, isError) {
    saveStatus.textContent = msg;
    saveStatus.className = 'save-status ' + (isError ? 'is-error' : 'is-ok');
  }
  function showBanner(msg, isError) {
    banner.textContent = msg;
    banner.className = 'admin-banner ' + (isError ? 'is-error' : 'is-info');
    banner.style.display = 'block';
  }
  function hideBanner() { banner.style.display = 'none'; }
  function markDirty() {
    saveStatus.textContent = '⚠ 有未保存的修改';
    saveStatus.className = 'save-status is-dirty';
  }
  function markClean() {
    saveStatus.textContent = '';
    saveStatus.className = 'save-status';
  }

  // ---- 当前编辑的集合（按 主页/耳语页 切换） ----
  function getLinks() { return activePage === 'whisper' ? state.whisper.links : state.links; }
  function getGallery() { return activePage === 'whisper' ? state.whisper.gallery : state.gallery; }

  // ---- API ----
  function apiGet() {
    // 加时间戳绕过 CDN 边缘缓存，保证后台始终读取到最新数据
    return fetch('api/config?_=' + Date.now(), { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  // 登录时校验口令（无需返回数据）
  function apiVerify(pwd) {
    return fetch('api/config?verify=' + encodeURIComponent(pwd) + '&_=' + Date.now(), { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function apiSave(extra) {
    collectSettings();
    var payload = {
      password: password,
      site: state.site, pet: state.pet, egg: state.egg, whisper: state.whisper,
      links: state.links, gallery: state.gallery,
    };
    if (extra) {
      for (var k in extra) if (extra.hasOwnProperty(k)) payload[k] = extra[k];
    }
    return fetch('api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
      });
    });
  }

  // ---- 工具 ----
  function isImagePath(str) {
    return /\.(svg|png|jpe?g|webp|gif|ico|avif)([?#].*)?$/i.test(String(str).trim());
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function num(id) { var v = parseInt(val(id), 10); return isNaN(v) ? 0 : v; }
  function chk(id) { var el = document.getElementById(id); return el ? el.checked : true; }
  function textareaLines(id) {
    return val(id).split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function opBtn(text, title, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'op-btn';
    b.title = title;
    b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }

  function iconHtml(icon) {
    if (!icon) return '<div class="icon-placeholder"><i class="fas fa-question"></i></div>';
    if (isImagePath(icon)) {
      return '<div class="icon-img-wrap"><img src="' + esc(icon) + '" alt="" class="icon-img"></div>';
    }
    return '<div class="icon-fa"><i class="' + esc(icon) + '"></i></div>';
  }

  function enabledToggle(checked, onChange) {
    var lab = document.createElement('label');
    lab.className = 'enabled-toggle';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'switch-check';
    cb.checked = checked !== false;
    cb.addEventListener('change', function () { onChange(cb.checked); });
    var span = document.createElement('span');
    span.textContent = '显示';
    lab.appendChild(cb);
    lab.appendChild(span);
    return lab;
  }

  function makeField(card, label, key, value, idx, placeholder) {
    var wrap = document.createElement('label');
    wrap.className = 'field';
    var lab = document.createElement('span');
    lab.className = 'field-label';
    lab.textContent = label;
    var input = document.createElement('input');
    input.className = 'admin-input';
    input.type = 'text';
    input.value = value || '';
    input.placeholder = placeholder || '';
    input.addEventListener('input', function () {
      getLinks()[idx][key] = input.value;
      if (key === 'label' && card) {
        var pLabel = card.querySelector('.preview-label');
        if (pLabel) pLabel.textContent = input.value || '未命名';
      }
      markDirty();
    });
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  // ---- 渲染：链接 ----
  function renderLinks() {
    var arr = getLinks();
    linksList.innerHTML = '';
    arr.forEach(function (link, i) {
      var card = document.createElement('div');
      card.className = 'item-card';

      var preview = document.createElement('div');
      preview.className = 'item-preview';
      var iconBox = document.createElement('div');
      iconBox.innerHTML = iconHtml(link.icon);
      preview.appendChild(iconBox.firstChild);
      var pLabel = document.createElement('span');
      pLabel.className = 'preview-label';
      pLabel.textContent = link.label || '未命名';
      preview.appendChild(pLabel);
      preview.appendChild(enabledToggle(link.enabled, function (on) {
        arr[i].enabled = on;
        markDirty();
      }));
      card.appendChild(preview);

      var fields = document.createElement('div');
      fields.className = 'item-fields';
      fields.appendChild(makeField(card, '显示名称', 'label', link.label, i, '如 QQ'));
      fields.appendChild(makeField(card, '多语言键(可选)', 'labelKey', link.labelKey, i, '如 brand.qq，留空则用显示名称'));
      fields.appendChild(makeField(card, '图标', 'icon', link.icon, i, '图片路径 或 图标类，如 fab fa-weixin'));
      fields.appendChild(makeField(card, '跳转链接(可选)', 'url', link.url, i, 'https://…'));
      fields.appendChild(makeField(card, '二维码图片(可选)', 'qr', link.qr, i, 'assets/qrcodes/….jpg'));
      fields.appendChild(makeField(card, '备注(可选)', 'note', link.note, i, '弹窗底部说明文字'));
      fields.appendChild(makeField(card, '备注多语言键(可选)', 'noteKey', link.noteKey, i, '如 popup.note.visit'));
      card.appendChild(fields);

      var ops = document.createElement('div');
      ops.className = 'item-ops';
      ops.appendChild(opBtn('↑', '上移', function () { move(arr, i, -1); renderLinks(); }));
      ops.appendChild(opBtn('↓', '下移', function () { move(arr, i, 1); renderLinks(); }));
      ops.appendChild(opBtn('✕', '删除', function () {
        arr.splice(i, 1);
        markDirty();
        renderLinks();
      }));
      card.appendChild(ops);

      linksList.appendChild(card);
    });
  }

  // ---- 渲染：相册 ----
  function renderGallery() {
    var arr = getGallery();
    galleryList.innerHTML = '';
    arr.forEach(function (img, i) {
      var item = document.createElement('div');
      item.className = 'gallery-item';

      var thumb = document.createElement('div');
      thumb.className = 'gallery-thumb';
      var im = document.createElement('img');
      im.src = img.src;
      im.alt = img.label || '';
      im.loading = 'lazy';
      im.onerror = function () { im.classList.add('thumb-error'); };
      thumb.appendChild(im);
      item.appendChild(thumb);

      var labelInput = document.createElement('input');
      labelInput.className = 'admin-input gallery-label-input';
      labelInput.placeholder = '标签(可选)';
      labelInput.value = img.label || '';
      labelInput.addEventListener('input', function () {
        arr[i].label = labelInput.value;
        markDirty();
      });
      item.appendChild(labelInput);

      item.appendChild(enabledToggle(img.enabled, function (on) {
        arr[i].enabled = on;
        markDirty();
      }));

      var ops = document.createElement('div');
      ops.className = 'item-ops';
      ops.appendChild(opBtn('↑', '上移', function () { move(arr, i, -1); renderGallery(); }));
      ops.appendChild(opBtn('↓', '下移', function () { move(arr, i, 1); renderGallery(); }));
      ops.appendChild(opBtn('✕', '删除', function () {
        arr.splice(i, 1);
        markDirty();
        renderGallery();
      }));
      item.appendChild(ops);

      galleryList.appendChild(item);
    });
  }

  function move(arr, idx, dir) {
    var j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    var t = arr[idx];
    arr[idx] = arr[j];
    arr[j] = t;
    markDirty();
  }

  // ---- 站点设置：表单 <-> state ----
  function writeSettings() {
    var s = state.site || {};
    $('#site-name').value = s.name || '';
    $('#site-titleZh').value = s.titleZh || '';
    $('#site-titleEn').value = s.titleEn || '';
    $('#site-avatar').value = s.avatar || '';
    $('#site-favicon').value = s.favicon || '';
    $('#site-background').value = s.background || '';
    $('#site-copyright').value = s.copyright || '';
    $('#site-showAlbum').checked = s.showAlbum !== false;
    $('#site-showShare').checked = s.showShare !== false;

    var p = state.pet || {};
    $('#pet-enabled').checked = p.enabled !== false;
    $('#pet-src').value = p.src || '';
    $('#pet-type').value = p.type || 'video';
    $('#pet-messages-zh').value = (p.messages && p.messages['zh-CN'] || []).join('\n');
    $('#pet-messages-en').value = (p.messages && p.messages.en || []).join('\n');

    var e = state.egg || {};
    $('#egg-enabled').checked = e.enabled !== false;
    $('#egg-clicks').value = e.clicks || 5;
    $('#egg-timeout').value = e.timeout || 200;
    $('#egg-target').value = e.target || 'whisper/';

    var w = state.whisper || {};
    $('#whisper-enabled').checked = w.enabled !== false;
    $('#whisper-titleZh').value = w.titleZh || '';
    $('#whisper-titleEn').value = w.titleEn || '';
    $('#whisper-background').value = w.background || '';
    $('#whisper-salt').value = w.salt || '';
    $('#whisper-secretLen').value = w.secretLen || 6;
    $('#whisper-refParam').value = w.refParam || 'ref_id';
    var wp = w.pet || {};
    $('#whisper-pet-enabled').checked = wp.enabled !== false;
    $('#whisper-pet-src').value = wp.src || '';
    $('#whisper-pet-type').value = wp.type || 'image';
    $('#whisper-pet-zh').value = (wp.messages && wp.messages['zh-CN'] || []).join('\n');
    $('#whisper-pet-en').value = (wp.messages && wp.messages.en || []).join('\n');
  }

  function collectSettings() {
    state.site = {
      name: val('site-name'), titleZh: val('site-titleZh'), titleEn: val('site-titleEn'),
      avatar: val('site-avatar'), favicon: val('site-favicon'), background: val('site-background'),
      copyright: val('site-copyright'), showAlbum: chk('site-showAlbum'), showShare: chk('site-showShare'),
    };
    state.pet = {
      enabled: chk('pet-enabled'), src: val('pet-src'), type: val('pet-type'),
      messages: { 'zh-CN': textareaLines('pet-messages-zh'), en: textareaLines('pet-messages-en') },
    };
    state.egg = {
      enabled: chk('egg-enabled'), clicks: num('egg-clicks'), timeout: num('egg-timeout'), target: val('egg-target'),
    };
    state.whisper = {
      enabled: chk('whisper-enabled'), titleZh: val('whisper-titleZh'), titleEn: val('whisper-titleEn'),
      background: val('whisper-background'), salt: val('whisper-salt'),
      secretLen: num('whisper-secretLen'), refParam: val('whisper-refParam'),
      pet: {
        enabled: chk('whisper-pet-enabled'), src: val('whisper-pet-src'), type: val('whisper-pet-type'),
        messages: { 'zh-CN': textareaLines('whisper-pet-zh'), en: textareaLines('whisper-pet-en') },
      },
      links: state.whisper.links || [], gallery: state.whisper.gallery || [],
    };
  }

  // ---- 登录 ----
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    password = pwdInput.value.trim();
    if (!password) {
      loginHint.textContent = '请输入口令';
      loginHint.className = 'login-hint is-error';
      return;
    }
    loginBtn.disabled = true;
    apiVerify(password).then(function () {
      return loadData();
    }).then(function () {
      loginView.style.display = 'none';
      appView.style.display = 'block';
      loginHint.textContent = '首次默认口令 admin123 · 登录后请在「设置」修改';
      loginHint.className = 'login-hint';
      loginBtn.disabled = false;
    }).catch(function (err) {
      if (/401/.test(err.message || '')) {
        loginHint.textContent = '口令错误，请重新输入';
      } else {
        loginHint.textContent = '无法连接配置接口：请确认通过 Vercel 部署访问（本地直接打开无法在线管理）';
      }
      loginHint.className = 'login-hint is-error';
      loginBtn.disabled = false;
    });
  });

  function loadData() {
    return apiGet().then(function (cfg) {
      state.site = cfg.site || {};
      state.pet = cfg.pet || {};
      state.egg = cfg.egg || {};
      state.whisper = cfg.whisper || {};
      state.links = Array.isArray(cfg.links) ? cfg.links : [];
      state.gallery = Array.isArray(cfg.gallery) ? cfg.gallery : [];
      state.whisper.links = Array.isArray(state.whisper.links) ? state.whisper.links : [];
      state.whisper.gallery = Array.isArray(state.whisper.gallery) ? state.whisper.gallery : [];
      renderLinks();
      renderGallery();
      writeSettings();
      loaded = true;
      hideBanner();
    });
  }

  // ---- 标签切换（仅顶部导航） ----
  var tabs = document.querySelectorAll('.admin-tabs > .admin-tab');
  for (var ti = 0; ti < tabs.length; ti++) {
    tabs[ti].addEventListener('click', function () {
      for (var x = 0; x < tabs.length; x++) tabs[x].classList.remove('is-active');
      this.classList.add('is-active');
      var panels = document.querySelectorAll('.tab-panel');
      for (var p = 0; p < panels.length; p++) panels[p].classList.remove('is-active');
      var target = document.getElementById('tab-' + this.getAttribute('data-tab'));
      if (target) target.classList.add('is-active');
    });
  }

  // ---- 主页 / 耳语页 切换 ----
  var pageBtns = document.querySelectorAll('[data-page]');
  for (var pb = 0; pb < pageBtns.length; pb++) {
    pageBtns[pb].addEventListener('click', function () {
      activePage = this.getAttribute('data-page');
      var group = this.parentNode;
      var btns = group.querySelectorAll('[data-page]');
      for (var b = 0; b < btns.length; b++) btns[b].classList.remove('is-active');
      this.classList.add('is-active');
      renderLinks();
      renderGallery();
    });
  }

  // ---- 新增链接 ----
  $('#addLinkBtn').addEventListener('click', function () {
    var arr = getLinks();
    arr.push({ label: '新链接', labelKey: '', enabled: true, icon: '', url: '', qr: '', note: '', noteKey: '' });
    markDirty();
    renderLinks();
    linksList.lastChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ---- 新增相册图片 ----
  $('#addGalBtn').addEventListener('click', function () {
    var src = $('#galSrcInput').value.trim();
    if (!src) { toast('请填写图片链接', true); return; }
    getGallery().push({ src: src, label: $('#galLabelInput').value.trim(), enabled: true });
    $('#galSrcInput').value = '';
    $('#galLabelInput').value = '';
    markDirty();
    renderGallery();
  });

  // ---- 保存 ----
  saveBtn.addEventListener('click', function () {
    var newPwd = $('#newPwdInput').value;
    var newPwd2 = $('#newPwdInput2').value;
    var extra = null;
    if (newPwd || newPwd2) {
      if (newPwd !== newPwd2) { toast('两次输入的新口令不一致', true); return; }
      if (newPwd.length < 4) { toast('新口令至少 4 位', true); return; }
      extra = { newPassword: newPwd };
    }
    saveBtn.disabled = true;
    apiSave(extra).then(function () {
      var msg = '已保存，所有访客将看到最新内容 ✓';
      if (extra && extra.newPassword) {
        // 本会话同步新口令，避免下次保存仍用旧口令而被拒
        password = extra.newPassword;
        msg = '已保存 ✓ 口令已更新，下次登录请使用新口令';
      }
      $('#newPwdInput').value = '';
      $('#newPwdInput2').value = '';
      toast(msg);
      saveBtn.disabled = false;
    }).catch(function (err) {
      toast('保存失败：' + err.message, true);
      saveBtn.disabled = false;
      if (/401|口令/.test(err.message)) {
        // 口令错误 → 回到登录
        password = '';
        appView.style.display = 'none';
        loginView.style.display = 'flex';
        pwdInput.value = '';
        loginHint.textContent = '口令错误，请重新输入';
        loginHint.className = 'login-hint is-error';
      }
    });
  });

  // ---- 导出 / 导入 ----
  $('#exportBtn').addEventListener('click', function () {
    collectSettings();
    var data = {
      site: state.site, pet: state.pet, egg: state.egg, whisper: state.whisper,
      links: state.links, gallery: state.gallery,
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'huolin-config.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 100);
  });

  $('#importFile').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (data && typeof data === 'object') {
          state.site = data.site || state.site || {};
          state.pet = data.pet || state.pet || {};
          state.egg = data.egg || state.egg || {};
          if (data.whisper) {
            state.whisper = data.whisper;
            state.whisper.links = Array.isArray(state.whisper.links) ? state.whisper.links : [];
            state.whisper.gallery = Array.isArray(state.whisper.gallery) ? state.whisper.gallery : [];
          }
          if (Array.isArray(data.links)) state.links = data.links;
          if (Array.isArray(data.gallery)) state.gallery = data.gallery;
        }
        renderLinks();
        renderGallery();
        writeSettings();
        markDirty();
        toast('导入成功，记得点「保存」');
      } catch (err) {
        toast('导入失败：JSON 格式不正确', true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ---- 初始：未部署 / 无法连接时给出提示（不阻断本地查看） ----
  apiGet().then(function (cfg) {
    state.site = cfg.site || {};
    state.pet = cfg.pet || {};
    state.egg = cfg.egg || {};
    state.whisper = cfg.whisper || {};
    state.links = Array.isArray(cfg.links) ? cfg.links : [];
    state.gallery = Array.isArray(cfg.gallery) ? cfg.gallery : [];
    state.whisper.links = Array.isArray(state.whisper.links) ? state.whisper.links : [];
    state.whisper.gallery = Array.isArray(state.whisper.gallery) ? state.whisper.gallery : [];
    renderLinks();
    renderGallery();
    writeSettings();
    loaded = true;
  }).catch(function () {
    showBanner('⚠ 无法连接配置接口：当前页面可能未通过 Vercel 部署访问，或尚未创建 Blob 存储。在线保存将不可用，但仍可编辑并「导出」备份。', true);
  });
})();
