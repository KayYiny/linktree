/**
 * secret — 每日密钥（共享）
 *
 * 主页彩蛋跳转 / 耳语页校验 / hint-popup / 分享按钮 都依赖当日密钥。
 * 盐（salt）与长度（secretLen）从配置读取，可在后台修改。
 *
 * 用法：
 *   window.__getDailySecret() → 例如 "ab3cde"
 *
 * 说明：简单哈希 + 固定盐，目的是挡住静态爬取，不是防逆向。
 */
(function () {
  'use strict';

  var SALT_DEFAULT = 'hul_ref_2024';
  var LEN_DEFAULT = 6;

  function _hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  /** 读取当前配置中的盐与长度（配置由 site-data.js 异步注入） */
  function getConfig() {
    var w = (window.__siteConfig && window.__siteConfig.whisper) || {};
    return {
      salt: w.salt || SALT_DEFAULT,
      len: Number(w.secretLen) || LEN_DEFAULT,
    };
  }

  /** 计算当日密钥 */
  function getDailySecret() {
    var c = getConfig();
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return _hash(y + '-' + m + '-' + day + c.salt).slice(0, c.len);
  }

  window.__getDailySecret = getDailySecret;
  window.__secretDefaults = { salt: SALT_DEFAULT, len: LEN_DEFAULT };
})();
