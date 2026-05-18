async function getUserProfile(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) return { uid: doc.id, ...doc.data() };
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
}

async function updateUserProfile(uid, data) {
  try {
    await db.collection('users').doc(uid).set(
      { ...data, updatedAt: new Date() },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

async function checkHandleExists(handle, excludeUid = null) {
  try {
    const q = await db.collection('users')
      .where('handle', '==', handle.toLowerCase())
      .get();
    if (q.empty) return false;
    if (excludeUid) return q.docs.some(d => d.id !== excludeUid);
    return true;
  } catch (error) {
    return false;
  }
}
