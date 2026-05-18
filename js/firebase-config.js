// Firebase 配置（需要替换为自己的 Firebase 项目信息）
// 去 https://console.firebase.google.com 创建项目后获取配置

const firebaseConfig = {
  apiKey: "AIzaSyCwqWCXhutZFyAc07kWkBffBC5qPAeiio0",
  authDomain: "lynnweb-833dc.firebaseapp.com",
  projectId: "lynnweb-833dc",
  storageBucket: "lynnweb-833dc.firebasestorage.app",
  messagingSenderId: "848984061478",
  appId: "1:848984061478:web:e52879c20c03061fbd58e7"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);

// 获取 Firestore 和 Auth 实例
const db = firebase.firestore();
const auth = firebase.auth();

// 启用 Firestore 离线持久化（可选）
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
      console.log('The current browser does not support persistence.');
    }
  });
