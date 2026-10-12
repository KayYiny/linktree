/**
 * save.js — 保存引擎：保存全部 + 各实体的批量提交（显式保存模型）
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

  // ==================== 保存全部（批量提交） ====================
  // 依赖顺序：先建/改页面（新页面 id 供子内容引用）→ 子内容 → 删页面 → 站点配置
  async function saveAll() {
    var errs = [];
    setSaving(true);
    try {
      await savePagesPhase1(errs); // 新建 + 更新页面，重映射子内容 page_id
      await savePets(errs);
      await saveGallery(errs);
      await saveLinks(errs);
      await savePagesPhase2(errs); // 删除页面（子内容已删）
      await saveSite(errs);
    } catch (err) {
      errs.push(err.message);
    }
    setSaving(false);
    if (errs.length) {
      showToast('保存完成，但有 ' + errs.length + ' 处失败：' + errs.slice(0, 3).join('；'), true, 4500);
    } else {
      showToast('全部保存成功！');
      A.lastSaveTime = new Date().toTimeString().slice(0, 5);
    }
    try { await A.loadAll(); } catch (e) { /* 已提示 */ }
  }

  // 按 page_id 分组重算 sort_order（仅作用于非删除条目）
  function assignSort(arr, getPage) {
    var byPage = {};
    arr.forEach(function (it) {
      if (it._deleted) return;
      var k = String(getPage(it));
      (byPage[k] = byPage[k] || []).push(it);
    });
    Object.keys(byPage).forEach(function (k) {
      byPage[k].forEach(function (it, i) {
        if (it.sort_order !== i) {
          it.sort_order = i;
          // 排序变化的已有条目标脏，确保新顺序被提交（否则只存部分条目会打乱顺序）
          if (!it._new) it._dirty = true;
        }
      });
    });
  }

  async function savePagesPhase1(errs) {
    var arr = S.pages;
    var touched = arr.some(function (p) { return p._dirty; });
    if (!touched) return;
    try {
      // 新建页面（先生成真实 id，并重映射子内容引用）
      for (var it of arr) {
        if (it._new && !it._deleted) {
          if (!it.slug || !it.slug.trim()) {
            errs.push('页面「' + (it.title || '未命名') + '」的 slug 为空，已跳过');
            continue;
          }
          var res = await api('/api/admin/pages', 'POST', {
            slug: it.slug, title: it.title || '', background_image: it.background_image || null,
            is_active: it.is_active, sort_order: it.sort_order, gallery_enabled: it.gallery_enabled !== false, key_required: it.key_required === true, egg_target: it.egg_target || ''
          });
          if (res && res.id != null) {
            var oldId = String(it.id);
            ['links', 'gallery', 'pets'].forEach(function (k) {
              S[k].forEach(function (c) { if (String(c.page_id) === oldId) c.page_id = res.id; });
            });
            it.id = res.id;
            it._new = false;
          }
        }
      }
      // 更新已有页面
      assignSort(arr, function () { return 0; });
      for (var it2 of arr) {
        if (!it2._new && !it2._deleted && it2._dirty) {
          await api('/api/admin/pages?id=' + it2.id, 'PUT', {
            slug: it2.slug, title: it2.title || '', background_image: it2.background_image || null,
            is_active: it2.is_active, sort_order: it2.sort_order, gallery_enabled: it2.gallery_enabled !== false, key_required: it2.key_required === true, egg_target: it2.egg_target || ''
          });
          it2._dirty = false;
        }
      }
    } catch (e) { errs.push('页面：' + e.message); }
  }

  async function savePagesPhase2(errs) {
    var arr = S.pages;
    try {
      for (var it of arr) {
        if (it._deleted && !it._new && it.id != null) {
          await api('/api/admin/pages?id=' + it.id, 'DELETE');
        }
      }
    } catch (e) { errs.push('删除页面：' + e.message); }
  }

  async function savePets(errs) {
    var arr = S.pets;
    if (!arr.some(function (p) { return p._dirty; })) return;
    try {
      for (var it of arr) if (it._deleted && !it._new && it.id != null) await api('/api/admin/pet?id=' + it.id, 'DELETE');
      for (var it of arr) if (it._new && !it._deleted) {
        var res = await api('/api/admin/pet', 'POST', {
          page_id: it.page_id, pet_image: it.pet_image || '', pet_type: it.pet_type || '', messages: it.messages || [],
          is_active: it.is_active !== false
        });
        if (res && res.id != null) { it.id = res.id; it._new = false; it._dirty = false; }
      }
      for (var it of arr) if (!it._new && !it._deleted && it._dirty) {
        await api('/api/admin/pet?id=' + it.id, 'PUT', {
          pet_image: it.pet_image || '', pet_type: it.pet_type || '', messages: it.messages || [],
          is_active: it.is_active !== false
        });
      }
    } catch (e) { errs.push('宠物：' + e.message); }
  }

  async function saveGallery(errs) {
    var arr = S.gallery;
    if (!arr.some(function (g) { return g._dirty; })) return;
    try {
      for (var it of arr) if (it._deleted && !it._new && it.id != null) await api('/api/admin/gallery?id=' + it.id, 'DELETE');
      assignSort(arr, function (g) { return g.page_id; });
      for (var it of arr) if (it._new && !it._deleted) {
        if (!it.src || !it.src.trim()) { errs.push('相册：存在空图片地址，已跳过'); continue; }
        var res = await api('/api/admin/gallery', 'POST', { page_id: it.page_id, src: it.src, sort_order: it.sort_order, is_active: it.is_active !== false });
        if (res && res.id != null) { it.id = res.id; it._new = false; it._dirty = false; }
      }
      for (var it of arr) if (!it._new && !it._deleted && it._dirty) {
        await api('/api/admin/gallery?id=' + it.id, 'PUT', { page_id: it.page_id, src: it.src, sort_order: it.sort_order, is_active: it.is_active !== false });
      }
    } catch (e) { errs.push('相册：' + e.message); }
  }

  async function saveLinks(errs) {
    var arr = S.links;
    if (!arr.some(function (l) { return l._dirty; })) return;
    try {
      for (var it of arr) if (it._deleted && !it._new && it.id != null) await api('/api/admin/links?id=' + it.id, 'DELETE');
      assignSort(arr, function (l) { return l.page_id; });
      for (var it of arr) if (it._new && !it._deleted) {
        var res = await api('/api/admin/links', 'POST', {
          page_id: it.page_id, label: it.label || '链接', url: it.url || null, icon: it.icon || null,
          qr_code: it.qr_code || null, popup_note: it.popup_note || null,
          is_active: it.is_active, sort_order: it.sort_order
        });
        if (res && res.id != null) { it.id = res.id; it._new = false; it._dirty = false; }
      }
      for (var it of arr) if (!it._new && !it._deleted && it._dirty) {
        await api('/api/admin/links?id=' + it.id, 'PUT', {
          page_id: it.page_id, label: it.label || '链接', url: it.url || null, icon: it.icon || null,
          qr_code: it.qr_code || null, popup_note: it.popup_note || null,
          is_active: it.is_active, sort_order: it.sort_order
        });
      }
    } catch (e) { errs.push('链接：' + e.message); }
  }

  async function saveSite(errs) {
    try {
      var body = {};
      if (S.siteDirty) {
        body.avatar = S.site.avatar || '';
        body.username = S.site.username || '';
        body.favicon = S.site.favicon || '';
        body.footer = S.site.footer || '';
      }
      if (S.eggDirty) {
        body.egg_enabled = S.egg.enabled ? '1' : '0';
        body.egg_clicks = String(S.egg.clicks || '5');
        body.egg_timeout = String(S.egg.timeout || '2000');
      }
      if (S.keyDirty) {
        body.key_enabled = S.key.enabled ? '1' : '0';
        body.key_rotation = S.key.rotation || 'daily';
        body.key_salt = S.key.salt || '';
        body.key_permanent = S.key.permanent || '';
      }
      if (Object.keys(body).length) await api('/api/admin/site-config', 'PUT', body);
    } catch (e) { errs.push('站点配置：' + e.message); }
  }

  // ---- 模块导出 ----

  A.saveAll = saveAll;

})();
