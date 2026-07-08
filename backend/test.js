const { db } = require('./src/config/firebase');

async function testThreadsLogic(uid) {
    const [asUser1, asUser2, asTeacher, asLearner] = await Promise.all([
      db.collection('matches').where('user1Uid', '==', uid).get(),
      db.collection('matches').where('user2Uid', '==', uid).get(),
      db.collection('matches').where('teacherUid', '==', uid).get(),
      db.collection('matches').where('learnerUid', '==', uid).get(),
    ]);

    const allMatchesMap = new Map();
    [...asUser1.docs, ...asUser2.docs, ...asTeacher.docs, ...asLearner.docs].forEach(d => {
      allMatchesMap.set(d.id, { ...d.data(), matchId: d.id });
    });

    const allMatches = Array.from(allMatchesMap.values())
      .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

    console.log(`Found ${allMatches.length} raw matches for ${uid}`);

    const COLLECTION_USERS = 'users';
    const threads = (await Promise.all(
      allMatches.map(async (match) => {
        let partnerUid = match.user1Uid === uid ? match.user2Uid : match.user1Uid;
        if (!partnerUid && match.teacherUid && match.learnerUid) {
          partnerUid = match.teacherUid === uid ? match.learnerUid : match.teacherUid;
        }
        if (!partnerUid) return null;
        
        let partner = { uid: partnerUid, name: 'Study Partner', photoUrl: '' };
        try {
          const userDoc = await db.collection(COLLECTION_USERS).doc(partnerUid).get();
          if (userDoc.exists) {
            const u = userDoc.data();
            partner = {
              uid: partnerUid,
              name: u.name || u.displayName || 'Study Partner',
              photoUrl: u.photoUrl || u.photoURL || '',
            };
          }
        } catch (_) { /* ignore */ }
        return {
          matchId: match.matchId,
          partner,
          lastMessage: match.lastMessage || '',
          lastMessageTime: match.lastMessageTime || 0,
        };
      })
    )).filter(Boolean);

    console.log(`Processed ${threads.length} threads`);
    console.log(JSON.stringify(threads, null, 2));
}

// Test with one of the UIDs from earlier
testThreadsLogic('diAvOUxwUegP0NfOOR7OT5JtjJR2').then(() => process.exit(0));
