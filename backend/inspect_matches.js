const { db } = require('./src/config/firebase');

async function run() {
  const snapshot = await db.collection('matches').limit(5).get();
  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
  process.exit(0);
}
run();
