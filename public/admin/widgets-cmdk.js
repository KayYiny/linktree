/**
 * widgets-cmdk.js — ⌘K 命令面板（签名功能）
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

  // ---- 模块导出 ----

  A.buildCmdItems = buildCmdItems;

})();
