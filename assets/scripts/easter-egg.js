/**
 * Easter Egg — 彩蛋模块
 *
 * 在页面上使用：
 *   <script src="assets/scripts/easter-egg.js"></script>
 *
 * 配置方式（在引用本脚本之前）：
 *
 *   window.__eggConfig = {
 *     trigger: '#hashtag',        // 点击触发器的 CSS 选择器
 *     clicks: 5,                  // 累计点击次数
 *     timeout: 2000,              // 点击间隔超时（毫秒）
 *     action: function() {        // 触发后执行的回调
 *       window.location.href = '/';
 *     }
 *   };
 *
 * 所有字段均可选，不配则使用默认值。
 */
(function () {
  'use strict';

  // 触发器选择器（用默认 #hashtag；配置由 site-data.js 异步注入，读最新值）
  var selector = '#hashtag';

  // ---- 内部状态 ----
  var count = 0;
  var timer = null;

  // ---- 查找触发器并绑定 ----
  var el = document.querySelector(selector);
  if (!el) {
    console.warn('[EasterEgg] 未找到触发器: ' + selector);
    return;
  }

  el.addEventListener('click', function () {
    // 每次点击读取最新配置（后台修改无需重新部署立即生效）
    var cfg = window.__eggConfig || {};
    if (cfg.enabled === false) { count = 0; return; }
    var maxClicks = cfg.clicks || 5;
    var resetTime = cfg.timeout || 2000;
    var action = cfg.action || function () { window.location.href = '/'; };

    count++;
    if (timer) clearTimeout(timer);

    if (count >= maxClicks) {
      count = 0;
      action();
      return;
    }

    timer = setTimeout(function () {
      count = 0;
    }, resetTime);
  });
})();
