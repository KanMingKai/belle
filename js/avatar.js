async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText).secure_url);
      } else {
        reject(new Error('頭像上傳失敗 (status ' + xhr.status + ')'));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('網路錯誤')));
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`);
    xhr.send(formData);
  });
}

async function getAvatarURL(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? (doc.data().avatar || null) : null;
  } catch (error) {
    return null;
  }
}
