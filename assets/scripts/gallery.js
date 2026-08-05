/**
 * Gallery — 图片相册模块
 *
 * 功能：
 *   - 在弹窗中展示图片网格
 *   - 点击缩略图进入灯箱视图（大图浏览）
 *   - 键盘方向键 / 点击按钮切换图片
 *   - 支持本地路径和直链 URL
 *
 * 用法：
 *   1. 在页面中放入 <a class="link gallery-trigger">…</a> 作为相册入口
 *   2. 在引入本脚本之前定义 window.__galleryImages
 *   3. 每个页面可配置完全不同的图片集
 *
 *   window.__galleryImages = [
 *     { src: 'assets/images/photo.jpg',  label: '照片 1' },
 *     { src: 'https://example.com/img.jpg', label: '网络图片' },
 *   ];
 *
 *   所有字段：
 *     src   — 图片路径（本地相对路径或直链 URL）[必需]
 *     label — 显示在缩略图底部和灯箱底部的标签     [可选]
 */
(function () {
  'use strict';

  // ──────────────────────────────────────────────
  //  读取配置
  // ──────────────────────────────────────────────
  var images = window.__galleryImages || [];
  var totalImages = images.length;

  // 按列数取展示行数（保证完整行，不留半行）
  function getItemsPerPage() {
    var cols = window.innerWidth <= 768 ? 2 : 3;
    return cols * 3; // 显示 3 整行
  }

  // ──────────────────────────────────────────────
  //  内部状态
  // ──────────────────────────────────────────────
  var currentIndex = 0;
  var currentPage = 0;
  var totalPages = 0;
  var mode = 'grid'; // 'grid' | 'lightbox'

  // DOM 引用（build 后填充）
  var overlay, modal;
  var headerEl, gridEl, paginationEl, lightboxEl;
  var lightboxImg, lightboxLabel, lightboxCounter;
  var pageIndicatorEl, pagePrevBtn, pageNextBtn;
  var perPageGlobal, galleryTitle, backBtn;

  // 样式已移至 style.css（GALLERY 节）

  // ──────────────────────────────────────────────
  //  构建 DOM
  // ──────────────────────────────────────────────
  function build() {
    overlay = document.createElement('div');
    overlay.className = 'gallery-overlay';

    modal = document.createElement('div');
    modal.className = 'gallery-modal';

    // ---- Header（仅网格模式可见） ----
    headerEl = document.createElement('div');
    headerEl.className = 'gallery-header';
    galleryTitle = document.createElement('span');
    galleryTitle.className = 'gallery-title';
    galleryTitle.textContent = __('gallery.title');
    var closeBtn = document.createElement('span');
    closeBtn.className = 'gallery-close-btn';
    closeBtn.innerHTML = '×';
    headerEl.appendChild(galleryTitle);
    headerEl.appendChild(closeBtn);

    // ---- 网格视图 ----
    gridEl = document.createElement('div');
    gridEl.className = 'gallery-grid';

    // 按当前屏幕宽度决定每页展示数（桌面 3×3 / 手机 2×3）
    var perPage = getItemsPerPage();
    perPageGlobal = perPage;
    totalPages = Math.ceil(totalImages / perPage);
    currentPage = 0;

    images.forEach(function (img, i) {
      var item = document.createElement('div');
      item.className = 'gallery-grid-item';
      // 第一页之外的项先隐藏
      if (Math.floor(i / perPage) !== 0) {
        item.classList.add('gallery-page-hidden');
      }
      // 动画延迟：每页内的项入场节奏不乱
      item.style.animationDelay = (0.06 * (i % perPage)) + 's';

      var imgTag = document.createElement('img');
      imgTag.src = img.src;
      imgTag.alt = img.label || '';
      imgTag.loading = 'lazy';
      imgTag.draggable = false;

      // 图片加载失败占位
      imgTag.onerror = function () {
        this.className = 'gallery-img-error';
        if (!item.querySelector('.gallery-error-icon')) {
          var placeholder = document.createElement('div');
          placeholder.className = 'gallery-error-icon';
          placeholder.innerHTML = '<i class="fas fa-image"></i>';
          item.insertBefore(placeholder, this.nextSibling);
        }
      };

      item.appendChild(imgTag);

      // 透明遮罩：阻止长按/右键选中图片
      var overlayEl = document.createElement('div');
      overlayEl.className = 'gallery-img-overlay';
      item.appendChild(overlayEl);

      if (img.label) {
        var lbl = document.createElement('span');
        lbl.className = 'gallery-grid-label';
        lbl.textContent = img.label;
        item.appendChild(lbl);
      }

      item.addEventListener('click', function () {
        openLightbox(i);
      });

      gridEl.appendChild(item);
    });

    // ---- 分页栏（超过一页时显示） ----
    paginationEl = document.createElement('div');
    paginationEl.className = 'gallery-pagination';
    pagePrevBtn = document.createElement('span');
    pagePrevBtn.className = 'gallery-page-btn';
    pagePrevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> ' + __('gallery.prev');
    pageIndicatorEl = document.createElement('span');
    pageIndicatorEl.className = 'gallery-page-indicator';
    pageIndicatorEl.textContent = '1 / ' + totalPages;
    pageNextBtn = document.createElement('span');
    pageNextBtn.className = 'gallery-page-btn';
    pageNextBtn.innerHTML = __('gallery.next') + ' <i class="fas fa-chevron-right"></i>';
    paginationEl.appendChild(pagePrevBtn);
    paginationEl.appendChild(pageIndicatorEl);
    paginationEl.appendChild(pageNextBtn);

    pagePrevBtn.addEventListener('click', function () {
      if (currentPage > 0) showPage(currentPage - 1);
    });
    pageNextBtn.addEventListener('click', function () {
      if (currentPage < totalPages - 1) showPage(currentPage + 1);
    });

    // 只有一页时不显示分页栏
    if (totalPages <= 1) {
      paginationEl.style.display = 'none';
    }

    // ---- 灯箱视图 ----
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'gallery-lightbox';

    // 灯箱头：返回按钮 + 关闭按钮
    var lbHeader = document.createElement('div');
    lbHeader.className = 'gallery-lb-header';
    backBtn = document.createElement('span');
    backBtn.className = 'gallery-lb-back';
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> ' + __('gallery.back');
    var lbCloseBtn = document.createElement('span');
    lbCloseBtn.className = 'gallery-close-btn';
    lbCloseBtn.innerHTML = '×';
    lbHeader.appendChild(backBtn);
    lbHeader.appendChild(lbCloseBtn);

    // 灯箱体：图片 + 导航箭头
    var lbBody = document.createElement('div');
    lbBody.className = 'gallery-lb-body';
    var prevBtn = document.createElement('span');
    prevBtn.className = 'gallery-lb-nav gallery-lb-prev';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    var nextBtn = document.createElement('span');
    nextBtn.className = 'gallery-lb-nav gallery-lb-next';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    lightboxImg = document.createElement('img');
    lightboxImg.className = 'gallery-lb-image';
    lightboxImg.alt = '';
    lightboxImg.onerror = function () {
      this.className = 'gallery-img-error';
    };
    lbBody.appendChild(prevBtn);
    lbBody.appendChild(lightboxImg);
    // 灯箱大图透明遮罩
    var lbOverlay = document.createElement('div');
    lbOverlay.className = 'gallery-lb-overlay';
    lbBody.appendChild(lbOverlay);
    lbBody.appendChild(nextBtn);

    // 灯箱底：标签 + 计数
    var lbFooter = document.createElement('div');
    lbFooter.className = 'gallery-lb-footer';
    lightboxLabel = document.createElement('span');
    lightboxLabel.className = 'gallery-lb-label';
    lightboxCounter = document.createElement('span');
    lightboxCounter.className = 'gallery-lb-counter';
    lbFooter.appendChild(lightboxLabel);
    lbFooter.appendChild(lightboxCounter);

    lightboxEl.appendChild(lbHeader);
    lightboxEl.appendChild(lbBody);
    lightboxEl.appendChild(lbFooter);

    // 组装
    modal.appendChild(headerEl);
    modal.appendChild(gridEl);
    modal.appendChild(paginationEl);
    modal.appendChild(lightboxEl);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ---- 事件绑定 ----
    closeBtn.addEventListener('click', close);
    lbCloseBtn.addEventListener('click', close);
    backBtn.addEventListener('click', showGrid);
    prevBtn.addEventListener('click', function () { navigate(-1); });
    nextBtn.addEventListener('click', function () { navigate(1); });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
  }

  // ──────────────────────────────────────────────
  //  核心方法
  // ──────────────────────────────────────────────
  function open() {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    resetMode();
  }

  function resetMode() {
    mode = 'grid';
    headerEl.style.display = '';
    gridEl.style.display = '';
    paginationEl.style.display = totalPages > 1 ? '' : 'none';
    lightboxEl.style.display = 'none';
    // 回到第一页
    if (currentPage !== 0) showPage(0);
  }

  function showGrid() {
    resetMode();
  }

  // ---- 翻页 ----
  function showPage(page) {
    currentPage = page;
    var items = gridEl.children;
    var start = currentPage * perPageGlobal;
    var end = Math.min(start + perPageGlobal, totalImages);

    for (var i = 0; i < totalImages; i++) {
      if (i >= start && i < end) {
        items[i].classList.remove('gallery-page-hidden');
      } else {
        items[i].classList.add('gallery-page-hidden');
      }
    }

    // 更新分页栏
    pageIndicatorEl.textContent = (currentPage + 1) + ' / ' + totalPages;
    pagePrevBtn.classList.toggle('is-disabled', currentPage === 0);
    pageNextBtn.classList.toggle('is-disabled', currentPage === totalPages - 1);
  }

  function openLightbox(index) {
    currentIndex = index;
    mode = 'lightbox';
    headerEl.style.display = 'none';
    gridEl.style.display = 'none';
    paginationEl.style.display = 'none';
    lightboxEl.style.display = 'flex';
    updateLightbox();
  }

  function updateLightbox() {
    var img = images[currentIndex];
    // 先显示加载态（脉冲闪烁），图片加载完后淡入
    lightboxImg.className = 'gallery-lb-image gallery-lb-loading';
    lightboxImg.src = img.src;
    lightboxImg.alt = img.label || '';
    lightboxImg.onload = function () {
      this.classList.remove('gallery-lb-loading');
    };
    lightboxLabel.textContent = img.label || '';
    lightboxCounter.textContent = (currentIndex + 1) + ' / ' + images.length;
  }

  function navigate(dir) {
    currentIndex = (currentIndex + dir + images.length) % images.length;
    updateLightbox();
  }

  // ──────────────────────────────────────────────
  //  键盘事件
  // ──────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (!overlay || !overlay.classList.contains('active')) return;

    switch (e.key) {
      case 'Escape':
        if (mode === 'lightbox') showGrid();
        else close();
        break;
      case 'ArrowLeft':
        if (mode === 'lightbox') navigate(-1);
        break;
      case 'ArrowRight':
        if (mode === 'lightbox') navigate(1);
        break;
    }
  });

  // ──────────────────────────────────────────────
  //  启动
  // ──────────────────────────────────────────────
  var built = false;
  function init() {
    var trigger = document.querySelector('.gallery-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      if (!built) { build(); built = true; }
      open();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 语言切换时刷新 gallery 文字
  document.addEventListener('languagechange', function () {
    if (!headerEl) return;
    galleryTitle.textContent = __('gallery.title');
    pagePrevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> ' + __('gallery.prev');
    pageNextBtn.innerHTML = __('gallery.next') + ' <i class="fas fa-chevron-right"></i>';
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> ' + __('gallery.back');
  });

  // data-loader 加载完成后重新读取相册图片
  document.addEventListener('configloaded', function () {
    images = window.__galleryImages || [];
    totalImages = images.length;
    built = false;
    init();
  });

})();
