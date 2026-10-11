/**
 * Easter Egg — 彩蛋模块
 *
 * 配置由 data-loader 从 /api/config 的 site.egg_* 注入到 window.__eggConfig：
 *   { enabled: boolean, clicks: number, timeout: ms, target: string }
 *
 * 触发规则：在触发器（默认 #hashtag，即页脚版权文字）上
 * 连续点击 clicks 次，相邻点击间隔不超过 timeout 毫秒，即触发。
 * 触发后跳转到 target；若当前已在该目标页则回首页，避免原地刷新。
 *
 * 监听 'configloaded' 事件，管理面板保存后配置自动重载生效。
 */
(function () {
  'use strict';

  var selector = '#hashtag';
  var cfg = { enabled: true, clicks: 5, timeout: 2000, target: '' };
  var count = 0;
  var timer = null;

  // 根据目标生成跳转动作；已在目标页 → 回首页
  function buildAction(target) {
    var t = target ? String(target) : '';
    if (!t) return function () { window.location.href = '/'; };
    return function () {
      var isRemote = t.indexOf('://') !== -1;
      if (!isRemote) {
        var tPath = t.split('?')[0].replace(/^\//, '').replace(/\/+$/, '');
        var cur = (window.location.pathname || '/').replace(/^\//, '').replace(/\/+$/, '');
        if (tPath && cur && cur.indexOf(tPath) !== -1) {
          window.location.href = '/';
          return;
        }
      }
      window.location.href = t;
    };
  }

  function applyConfig() {
    var c = window.__eggConfig || {};
    cfg.enabled = c.enabled !== false;
    cfg.clicks = parseInt(c.clicks, 10) || 5;
    cfg.timeout = parseInt(c.timeout, 10) || 2000;
    cfg.target = c.target != null ? String(c.target) : '';
    cfg.action = buildAction(cfg.target);
    count = 0;
    if (timer) { clearTimeout(timer); timer = null; }
  }

  applyConfig();

  var el = document.querySelector(selector);
  if (!el) {
    console.warn('[EasterEgg] 未找到触发器: ' + selector);
    return;
  }

  el.addEventListener('click', function () {
    if (!cfg.enabled) return;
    count++;
    if (timer) clearTimeout(timer);

    if (count >= cfg.clicks) {
      count = 0;
      cfg.action();
      return;
    }

    timer = setTimeout(function () {
      count = 0;
    }, cfg.timeout);
  });

  document.addEventListener('configloaded', applyConfig);
})();
