/**
 * keygen.js — 密钥生成 / 校验（耳语页 ?k= 访问控制）
 *
 * 管理面板「设置 → 密钥设置」可配置：
 *   key_enabled    '1'/'0'    是否启用密钥（默认启用）
 *   key_rotation   hourly|daily|weekly|monthly|never   轮换周期
 *   key_salt       盐值（改了密钥就变；留空用默认 HuoLin）
 *   key_permanent  永久密钥（任意字符串，永远有效）
 *
 * 同一份算法供两处使用（UMD）：
 *   - 浏览器：window.__keygen（管理面板实时显示当前密钥、前端地址栏归一化）
 *   - Node  ：module.exports（api/config.js 服务端校验 whisper 密钥）
 * 修改本文件时，两端行为同步，无需二次改动。
 *
 * 时间桶统一用 UTC（而非本地时区）：服务端在 Vercel 按 UTC 跑，
 * 若客户端按本地时区算，跨时区（如访客 UTC+8）会算出不同的日桶导致误拒。
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.__keygen = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_SALT = 'HuoLin';

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // 按轮换周期取当前时间桶（一律用 UTC，见文件头注释）
  function bucket(rotation, date) {
    var d = date || new Date();
    var y = d.getUTCFullYear();
    var m = pad(d.getUTCMonth() + 1);
    var day = pad(d.getUTCDate());
    switch (rotation) {
      case 'hourly':
        return y + '-' + m + '-' + day + '-' + pad(d.getUTCHours());
      case 'weekly': {
        var t = new Date(Date.UTC(y, d.getUTCMonth(), day));
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

  return {
    DEFAULT_SALT: DEFAULT_SALT,
    hash: hash,
    bucket: bucket,
    currentKey: currentKey,
    isValid: isValid
  };
});
