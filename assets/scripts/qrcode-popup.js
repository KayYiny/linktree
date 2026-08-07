/**
 * QR Code Popup — 二维码弹窗模块
 *
 * 功能：
 *   - 点击带有 .img-popup-trigger 的链接弹出二维码
 *   - data-img   — 二维码图片路径
 *   - data-url   — 可选，弹窗中的「访问」按钮链接
 *   - data-note  — 可选，底部备注文字
 *
 * HTML 用法：
 *   <a class="link img-popup-trigger"
 *      data-img="https://example.com/qq.jpg"
 *      data-url="https://example.com"
 *      data-note="点击上方按钮直接访问">
 *     <span class="link-icon"><img src="https://cdn.simpleicons.org/qq" class="brand-icon" alt="QQ"></span>
 *     <span class="link-label">QQ</span>
 *   </a>
 */
(function () {
  'use strict';

  var activeTrigger = null;
  var imgPopup, imgPopupImage, imgPopupLabel, imgPopupBtn, imgPopupClose;
  var initialized = false;

  function initPopup() {
    var triggers = document.querySelectorAll('.img-popup-trigger');
    if (!triggers.length) return;

    // 如果弹窗 DOM 已存在，只需要重新绑定触发器
    if (initialized) {
      rebindTriggers(triggers);
      return;
    }

    // 创建弹窗 DOM
    imgPopup = document.createElement('div');
    imgPopup.className = 'img-popup-overlay';
    imgPopup.id = 'imgPopup';
    imgPopup.innerHTML = '<div class="img-popup-card">'
      + '<img class="img-popup-image" id="imgPopupImage" src="" alt="">'
      + '<div class="img-popup-label" id="imgPopupLabel"></div>'
      + '<a class="img-popup-btn" id="imgPopupBtn" href="#" target="_blank" style="display:none"><i class="fas fa-external-link-alt"></i> ' + __('popup.visit') + '</a>'
      + '<div class="img-popup-note" id="imgPopupNote"></div>'
      + '<span class="img-popup-close" id="imgPopupCloseBtn">&times;</span>'
      + '</div>';
    document.body.appendChild(imgPopup);

    imgPopupImage = document.getElementById('imgPopupImage');
    imgPopupLabel = document.getElementById('imgPopupLabel');
    imgPopupBtn = document.getElementById('imgPopupBtn');
    imgPopupClose = document.getElementById('imgPopupCloseBtn');

    rebindTriggers(triggers);

    // 关闭按钮
    imgPopupClose.addEventListener('click', closeImgPopup);
    imgPopup.addEventListener('click', function (e) {
      if (e.target === imgPopup) closeImgPopup();
    });
    document.addEventListener('keydown', function (e) {
      if (imgPopup && imgPopup.classList.contains('active') && e.key === 'Escape') {
        closeImgPopup();
      }
    });

    // 语言切换时更新弹窗文字
    document.addEventListener('languagechange', function () {
      if (!imgPopupBtn) return;
      var wasVisible = imgPopupBtn.style.display !== 'none';
      var href = imgPopupBtn.getAttribute('href');
      imgPopupBtn.innerHTML = '<i class="fas fa-external-link-alt"></i> ' + __('popup.visit');
      imgPopupBtn.setAttribute('href', href);
      if (wasVisible) imgPopupBtn.style.display = 'inline-flex';

      if (activeTrigger) {
        var newLabel = activeTrigger.querySelector('.link-label')?.textContent || '';
        var newNote = activeTrigger.getAttribute('data-note') || '';
        imgPopupLabel.textContent = newLabel;
        imgPopupNote.textContent = newNote;
      }
    });

    initialized = true;
  }

  function rebindTriggers(triggers) {
    // 移除旧的事件监听（通过克隆元素）
    triggers.forEach(function (btn) {
      var newBtn = btn.cloneNode(true);
      newBtn.addEventListener('click', handleTriggerClick);
      btn.parentNode.replaceChild(newBtn, btn);
    });
  }

  function handleTriggerClick(e) {
    e.preventDefault();
    activeTrigger = this;
    var imgSrc = this.dataset.img;
    var url = this.dataset.url;
    var note = this.dataset.note || '';
    var label = this.querySelector('.link-label')?.textContent || '';
    if (imgSrc && imgPopup) {
      imgPopupImage.src = imgSrc;
      imgPopupImage.alt = label;
      imgPopupLabel.textContent = label;
      document.getElementById('imgPopupNote').textContent = note;
      if (url) {
        imgPopupBtn.href = url;
        imgPopupBtn.style.display = 'inline-flex';
      } else {
        imgPopupBtn.style.display = 'none';
      }
      imgPopup.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeImgPopup() {
    if (imgPopup) {
      imgPopup.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // 初始运行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPopup);
  } else {
    initPopup();
  }

  // data-loader 加载完成后重新绑定
  document.addEventListener('configloaded', function () {
    initPopup();
  });

  // data-loader 在语言切换时重渲 #links 并派发 linksreloaded → 此时重新绑定触发器
  // （不能听 languagechange：qrcode-popup 加载早于 data-loader，触发时旧链接还没被重渲）
  document.addEventListener('linksreloaded', function () {
    initPopup();
  });

})();
