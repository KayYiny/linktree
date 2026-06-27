# 🔥 HuoLin Linktree — 火林名片站

<div align="center">
  <img src="assets/images/avatar.webp" alt="HuoLin Avatar" width="120" style="border: 4px solid #000; box-shadow: 8px 8px 0 #2a2a2a;">
  <br><br>

  <!-- Tech & License Badges -->
  ![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=fff)
  ![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=fff)
  ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)
  [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#-许可)
</div>

> **设计理念：** Raw · Heavy · Confrontational — 粗野、厚重、直面观众。用大胆的边框、厚重的阴影、鲜明的撞色（青、粉、黄）传递强烈的视觉个性。

---

## 📑 目录

- [项目概述](#-项目概述)
- [技术栈](#-技术栈)
- [设计风格 — 新粗野主义](#-设计风格--新粗野主义)
- [项目结构](#-项目结构)
- [快速预览](#-快速预览)
- [功能详解](#-功能详解)
  - [主页面](#-主页面-indexhtml)
  - [耳语子页面](#-耳语子页面-whisperindexhtml)
- [核心脚本](#-核心脚本)
- [响应式设计](#-响应式设计)
- [自定义指南](#-自定义指南)
- [部署方式](#-部署方式)
- [许可](#-许可)

---

## 📋 项目概述

**HuoLin Linktree** 是一个以 **新粗野主义（Neo-Brutalism）** 设计风格打造的个性化个人名片页（Link-in-Bio）。项目包含一个主站页面和一个隐藏的「耳语」子页面，集成了社交链接、二维码弹窗、虚拟宠物互动、彩蛋导航等丰富功能。

---

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| **HTML5** | 页面结构 |
| **CSS3**（原生） | 样式系统 + 动画 + 响应式布局 |
| **JavaScript**（ES5 / ES6） | 弹窗、宠物互动、彩蛋、防护逻辑 |
| **Font Awesome 6** | 社交图标库 |
| **Neo-Brutalism** | 视觉设计系统 |

> 纯静态站点，零依赖，无需构建工具。

---

## 🎨 设计风格 — 新粗野主义

| 要素 | 说明 |
|------|------|
| **配色** | 黑色背景 `#0a0a0a` + 白色表面 + 青 `#00f0ff` / 粉 `#ff0066` / 黄 `#ffea00` 三色点缀 |
| **字体** | 标题：Bebas Neue（粗野无衬线）；正文：DM Sans（现代简洁） |
| **边框** | 全局 `4px` 粗边框，无圆角，保持尖锐感 |
| **阴影** | 标志性 `8px × 8px` 右下阴影，hover 时增强 |
| **纹理** | SVG 噪点颗粒叠加层，增强质感 |
| **动效** | 链接交错入场 `fadeUp`；hover 时上左位移 + 青影；按压时下沉 |

---

## 🗂️ 项目结构

```
linktree/
├── index.html                       # 主页面
├── style.css                        # 新粗野主义设计系统
├── README.md                        # 项目文档
│
├── assets/
│   ├── fontawesome/                 # Font Awesome 6 图标库
│   ├── images/
│   │   ├── avatar.webp               # 头像（WebP 压缩）
│   │   ├── bg.jpg                   # 主页面背景
│   │   ├── favicon.svg              # 网站图标
│   │   └── Puppy_Play_Pride_Flag.svg # 耳语页面背景（彩虹旗）
│   ├── pets/
│   │   ├── pet.webm                 # 主页面宠物（老虎/猫，WebM 视频）
│   │   └── pet1.webp                # 耳语页面宠物（小狗）
│   ├── qrcodes/                     # 各平台二维码图片
│   └── scripts/
│       ├── anti-inspect.js          # 前端防护
│       ├── easter-egg.js            # 彩蛋模块
│       ├── gallery.js               # 图片相册（分页 + 灯箱）
│       └── pet.js                   # 虚拟宠物交互
│
└── whisper/
    └── index.html                   # 隐藏子页面「耳语」
```

---

## 👀 快速预览

> 🖼️ 将页面截图放入 `screenshots/` 目录后，在此处展示：

```markdown
<!-- 示例： -->
![主页面预览](screenshots/homepage.png)
![耳语页面预览](screenshots/whisper.png)
```

---

## ✨ 功能详解

### 🏠 主页面 (`index.html`)

| 功能模块 | 说明 |
|---------|------|
| 🔗 **社交链接** | QQ / 微信 / Bilibili / 抖音，品牌官方配色图标 |
| 🖼️ **二维码弹窗** | 点击社交链接触发 Neo-Brutalism 风格弹窗 |
| 🐯 **虚拟宠物** | 老虎/猫 WebM 视频，点击跳跃 + 随机趣味气泡 |
| 🥚 **彩蛋导航** | 底部版权连点 5 次 → 跳转 `/whisper` |
| 🛡️ **前端防护** | 禁右键 / 拦截 F12 / 禁 Ctrl+U 查看源码 |

#### 🔗 社交链接

| 平台 | 图标 | 交互方式 |
|------|------|----------|
| **QQ** | `fa-qq` | 点击弹出二维码 + 跳转链接 |
| **微信** | `fa-weixin` | 点击弹出二维码（仅扫码） |
| **Bilibili** | `fa-bilibili` | 点击弹出二维码 + 跳转链接 |
| **抖音** | `fa-tiktok` | 点击弹出二维码 + 跳转链接（渐变图标） |

#### 🖼️ 二维码弹窗

- 弹窗包含：平台名称、二维码、操作按钮（有跳转链接时）、备注提示
- 支持点击遮罩层 / 关闭按钮 / 按 `ESC` 关闭

#### 🐯 虚拟宠物

- **点击**：宠物执行三段式跳跃动画
- **气泡**：随机显示趣味台词，2.5 秒后自动消失
- 宠物包裹在粗野主义风格的白色相框中，底部有黄色强调条

#### 🥚 彩蛋导航

在页面底部版权区域 **`© 2026 HuoLin`** 上**连续点击 5 次**（间隔 < 2 秒），触发跳转到 `/whisper`（耳语子页面）。

---

### 🤫 耳语子页面 (`whisper/index.html`)

通过主页面彩蛋进入的隐藏页面，采用**彩虹旗**作为背景，呈现更私密的个人空间：

| 功能 | 说明 |
|------|------|
| 🔗 **社交链接** | X (Twitter) / Instagram / Bluesky |
| 🐶 **宠物** | 小狗，语录风格转为温顺/依赖向 |
| 🥚 **反向彩蛋** | 同样连点 5 次底部版权，返回主页面 |

---

## 🧩 核心脚本

### `anti-inspect.js`
前端基础防护脚本，增加普通用户通过浏览器开发者工具查看源码的门槛。

### `easter-egg.js`
通用彩蛋模块，支持通过 `window.__eggConfig` 配置：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `trigger` | `string` | `#hashtag` | 触发元素 CSS 选择器 |
| `clicks` | `number` | `5` | 所需点击次数 |
| `timeout` | `number` | `2000` | 点击间隔超时（ms） |
| `action` | `function` | 跳转首页 | 触发回调函数 |

### `pet.js`
虚拟宠物模块，自动初始化，支持：

- `window.__petMessages` — 自定义气泡语录数组
- 点击触发跳跃动画 + 随机气泡展示
- DOM 未就绪时自动重试（`setTimeout` 回退）

---

## 📱 响应式设计

| 断点 | 调整内容 |
|------|----------|
| **≤ 768px**（平板） | 缩小头像、名称字号、内边距、宠物尺寸、弹窗尺寸 |
| **≤ 480px**（手机） | 进一步缩小装饰角标、边距、边框粗细 |

---

## 🛠️ 自定义指南

### 修改社交链接

编辑 `index.html` 中 `#links` 部分：

```html
<a class="link img-popup-trigger"
   data-img="assets/qrcodes/xxx.jpg"    <!-- 二维码图片 -->
   data-url="https://..."                <!-- 跳转链接（可选） -->
   data-note="使用 xx 扫码">            <!-- 底部提示文字 -->
  <span class="link-icon"><i class="fab fa-xxx"></i></span>
  <span class="link-label">平台名称</span>
</a>
```

### 更换宠物

1. 将宠物文件放入 `assets/pets/` 目录（支持 WebM / WebP / GIF）
2. 修改 `index.html` 中 `#petImage` 的 `src` 属性
3. 修改 `window.__petMessages` 数组自定义台词

### 修改彩蛋配置

在引用 `easter-egg.js` 之前设置：

```html
<script>
window.__eggConfig = {
  clicks: 10,              // 改为 10 次点击
  timeout: 3000,           // 间隔延长到 3 秒
  action: function () {
    window.location.href = 'https://example.com';
  }
};
</script>
```

---

## 🚀 部署方式

本项目为纯静态站点，无需构建，可直接部署到任何静态托管服务：

| 方式 | 操作 |
|------|------|
| **GitHub Pages** | `git push` 后，在仓库 Settings > Pages 中选择 `main` 分支启用 |
| **Vercel / Netlify** | 直接导入仓库，自动部署，零配置 |
| **任意 Web 服务器** | 将项目文件放入服务器根目录即可访问 |

---

## 📄 许可

本项目采用 **MIT License** 开源。您可以自由使用、修改和分发本项目，但请保留原始出处声明。

---

<div align="center">
  <sub>Made with 🔥 by HuoLin · 2026</sub>
  <br>
  <sub>Design: Neo-Brutalism · Built with Vanilla HTML/CSS/JS</sub>
</div>
