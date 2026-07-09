/**
 * neo4j.js — Neo4j Driver Singleton & Boot-Up Schema Constraints
 *
 * Creates a single Neo4j driver instance with connection pooling optimized
 * for Apple Silicon (arm64). On server start, runs Cypher uniqueness
 * constraints to prevent data duplication in the graph.
 *
 * Supports both Neo4j Aura (cloud) and local Docker deployments via
 * environment variables.
 */

const neo4j = require('neo4j-driver');

// ── Driver singleton ──────────────────────────────────────────────────
let driver = null;

/**
 * Returns the Neo4j driver singleton, creating it on first call.
 * Connection pooling is configured for low-memory arm64 machines.
 */
function getDriver() {
  if (driver) return driver;

  const uri      = process.env.NEO4J_URI      || 'neo4j+s://localhost:7687';
  const user     = process.env.NEO4J_USER     || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'password';

  driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    // ── Pool tuning for Mac M2 (arm64) ──────────────────────────────
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 30_000,    // 30 s
    connectionTimeout: 10_000,               // 10 s
    maxTransactionRetryTime: 15_000,         // 15 s

    // Log level in dev only
    logging: neo4j.logging.console(
      process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    ),
  });

  console.log(`✅ Neo4j driver created → ${uri}`);
  return driver;
}

/**
 * Boot-up optimization: Creates uniqueness constraints on the graph
 * to prevent data duplication during Firestore→Neo4j sync.
 *
 * Runs once when the server starts. Safe to call multiple times
 * (CREATE CONSTRAINT IF NOT EXISTS is idempotent).
 */
async function ensureConstraints() {
  const d = getDriver();
  const session = d.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });

  const constraints = [
    // User nodes — uid must be unique
    'CREATE CONSTRAINT user_uid_unique IF NOT EXISTS FOR (u:User) REQUIRE u.uid IS UNIQUE',
    // Skill nodes — name must be unique
    'CREATE CONSTRAINT skill_name_unique IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE',
    // College nodes — name must be unique
    'CREATE CONSTRAINT college_name_unique IF NOT EXISTS FOR (c:College) REQUIRE c.name IS UNIQUE',
    // Session nodes — sessionId must be unique
    'CREATE CONSTRAINT session_id_unique IF NOT EXISTS FOR (s:Session) REQUIRE s.sessionId IS UNIQUE',
    // Message nodes — messageId must be unique
    'CREATE CONSTRAINT message_id_unique IF NOT EXISTS FOR (m:Message) REQUIRE m.messageId IS UNIQUE',
    // ChatThread nodes — id must be unique
    'CREATE CONSTRAINT thread_id_unique IF NOT EXISTS FOR (t:ChatThread) REQUIRE t.id IS UNIQUE',
    // Badge nodes — name must be unique
    'CREATE CONSTRAINT badge_name_unique IF NOT EXISTS FOR (b:Badge) REQUIRE b.name IS UNIQUE',
  ];

  try {
    for (const cypher of constraints) {
      await session.run(cypher);
    }
    console.log('✅ Neo4j uniqueness constraints verified (User, Skill, College)');
  } catch (err) {
    // Non-fatal: the server can still operate, constraints just won't be enforced
    console.warn('⚠️  Neo4j constraint setup skipped:', err.message);
  } finally {
    await session.close();
  }
}

/**
 * Verifies that the driver can connect to Neo4j.
 * @returns {Promise<boolean>} true if the connection is live
 */
async function verifyConnectivity() {
  try {
    const d = getDriver();
    const serverInfo = await d.getServerInfo();
    console.log(`✅ Neo4j connected → ${serverInfo.address} (v${serverInfo.protocolVersion})`);
    return true;
  } catch (err) {
    console.warn('⚠️  Neo4j connection failed:', err.message);
    return false;
  }
}

/**
 * Gracefully closes the Neo4j driver.
 * Called during server shutdown.
 */
async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
    console.log('🔌 Neo4j driver closed');
  }
}

module.exports = {
  getDriver,
  ensureConstraints,
  verifyConnectivity,
  closeDriver,
};
