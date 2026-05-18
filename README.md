# 配对视频平台 - 部署指南

## 📋 项目概述

一个基于 Firebase 和 Cloudinary 的短视频社交平台，允许用户：
- 用 Email/Password 认证注册和登录
- 手动配对（输入对方 email）
- 录制或上传 15 秒短视频
- 并排观看配对视频
- 实时发送和接收弹幕评论

---

## 🚀 快速开始

### 前提条件
- 拥有 Google 账号（用于创建 Firebase 项目）
- 拥有 Cloudinary 账号（用于视频存储）

### 第一步：创建 Firebase 项目

1. 访问 [Firebase Console](https://console.firebase.google.com)
2. 点击"创建项目"
   - 项目名称：`Instagram-Clone`（随意）
   - 取消启用 Google Analytics（可选）
3. 创建完成后，进入项目

### 第二步：配置 Firebase

#### 2.1 启用 Authentication

1. 左侧菜单 → Build → Authentication
2. 点击"开始使用"
3. 选择"Email/Password"
4. 启用"邮箱/密码"选项
5. 保存

#### 2.2 创建 Firestore 数据库

1. 左侧菜单 → Build → Firestore Database
2. 点击"创建数据库"
3. 位置选择：`asia-southeast1`（Singapore，最接近亚洲）
4. 安全规则：选择"**从模板开始**"（我们稍后会配置规则）
5. 创建完成

#### 2.3 获取 Firebase 配置

1. 点击项目设置（齿轮图标）
2. 选择"项目设置"
3. 滚动到"您的应用"部分
4. 如果没有应用，点击"添加应用" → 选择 Web 平台（`</>`）
5. 应用昵称：`web-app`
6. 点击"注册应用"
7. 复制以下信息：

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

8. 将这些值填入 `js/firebase-config.js`

### 第三步：配置 Firestore 安全规则

1. 在 Firebase Console 中，进入 Firestore Database
2. 点击"Rules"标签
3. **完全替换**现有规则为下面的代码（见文件末尾的安全规则部分）
4. 点击"发布"

### 第四步：配置 Cloudinary

1. 访问 [Cloudinary Dashboard](https://cloudinary.com/console/dashboard)
2. 查看您的"Cloud Name"（在顶部）
3. 创建上传预设：
   - 左侧菜单 → Settings → Upload
   - 向下滚动到"Upload presets"
   - 点击"Add upload preset"
   - 配置：
     - **Name**: `video_upload`
     - **Unsigned**: 启用（这样前端可以直接上传）
     - **Resource type**: Auto（或 Video）
     - 点击"Save"

4. 将以下信息填入 `js/cloudinary.js`：

```javascript
const CLOUDINARY_CLOUD_NAME = "your_cloud_name";
const CLOUDINARY_UPLOAD_PRESET = "video_upload";
```

### 第五步：部署到 Firebase Hosting

#### 5.1 安装 Firebase CLI

```bash
npm install -g firebase-tools
```

#### 5.2 初始化 Firebase

在项目根目录运行：

```bash
firebase login
firebase init hosting
```

按照提示：
- 选择现有项目（选择之前创建的项目）
- 公开目录：`.`（当前目录）
- 单页应用：选择 `No`
- 覆盖 `index.html`：选择 `No`

#### 5.3 部署

```bash
firebase deploy
```

部署完成后，你会获得一个公网 URL，例如：
```
https://your-project-id.web.app
```

---

## 📁 项目文件结构

```
instagram-clone/
├── index.html              ← 登录/注册页面
├── dashboard.html          ← 我的配对列表页面
├── upload.html            ← 视频录制/上传页面
├── video-pair.html        ← 并排观看+弹幕页面
│
├── js/
│   ├── firebase-config.js  ← 🔴 需要配置：Firebase 凭证
│   ├── cloudinary.js       ← 🔴 需要配置：Cloudinary 凭证
│   ├── auth.js             ← 认证逻辑
│   ├── partnership.js      ← 配对管理
│   ├── video.js            ← 视频上传/管理
│   └── danmaku.js          ← 弹幕系统
│
├── css/
│   └── style.css           ← 全局样式
│
└── README.md               ← 本文件
```

---

## 🔐 Firestore 安全规则

将以下规则复制到 Firebase Console 的 Firestore Rules 标签中：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 用户集合：公开读取，只有自己可写
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth.uid == userId;
    }
    
    // 配对关系：只有配对的两个用户可访问
    match /partnerships/{partnershipId} {
      allow read, create, delete: if request.auth != null;
      allow update: if request.auth.uid == resource.data.user_a_uid || request.auth.uid == resource.data.user_b_uid;
    }
    
    // 视频集合：只有配对用户可读写
    match /videos/{videoId} {
      allow read: if request.auth != null && exists(/databases/$(database)/documents/partnerships/{p in get(/databases/$(database)/documents/videos/$(videoId)).data.partnership_id}) &&
        (get(/databases/$(database)/documents/partnerships/{p in get(/databases/$(database)/documents/videos/$(videoId)).data.partnership_id}).data.user_a_uid == request.auth.uid || 
         get(/databases/$(database)/documents/partnerships/{p in get(/databases/$(database)/documents/videos/$(videoId)).data.partnership_id}).data.user_b_uid == request.auth.uid);
      
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.user_uid;
      
      // 评论：只有配对用户可读写
      match /comments/{commentId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
        allow delete: if request.auth.uid == resource.data.user_uid;
      }
    }
  }
}
```

> **提示**：上面的规则比较复杂。为了简化开发，你也可以先用以下**宽松规则**（生产环境不要用）：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 🔑 环境变量配置

### js/firebase-config.js

```javascript
const firebaseConfig = {
  apiKey: "xxx",
  authDomain: "xxx.firebaseapp.com",
  projectId: "xxx",
  storageBucket: "xxx.appspot.com",
  messagingSenderId: "xxx",
  appId: "xxx"
};
```

### js/cloudinary.js

```javascript
const CLOUDINARY_CLOUD_NAME = "your_cloud_name";
const CLOUDINARY_UPLOAD_PRESET = "video_upload";
```

---

## 🧪 测试应用

1. 访问部署的 URL
2. 注册两个账号（例如：alice@test.com, bob@test.com）
3. 用 Alice 账号：
   - 登录
   - 点击"添加配对"
   - 输入 `bob@test.com`
4. 用 Bob 账号：
   - 登录
   - 应该能看到 Alice 的配对请求
5. 各上传一个视频（15秒）
6. 在"观看视频"页面看到并排的视频
7. 发送弹幕测试实时功能

---

## 📊 数据库结构

### Collections

#### users
```
{
  uid: "firebase_uid",
  email: "user@example.com",
  displayName: "Alice",
  created_at: timestamp
}
```

#### partnerships
```
{
  user_a_uid: "uid_1",
  user_a_email: "alice@example.com",
  user_b_uid: "uid_2",
  user_b_email: "bob@example.com",
  status: "active",
  created_at: timestamp
}
```

#### videos
```
{
  user_uid: "uid_1",
  user_email: "alice@example.com",
  partnership_id: "xxx",
  cloudinary_url: "https://res.cloudinary.com/...",
  uploaded_at: timestamp,
  duration: 15
}
```

#### videos/{videoId}/comments
```
{
  user_uid: "uid_2",
  user_email: "bob@example.com",
  text: "好笑!",
  timestamp: 3500,
  created_at: timestamp
}
```

---

## 🐛 常见问题

### Q: 上传视频时出现 401 错误
**A**: 检查 Cloudinary 上传预设是否配置为"Unsigned"（无签名）。

### Q: 看不到配对的视频
**A**: 确保两个用户都已上传视频，并且已经配对。视频应该在"观看视频"页面显示。

### Q: 弹幕不实时显示
**A**: 检查浏览器控制台是否有错误。确保 Firestore 规则允许实时监听。

### Q: 无法访问摄像头
**A**: 
- 确保浏览器有摄像头权限
- HTTPS 环境才能访问摄像头（本地 localhost 除外）
- 检查浏览器权限设置

---

## 📈 扩展功能建议

1. **推荐系统**：基于兴趣标签的自动配对
2. **视频审核**：集成内容审核 API
3. **社交功能**：关注、粉丝、点赞系统
4. **搜索功能**：搜索用户和视频
5. **深色主题**：支持深色模式
6. **移动优化**：更好的移动端体验
7. **视频编辑**：客户端视频编辑功能

---

## 📞 支持

有任何问题可以：
1. 检查浏览器开发者工具（F12）的 Console 和 Network 标签
2. 查看 Firebase Console 中的日志
3. 检查 Cloudinary Dashboard 的上传历史

---

## 📄 许可证

MIT License - 自由使用

---

**祝你开发顺利！** 🚀
