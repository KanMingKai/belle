# 🚀 前端项目快速指南

## 文件导航

### 📄 页面文件
| 页面 | 路径 | 用途 |
|------|------|------|
| 登录/注册 | `index.html` | 用户认证入口 |
| 配对管理 | `dashboard.html` | 创建和管理视频配对 |
| 上传视频 | `upload.html` | 上传和编辑视频 |
| 影片管理 | `my-videos.html` | 查看和管理已上传的视频 |

### 🎨 样式文件
- **使用新样式**: `css/style-new.css` ⭐ 推荐
- **旧样式（备份）**: `css/style.css`

### 🔧 功能模块
- `js/auth.js` - 用户登录/注册
- `js/firebase-config.js` - Firebase 初始化
- `js/partnership.js` - 配对管理
- `js/video.js` - 视频管理
- `js/cloudinary.js` - 视频上传

---

## 📱 用户流程

### 1. 首次使用
```
index.html (注册)
    ↓
dashboard.html (创建配对)
    ↓
upload.html (上传视频)
    ↓
my-videos.html (查看视频)
```

### 2. 日常使用
```
index.html (登录)
    ↓
dashboard.html (选择配对)
    ↓
my-videos.html (管理视频)
```

---

## 🎯 关键功能

### 👤 认证系统 (index.html)
- 邮箱/密码登录
- 新用户注册
- 自动重定向到仪表盘

### 🤝 配对管理 (dashboard.html)
- 查看所有配对
- 创建新配对（输入朋友邮箱）
- 删除配对
- 查看配对统计

### 📹 视频上传 (upload.html)
- 拖拽或点击选择视频
- 实时上传进度显示
- 选择关联的配对关系
- 添加视频描述

### 📊 影片管理 (my-videos.html)
- 按时间筛选（全部、今天、本周、本月）
- 按配对状态筛选
- 查看视频统计
- 删除视频

---

## 🛠️ 配置说明

### 第一步：配置 Firebase
编辑 `js/firebase-config.js`：
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 第二步：配置 Cloudinary
编辑 `js/cloudinary.js`：
```javascript
const CLOUDINARY_CLOUD_NAME = "your_cloud_name";
const CLOUDINARY_UPLOAD_PRESET = "your_upload_preset";
```

### 第三步：设置 CSS
所有 HTML 文件已配置使用 `style-new.css`

---

## 🎨 设计特点

### 颜色方案
- 主色：蓝色 (#0095ff)
- 成功：绿色 (#2ed573)
- 危险：红色 (#ff4757)
- 背景：浅灰 (#f5f5f5)

### 组件库
✅ 按钮（主、次、危险）
✅ 卡片
✅ 表单
✅ 消息提示
✅ 模态框
✅ 网格布局
✅ 统计面板
✅ 空状态

---

## 📊 CSS 类参考

### 布局
- `.container` - 容器（最大宽度1200px）
- `.page-wrapper` - 页面包装器
- `.header` - 顶部导航
- `.sidebar` - 侧边栏
- `.main-content` - 主内容区域

### 文字
- `.page-title` - 页面标题
- `.page-desc` - 页面描述
- `.form-label` - 表单标签

### 按钮
- `.btn` - 基础按钮
- `.btn-primary` - 主按钮
- `.btn-secondary` - 次按钮
- `.btn-danger` - 危险按钮
- `.btn-sm` - 小按钮
- `.btn-lg` - 大按钮

### 卡片
- `.card` - 卡片容器
- `.card-header` - 卡片头
- `.card-body` - 卡片内容
- `.card-footer` - 卡片底部

### 消息
- `.message` - 消息容器
- `.message.error` - 错误消息
- `.message.success` - 成功消息
- `.message.warning` - 警告消息
- `.message.info` - 信息消息

### 网格
- `.video-grid` - 视频网格
- `.stats-grid` - 统计网格
- `.video-item` - 视频卡片

---

## ⚡ 性能优化

✅ 使用 CSS 变量加快加载
✅ 响应式图片和视频
✅ 平滑过渡和动画
✅ 模块化代码结构
✅ 缩小的 CSS（850 行 vs 1135 行）

---

## 📝 文件操作

### 删除旧文件（可选）
```powershell
# 如果完全使用 style-new.css
Remove-Item .\css\style.css

# 如果使用新的 my-videos.html
Remove-Item .\my-videos-new.html

# 删除旧的弹幕文件（已删除）
# Remove-Item .\js\danmaku.js
```

---

## 🔐 安全检查清单

- [ ] 确保 Firebase 配置正确
- [ ] 验证 Firestore 安全规则
- [ ] 检查 Cloudinary 上传预设
- [ ] 隐藏敏感信息（key、token等）
- [ ] 测试所有用户流程

---

## 🐛 调试建议

### 浏览器开发者工具
1. **Console** - 查看错误和日志
2. **Network** - 检查 API 请求
3. **Storage** - 查看本地存储和 Cookies
4. **Performance** - 分析加载速度

### 常见问题
- 页面不加载 → 检查 Firebase 配置
- 视频无法上传 → 检查 Cloudinary 设置
- 配对失败 → 检查邮箱格式和 Firestore 规则

---

## 📞 技术栈

- **前端框架**: Vanilla JavaScript (ES6+)
- **样式**: CSS3（带变量）
- **认证**: Firebase Auth
- **数据库**: Firestore
- **视频存储**: Cloudinary
- **部署**: Static hosting

---

## ✨ 后续计划

- [ ] 创建视频播放对比页面
- [ ] 添加实时通知
- [ ] 实现用户资料页面
- [ ] 优化移动端体验
- [ ] 添加深色模式

---

**准备好了吗？开始开发吧！** 🚀
