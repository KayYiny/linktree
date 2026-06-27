/**
 * Anti-Inspect — 前端源码查看防护
 *
 * ⚠ 免责声明：此脚本无法 100% 阻止专业人员获取源码。
 * 它只能增加普通用户通过 F12 / 右键查看的门槛。
 * 真正的源码保护应依赖服务端逻辑与合规协议。
 */

(function () {
  'use strict';

  // ============================================================
  //  1. 禁用右键菜单
  // ============================================================
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  });

  // ============================================================
  //  2. 拦截快捷键
  // ============================================================
  document.addEventListener('keydown', function (e) {
    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+I (DevTools)
    // Ctrl+Shift+J (Console)
    // Ctrl+Shift+C (Inspect Element)
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
      e.preventDefault();
      return false;
    }

    // Ctrl+U (View Source)
    if (e.ctrlKey && e.key.toUpperCase() === 'U') {
      e.preventDefault();
      return false;
    }

    // Ctrl+S (Save Page)
    if (e.ctrlKey && e.key.toUpperCase() === 'S') {
      e.preventDefault();
      return false;
    }
  });

})();
