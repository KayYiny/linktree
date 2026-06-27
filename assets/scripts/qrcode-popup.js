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
 *      data-img="assets/qrcodes/qq.jpg"
 *      data-url="https://example.com"
 *      data-note="点击上方按钮直接访问">
 *     <span class="link-icon"><img src="assets/icons/qq.svg" class="brand-icon" alt="QQ"></span>
 *     <span class="link-label">QQ</span>
 *   </a>
 */
(function () {
  'use strict';

  // 没有触发器则直接退出
  var triggers = document.querySelectorAll('.img-popup-trigger');
  if (!triggers.length) return;

  var activeTrigger = null; // 当前打开的触发器

  // ---- 创建弹窗 DOM ----
  var popupDom = document.createElement('div');
  popupDom.className = 'img-popup-overlay';
  popupDom.id = 'imgPopup';
  popupDom.innerHTML = '<div class="img-popup-card">'
    + '<img class="img-popup-image" id="imgPopupImage" src="" alt="">'
    + '<div class="img-popup-label" id="imgPopupLabel"></div>'
    + '<a class="img-popup-btn" id="imgPopupBtn" href="#" target="_blank" style="display:none"><i class="fas fa-external-link-alt"></i> ' + __('popup.visit') + '</a>'
    + '<div class="img-popup-note" id="imgPopupNote"></div>'
    + '<span class="img-popup-close" id="imgPopupCloseBtn">&times;</span>'
    + '</div>';
  document.body.appendChild(popupDom);

  var imgPopup = document.getElementById('imgPopup');
  var imgPopupImage = document.getElementById('imgPopupImage');
  var imgPopupLabel = document.getElementById('imgPopupLabel');
  var imgPopupBtn = document.getElementById('imgPopupBtn');
  var imgPopupClose = document.getElementById('imgPopupCloseBtn');

  // ---- 绑定触发器点击 ----
  triggers.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      activeTrigger = this;
      var imgSrc = this.dataset.img;
      var url = this.dataset.url;
      var note = this.dataset.note || '';
      var label = this.querySelector('.link-label')?.textContent || '';
      if (imgSrc) {
        imgPopupImage.src = imgSrc;
        imgPopupImage.alt = label;
        imgPopupLabel.textContent = label;
        imgPopupNote.textContent = note;
        if (url) {
          imgPopupBtn.href = url;
          imgPopupBtn.style.display = 'inline-flex';
        } else {
          imgPopupBtn.style.display = 'none';
        }
        imgPopup.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  // ---- 关闭弹窗 ----
  function closeImgPopup() {
    imgPopup.classList.remove('active');
    document.body.style.overflow = '';
  }

  imgPopupClose.addEventListener('click', closeImgPopup);

  imgPopup.addEventListener('click', function (e) {
    if (e.target === imgPopup) closeImgPopup();
  });

  document.addEventListener('keydown', function (e) {
    if (imgPopup.classList.contains('active') && e.key === 'Escape') {
      closeImgPopup();
    }
  });

  // 语言切换时更新弹窗文字
  document.addEventListener('languagechange', function () {
    // 重建按钮 HTML（保留原有 display 状态）
    var wasVisible = imgPopupBtn.style.display !== 'none';
    var href = imgPopupBtn.getAttribute('href');
    imgPopupBtn.innerHTML = '<i class="fas fa-external-link-alt"></i> ' + __('popup.visit');
    imgPopupBtn.setAttribute('href', href);
    if (wasVisible) imgPopupBtn.style.display = 'inline-flex';

    // 更新标签和备注（从当前触发器重新读取）
    if (activeTrigger) {
      var newLabel = activeTrigger.querySelector('.link-label')?.textContent || '';
      var newNote = activeTrigger.getAttribute('data-note') || '';
      imgPopupLabel.textContent = newLabel;
      imgPopupNote.textContent = newNote;
    }
  });

})();
