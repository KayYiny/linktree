/**
 * view-files.js — 文件上传（全站按钮共用）与文件库（R2）
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

  // ==================== 文件上传（全站「上传」按钮共用） ====================
  var uploadTarget = null; // 待填入的 input；null 表示上传到文件库
  var uploadFileInput = document.getElementById('uploadFileInput');
  var ALLOWED_UPLOAD_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'video/webm', 'video/mp4'];

  // 任何带 data-upload 的按钮：就近找到同一 form-group 内的输入框，弹文件选择
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-upload]') : null;
    if (!btn) return;
    var row = btn.closest('.form-group') || btn.closest('.inline-add') || btn.parentNode;
    var input = row.querySelector('input[type="text"], input:not([type="button"]):not([type="file"])');
    uploadTarget = input || null;
    uploadFileInput.accept = btn.dataset.upload === 'video' ? 'image/*,video/webm,video/mp4' : 'image/*';
    uploadFileInput.value = '';
    uploadFileInput.click();
  });

  async function uploadFile(file) {
    // 前端预校验（后端仍有最终防线）
    if (ALLOWED_UPLOAD_MIME.indexOf(file.type) === -1) throw new Error('不支持的文件类型（仅支持 jpg/png/gif/webp/svg/webm/mp4）');
    var isVideo = file.type.indexOf('video/') === 0;
    var limit = isVideo ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > limit) throw new Error(isVideo ? '视频不能超过 20MB' : '图片不能超过 5MB');
    var fd = new FormData();
    fd.append('file', file);
    var res = await fetch('/api/admin/files', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd });
    if (res.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/';
      throw new Error('未登录或登录已过期');
    }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }

  uploadFileInput.addEventListener('change', async function () {
    var file = this.files[0];
    if (!file) return;
    try {
      showToast('上传中…');
      var res = await uploadFile(file);
      if (uploadTarget) {
        uploadTarget.value = res.url;
        uploadTarget.dispatchEvent(new Event('input', { bubbles: true }));
        showToast('上传成功，已填入：' + res.url);
      } else {
        showToast('上传成功：' + res.name);
        loadFiles();
      }
    } catch (err) {
      showToast(err.message || '上传失败', true);
    }
    uploadTarget = null;
    this.value = '';
  });

  // ==================== 文件库（R2） ====================
  var filesState = { data: null, filter: 'all' };

  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  async function loadFiles() {
    try {
      filesState.data = await api('/api/admin/files', 'GET');
      renderFiles();
    } catch (e) {
      showToast('文件库加载失败：' + e.message, true);
    }
  }

  function renderFiles() {
    var d = filesState.data;
    var wrap = document.getElementById('filesList');
    if (!d) { wrap.innerHTML = '<p class="empty-tip">加载中…</p>'; return; }

    // 用量条（≥85% 变黄警示）
    var pct = Math.min(100, Math.round(d.total_bytes / d.quota_bytes * 1000) / 10);
    var bar = document.getElementById('quotaFill');
    bar.style.width = Math.max(pct, 0.5) + '%';
    bar.className = 'quota-fill' + (d.total_bytes >= d.quota_bytes * 0.85 ? ' warn' : '');
    document.getElementById('quotaText').textContent =
      '已用 ' + fmtSize(d.total_bytes) + ' / ' + fmtSize(d.quota_bytes) + '（' + pct + '%）';

    var usedCount = d.files.filter(function (f) { return f.used_by.length > 0; }).length;
    var filter = filesState.filter;
    var list = d.files.filter(function (f) {
      if (filter === 'used') return f.used_by.length > 0;
      if (filter === 'unused') return f.used_by.length === 0;
      return true;
    });
    document.getElementById('filesHint').textContent =
      '共 ' + d.files.length + ' 个文件（使用中 ' + usedCount + ' / 未使用 ' + (d.files.length - usedCount) + '）';

    wrap.innerHTML = '';
    if (!list.length) { wrap.innerHTML = '<p class="empty-tip">没有符合条件的文件。</p>'; return; }
    list.forEach(function (f) {
      var card = document.createElement('div');
      card.className = 'card file-card' + (f.used_by.length ? '' : ' unused');
      var isVideo = f.mime.indexOf('video/') === 0;
      var preview = isVideo
        ? '<video src="' + esc(f.url) + '" muted preload="metadata"></video>'
        : '<img src="' + esc(f.url) + '" alt="">';
      card.innerHTML =
        '<div class="file-thumb">' + preview + '</div>' +
        '<div class="file-meta">' +
          '<div class="file-name" title="' + esc(f.name) + '">' + esc(f.name) + '</div>' +
          '<div class="sec-hint">' + fmtSize(f.size) + '</div>' +
          (f.used_by.length
            ? '<div class="file-usage">使用中：' + esc(f.used_by.join('、')) + '</div>'
            : '<div class="file-usage unused-tag">未使用</div>') +
        '</div>' +
        '<button type="button" class="btn btn-danger btn-sm file-del-btn"><i class="fas fa-trash"></i> 删除</button>';
      wrap.appendChild(card);
      card.querySelector('.file-del-btn').addEventListener('click', function () {
        var msg = f.used_by.length
          ? '该文件正被「' + f.used_by.join('、') + '」使用，删除后对应位置会裂图。确定删除？'
          : '确定删除「' + f.name + '」？';
        if (!confirm(msg)) return;
        deleteFileByKey(f.key);
      });
    });
  }

  async function deleteFileByKey(key) {
    try {
      await api('/api/admin/files?key=' + encodeURIComponent(key), 'DELETE');
      showToast('已删除');
      loadFiles();
    } catch (e) {
      showToast('删除失败：' + e.message, true);
    }
  }

  document.getElementById('filesFilter').addEventListener('change', function () {
    filesState.filter = this.value;
    renderFiles();
  });
  document.getElementById('filesUploadBtn').addEventListener('click', function () {
    uploadTarget = null;
    uploadFileInput.accept = 'image/*,video/webm,video/mp4';
    uploadFileInput.value = '';
    uploadFileInput.click();
  });

  // ---- 模块导出 ----

  A.loadFiles = loadFiles;

})();
