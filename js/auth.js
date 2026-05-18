// 认证模块

/**
 * 用户注册
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise}
 */
async function registerUser(email, password) {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;

    // 创建用户文档
    await db.collection("users").doc(uid).set({
      uid: uid,
      email: email,
      displayName: email.split('@')[0],
      created_at: new Date()
    });

    console.log('User registered successfully:', uid);
    return userCredential.user;
  } catch (error) {
    console.error('Registration error:', error.message);
    throw error;
  }
}

/**
 * 用户登录
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise}
 */
async function loginUser(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    console.log('User logged in successfully:', userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error.message);
    throw error;
  }
}

/**
 * 用户登出
 * @returns {Promise}
 */
async function logoutUser() {
  try {
    await auth.signOut();
    console.log('User logged out successfully');
  } catch (error) {
    console.error('Logout error:', error.message);
    throw error;
  }
}

/**
 * 获取当前登录用户
 * @returns {User|null}
 */
function getCurrentUser() {
  return auth.currentUser;
}

/**
 * 监听认证状态变化
 * @param {Function} callback 
 */
function onAuthStateChanged(callback) {
  return auth.onAuthStateChanged(callback);
}

/**
 * 获取用户信息
 * @param {string} uid 
 * @returns {Promise<Object>}
 */
async function getUserInfo(uid) {
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (doc.exists) {
      return doc.data();
    } else {
      console.log("User not found");
      return null;
    }
  } catch (error) {
    console.error('Error getting user info:', error);
    throw error;
  }
}
