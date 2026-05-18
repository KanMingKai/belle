// 影片管理模組

function getTimeSlot(uploaded_at) {
  const d = uploaded_at && uploaded_at.toDate ? uploaded_at.toDate() : new Date(uploaded_at);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hr = String(Math.floor(d.getHours() / 2) * 2).padStart(2, '0');
  return y + '-' + mo + '-' + da + '_' + hr;
}

function getThumbnailUrl(videoUrl) {
  if (!videoUrl) return '';
  return videoUrl
    .replace('/video/upload/', '/video/upload/so_0,w_400/')
    .replace(/\.[^.]+$/, '.jpg');
}

async function saveVideoMetadata(data) {
  try {
    const now = new Date();
    const timeSlot = getTimeSlot(now);

    // 確認此 time_slot 是否已有影片
    const existing = await db.collection('videos')
      .where('user_uid', '==', data.userId)
      .where('time_slot', '==', timeSlot)
      .get();

    const isFirst = existing.empty;

    const ref = await db.collection('videos').add({
      user_uid: data.userId,
      title: data.title || '',
      description: data.description || '',
      url: data.url,
      thumbnail_url: data.thumbnail_url || getThumbnailUrl(data.url),
      partnershipId: data.partnershipId || null,
      duration: data.duration || 10,
      aspect_ratio: '9:8',
      time_slot: timeSlot,
      is_active_slot: isFirst,
      uploaded_at: now
    });

    return ref.id;
  } catch (error) {
    console.error('Error saving video:', error);
    throw error;
  }
}

async function getUserVideos(userUid) {
  try {
    const snapshot = await db.collection('videos')
      .where('user_uid', '==', userUid)
      .orderBy('uploaded_at', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    // 若索引未建立，降級為客戶端排序
    const snap = await db.collection('videos').where('user_uid', '==', userUid).get();
    return snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const ta = a.uploaded_at?.toDate?.() || new Date(0);
        const tb = b.uploaded_at?.toDate?.() || new Date(0);
        return tb - ta;
      });
  }
}

async function getActiveSlotVideo(userUid, timeSlot) {
  try {
    const snap = await db.collection('videos')
      .where('user_uid', '==', userUid)
      .where('time_slot', '==', timeSlot)
      .where('is_active_slot', '==', true)
      .get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch (error) {
    console.error('Error getting active slot video:', error);
    return null;
  }
}

async function setActiveSlotVideo(userUid, timeSlot, videoId) {
  try {
    const snap = await db.collection('videos')
      .where('user_uid', '==', userUid)
      .where('time_slot', '==', timeSlot)
      .get();
    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { is_active_slot: doc.id === videoId });
    });
    await batch.commit();
  } catch (error) {
    console.error('Error setting active slot video:', error);
    throw error;
  }
}

async function getSlotVideosForFeed(myUid, partnerUid) {
  try {
    const [mySnap, partnerSnap] = await Promise.all([
      db.collection('videos').where('user_uid', '==', myUid).where('is_active_slot', '==', true).get(),
      db.collection('videos').where('user_uid', '==', partnerUid).where('is_active_slot', '==', true).get()
    ]);

    const toMap = snap => {
      const m = {};
      snap.docs.forEach(doc => {
        const d = doc.data();
        if (d.time_slot) m[d.time_slot] = { id: doc.id, ...d };
      });
      return m;
    };

    const myMap = toMap(mySnap);
    const partnerMap = toMap(partnerSnap);
    const allSlots = new Set([...Object.keys(myMap), ...Object.keys(partnerMap)]);

    return [...allSlots].sort().reverse().map(slot => ({
      slot,
      mine: myMap[slot] || null,
      partner: partnerMap[slot] || null
    }));
  } catch (error) {
    console.error('Error getting slot videos for feed:', error);
    return [];
  }
}

async function loadFeedVideos(limitCount = 20) {
  try {
    const snap = await db.collection('videos')
      .orderBy('uploaded_at', 'desc')
      .limit(limitCount)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error loading feed:', error);
    return [];
  }
}

async function deleteVideo(videoId) {
  try {
    await db.collection('videos').doc(videoId).delete();
    console.log('Video deleted:', videoId);
  } catch (error) {
    console.error('Error deleting video:', error);
    throw error;
  }
}

async function getFavorites(userUid) {
  try {
    const snap = await db.collection('favorites')
      .where('user_uid', '==', userUid)
      .orderBy('saved_at', 'desc')
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting favorites:', error);
    return [];
  }
}

async function saveFavorite(data) {
  try {
    const ref = await db.collection('favorites').add({
      user_uid: data.userUid,
      my_video_id: data.myVideoId || null,
      my_video_url: data.myVideoUrl || null,
      my_video_thumb: data.myVideoThumb || null,
      partner_video_id: data.partnerVideoId || null,
      partner_video_url: data.partnerVideoUrl || null,
      partner_video_thumb: data.partnerVideoThumb || null,
      partnership_id: data.partnershipId || null,
      time_slot: data.timeSlot,
      saved_at: new Date()
    });
    return ref.id;
  } catch (error) {
    console.error('Error saving favorite:', error);
    throw error;
  }
}

async function deleteFavorite(favoriteId) {
  try {
    await db.collection('favorites').doc(favoriteId).delete();
  } catch (error) {
    console.error('Error deleting favorite:', error);
    throw error;
  }
}
