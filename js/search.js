async function searchUsers(query) {
  if (!query || query.trim().length < 1) return [];
  try {
    const q = query.trim();
    const snap = await db.collection('users')
      .orderBy('displayName')
      .startAt(q)
      .endAt(q + '')
      .limit(15)
      .get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}
