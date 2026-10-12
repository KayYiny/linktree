/**
 * view-settings.js — 设置：站点信息、彩蛋参数、密钥参数、账号
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

  // ==================== 设置：站点配置 ====================
  function renderSite() {
    var f = document.getElementById('siteConfigForm');
    f.avatar.value = S.site.avatar || '';
    f.username.value = S.site.username || '';
    f.favicon.value = S.site.favicon || '';
    f.footer.value = S.site.footer || '';
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

  // ==================== 设置：彩蛋（Easter Egg） ====================
  function renderEgg() {
    var f = document.getElementById('eggConfigForm');
    if (!f) return;
    f.eggEnabled.checked = !!S.egg.enabled;
    f.eggClicks.value = S.egg.clicks;
    f.eggTimeout.value = S.egg.timeout;
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
  })();

  // ==================== 设置：密钥（隐藏页 ?k= 访问控制） ====================
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
      if (navigator.clipboard) navigator.clipboard.writeText(k);
      showToast('已复制当前有效密钥：' + k);
    });
    document.getElementById('keyCopyMainBtn').addEventListener('click', function () {
      if (!window.__keygen) { showToast('密钥模块未加载', true); return; }
      var k = window.__keygen.currentKey(S.key.rotation || 'daily', S.key.salt || '');
      var link = window.location.origin + '/?k=' + k;
      if (navigator.clipboard) navigator.clipboard.writeText(link);
      showToast('已复制主页入口链接（含密钥），打开后提示如何用彩蛋进入隐藏页');
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

  // ---- 模块导出 ----

  A.renderSite = renderSite; A.renderEgg = renderEgg; A.renderKey = renderKey;

})();
