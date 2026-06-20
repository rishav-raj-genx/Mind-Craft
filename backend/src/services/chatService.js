/**
 * chatService.js — Real-Time WebSocket Chat Service
 *
 * Native WebSocket implementation (no Socket.IO) for P2P chat between
 * matched peers. Messages are persisted to the same Firestore schema
 * used by the Android ChatRepository.
 *
 * Protocol:
 *   - Client connects: ws://host:port?token=<firebase-id-token>
 *   - Client sends:    { type: 'join', matchId: '...' }
 *   - Client sends:    { type: 'message', matchId: '...', text: '...' }
 *   - Client sends:    { type: 'typing', matchId: '...' }
 *   - Server pushes:   { type: 'message', ... } to all room members
 *   - Server pushes:   { type: 'typing', uid: '...', matchId: '...' }
 */

const { WebSocketServer } = require('ws');
const url                  = require('url');
const { auth, db }         = require('../config/firebase');
const {
  COLLECTION_MESSAGES,
  COLLECTION_CHATS,
  COLLECTION_MATCHES,
} = require('../utils/constants');

// ── Room management ───────────────────────────────────────────────────
// Map<matchId, Set<WebSocket>>
const rooms = new Map();

// Map<WebSocket, { uid, email, name }>
const clients = new Map();

/**
 * Initializes the WebSocket server by attaching to an existing HTTP server.
 *
 * @param {import('http').Server} httpServer — Express HTTP server
 */
function initWebSocketServer(httpServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    path:   '/ws',
  });

  wss.on('connection', async (ws, req) => {
    // ── Authenticate on connection ──────────────────────────────────
    const parsed = url.parse(req.url, true);
    const token  = parsed.query.token;

    if (!token) {
      ws.close(4001, 'Missing authentication token');
      return;
    }

    let user;
    try {
      const decoded = await auth.verifyIdToken(token);
      user = {
        uid:   decoded.uid,
        email: decoded.email || '',
        name:  decoded.name  || '',
      };
    } catch (_err) {
      ws.close(4003, 'Invalid authentication token');
      return;
    }

    clients.set(ws, user);
    console.log(`🔌 WS connected: ${user.name} (${user.uid})`);

    // ── Handle incoming messages ────────────────────────────────────
    ws.on('message', async (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch (_e) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
        return;
      }

      switch (data.type) {
        case 'join':
          handleJoin(ws, user, data.matchId);
          break;

        case 'message':
          await handleMessage(ws, user, data.matchId, data.text);
          break;

        case 'typing':
          handleTyping(ws, user, data.matchId);
          break;

        case 'read':
          await handleRead(user, data.matchId);
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', error: `Unknown type: ${data.type}` }));
      }
    });

    // ── Cleanup on disconnect ───────────────────────────────────────
    ws.on('close', () => {
      clients.delete(ws);
      // Remove from all rooms
      for (const [matchId, members] of rooms) {
        members.delete(ws);
        if (members.size === 0) rooms.delete(matchId);
        else broadcastToRoom(matchId, { type: 'presence', uid: user.uid, status: 'offline' }, ws);
      }
      console.log(`🔌 WS disconnected: ${user.name}`);
    });

    ws.on('error', (err) => {
      console.error(`WS error for ${user.uid}:`, err.message);
    });
  });

  console.log('✅ WebSocket server initialized on /ws');
  return wss;
}

// ── Handler functions ─────────────────────────────────────────────────

function handleJoin(ws, user, matchId) {
  if (!matchId) {
    ws.send(JSON.stringify({ type: 'error', error: 'matchId is required' }));
    return;
  }

  if (!rooms.has(matchId)) rooms.set(matchId, new Set());
  rooms.get(matchId).add(ws);

  // Notify room of new presence
  broadcastToRoom(matchId, { type: 'presence', uid: user.uid, status: 'online' }, ws);
  ws.send(JSON.stringify({ type: 'joined', matchId }));
}

async function handleMessage(ws, user, matchId, text) {
  if (!matchId || !text) {
    ws.send(JSON.stringify({ type: 'error', error: 'matchId and text are required' }));
    return;
  }

  // ── Persist to Firestore (same schema as Android ChatRepository) ──
  const chatRef   = db.collection(COLLECTION_MESSAGES).doc(matchId).collection(COLLECTION_CHATS);
  const messageId = chatRef.doc().id;
  const timestamp = Date.now();

  const message = {
    messageId,
    senderUid: user.uid,
    text,
    timestamp,
    read: false,
  };

  try {
    // Write message and update match's last message in parallel
    await Promise.all([
      chatRef.doc(messageId).set(message),
      db.collection(COLLECTION_MATCHES).doc(matchId).update({
        lastMessage:     text,
        lastMessageTime: timestamp,
      }),
    ]);

    // ── Broadcast to all room members ─────────────────────────────
    const outgoing = {
      type: 'message',
      matchId,
      messageId,
      senderUid: user.uid,
      senderName: user.name,
      text,
      timestamp,
    };

    broadcastToRoom(matchId, outgoing);
  } catch (err) {
    console.error('❌ Chat message persist error:', err.message);
    ws.send(JSON.stringify({ type: 'error', error: 'Failed to send message' }));
  }
}

function handleTyping(ws, user, matchId) {
  if (!matchId) return;
  broadcastToRoom(matchId, { type: 'typing', uid: user.uid, matchId }, ws);
}

async function handleRead(user, matchId) {
  if (!matchId) return;

  try {
    const snapshot = await db
      .collection(COLLECTION_MESSAGES)
      .doc(matchId)
      .collection(COLLECTION_CHATS)
      .where('read', '==', false)
      .get();

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      const msg = doc.data();
      if (msg.senderUid !== user.uid) {
        batch.update(doc.ref, { read: true });
      }
    }
    await batch.commit();
  } catch (err) {
    console.error('❌ Mark read error:', err.message);
  }
}

// ── Broadcast helper ──────────────────────────────────────────────────

function broadcastToRoom(matchId, data, excludeWs = null) {
  const members = rooms.get(matchId);
  if (!members) return;

  const payload = JSON.stringify(data);
  for (const member of members) {
    if (member !== excludeWs && member.readyState === 1) {
      member.send(payload);
    }
  }
}

module.exports = { initWebSocketServer };
