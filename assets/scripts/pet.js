/**
 * Pet Buddy — 虚拟宠物（纯功能）
 * 点击跳两下 + 随机气泡说话
 * 宠物图片由 HTML 中 <img src="..."> 直接指定
 * 每个页面可通过 window.__petMessages 自定义气泡语录
 */
(function () {
  'use strict';

  function initPet() {
    var pet = document.getElementById('pet');
    var petBubble = document.getElementById('petBubble');
    if (!pet || !petBubble) return; // 安全兜底，不会重试

    var timer = null;

    // 气泡语录（页面自定义 → i18n 翻译 → 默认英文/中文兜底）
    var messages = window.__petMessages || __('pet.default');

    // 语言切换时刷新消息列表
    document.addEventListener('languagechange', function () {
      messages = window.__petMessages || __('pet.default');
    });

    pet.addEventListener('click', function (e) {
      if (timer) {
        clearTimeout(timer);
        petBubble.classList.remove('show');
        timer = null;
      }

      // 重播跳跃动画
      pet.classList.remove('jumping');
      void pet.offsetWidth;
      pet.classList.add('jumping');

      // 随机消息
      petBubble.textContent = messages[Math.floor(Math.random() * messages.length)];

      // 显示气泡
      petBubble.classList.add('show');

      // 移除动画 class
      setTimeout(function () {
        pet.classList.remove('jumping');
      }, 700);

      // 自动隐藏气泡
      timer = setTimeout(function () {
        petBubble.classList.remove('show');
        timer = null;
      }, 2500);
    });
  }

  // 如果页面已加载完成，立即初始化；否则等 DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPet);
  } else {
    initPet();
  }

  // data-loader 加载完成后重新初始化（使用数据库中的宠物数据）
  document.addEventListener('configloaded', function () {
    // 重新初始化 pet，使用从数据库加载的图片和消息
    initPet();
  });

})();
