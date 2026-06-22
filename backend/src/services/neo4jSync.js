/**
 * neo4jSync.js — Firestore → Neo4j Data Synchronization Engine
 *
 * Listens to Firestore user document changes and mirrors them into
 * the Neo4j graph. Creates User nodes connected to Skill and College
 * nodes via TEACHES, LEARNS, and BELONGS_TO relationships.
 *
 * This is the write-path that keeps the graph in sync with Firestore.
 * The matching engine (matchingEngine.js) is the read-path.
 */

const { db }        = require('../config/firebase');
const { getDriver } = require('../config/neo4j');
const {
  COLLECTION_USERS,
} = require('../utils/constants');

/**
 * Upserts a single user into the Neo4j graph.
 *
 * Uses MERGE to avoid duplicates (backed by the uniqueness constraints
 * created in neo4j.js ensureConstraints). A single Cypher transaction
 * atomically:
 *   1. MERGEs the User node with all profile properties
 *   2. MERGEs the College node and BELONGS_TO relationship
 *   3. Deletes stale TEACHES/LEARNS relationships
 *   4. MERGEs fresh Skill nodes and relationships
 *
 * @param {object} userData — Firestore user document data
 */
async function syncUserToGraph(userData) {
  const driver  = getDriver();
  const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });

  try {
    await session.executeWrite(async (tx) => {
      // ── 1. Upsert User node ───────────────────────────────────────
      await tx.run(
        `MERGE (u:User { uid: $uid })
         SET u.name           = $name,
             u.email          = $email,
             u.photoUrl       = $photoUrl,
             u.college        = $college,
             u.department     = $department,
             u.year           = $year,
             u.averageRating  = $averageRating,
             u.totalSessions  = $totalSessions,
             u.latitude       = $latitude,
             u.longitude      = $longitude,
             u.updatedAt      = timestamp()`,
        {
          uid:           userData.uid           || '',
          name:          userData.name          || '',
          email:         userData.email         || '',
          photoUrl:      userData.photoUrl      || '',
          college:       userData.college       || '',
          department:    userData.department    || '',
          year:          userData.year          || '',
          averageRating: userData.averageRating || 0,
          totalSessions: userData.totalSessions || 0,
          latitude:      userData.latitude      || 0,
          longitude:     userData.longitude     || 0,
        },
      );

      // ── 2. Upsert College node + relationship ────────────────────
      if (userData.college) {
        await tx.run(
          `MERGE (c:College { name: $college })
           WITH c
           MATCH (u:User { uid: $uid })
           MERGE (u)-[:BELONGS_TO]->(c)`,
          { college: userData.college, uid: userData.uid },
        );
      }

      // ── 3. Remove stale TEACHES / LEARNS relationships ───────────
      await tx.run(
        `MATCH (u:User { uid: $uid })-[r:TEACHES]->()
         DELETE r`,
        { uid: userData.uid },
      );
      await tx.run(
        `MATCH (u:User { uid: $uid })-[r:LEARNS]->()
         DELETE r`,
        { uid: userData.uid },
      );

      // ── 4. Create fresh TEACHES relationships ────────────────────
      const teaches = userData.teaches || [];
      if (teaches.length > 0) {
        await tx.run(
          `MATCH (u:User { uid: $uid })
           UNWIND $skills AS skillName
           MERGE (s:Skill { name: skillName })
           MERGE (u)-[:TEACHES]->(s)`,
          { uid: userData.uid, skills: teaches },
        );
      }

      // ── 5. Create fresh LEARNS relationships ─────────────────────
      const learns = userData.learns || [];
      if (learns.length > 0) {
        await tx.run(
          `MATCH (u:User { uid: $uid })
           UNWIND $skills AS skillName
           MERGE (s:Skill { name: skillName })
           MERGE (u)-[:LEARNS]->(s)`,
          { uid: userData.uid, skills: learns },
        );
      }
    });

    console.log(`🔄 Neo4j sync complete for user: ${userData.uid}`);
  } catch (err) {
    console.error(`❌ Neo4j sync failed for user ${userData.uid}:`, err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Removes a user and all their relationships from the Neo4j graph.
 *
 * @param {string} uid — Firebase Auth UID
 */
async function removeUserFromGraph(uid) {
  const driver  = getDriver();
  const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `MATCH (u:User { uid: $uid })
         DETACH DELETE u`,
        { uid },
      );
    });
    console.log(`🗑️  Neo4j user removed: ${uid}`);
  } catch (err) {
    console.error(`❌ Neo4j user removal failed for ${uid}:`, err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Performs a full sync of ALL users from Firestore into Neo4j.
 * Intended to be run once on first deployment or to rebuild the graph.
 */
async function fullSync() {
  console.log('🔄 Starting full Firestore → Neo4j sync…');
  const snapshot = await db.collection(COLLECTION_USERS).get();

  let synced = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    try {
      await syncUserToGraph({ uid: doc.id, ...doc.data() });
      synced++;
    } catch (_err) {
      failed++;
    }
  }

  console.log(`✅ Full sync complete: ${synced} synced, ${failed} failed`);
  return { synced, failed };
}

/**
 * Sets up a Firestore onSnapshot listener that automatically mirrors
 * user document changes to Neo4j in real time.
 *
 * @returns {Function} unsubscribe — call to stop listening
 */
function startRealtimeSync() {
  const unsubscribe = db.collection(COLLECTION_USERS).onSnapshot(
    (snapshot) => {
      for (const change of snapshot.docChanges()) {
        const data = { uid: change.doc.id, ...change.doc.data() };

        switch (change.type) {
          case 'added':
          case 'modified':
            syncUserToGraph(data).catch((err) =>
              console.error('Realtime sync error:', err.message),
            );
            break;
          case 'removed':
            removeUserFromGraph(data.uid).catch((err) =>
              console.error('Realtime removal error:', err.message),
            );
            break;
        }
      }
    },
    (err) => {
      console.error('❌ Firestore listener error:', err.message);
    },
  );

  console.log('👂 Firestore → Neo4j realtime sync listener active');
  return unsubscribe;
}

module.exports = {
  syncUserToGraph,
  removeUserFromGraph,
  fullSync,
  startRealtimeSync,
};
