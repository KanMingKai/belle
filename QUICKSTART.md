/* 
  ==========================================
  配对视频平台 - 快速配置指南
  ==========================================
  
  按照以下步骤配置你的项目：
*/

/* ========== 步骤 1：Firebase 配置 ========== */

// 打开 js/firebase-config.js，将以下信息替换：

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",              // 👈 替换
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",  // 👈 替换
  projectId: "YOUR_PROJECT_ID",       // 👈 替换
  storageBucket: "YOUR_PROJECT_ID.appspot.com",   // 👈 替换
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",  // 👈 替换
  appId: "YOUR_APP_ID"                // 👈 替换
};

/*
  如何获取？
  1. 访问 https://console.firebase.google.com
  2. 创建一个新项目（或选择现有项目）
  3. 点击项目设置（⚙️ 图标）
  4. 在"您的应用"部分找到你的配置信息
*/


/* ========== 步骤 2：Cloudinary 配置 ========== */

// 打开 js/cloudinary.js，将以下信息替换：

const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME";  // 👈 替换
const CLOUDINARY_UPLOAD_PRESET = "YOUR_UPLOAD_PRESET";  // 👈 替换

/*
  如何获取？
  1. 访问 https://cloudinary.com/console/dashboard
  2. "Cloud name" 在仪表板顶部
  3. 创建上传预设：
     - Settings → Upload
     - 向下滚动到 "Upload presets"
     - 点击 "Add upload preset"
     - 设置：
       * Name: video_upload
       * Unsigned: 启用
       * Resource type: Video
     - 点击 Save
*/


/* ========== 步骤 3：Firebase Firestore 规则配置 ========== */

/*
  1. 访问 Firebase Console
  2. 选择你的项目
  3. 左侧菜单 → Build → Firestore Database
  4. 点击 "Rules" 标签
  5. 将 firestore-rules.txt 中的内容复制粘贴
  6. 点击 "Publish"
*/


/* ========== 步骤 4：本地测试 ========== */

/*
  使用 Python 的简单 HTTP 服务器运行项目：
  
  Windows 系统：
    python -m http.server 8000
  
  macOS/Linux：
    python3 -m http.server 8000
  
  然后访问：
    http://localhost:8000
  
  测试流程：
  1. 注册第一个账号：alice@test.com / password123
  2. 注册第二个账号：bob@test.com / password123
  3. Alice 账号：
     - 登录
     - 进入"我的配对"
     - 点击"添加配对"
     - 输入 bob@test.com
  4. Bob 账号：
     - 登录
     - 应该能看到 Alice 的配对
  5. 各自上传一个视频（录制或选择文件）
  6. 进入"观看视频"，选择配对关系
  7. 发送弹幕测试
*/


/* ========== 步骤 5：部署到 Firebase Hosting ========== */

/*
  安装 Firebase CLI：
    npm install -g firebase-tools
  
  登录 Firebase：
    firebase login
  
  初始化项目：
    firebase init hosting
  
  部署：
    firebase deploy
  
  你将获得一个公网 URL，例如：
    https://your-project-id.web.app
*/


/* ========== 文件结构 ========== */

/*
instagram-clone/
├── index.html              (登录/注册)
├── dashboard.html          (配对列表)
├── upload.html            (视频录制/上传)
├── video-pair.html        (观看+弹幕)
├── README.md              (详细文档)
├── QUICKSTART.md          (本文件)
│
├── js/
│   ├── firebase-config.js  ✏️  需要配置
│   ├── cloudinary.js       ✏️  需要配置
│   ├── auth.js             (认证)
│   ├── partnership.js      (配对)
│   ├── video.js            (视频)
│   └── danmaku.js          (弹幕)
│
└── css/
    └── style.css           (样式)
*/


/* ========== 常见问题 ========== */

/*
Q: 上传视频失败 - 401 错误
A: 检查 Cloudinary 上传预设是否设置为"Unsigned"

Q: 无法访问摄像头
A: 需要 HTTPS 或 localhost（本地开发）

Q: 弹幕不出现
A: 检查浏览器控制台错误，确保两个用户都在配对中

Q: 登录后白屏
A: 检查 Firebase 配置信息是否正确
*/


/* ========== 快速检查清单 ========== */

/*
在部署之前，检查以下项目：

□ Firebase 项目已创建
□ Authentication（Email/Password）已启用
□ Firestore Database 已创建
□ Firebase 配置信息已填入 js/firebase-config.js
□ Firestore 规则已配置（firestore-rules.txt）
□ Cloudinary 账号已注册
□ Cloudinary 上传预设已创建（video_upload）
□ Cloudinary 信息已填入 js/cloudinary.js
□ 项目已在本地测试通过
□ Firebase CLI 已安装
□ 项目已部署到 Firebase Hosting
*/


// ========== 需要帮助？==========
// 查看 README.md 获取更详细的步骤说明
// 或访问：
// - Firebase 文档：https://firebase.google.com/docs
// - Cloudinary 文档：https://cloudinary.com/documentation
