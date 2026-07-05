/**
 * chat.js — Chat REST Endpoints (WebSocket fallback)
 *
 * Provides REST endpoints for chat operations when the WebSocket
 * connection is unavailable. Mirrors the Firestore schema used by
 * both the Android ChatRepository and the WebSocket chatService.
 *
 * Endpoints:
 *   GET    /api/chat/:matchId/history — Paginated message history
 *   POST   /api/chat/:matchId/send    — REST fallback for sending
 *   PATCH  /api/chat/:matchId/message/:messageId — REST fallback for editing
 *   DELETE /api/chat/:matchId/message/:messageId — REST fallback for deleting
 *   GET    /api/chat/threads/:uid     — List all chat threads
 */

const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();

const { db }                    = require('../config/firebase');
const { verifyFirebaseToken }   = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const {
  COLLECTION_MESSAGES,
  COLLECTION_CHATS,
  COLLECTION_MATCHES,
} = require('../utils/constants');

// ── GET /api/chat/:matchId/history ────────────────────────────────────
router.get('/:matchId/history', verifyFirebaseToken, async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const limit  = parseInt(req.query.limit, 10) || 50;
    const before = req.query.before ? parseInt(req.query.before, 10) : null;

    let query = db
      .collection(COLLECTION_MESSAGES)
      .doc(matchId)
      .collection(COLLECTION_CHATS)
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (before) {
      query = query.where('timestamp', '<', before);
    }

    const snapshot = await query.get();
    const messages = snapshot.docs
      .map((d) => d.data())
      .reverse(); // Chronological order

    res.json({
      success: true,
      count:   messages.length,
      hasMore: messages.length === limit,
      data:    messages,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/chat/:matchId/send ──────────────────────────────────────
router.post(
  '/:matchId/send',
  verifyFirebaseToken,
  [body('text').trim().notEmpty().withMessage('Message text is required')],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const { matchId } = req.params;
      const { text }    = req.body;
      const senderUid   = req.user.uid;

      const chatRef   = db.collection(COLLECTION_MESSAGES).doc(matchId).collection(COLLECTION_CHATS);
      const messageId = chatRef.doc().id;
      const timestamp = Date.now();

      const message = {
        messageId,
        senderUid,
        text,
        timestamp,
        read: false,
      };

      // Write message and update match in parallel
      await Promise.all([
        chatRef.doc(messageId).set(message),
        db.collection(COLLECTION_MATCHES).doc(matchId).update({
          lastMessage:     text,
          lastMessageTime: timestamp,
          lastMessageSender: senderUid,
          unread: true,
        }),
      ]);

      res.status(201).json({ success: true, data: message });
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /api/chat/:matchId/message/:messageId ──────────────────────────────
router.patch(
  '/:matchId/message/:messageId',
  verifyFirebaseToken,
  [body('text').trim().notEmpty().withMessage('Message text is required')],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const { matchId, messageId } = req.params;
      const { text } = req.body;
      const senderUid = req.user.uid;

      const chatRef = db.collection(COLLECTION_MESSAGES).doc(matchId).collection(COLLECTION_CHATS).doc(messageId);
      const doc = await chatRef.get();

      if (!doc.exists) {
        return res.status(404).json({ success: false, error: 'Message not found' });
      }

      const msg = doc.data();
      if (msg.senderUid !== senderUid) {
        return res.status(403).json({ success: false, error: 'Unauthorized to edit this message' });
      }

      await chatRef.update({
        text,
        isEdited: true,
      });

      // Update match preview if this is the last message
      const matchRef = db.collection(COLLECTION_MATCHES).doc(matchId);
      const matchDoc = await matchRef.get();
      if (matchDoc.exists) {
        const matchData = matchDoc.data();
        if (matchData.lastMessageSender === senderUid && Math.abs(matchData.lastMessageTime - msg.timestamp) < 5000) {
          await matchRef.update({ lastMessage: text });
        }
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/chat/:matchId/message/:messageId ─────────────────────────────
router.delete('/:matchId/message/:messageId', verifyFirebaseToken, async (req, res, next) => {
  try {
    const { matchId, messageId } = req.params;
    const senderUid = req.user.uid;

    const chatRef = db.collection(COLLECTION_MESSAGES).doc(matchId).collection(COLLECTION_CHATS).doc(messageId);
    const doc = await chatRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    if (doc.data().senderUid !== senderUid) {
      return res.status(403).json({ success: false, error: 'Unauthorized to delete this message' });
    }

    // Hard delete
    await chatRef.delete();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/chat/threads/:uid ────────────────────────────────────────
router.get('/threads/:uid', verifyFirebaseToken, async (req, res, next) => {
  try {
    const uid = req.params.uid;

    // Get all matches where user is a participant
    const [asUser1, asUser2] = await Promise.all([
      db.collection(COLLECTION_MATCHES).where('user1Uid', '==', uid).get(),
      db.collection(COLLECTION_MATCHES).where('user2Uid', '==', uid).get(),
    ]);

    const allMatches = [
      ...asUser1.docs.map((d) => ({ ...d.data(), matchId: d.id })),
      ...asUser2.docs.map((d) => ({ ...d.data(), matchId: d.id })),
    ].sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

    // Resolve partner profiles
    const COLLECTION_USERS = 'users';
    const threads = await Promise.all(
      allMatches.map(async (match) => {
        const partnerUid = match.user1Uid === uid ? match.user2Uid : match.user1Uid;
        let partner = { uid: partnerUid, name: 'Study Partner', photoUrl: '' };
        try {
          const userDoc = await db.collection(COLLECTION_USERS).doc(partnerUid).get();
          if (userDoc.exists) {
            const u = userDoc.data();
            partner = {
              uid: partnerUid,
              name: u.name || u.displayName || 'Study Partner',
              photoUrl: u.photoUrl || u.photoURL || '',
              college: u.college || '',
              department: u.department || '',
            };
          }
        } catch (_) { /* ignore */ }
        return {
          matchId: match.matchId,
          partner,
          lastMessage: match.lastMessage || '',
          lastMessageTime: match.lastMessageTime || 0,
          lastMessageSender: match.lastMessageSender || '',
          unread: match.unread || false,
        };
      })
    );

    res.json({
      success: true,
      count:   threads.length,
      data:    threads,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/chat/:matchId/detail ─────────────────────────────────────
router.get('/:matchId/detail', verifyFirebaseToken, async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const uid = req.user.uid;

    const matchDoc = await db.collection(COLLECTION_MATCHES).doc(matchId).get();
    if (!matchDoc.exists) {
      return res.status(404).json({ success: false, error: 'Thread not found' });
    }

    const match = matchDoc.data();
    const partnerUid = match.user1Uid === uid ? match.user2Uid : match.user1Uid;

    let partner = { uid: partnerUid, name: 'Study Partner', photoUrl: '' };
    try {
      const userDoc = await db.collection('users').doc(partnerUid).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        partner = {
          uid: partnerUid,
          name: u.name || u.displayName || 'Study Partner',
          photoUrl: u.photoUrl || u.photoURL || '',
          college: u.college || '',
          department: u.department || '',
          averageRating: u.averageRating || 0,
        };
      }
    } catch (_) { /* ignore */ }

    res.json({
      success: true,
      data: {
        matchId: matchDoc.id,
        partner,
        lastMessage: match.lastMessage || '',
        lastMessageTime: match.lastMessageTime || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/chat/thread ──────────────────────────────────────────────
router.post('/thread', verifyFirebaseToken, async (req, res, next) => {
  try {
    const fromUid = req.user.uid;
    const { partnerUid } = req.body;
    
    if (!partnerUid) {
      return res.status(400).json({ success: false, error: 'partnerUid is required' });
    }

    // Check if match exists
    const matchCheck1 = await db.collection(COLLECTION_MATCHES)
      .where('user1Uid', '==', fromUid).where('user2Uid', '==', partnerUid).get();
    const matchCheck2 = await db.collection(COLLECTION_MATCHES)
      .where('user1Uid', '==', partnerUid).where('user2Uid', '==', fromUid).get();
      
    if (!matchCheck1.empty) {
      return res.json({ success: true, matchId: matchCheck1.docs[0].id });
    }
    if (!matchCheck2.empty) {
      return res.json({ success: true, matchId: matchCheck2.docs[0].id });
    }
    
    // Create new match if none exists
    const matchRef = db.collection(COLLECTION_MATCHES).doc();
    const match = {
      matchId:         matchRef.id,
      user1Uid:        fromUid,
      user2Uid:        partnerUid,
      sharedSkills:    [],
      createdAt:       Date.now(),
      lastMessage:     '',
      lastMessageTime: 0,
    };
    await matchRef.set(match);
    res.json({ success: true, matchId: matchRef.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
