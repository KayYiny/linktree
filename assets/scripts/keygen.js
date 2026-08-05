/**
 * keygen.js — 密钥生成 / 校验（耳语页 ?k= 访问控制）
 *
 * 管理面板「设置 → 密钥设置」可配置：
 *   key_enabled    '1'/'0'    是否启用密钥（默认启用）
 *   key_rotation   hourly|daily|weekly|monthly|never   轮换周期
 *   key_salt       盐值（改了密钥就变；留空用默认 hul_ref_2024）
 *   key_permanent  永久密钥（任意字符串，永远有效）
 *
 * 暴露 window.__keygen：
 *   currentKey(rotation, salt) -> 当前 6 位轮换密钥
 *   isValid(k, rotation, salt, permanent) -> 是否放行
 */
(function () {
  'use strict';

  var DEFAULT_SALT = 'hul_ref_2024';

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // 按轮换周期取当前时间桶
  function bucket(rotation, date) {
    var d = date || new Date();
    var y = d.getFullYear();
    var m = pad(d.getMonth() + 1);
    var day = pad(d.getDate());
    switch (rotation) {
      case 'hourly':
        return y + '-' + m + '-' + day + '-' + pad(d.getHours());
      case 'weekly': {
        var t = new Date(Date.UTC(y, d.getMonth(), d.getDate()));
        var dow = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - dow);
        var yStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        var week = Math.ceil((((t - yStart) / 86400000) + 1) / 7);
        return t.getUTCFullYear() + '-W' + pad(week);
      }
      case 'monthly':
        return y + '-' + m;
      case 'never':
        return 'static';
      case 'daily':
      default:
        return y + '-' + m + '-' + day;
    }
  }

  // 当前轮换密钥（6 位）
  function currentKey(rotation, salt) {
    return hash(bucket(rotation) + (salt || DEFAULT_SALT)).slice(0, 6);
  }

  // 校验 ?k= 是否有效（命中永久密钥 或 当前轮换密钥）
  function isValid(k, rotation, salt, permanent) {
    if (!k) return false;
    if (permanent && k === permanent) return true;
    return k === currentKey(rotation, salt);
  }

  window.__keygen = {
    DEFAULT_SALT: DEFAULT_SALT,
    hash: hash,
    bucket: bucket,
    currentKey: currentKey,
    isValid: isValid
  };
})();
