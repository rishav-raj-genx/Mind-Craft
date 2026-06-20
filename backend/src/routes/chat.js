/**
 * chat.js — Chat REST Endpoints (WebSocket fallback)
 *
 * Provides REST endpoints for chat operations when the WebSocket
 * connection is unavailable. Mirrors the Firestore schema used by
 * both the Android ChatRepository and the WebSocket chatService.
 *
 * Endpoints:
 *   GET  /api/chat/:matchId/history — Paginated message history
 *   POST /api/chat/:matchId/send    — REST fallback for sending
 *   GET  /api/chat/threads/:uid     — List all chat threads
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
        }),
      ]);

      res.status(201).json({ success: true, data: message });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/chat/threads/:uid ────────────────────────────────────────
router.get('/threads/:uid', verifyFirebaseToken, async (req, res, next) => {
  try {
    const uid = req.params.uid;

    // Get all matches where user is a participant
    const [asUser1, asUser2] = await Promise.all([
      db.collection(COLLECTION_MATCHES).where('user1Uid', '==', uid).get(),
      db.collection(COLLECTION_MATCHES).where('user2Uid', '==', uid).get(),
    ]);

    const matches = [
      ...asUser1.docs.map((d) => d.data()),
      ...asUser2.docs.map((d) => d.data()),
    ].sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

    res.json({
      success: true,
      count:   matches.length,
      data:    matches,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
