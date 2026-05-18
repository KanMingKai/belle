// 配對關係管理模組

async function createPartnership(currentUserUid, currentUserEmail, partnerUid, type) {
  if (!currentUserUid) throw new Error('未登入');
  if (!partnerUid) throw new Error('找不到對方資料');
  if (!type) throw new Error('配對類型不明');
  if (partnerUid === currentUserUid) throw new Error('不能與自己配對');

  try {
    const [snapA, snapB] = await Promise.all([
      db.collection("partnerships").where("user_a_uid", "==", currentUserUid).get(),
      db.collection("partnerships").where("user_b_uid", "==", currentUserUid).get()
    ]);

    const hasConflict = [...snapA.docs, ...snapB.docs]
      .some(function(doc) {
        const d = doc.data();
        return d.status === 'active' && d.type === type;
      });
    if (hasConflict) throw new Error("此分頁已有配對對象");

    const partnerDoc = await db.collection('users').doc(partnerUid).get();
    const partnerEmail = (partnerDoc.exists && partnerDoc.data().email) || '';

    const docRef = await db.collection("partnerships").add({
      user_a_uid: currentUserUid,
      user_a_email: currentUserEmail,
      user_b_uid: partnerUid,
      user_b_email: partnerEmail,
      type: type,
      status: "active",
      created_at: new Date()
    });

    console.log('Partnership created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating partnership:', error.message);
    throw error;
  }
}

async function getPartnershipByType(uid, type) {
  try {
    const [snapA, snapB] = await Promise.all([
      db.collection("partnerships").where("user_a_uid", "==", uid).get(),
      db.collection("partnerships").where("user_b_uid", "==", uid).get()
    ]);

    const docs = [...snapA.docs, ...snapB.docs]
      .filter(function(doc) {
        const d = doc.data();
        return d.status === 'active' && d.type === type;
      });
    if (!docs.length) return null;
    return { id: docs[0].id, ...docs[0].data() };
  } catch (error) {
    console.error('Error getting partnership by type:', error);
    return null;
  }
}

async function getUserPartnerships(uid) {
  try {
    const [snapA, snapB] = await Promise.all([
      db.collection("partnerships").where("user_a_uid", "==", uid).get(),
      db.collection("partnerships").where("user_b_uid", "==", uid).get()
    ]);
    return [...snapA.docs, ...snapB.docs]
      .filter(doc => doc.data().status === 'active')
      .map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting partnerships:', error);
    throw error;
  }
}

async function cancelPartnership(partnershipId) {
  try {
    await db.collection("partnerships").doc(partnershipId).update({ status: "cancelled" });
    console.log('Partnership cancelled:', partnershipId);
  } catch (error) {
    console.error('Error cancelling partnership:', error);
    throw error;
  }
}

async function getPartnerInfo(partnershipId, currentUserUid) {
  try {
    const doc = await db.collection("partnerships").doc(partnershipId).get();
    const data = doc.data();
    return data.user_a_uid === currentUserUid
      ? { uid: data.user_b_uid, email: data.user_b_email }
      : { uid: data.user_a_uid, email: data.user_a_email };
  } catch (error) {
    console.error('Error getting partner info:', error);
    throw error;
  }
}
