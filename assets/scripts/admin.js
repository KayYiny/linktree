/**
 * Admin — 站点管理后台
 *
 * 管理「链接」与「相册图片」，数据经 api/config 持久化到 Vercel Blob，
 * 保存后所有访客立即看到最新内容。
 * 支持导出 / 导入 JSON 备份，数据随时可迁移。
 */
(function () {
  'use strict';

  // ---- 状态 ----
  var state = { links: [], gallery: [] };
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
    return fetch('api/config?verify=' + encodeURIComponent(pwd), { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function apiSave(extra) {
    var payload = { password: password, links: state.links, gallery: state.gallery };
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
      state.links[idx][key] = input.value;
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
    linksList.innerHTML = '';
    state.links.forEach(function (link, i) {
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
      ops.appendChild(opBtn('↑', '上移', function () { move('links', i, -1); }));
      ops.appendChild(opBtn('↓', '下移', function () { move('links', i, 1); }));
      ops.appendChild(opBtn('✕', '删除', function () {
        state.links.splice(i, 1);
        markDirty();
        renderLinks();
      }));
      card.appendChild(ops);

      linksList.appendChild(card);
    });
  }

  // ---- 渲染：相册 ----
  function renderGallery() {
    galleryList.innerHTML = '';
    state.gallery.forEach(function (img, i) {
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
        state.gallery[i].label = labelInput.value;
        markDirty();
      });
      item.appendChild(labelInput);

      var ops = document.createElement('div');
      ops.className = 'item-ops';
      ops.appendChild(opBtn('↑', '上移', function () { move('gallery', i, -1); }));
      ops.appendChild(opBtn('↓', '下移', function () { move('gallery', i, 1); }));
      ops.appendChild(opBtn('✕', '删除', function () {
        state.gallery.splice(i, 1);
        markDirty();
        renderGallery();
      }));
      item.appendChild(ops);

      galleryList.appendChild(item);
    });
  }

  function move(which, idx, dir) {
    var arr = state[which];
    var j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    var tmp = arr[idx];
    arr[idx] = arr[j];
    arr[j] = tmp;
    markDirty();
    if (which === 'links') renderLinks();
    else renderGallery();
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
      state.links = Array.isArray(cfg.links) ? cfg.links : [];
      state.gallery = Array.isArray(cfg.gallery) ? cfg.gallery : [];
      renderLinks();
      renderGallery();
      loaded = true;
      hideBanner();
    });
  }

  // ---- 标签切换 ----
  var tabs = document.querySelectorAll('.admin-tab');
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

  // ---- 新增链接 ----
  $('#addLinkBtn').addEventListener('click', function () {
    state.links.push({ label: '新链接', labelKey: '', icon: '', url: '', qr: '', note: '', noteKey: '' });
    markDirty();
    renderLinks();
    linksList.lastChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ---- 新增相册图片 ----
  $('#addGalBtn').addEventListener('click', function () {
    var src = $('#galSrcInput').value.trim();
    if (!src) { toast('请填写图片链接', true); return; }
    state.gallery.push({ src: src, label: $('#galLabelInput').value.trim() });
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
      toast('已保存，所有访客将看到最新内容 ✓');
      $('#newPwdInput').value = '';
      $('#newPwdInput2').value = '';
      markClean();
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
    var data = { links: state.links, gallery: state.gallery };
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
        if (data && Array.isArray(data.links)) state.links = data.links;
        if (data && Array.isArray(data.gallery)) state.gallery = data.gallery;
        renderLinks();
        renderGallery();
        markDirty();
        toast('已导入 ' + state.links.length + ' 个链接 / ' + state.gallery.length + ' 张图片，记得点「保存」');
      } catch (err) {
        toast('导入失败：JSON 格式不正确', true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ---- 初始：未部署 / 无法连接时给出提示（不阻断本地查看） ----
  apiGet().then(function (cfg) {
    state.links = Array.isArray(cfg.links) ? cfg.links : [];
    state.gallery = Array.isArray(cfg.gallery) ? cfg.gallery : [];
    renderLinks();
    renderGallery();
    loaded = true;
  }).catch(function () {
    showBanner('⚠ 无法连接配置接口：当前页面可能未通过 Vercel 部署访问，或尚未创建 Blob 存储。在线保存将不可用，但仍可编辑并「导出」备份。', true);
  });
})();
