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
    if (!pet || !petBubble) {
      // DOM 还没渲染好，稍后重试
      setTimeout(initPet, 200);
      return;
    }

    var timer = null;

    // 气泡语录（页面自定义 → 默认）
    var messages = window.__petMessages || [
      '揪一下~ 🐾',
      '今天心情不错！',
      '咕噜咕噜~',
      '戳我干嘛呀？',
      '好想吃小鱼干 🐟',
      '看我跳一跳！',
      '晚安世界 🌙',
      '要抱抱！🤗',
      '嘿嘿，又被你抓到了',
      '喜欢你的主页 ✨',
      '我是小跟屁虫~',
      '好闲呀… zzz',
      '你今天真好看 💕',
      '再戳就生气了！哼！',
      '飞一个~ 🦋',
      '发现野生大佬！',
      '摇尾巴 ing 🌀',
      '待机中，请稍候 ⏳',
    ];

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

})();
