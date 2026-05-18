# 📱 Instagram 克隆 - Belle 设计集成完整计划

**项目名称**：Video Pairing Platform with Belle Design  
**架构**：单页应用 (SPA)  
**状态**：前端优先模式（后端补齐）  
**开始日期**：2026-05-15  

---

## 📋 目录
1. [项目概述](#项目概述)
2. [架构设计](#架构设计)
3. [功能需求](#功能需求)
4. [文件结构](#文件结构)
5. [前端详细设计](#前端详细设计)
6. [后端需求清单](#后端需求清单)
7. [集成步骤](#集成步骤)
8. [代码示例](#代码示例)

---

## 项目概述

### 核心目标
将 Belle 设计系统（高端棕色/奶油色美学）与现有 Firebase 后端集成，创建一个完整的视频配对社交平台。

### 关键特性
- ✅ **用户认证**：Email/Password（Firebase Auth）
- ✅ **视频管理**：上传、删除、配对、浏览
- ✅ **个人资料**：displayName、handle、头像、个人简介
- ✅ **视频配对**：与其他用户配对视频
- ✅ **美学**：Belle 设计系统（棕色主题、现代动画）

### 移除的功能
- ❌ 粉丝/关注数统计
- ❌ 弹幕系统（js/danmaku.js - 已删除）

---

## 架构设计

### 📐 应用架构：SPA（单页应用）

```
index.html (登录入口)
    ↓
    ✓ 登录成功
    ↓
belle-v1.html (单页应用)
    ├─ 屏幕1：首页 (#screen-home)
    ├─ 屏幕2：上传视频 (#screen-upload)
    ├─ 屏幕3：我的影片 (#screen-my-videos)
    ├─ 屏幕4：个人资料 (#screen-profile)
    ├─ 屏幕5：编辑资料 (#screen-edit-profile)
    └─ 屏幕6：搜索用户 (#screen-search)
    
所有屏幕共享：
- 全局状态（currentUser, userVideos 等）
- 统一 CSS 样式
- 统一 JS 模块
- URL 保持不变
```

### 🔄 屏幕切换流程

```javascript
// 用户操作 → JS 函数 → 屏幕切换
用户点击"上传按钮" 
  → navigateTo('upload')
    → 隐藏 #screen-home
    → 显示 #screen-upload
    → 调用 initUploadScreen()
    
URL 始终：http://localhost/belle-v1.html
```

### 📊 数据流

```
Firebase Auth
    ↓
登录/注册 (auth.js)
    ↓
index.html (登录页)
    ↓
重定向 → belle-v1.html
    ↓
加载 currentUser
    ↓
显示首页屏幕
    ↓
用户交互 → 屏幕切换 → 功能调用 → Firestore 操作
```

---

## 功能需求

### ✅ 已实现功能
| 模块 | 函数 | 文件 | 状态 |
|------|------|------|------|
| 认证 | `registerUser()` | auth.js | ✅ |
| 认证 | `loginUser()` | auth.js | ✅ |
| 认证 | `logoutUser()` | auth.js | ✅ |
| 认证 | `getUserInfo()` | auth.js | ✅ |
| 视频 | `getUserVideos()` | video.js | ✅ |
| 视频 | `deleteVideo()` | video.js | ✅ |
| 视频 | `uploadToCloudinary()` | cloudinary.js | ✅ |
| 配对 | `createPartnership()` | partnership.js | ✅ |
| 配对 | `getUserPartnerships()` | partnership.js | ✅ |

### ⏳ 需要实现的功能

#### 前端优先（PHASE 1 - 前端）
| 屏幕 | 功能 | 优先级 | 文件 |
|------|------|--------|------|
| 首页 | 显示视频feed | 🔴 高 | belle-v1.html |
| 首页 | 视频播放 | 🔴 高 | belle-v1.html |
| 上传 | 选择视频 | 🔴 高 | belle-v1.html |
| 上传 | 上传进度条 | 🟡 中 | belle-v1.html |
| 我的影片 | 显示用户视频网格 | 🔴 高 | belle-v1.html |
| 我的影片 | 删除视频 | 🔴 高 | belle-v1.html |
| 个人资料 | 显示用户信息 | 🔴 高 | belle-v1.html |
| 个人资料 | 编辑个人资料表单 | 🔴 高 | belle-v1.html |
| 个人资料 | 头像上传预览 | 🟡 中 | belle-v1.html |
| 搜索 | 搜索用户 | 🟡 中 | belle-v1.html |
| 底部导航 | 屏幕切换按钮 | 🔴 高 | belle-v1.html |

#### 后端需求（PHASE 2 - 后端补齐）
| 模块 | 函数 | 优先级 | 新建/修改 |
|------|------|--------|----------|
| 用户资料 | `updateUserProfile()` | 🔴 高 | 新建 profile.js |
| 用户资料 | `getUserProfile(uid)` | 🔴 高 | 新建 profile.js |
| 头像 | `uploadAvatar(file)` | 🟡 中 | 新建 avatar.js |
| 头像 | `getAvatarURL(uid)` | 🟡 中 | 新建 avatar.js |
| 搜索 | `searchUsers(query)` | 🟡 中 | 新建 search.js |
| Firestore | 扩展 users 集合 | 🔴 高 | 修改数据库 |

### 🗄️ Firestore 数据结构需求

#### 当前 users 集合
```
users/{uid}
├─ email (string)
├─ createdAt (timestamp)
└─ ...
```

#### 需要扩展的字段
```
users/{uid}
├─ email (string)                  // 存在
├─ displayName (string)            // 新增：显示名（如"张三"）
├─ handle (string)                 // 新增：昵称（如"@zhang_san"）
├─ avatar (string)                 // 新增：头像 URL（Cloudinary）
├─ bio (string)                    // 新增：个人简介
├─ createdAt (timestamp)           // 存在
├─ updatedAt (timestamp)           // 新增：最后修改时间
└─ isActive (boolean)              // 新增：账户激活状态
```

---

## 文件结构

### 现有文件
```
d:\Instangram\
├─ index.html              ← 登录页面（保留）
├─ css/
│  └─ style.css            ← CSS 样式表（保留）
├─ js/
│  ├─ auth.js              ← 认证模块（保留）
│  ├─ firebase-config.js   ← Firebase 配置（保留）
│  ├─ cloudinary.js        ← Cloudinary 上传（保留）
│  ├─ partnership.js       ← 配对功能（保留）
│  └─ video.js             ← 视频管理（保留）
├─ firestore-rules.txt     ← Firestore 规则（保留）
└─ README.md               ← 文档（保留）
```

### 新增文件（前端）
```
d:\Instangram\
├─ belle-v1.html           ← 单页应用（新增）
│  └─ 包含所有屏幕 + 全局 JS
├─ css/
│  └─ belle-style.css      ← Belle 设计样式（新增或合并到 style.css）
└─ js/
   ├─ belle-app.js         ← 屏幕切换 + 全局函数（新增）
   └─ screen-*.js          ← 各屏幕的初始化函数（可选拆分）
```

### 新增文件（后端 - PHASE 2）
```
d:\Instangram\js/
├─ profile.js              ← 个人资料管理（新增）
├─ avatar.js               ← 头像上传（新增）
├─ search.js               ← 用户搜索（新增）
└─ follow.js               ← 关注功能（新增，可选）
```

---

## 前端详细设计

### 📄 belle-v1.html 结构

#### HTML 框架
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Pairing Platform</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/belle-style.css">
</head>
<body>
  <!-- 全局容器 -->
  <div class="app-container">
    
    <!-- 所有屏幕（互相隐藏/显示） -->
    <div data-screen="home" class="screen active">
      <!-- 屏幕1：首页 -->
    </div>
    
    <div data-screen="upload" class="screen">
      <!-- 屏幕2：上传视频 -->
    </div>
    
    <div data-screen="my-videos" class="screen">
      <!-- 屏幕3：我的影片 -->
    </div>
    
    <div data-screen="profile" class="screen">
      <!-- 屏幕4：个人资料 -->
    </div>
    
    <div data-screen="edit-profile" class="screen">
      <!-- 屏幕5：编辑资料 -->
    </div>
    
    <div data-screen="search" class="screen">
      <!-- 屏幕6：搜索用户 -->
    </div>
    
  </div>

  <!-- 全局状态 & 脚本 -->
  <script src="js/firebase-config.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/cloudinary.js"></script>
  <script src="js/video.js"></script>
  <script src="js/partnership.js"></script>
  <script src="js/belle-app.js"></script>
</body>
</html>
```

#### 全局状态（js/belle-app.js）
```javascript
// ===== 全局状态 =====
let currentUser = null;           // 当前登录用户 {uid, email, displayName, handle, avatar, bio, ...}
let userVideos = [];              // 当前用户的视频列表
let feedVideos = [];              // 首页 feed 视频
let currentPartnership = null;    // 当前选中的配对
let editProfileData = {};         // 编辑资料的临时数据

// ===== 屏幕切换函数 =====
function navigateTo(screenName) {
  // 隐藏所有屏幕
  document.querySelectorAll('[data-screen]').forEach(screen => {
    screen.classList.remove('active');
  });
  
  // 显示目标屏幕
  const targetScreen = document.querySelector(`[data-screen="${screenName}"]`);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
  
  // 调用屏幕初始化函数
  if (typeof window[`init${capitalize(screenName)}`] === 'function') {
    window[`init${capitalize(screenName)}`]();
  }
}

// ===== 辅助函数 =====
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// 页面加载时
document.addEventListener('DOMContentLoaded', async () => {
  // 检查用户是否已登录
  if (!currentUser) {
    // 从 auth.js 获取当前用户
    currentUser = await getCurrentUser();
    
    if (!currentUser) {
      // 未登录，重定向到登录页
      window.location.href = 'index.html';
      return;
    }
  }
  
  // 初始化首页
  navigateTo('home');
});

// 退出登录
async function handleLogout() {
  await logoutUser();
  window.location.href = 'index.html';
}
```

### 🏠 屏幕1：首页（#screen-home）

**功能**：显示视频 feed、播放视频、底部导航

**HTML 结构**：
```html
<div data-screen="home" class="screen active">
  <!-- 顶部栏 -->
  <header class="header">
    <h1 class="logo">Video Pairing</h1>
    <button class="btn-search" onclick="navigateTo('search')">
      <span>🔍</span>
    </button>
  </header>

  <!-- 视频 feed -->
  <div class="video-feed">
    <div id="feed-container" class="feed-grid">
      <!-- 动态生成视频卡片 -->
    </div>
  </div>

  <!-- 底部导航 -->
  <nav class="bottom-nav">
    <button class="nav-item active" onclick="navigateTo('home')">
      <span>🏠</span> <span>首页</span>
    </button>
    <button class="nav-item" onclick="navigateTo('upload')">
      <span>⬆️</span> <span>上传</span>
    </button>
    <button class="nav-item" onclick="navigateTo('my-videos')">
      <span>📹</span> <span>我的影片</span>
    </button>
    <button class="nav-item" onclick="navigateTo('profile')">
      <span>👤</span> <span>资料</span>
    </button>
  </nav>
</div>
```

**JS 初始化函数**（在 belle-app.js 中）：
```javascript
async function initHome() {
  // 加载 feed 视频
  try {
    feedVideos = await loadFeedVideos(); // 需要后端实现
    renderFeedVideos(feedVideos);
  } catch (error) {
    console.error('加载 feed 失败:', error);
  }
}

function renderFeedVideos(videos) {
  const container = document.getElementById('feed-container');
  container.innerHTML = '';
  
  videos.forEach(video => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
      <video src="${video.url}" controls style="width: 100%; height: 200px; object-fit: cover;"></video>
      <div class="video-info">
        <p class="video-title">${video.title || '无标题'}</p>
        <p class="video-creator">@${video.creatorHandle}</p>
      </div>
    `;
    container.appendChild(card);
  });
}
```

### 📤 屏幕2：上传视频（#screen-upload）

**功能**：选择视频文件、填写标题、上传到 Cloudinary

**HTML 结构**：
```html
<div data-screen="upload" class="screen">
  <header class="header">
    <button class="btn-back" onclick="navigateTo('home')">← 返回</button>
    <h2>上传视频</h2>
  </header>

  <form id="upload-form" class="upload-form">
    <!-- 文件选择 -->
    <div class="form-group">
      <label for="video-file">选择视频</label>
      <input type="file" id="video-file" accept="video/*" required>
      <small>最大 500MB</small>
    </div>

    <!-- 标题输入 -->
    <div class="form-group">
      <label for="video-title">标题</label>
      <input type="text" id="video-title" placeholder="输入视频标题" maxlength="100">
    </div>

    <!-- 描述输入 -->
    <div class="form-group">
      <label for="video-description">描述</label>
      <textarea id="video-description" placeholder="输入视频描述" maxlength="500" rows="3"></textarea>
    </div>

    <!-- 配对用户选择（可选） -->
    <div class="form-group">
      <label for="partnership-select">配对用户（可选）</label>
      <select id="partnership-select">
        <option value="">不配对</option>
        <!-- 动态生成现有配对 -->
      </select>
    </div>

    <!-- 上传进度 -->
    <div id="upload-progress" class="progress-bar" style="display: none;">
      <div class="progress-fill" id="progress-fill"></div>
      <span id="progress-text">0%</span>
    </div>

    <!-- 提交按钮 -->
    <button type="submit" class="btn-primary" id="submit-btn">上传视频</button>
  </form>
</div>
```

**JS 处理函数**（在 belle-app.js 中）：
```javascript
async function initUpload() {
  // 加载现有配对
  const partnerships = await getUserPartnerships(currentUser.uid);
  const select = document.getElementById('partnership-select');
  
  partnerships.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.partnerName;
    select.appendChild(option);
  });

  // 表单提交
  document.getElementById('upload-form').onsubmit = async (e) => {
    e.preventDefault();
    
    const file = document.getElementById('video-file').files[0];
    const title = document.getElementById('video-title').value;
    const description = document.getElementById('video-description').value;
    const partnershipId = document.getElementById('partnership-select').value;
    
    if (!file) {
      alert('请选择视频文件');
      return;
    }
    
    try {
      // 上传视频
      const cloudinaryUrl = await uploadToCloudinary(file, (progress) => {
        document.getElementById('upload-progress').style.display = 'block';
        document.getElementById('progress-fill').style.width = progress + '%';
        document.getElementById('progress-text').textContent = progress + '%';
      });
      
      // 保存视频元数据到 Firestore（需要 video.js 扩展）
      await saveVideoMetadata({
        title,
        description,
        url: cloudinaryUrl,
        userId: currentUser.uid,
        partnershipId: partnershipId || null,
        createdAt: new Date()
      });
      
      alert('上传成功！');
      navigateTo('my-videos');
    } catch (error) {
      alert('上传失败：' + error.message);
      console.error(error);
    }
  };
}
```

### 🎬 屏幕3：我的影片（#screen-my-videos）

**功能**：显示用户上传的所有视频，可删除

**HTML 结构**：
```html
<div data-screen="my-videos" class="screen">
  <header class="header">
    <button class="btn-back" onclick="navigateTo('home')">← 返回</button>
    <h2>我的影片</h2>
  </header>

  <div class="my-videos-container">
    <div id="my-videos-grid" class="video-grid">
      <!-- 动态生成视频卡片 -->
    </div>
  </div>

  <!-- 底部导航 -->
  <nav class="bottom-nav">
    <button class="nav-item" onclick="navigateTo('home')">
      <span>🏠</span> <span>首页</span>
    </button>
    <button class="nav-item" onclick="navigateTo('upload')">
      <span>⬆️</span> <span>上传</span>
    </button>
    <button class="nav-item active" onclick="navigateTo('my-videos')">
      <span>📹</span> <span>我的影片</span>
    </button>
    <button class="nav-item" onclick="navigateTo('profile')">
      <span>👤</span> <span>资料</span>
    </button>
  </nav>
</div>
```

**JS 初始化函数**：
```javascript
async function initMyVideos() {
  try {
    userVideos = await getUserVideos(currentUser.uid);
    renderMyVideos(userVideos);
  } catch (error) {
    console.error('加载影片失败:', error);
  }
}

function renderMyVideos(videos) {
  const grid = document.getElementById('my-videos-grid');
  grid.innerHTML = '';
  
  videos.forEach(video => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
      <video src="${video.url}" style="width: 100%; height: 150px; object-fit: cover;"></video>
      <div class="video-info">
        <p class="video-title">${video.title || '无标题'}</p>
        <button class="btn-delete" onclick="handleDeleteVideo('${video.id}')">删除</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function handleDeleteVideo(videoId) {
  if (!confirm('确定删除此视频？')) return;
  
  try {
    await deleteVideo(videoId);
    await initMyVideos(); // 重新加载
  } catch (error) {
    alert('删除失败：' + error.message);
  }
}
```

### 👤 屏幕4：个人资料（#screen-profile）

**功能**：显示用户信息（displayName、handle、头像、简介）

**HTML 结构**：
```html
<div data-screen="profile" class="screen">
  <header class="header">
    <h2>个人资料</h2>
    <button class="btn-menu" onclick="toggleProfileMenu()">⋮</button>
  </header>

  <!-- 个人资料卡片 -->
  <div class="profile-card">
    <!-- 头像 -->
    <div class="avatar-section">
      <img id="profile-avatar" src="" alt="头像" class="avatar-large">
    </div>

    <!-- 用户信息 -->
    <div class="user-info">
      <h3 id="profile-display-name" class="display-name">名字</h3>
      <p id="profile-handle" class="handle">@handle</p>
      <p id="profile-bio" class="bio">个人简介</p>
    </div>

    <!-- 操作按钮 -->
    <div class="profile-actions">
      <button class="btn-primary" onclick="navigateTo('edit-profile')">编辑资料</button>
      <button class="btn-secondary" onclick="handleLogout()">退出登录</button>
    </div>
  </div>

  <!-- 用户视频统计 -->
  <div class="profile-stats">
    <div class="stat-item">
      <span class="stat-number" id="stats-videos">0</span>
      <span class="stat-label">视频</span>
    </div>
    <div class="stat-item">
      <span class="stat-number" id="stats-partnerships">0</span>
      <span class="stat-label">配对</span>
    </div>
  </div>

  <!-- 底部导航 -->
  <nav class="bottom-nav">
    <button class="nav-item" onclick="navigateTo('home')">
      <span>🏠</span> <span>首页</span>
    </button>
    <button class="nav-item" onclick="navigateTo('upload')">
      <span>⬆️</span> <span>上传</span>
    </button>
    <button class="nav-item" onclick="navigateTo('my-videos')">
      <span>📹</span> <span>我的影片</span>
    </button>
    <button class="nav-item active" onclick="navigateTo('profile')">
      <span>👤</span> <span>资料</span>
    </button>
  </nav>
</div>
```

**JS 初始化函数**：
```javascript
async function initProfile() {
  // 显示用户信息
  document.getElementById('profile-display-name').textContent = currentUser.displayName || '用户';
  document.getElementById('profile-handle').textContent = `@${currentUser.handle || 'user'}`;
  document.getElementById('profile-bio').textContent = currentUser.bio || '还没有简介';
  
  if (currentUser.avatar) {
    document.getElementById('profile-avatar').src = currentUser.avatar;
  }
  
  // 加载统计数据
  const videos = await getUserVideos(currentUser.uid);
  const partnerships = await getUserPartnerships(currentUser.uid);
  
  document.getElementById('stats-videos').textContent = videos.length;
  document.getElementById('stats-partnerships').textContent = partnerships.length;
}

function toggleProfileMenu() {
  // 可选：显示菜单（设置、帮助等）
}
```

### ✏️ 屏幕5：编辑资料（#screen-edit-profile）

**功能**：编辑 displayName、handle、头像、简介

**HTML 结构**：
```html
<div data-screen="edit-profile" class="screen">
  <header class="header">
    <button class="btn-back" onclick="navigateTo('profile')">← 返回</button>
    <h2>编辑资料</h2>
  </header>

  <form id="edit-profile-form" class="edit-profile-form">
    <!-- 头像上传 -->
    <div class="form-group">
      <label>头像</label>
      <div class="avatar-upload">
        <img id="avatar-preview" src="" alt="头像预览" class="avatar-preview">
        <input type="file" id="avatar-input" accept="image/*">
        <button type="button" class="btn-upload" onclick="document.getElementById('avatar-input').click()">
          更换头像
        </button>
      </div>
    </div>

    <!-- 显示名 -->
    <div class="form-group">
      <label for="display-name">显示名</label>
      <input type="text" id="display-name" placeholder="输入显示名" maxlength="50" required>
    </div>

    <!-- Handle（昵称） -->
    <div class="form-group">
      <label for="handle">昵称 (@xxx_xx)</label>
      <div class="handle-input">
        <span>@</span>
        <input type="text" id="handle" placeholder="handle" maxlength="30" required>
      </div>
      <small id="handle-status"></small>
    </div>

    <!-- 个人简介 -->
    <div class="form-group">
      <label for="bio">个人简介</label>
      <textarea id="bio" placeholder="介绍一下自己..." maxlength="200" rows="3"></textarea>
    </div>

    <!-- 提交按钮 -->
    <button type="submit" class="btn-primary" id="save-profile-btn">保存</button>
  </form>
</div>
```

**JS 初始化函数**：
```javascript
async function initEditProfile() {
  // 加载当前用户信息
  document.getElementById('display-name').value = currentUser.displayName || '';
  document.getElementById('handle').value = currentUser.handle || '';
  document.getElementById('bio').value = currentUser.bio || '';
  
  if (currentUser.avatar) {
    document.getElementById('avatar-preview').src = currentUser.avatar;
  }

  // 头像上传预览
  document.getElementById('avatar-input').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        document.getElementById('avatar-preview').src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // 表单提交
  document.getElementById('edit-profile-form').onsubmit = async (e) => {
    e.preventDefault();
    
    const displayName = document.getElementById('display-name').value;
    const handle = document.getElementById('handle').value;
    const bio = document.getElementById('bio').value;
    const avatarFile = document.getElementById('avatar-input').files[0];
    
    try {
      // 上传头像（如果选了新的）
      let avatarURL = currentUser.avatar;
      if (avatarFile) {
        avatarURL = await uploadToCloudinary(avatarFile);
      }
      
      // 更新用户资料（需要后端实现 updateUserProfile）
      await updateUserProfile(currentUser.uid, {
        displayName,
        handle,
        bio,
        avatar: avatarURL,
        updatedAt: new Date()
      });
      
      // 更新全局状态
      currentUser = {
        ...currentUser,
        displayName,
        handle,
        bio,
        avatar: avatarURL
      };
      
      alert('保存成功！');
      navigateTo('profile');
    } catch (error) {
      alert('保存失败：' + error.message);
      console.error(error);
    }
  };
}
```

### 🔍 屏幕6：搜索用户（#screen-search）

**功能**：搜索其他用户、查看其信息

**HTML 结构**：
```html
<div data-screen="search" class="screen">
  <header class="header">
    <button class="btn-back" onclick="navigateTo('home')">← 返回</button>
    <div class="search-box">
      <input type="text" id="search-input" placeholder="搜索用户..." onkeyup="handleSearch()">
    </div>
  </header>

  <div class="search-results">
    <div id="search-results-container">
      <!-- 动态生成搜索结果 -->
    </div>
  </div>
</div>
```

**JS 初始化函数**：
```javascript
async function handleSearch() {
  const query = document.getElementById('search-input').value.trim();
  
  if (query.length < 2) {
    document.getElementById('search-results-container').innerHTML = '';
    return;
  }
  
  try {
    const results = await searchUsers(query); // 需要后端实现
    renderSearchResults(results);
  } catch (error) {
    console.error('搜索失败:', error);
  }
}

function renderSearchResults(users) {
  const container = document.getElementById('search-results-container');
  container.innerHTML = '';
  
  if (users.length === 0) {
    container.innerHTML = '<p class="empty-state">未找到用户</p>';
    return;
  }
  
  users.forEach(user => {
    const card = document.createElement('div');
    card.className = 'search-result-card';
    card.innerHTML = `
      <div class="result-content">
        <img src="${user.avatar || 'default-avatar.png'}" alt="头像" class="result-avatar">
        <div class="result-info">
          <p class="result-name">${user.displayName}</p>
          <p class="result-handle">@${user.handle}</p>
          <p class="result-bio">${user.bio || ''}</p>
        </div>
      </div>
      <button class="btn-view" onclick="viewUserProfile('${user.uid}')">查看</button>
    `;
    container.appendChild(card);
  });
}

async function viewUserProfile(userId) {
  // 可选：显示该用户的详细资料和视频
  console.log('查看用户:', userId);
}
```

### 💅 CSS 样式（belle-style.css 或合并到 style.css）

```css
/* ===== Belle 设计系统 ===== */

:root {
  /* 颜色 */
  --brown: #A48977;
  --cream: #EAE7DA;
  --sand: #D4B896;
  --dark-brown: #6B5344;
  --bg: #0d0a08;
  --text: #f5f5f5;
  
  /* 字体 */
  --font-serif: 'Playfair Display', serif;
  --font-sans: 'DM Sans', sans-serif;
  --font-display: 'Cinzel', serif;
  --font-accent: 'Cormorant Garamond', serif;
}

/* ===== 全局样式 ===== */
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  margin: 0;
  padding: 0;
}

.app-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

/* ===== 屏幕管理 ===== */
.screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  overflow-y: auto;
  padding-bottom: 80px; /* 为底部导航预留空间 */
}

.screen.active {
  opacity: 1;
  visibility: visible;
}

/* ===== 顶部栏 ===== */
.header {
  background: rgba(20, 18, 16, 0.95);
  border-bottom: 1px solid var(--sand);
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header h1, .header h2 {
  font-family: var(--font-serif);
  font-size: 24px;
  margin: 0;
  color: var(--cream);
}

.btn-back, .btn-menu, .btn-search {
  background: transparent;
  border: none;
  color: var(--sand);
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
}

/* ===== 底部导航 ===== */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 70px;
  background: rgba(20, 18, 16, 0.98);
  border-top: 1px solid var(--sand);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 200;
}

.nav-item {
  background: transparent;
  border: none;
  color: var(--sand);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  transition: color 0.3s;
}

.nav-item.active {
  color: var(--cream);
  font-weight: bold;
}

.nav-item span:first-child {
  font-size: 24px;
  margin-bottom: 4px;
}

/* ===== 个人资料屏幕 ===== */
.profile-card {
  text-align: center;
  padding: 24px;
  margin: 16px;
  background: rgba(164, 137, 119, 0.1);
  border: 1px solid var(--sand);
  border-radius: 12px;
}

.avatar-large {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 16px;
  border: 2px solid var(--sand);
}

.display-name {
  font-family: var(--font-serif);
  font-size: 24px;
  margin: 8px 0;
  color: var(--cream);
}

.handle {
  color: var(--sand);
  margin: 4px 0;
}

.bio {
  color: var(--text);
  margin: 12px 0;
  font-size: 14px;
}

.profile-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.profile-actions button {
  flex: 1;
}

/* ===== 统计卡片 ===== */
.profile-stats {
  display: flex;
  justify-content: space-around;
  padding: 16px;
  gap: 12px;
}

.stat-item {
  flex: 1;
  background: rgba(164, 137, 119, 0.1);
  border: 1px solid var(--sand);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: var(--cream);
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--sand);
  margin-top: 8px;
}

/* ===== 按钮 ===== */
.btn-primary {
  background: var(--sand);
  color: var(--bg);
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  font-family: var(--font-sans);
}

.btn-primary:hover {
  background: var(--brown);
}

.btn-secondary {
  background: transparent;
  color: var(--sand);
  border: 1px solid var(--sand);
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--font-sans);
}

.btn-secondary:hover {
  background: rgba(164, 137, 119, 0.1);
}

/* ===== 表单 ===== */
.edit-profile-form, .upload-form {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 8px;
  font-weight: bold;
  color: var(--cream);
}

.form-group input,
.form-group textarea,
.form-group select {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--sand);
  color: var(--text);
  padding: 12px;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 14px;
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--sand);
}

/* ===== 头像上传 ===== */
.avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.avatar-preview {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--sand);
}

#avatar-input {
  display: none;
}

/* ===== 视频网格 ===== */
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  padding: 16px;
}

.video-card {
  background: rgba(164, 137, 119, 0.1);
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s;
}

.video-card:hover {
  transform: scale(1.05);
}

.video-info {
  padding: 8px;
}

.video-title {
  margin: 0;
  font-size: 12px;
  color: var(--cream);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-creator {
  margin: 4px 0 0 0;
  font-size: 11px;
  color: var(--sand);
}

/* ===== 搜索结果 ===== */
.search-result-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--sand);
}

.result-content {
  display: flex;
  gap: 12px;
  flex: 1;
}

.result-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
}

.result-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.result-name {
  margin: 0;
  color: var(--cream);
  font-weight: bold;
}

.result-handle {
  margin: 0;
  color: var(--sand);
  font-size: 12px;
}

.result-bio {
  margin: 0;
  color: var(--text);
  font-size: 12px;
}

/* ===== 响应式 ===== */
@media (max-width: 600px) {
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}
```

---

## 后端需求清单

### 前端依赖的后端函数

#### 1️⃣ 扩展 Firestore users 集合

**目前字段**：
```
uid (auto)
email
createdAt
```

**需要添加的字段**：
```
displayName (string) - 用户的显示名称
handle (string) - 唯一的用户昵称（如 @zhang_san）
avatar (string) - 头像 URL（Cloudinary）
bio (string) - 个人简介
updatedAt (timestamp) - 最后更新时间
isActive (boolean) - 账户是否激活
```

#### 2️⃣ js/profile.js（新建）

```javascript
/**
 * 获取用户资料
 * @param {string} uid - 用户 ID
 * @returns {Object} 用户信息
 */
async function getUserProfile(uid) {
  // 从 Firestore 读取 users/{uid}
}

/**
 * 更新用户资料
 * @param {string} uid - 用户 ID
 * @param {Object} data - 要更新的数据
 * @returns {boolean} 是否成功
 */
async function updateUserProfile(uid, data) {
  // 更新 users/{uid}
  // data 可能包含：displayName, handle, bio, avatar, updatedAt
}

/**
 * 检查 handle 是否已存在
 * @param {string} handle - 昵称
 * @returns {boolean} 是否已存在
 */
async function checkHandleExists(handle) {
  // 搜索 Firestore 中是否有相同 handle 的用户
}
```

#### 3️⃣ js/avatar.js（新建）

```javascript
/**
 * 上传头像到 Cloudinary
 * @param {File} file - 图片文件
 * @returns {string} Cloudinary URL
 */
async function uploadAvatar(file) {
  // 使用 cloudinary.js 中的 uploadToCloudinary()
  // 但限制为图片格式
}

/**
 * 获取用户头像 URL
 * @param {string} uid - 用户 ID
 * @returns {string} 头像 URL
 */
async function getAvatarURL(uid) {
  // 从 Firestore 读取 users/{uid}.avatar
}
```

#### 4️⃣ js/search.js（新建）

```javascript
/**
 * 搜索用户（按 displayName 或 handle）
 * @param {string} query - 搜索关键词
 * @returns {Array} 匹配的用户列表
 */
async function searchUsers(query) {
  // 在 Firestore users 集合中搜索
  // 支持模糊搜索 displayName 或 handle
}
```

#### 5️⃣ 扩展 js/video.js

```javascript
/**
 * 保存视频元数据到 Firestore
 * @param {Object} data - 视频信息
 * @returns {string} 视频 ID
 */
async function saveVideoMetadata(data) {
  // 保存到 Firestore videos/{videoId}
  // data 包含：title, description, url, userId, partnershipId, createdAt
}

/**
 * 加载 feed 视频（所有用户的视频）
 * @returns {Array} 视频列表
 */
async function loadFeedVideos() {
  // 从 Firestore 加载所有用户的视频
  // 按 createdAt 降序排列
}
```

#### 6️⃣ 可选：js/follow.js（新建）

```javascript
// 未来功能（如需关注系统）
async function followUser(currentUid, targetUid) {}
async function unfollowUser(currentUid, targetUid) {}
async function getFollowers(uid) {}
async function getFollowing(uid) {}
```

---

## 集成步骤

### PHASE 1：前端优先（立即开始）

#### 步骤 1.1：创建 belle-v1.html
- 复制现有的 index.html 结构
- 添加 6 个屏幕的 HTML 框架
- 集成现有 CSS（style.css）
- 添加顶部导航 + 底部导航

#### 步骤 1.2：创建 belle-app.js
- 编写全局状态管理
- 编写屏幕切换函数 `navigateTo()`
- 编写各屏幕初始化函数

#### 步骤 1.3：实现各屏幕功能
- **首页**：显示视频 feed（暂时使用模拟数据）
- **上传**：选择文件、填写表单、使用现有 `uploadToCloudinary()`
- **我的影片**：显示用户视频、删除功能
- **个人资料**：显示用户信息、统计数据
- **编辑资料**：编辑表单、头像预览
- **搜索**：搜索输入、显示结果

#### 步骤 1.4：集成现有后端
- 使用现有 auth.js 的登录/注册
- 使用现有 video.js 的 getUserVideos()、deleteVideo()
- 使用现有 partnership.js 的配对功能
- 使用现有 cloudinary.js 的视频上传

---

### PHASE 2：后端补齐（根据前端需求）

#### 步骤 2.1：扩展 Firestore users 集合
- 添加新字段：displayName, handle, avatar, bio, updatedAt, isActive

#### 步骤 2.2：创建 profile.js
- `getUserProfile(uid)`
- `updateUserProfile(uid, data)`
- `checkHandleExists(handle)`

#### 步骤 2.3：创建 avatar.js
- `uploadAvatar(file)`
- `getAvatarURL(uid)`

#### 步骤 2.4：创建 search.js
- `searchUsers(query)`

#### 步骤 2.5：扩展 video.js
- `saveVideoMetadata(data)`
- `loadFeedVideos()`

---

### PHASE 3：前后端对接（根据后端完成情况）

- 前端调用新的后端函数
- 修复相关前端代码
- 测试数据流

---

### PHASE 4：测试 & 文档

- 功能测试
- UI 测试
- 生成完整 markdown 文档

---

## 代码示例

### 示例 1：全局状态初始化

```javascript
// 在 belle-app.js 中
let currentUser = null;
let userVideos = [];
let feedVideos = [];

// 页面加载
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 检查用户是否已登录
    const user = await auth.currentUser;
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    
    // 加载用户信息
    currentUser = await getUserProfile(user.uid);
    if (!currentUser) {
      // 创建新用户记录
      await updateUserProfile(user.uid, {
        email: user.email,
        displayName: user.email.split('@')[0],
        handle: 'user_' + Date.now(),
        avatar: 'default-avatar.png',
        bio: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      });
    }
    
    // 显示首页
    navigateTo('home');
  } catch (error) {
    console.error('初始化失败:', error);
    window.location.href = 'index.html';
  }
});
```

### 示例 2：屏幕切换函数

```javascript
function navigateTo(screenName) {
  // 更新底部导航激活状态
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`.nav-item[onclick*="${screenName}"]`)?.classList.add('active');
  
  // 隐藏所有屏幕
  document.querySelectorAll('[data-screen]').forEach(screen => {
    screen.classList.remove('active');
  });
  
  // 显示目标屏幕
  const targetScreen = document.querySelector(`[data-screen="${screenName}"]`);
  if (targetScreen) {
    targetScreen.classList.add('active');
    
    // 调用屏幕初始化函数
    const initFunc = window[`init${screenName.charAt(0).toUpperCase() + screenName.slice(1)}`];
    if (typeof initFunc === 'function') {
      initFunc().catch(error => console.error(`初始化 ${screenName} 失败:`, error));
    }
  }
}
```

### 示例 3：简单的表单处理

```javascript
async function initEditProfile() {
  // 预填当前信息
  document.getElementById('display-name').value = currentUser.displayName;
  document.getElementById('handle').value = currentUser.handle;
  document.getElementById('bio').value = currentUser.bio || '';
  
  if (currentUser.avatar && currentUser.avatar !== 'default-avatar.png') {
    document.getElementById('avatar-preview').src = currentUser.avatar;
  }

  // 头像预览
  document.getElementById('avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        document.getElementById('avatar-preview').src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // 表单提交
  document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const displayName = document.getElementById('display-name').value;
    const handle = document.getElementById('handle').value;
    const bio = document.getElementById('bio').value;
    const avatarFile = document.getElementById('avatar-input').files[0];
    
    try {
      // 验证
      if (!displayName || !handle) {
        alert('显示名和昵称不能为空');
        return;
      }
      
      // 上传头像（如果有新的）
      let avatarURL = currentUser.avatar;
      if (avatarFile) {
        avatarURL = await uploadAvatar(avatarFile);
      }
      
      // 更新资料
      await updateUserProfile(currentUser.uid, {
        displayName,
        handle,
        bio,
        avatar: avatarURL,
        updatedAt: new Date()
      });
      
      // 更新全局状态
      currentUser = {
        ...currentUser,
        displayName,
        handle,
        bio,
        avatar: avatarURL
      };
      
      alert('保存成功！');
      navigateTo('profile');
    } catch (error) {
      alert('保存失败：' + error.message);
    }
  });
}
```

---

## 文件检查清单

### ✅ 必须创建/修改的文件

| 文件 | 类型 | 优先级 | 说明 |
|------|------|--------|------|
| belle-v1.html | 新建 | 🔴 高 | SPA 主文件，包含所有屏幕 |
| js/belle-app.js | 新建 | 🔴 高 | 屏幕切换 + 全局函数 |
| css/belle-style.css | 新建或修改 | 🟡 中 | Belle 设计样式 |
| js/profile.js | 新建 | 🟡 中 | 需要后端实现 |
| js/avatar.js | 新建 | 🟡 中 | 需要后端实现 |
| js/search.js | 新建 | 🟡 中 | 需要后端实现 |

### ✅ 保留的现有文件

| 文件 | 说明 |
|------|------|
| index.html | 登录页面 |
| js/auth.js | 认证模块 |
| js/firebase-config.js | Firebase 配置 |
| js/cloudinary.js | 云存储上传 |
| js/video.js | 视频管理（可能需要扩展） |
| js/partnership.js | 配对功能 |
| css/style.css | 基础样式 |

### ❌ 删除的文件

| 文件 | 原因 |
|------|------|
| js/danmaku.js | 弹幕系统（已移除） |
| robot_ig.html | 测试文件（已删除） |

---

## 下一步行动

### 立即可以做的（PHASE 1）

1. **创建 belle-v1.html**
   - 使用上述 HTML 框架
   - 集成现有 CSS
   - 添加所有 6 个屏幕

2. **创建 js/belle-app.js**
   - 编写全局状态
   - 编写屏幕切换函数
   - 编写屏幕初始化函数

3. **测试前端**
   - 确保屏幕切换正常
   - 确保样式显示正确
   - 测试导航按钮

### 后续需要做的（PHASE 2）

1. **扩展 Firestore users 集合**
   - 添加新字段
   - 迁移现有数据

2. **创建后端函数**
   - profile.js
   - avatar.js
   - search.js

3. **扩展现有后端**
   - video.js 添加 saveVideoMetadata() 和 loadFeedVideos()
   - auth.js 添加 getCurrentUser() 函数

---

## 完成标志

✅ **前端完成**
- [ ] belle-v1.html 创建并可访问
- [ ] 所有 6 个屏幕都能显示和切换
- [ ] 所有导航按钮都能工作
- [ ] 现有功能（上传、删除、配对）集成完成
- [ ] 样式和美观度符合 Belle 设计

✅ **后端完成**
- [ ] Firestore users 集合扩展完成
- [ ] profile.js 函数实现完成
- [ ] avatar.js 函数实现完成
- [ ] search.js 函数实现完成
- [ ] video.js 扩展完成

✅ **集成完成**
- [ ] 前后端可以正常通信
- [ ] 所有功能都能正常运作
- [ ] 没有控制台错误

---

## 注意事项

1. **URL 不变**：整个应用都在 belle-v1.html，不会改变 URL

2. **全局状态**：所有数据保存在内存中（currentUser, userVideos 等），切换屏幕时不会丢失

3. **样式一致**：所有屏幕使用相同的 CSS，保持视觉统一

4. **性能**：使用 CSS 的 display: none/block 进行屏幕切换，比加载新页面快得多

5. **代码组织**：所有屏幕的 HTML 在 belle-v1.html，所有 JS 逻辑在 belle-app.js（或拆分到其他文件）

6. **模块分离**：后端功能模块化（profile.js, avatar.js, search.js），便于维护和扩展

---

**此文档包含完整的前端设计和后端需求清单。明天可以直接用此文档进行实施，无需额外讨论。**



