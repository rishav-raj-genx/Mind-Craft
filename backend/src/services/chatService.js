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

// Map<uid, Set<WebSocket>> for global notifications (WhatsApp style)
const globalRooms = new Map();

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
    
    // Add to global room
    if (!globalRooms.has(user.uid)) globalRooms.set(user.uid, new Set());
    globalRooms.get(user.uid).add(ws);

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
          await handleMessage(ws, user, data.matchId, data.text, data.localId);
          break;

        case 'typing':
          handleTyping(ws, user, data.matchId);
          break;

        case 'edit_message':
          await handleEditMessage(ws, user, data.matchId, data.messageId, data.text);
          break;

        case 'delete_message':
          await handleDeleteMessage(ws, user, data.matchId, data.messageId);
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
      // Remove from global rooms
      if (globalRooms.has(user.uid)) {
        globalRooms.get(user.uid).delete(ws);
        if (globalRooms.get(user.uid).size === 0) {
          globalRooms.delete(user.uid);
        }
      }
      
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

async function handleMessage(ws, user, matchId, text, localId = null) {
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
    // Fetch match to get recipient
    const matchDoc = await db.collection(COLLECTION_MATCHES).doc(matchId).get();
    let recipientUid = null;
    if (matchDoc.exists) {
      const matchData = matchDoc.data();
      recipientUid = matchData.teacherUid === user.uid ? matchData.learnerUid : matchData.teacherUid;
    }

    // Write message and update match's last message in parallel
    await Promise.all([
      chatRef.doc(messageId).set(message),
      db.collection(COLLECTION_MATCHES).doc(matchId).update({
        lastMessage:     text,
        lastMessageTime: timestamp,
        lastMessageSender: user.uid,
        unread: true,
      }),
    ]);

    // ── Broadcast to all room members ─────────────────────────────
    const outgoing = {
      type: 'message',
      matchId,
      messageId,
      localId, // Used by sender for flawless optimistic UI mapping
      senderUid: user.uid,
      senderName: user.name,
      text,
      timestamp,
    };

    broadcastToRoom(matchId, outgoing, ws);

    // ── Broadcast to recipient's global room ──────────────────────
    if (recipientUid) {
      broadcastToGlobal(recipientUid, {
        type: 'global_new_message',
        matchId,
        messageId,
        senderUid: user.uid,
        senderName: user.name,
        text,
        timestamp,
      });

      // ── Send FCM push notification ────────────────────────────────
      try {
        const { admin } = require('../config/firebase');
        const recipientDoc = await db.collection('users').doc(recipientUid).get();
        if (recipientDoc.exists) {
          const fcmToken = recipientDoc.data().fcmToken;
          if (fcmToken) {
            await admin.messaging().send({
              token: fcmToken,
              notification: {
                title: user.name,
                body: text,
              },
              data: {
                type: 'chat',
                matchId: matchId,
                url: `/chat/${matchId}`
              }
            });
            console.log(`✅ FCM push sent to ${recipientUid}`);
          }
        }
      } catch (err) {
        console.warn('⚠️  FCM push failed:', err.message);
      }
    }

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
    batch.update(db.collection(COLLECTION_MATCHES).doc(matchId), { unread: false });
    await batch.commit();
  } catch (err) {
    console.error('❌ Mark read error:', err.message);
  }
}

// ── Broadcast helper ──────────────────────────────────────────────────

function broadcastToRoom(matchId, payload, excludeWs = null) {
  const members = rooms.get(matchId);
  if (!members) return;

  const msgStr = JSON.stringify(payload);
  for (const client of members) {
    if (client !== excludeWs && client.readyState === 1) { // 1 = OPEN
      client.send(msgStr);
    }
  }
}

function broadcastToGlobal(uid, payload) {
  const members = globalRooms.get(uid);
  if (!members) return;

  const msgStr = JSON.stringify(payload);
  for (const client of members) {
    if (client.readyState === 1) {
      client.send(msgStr);
    }
  }
}

async function handleEditMessage(ws, user, matchId, messageId, text) {
  if (!matchId || !messageId || !text) return;
  const chatRef = db.collection(COLLECTION_MESSAGES).doc(matchId).collection(COLLECTION_CHATS).doc(messageId);
  
  try {
    const doc = await chatRef.get();
    if (doc.exists && doc.data().senderUid === user.uid) {
      await chatRef.update({ text, isEdited: true });
      broadcastToRoom(matchId, {
        type: 'message_edited',
        messageId,
        text,
        matchId
      });
    }
  } catch (err) {
    console.error('Error editing message:', err);
  }
}

async function handleDeleteMessage(ws, user, matchId, messageId) {
  if (!matchId || !messageId) return;
  const chatRef = db.collection(COLLECTION_MESSAGES).doc(matchId).collection(COLLECTION_CHATS).doc(messageId);
  
  try {
    const doc = await chatRef.get();
    if (doc.exists && doc.data().senderUid === user.uid) {
      await chatRef.delete();
      broadcastToRoom(matchId, {
        type: 'message_deleted',
        messageId,
        matchId
      });
    }
  } catch (err) {
    console.error('Error deleting message:', err);
  }
}

module.exports = { initWebSocketServer, broadcastToGlobal };
