const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { prisma } = require('../config/prisma');
const { resolveUser } = require('../utils/userResolver');
const { getPagination } = require('../utils/pagination');
const { emitToThread } = require('../config/socket');
const { broadcastToGlobal } = require('../services/chatService');
const { assertParticipant, persistMessage, markThreadRead } = require('../services/chatPersistenceService');

async function handleHistory(req, res, next) {
  try {
    const threadId = req.params.threadId || req.params.matchId;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    let beforeDate = null;
    if (req.query.before) {
      const num = Number(req.query.before);
      const parsed = !isNaN(num) ? new Date(num) : new Date(req.query.before);
      if (!isNaN(parsed.getTime())) {
        beforeDate = parsed;
      }
    }

    const user = await resolveUser(req.user?.clerkUserId || req.user?.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Verify requesting user is a ChatParticipant
    await assertParticipant(threadId, user.id);

    const messages = await prisma.chatMessage.findMany({
      where: {
        threadId,
        deletedAt: null,
        ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
      },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const formatted = messages.map((m) => ({
      messageId: m.id,
      senderId: m.senderId,
      senderUid: m.sender.clerkUserId,
      text: m.text,
      timestamp: new Date(m.createdAt).getTime(),
      read: true,
      isEdited: Boolean(m.editedAt),
      createdAt: m.createdAt.toISOString(),
    })).reverse();

    res.json({
      success: true,
      count: formatted.length,
      limit,
      offset,
      hasMore: formatted.length === limit,
      data: formatted,
    });
  } catch (err) {
    if (err.statusCode === 403) {
      return res.status(403).json({ success: false, error: err.message });
    }
    next(err);
  }
}

// Chat history routes (supporting both /history/:threadId and /:matchId/history)
router.get('/history/:threadId', requireAuth, handleHistory);
router.get('/:matchId/history', requireAuth, handleHistory);

router.post('/:matchId/send', requireAuth, [body('text').trim().notEmpty()], async (req, res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);

    const { matchId } = req.params;
    const { text } = req.body;
    const user = await resolveUser(req.user?.clerkUserId || req.user?.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    await assertParticipant(matchId, user.id);

    const message = await persistMessage({
      threadId: matchId,
      senderId: user.id,
      clientMessageId: req.body.clientMessageId || undefined,
      text,
      createdAt: new Date(),
    });

    const timestamp = new Date(message.createdAt).getTime();

    // Broadcast message to thread
    try {
      emitToThread(matchId, 'chat:message', {
        messageId: message.id,
        threadId: matchId,
        senderId: user.id,
        senderUid: user.clerkUserId,
        senderName: user.name,
        text,
        createdAt: message.createdAt.toISOString(),
      });
    } catch (_err) {}

    // Notify other participants
    const thread = await prisma.chatThread.findUnique({
      where: { id: matchId },
      include: { participants: { include: { user: true } } },
    });

    const otherParticipants = (thread?.participants || []).filter((p) => p.userId !== user.id);
    for (const p of otherParticipants) {
      broadcastToGlobal(p.user.clerkUserId, {
        type: 'global_new_message',
        matchId,
        messageId: message.id,
        senderUid: user.clerkUserId,
        senderName: user.name,
        text,
        timestamp,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        messageId: message.id,
        senderId: user.id,
        senderUid: user.clerkUserId,
        text,
        timestamp,
        read: false,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:matchId/read', requireAuth, async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const user = await resolveUser(req.user?.clerkUserId || req.user?.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    await markThreadRead(matchId, user.id);

    try {
      emitToThread(matchId, 'chat:read', {
        threadId: matchId,
        userId: user.id,
        senderUid: user.clerkUserId,
        readAt: new Date().toISOString(),
      });
    } catch (_err) {}

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/:matchId/message/:messageId', requireAuth, [body('text').trim().notEmpty()], async (req, res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);

    const { matchId, messageId } = req.params;
    const { text } = req.body;
    const user = await resolveUser(req.user?.clerkUserId || req.user?.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.threadId !== matchId || message.senderId !== user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized or not found' });
    }

    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { text, editedAt: new Date() },
    });

    try {
      emitToThread(matchId, 'message_edited', { messageId, text, matchId });
    } catch (_err) {}

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:matchId/message/:messageId', requireAuth, async (req, res, next) => {
  try {
    const { matchId, messageId } = req.params;
    const user = await resolveUser(req.user?.clerkUserId || req.user?.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.threadId !== matchId || message.senderId !== user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized or not found' });
    }

    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    try {
      emitToThread(matchId, 'message_deleted', { messageId, matchId });
    } catch (_err) {}

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

async function handleGetThreads(req, res, next) {
  try {
    const targetUid = req.params.uid || req.user?.clerkUserId || req.user?.id;
    let user = await resolveUser(targetUid);
    if (!user) {
      if (targetUid === req.user?.clerkUserId || targetUid === req.user?.id) {
        user = req.user;
      } else {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
    }

    if (user.clerkUserId !== req.user?.clerkUserId && user.id !== req.user?.id) {
      return res.status(403).json({ success: false, error: "Cannot fetch another user's chat threads" });
    }

    const { limit, offset } = getPagination(req.query);

    if (!user.id) {
      return res.json({
        success: true,
        count: 0,
        limit,
        offset,
        hasMore: false,
        data: [],
      });
    }

    const participants = await prisma.chatParticipant.findMany({
      where: { userId: user.id, leftAt: null },
      include: {
        thread: {
          include: {
            participants: {
              where: { userId: { not: user.id } },
              include: { user: true },
            },
            lastSender: true,
          },
        },
      },
      orderBy: { thread: { updatedAt: 'desc' } },
      skip: offset,
      take: limit,
    });

    const threads = participants.map((p) => {
      const t = p.thread;
      const partnerUser = t.participants[0]?.user;
      const lastMessageTime = t.lastMessageAt ? new Date(t.lastMessageAt).getTime() : new Date(t.createdAt).getTime();
      const isSelfLastSender = t.lastSenderId === user.id || t.lastSender?.clerkUserId === user.clerkUserId;
      const unread = !isSelfLastSender && (p.lastReadAt && t.lastMessageAt ? new Date(p.lastReadAt) < new Date(t.lastMessageAt) : Boolean(t.lastMessage));

      return {
        matchId: t.id,
        partner: partnerUser ? {
          uid: partnerUser.clerkUserId,
          id: partnerUser.id,
          name: partnerUser.name,
          email: partnerUser.email,
          photoUrl: partnerUser.photoUrl,
        } : { uid: '', id: '', name: 'Study Partner' },
        lastMessage: t.lastMessage || '',
        lastMessageTime,
        lastMessageSender: t.lastSender?.clerkUserId || t.lastSenderId || '',
        unread,
      };
    });

    res.json({
      success: true,
      count: threads.length,
      limit,
      offset,
      hasMore: threads.length === limit,
      data: threads,
    });
  } catch (err) {
    next(err);
  }
}

// Supports both /threads and /threads/:uid
router.get('/threads', requireAuth, handleGetThreads);
router.get('/threads/:uid', requireAuth, handleGetThreads);

router.get('/:matchId/detail', requireAuth, async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const user = await resolveUser(req.user?.clerkUserId || req.user?.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const thread = await prisma.chatThread.findUnique({
      where: { id: matchId },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });

    if (!thread || !thread.participants.some((p) => p.userId === user.id)) {
      return res.status(404).json({ success: false, error: 'Thread not found' });
    }

    const partner = thread.participants.find((p) => p.userId !== user.id)?.user;
    const lastMessageTime = thread.lastMessageAt ? new Date(thread.lastMessageAt).getTime() : 0;

    res.json({
      success: true,
      data: {
        matchId: thread.id,
        partner: partner ? {
          uid: partner.clerkUserId,
          id: partner.id,
          name: partner.name,
          email: partner.email,
          photoUrl: partner.photoUrl,
        } : { uid: '', id: '', name: 'Study Partner' },
        lastMessage: thread.lastMessage || '',
        lastMessageTime,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/thread', requireAuth, async (req, res, next) => {
  try {
    const fromUid = req.user?.clerkUserId || req.user?.id;
    const { partnerUid } = req.body;
    if (!partnerUid) return res.status(400).json({ success: false, error: 'partnerUid is required' });

    const [me, partner] = await Promise.all([
      resolveUser(fromUid),
      resolveUser(partnerUid),
    ]);

    if (!me || !partner) {
      return res.status(404).json({ success: false, error: 'Partner not found' });
    }

    let thread = await prisma.chatThread.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: me.id } } },
          { participants: { some: { userId: partner.id } } },
        ],
      },
    });

    if (!thread) {
      thread = await prisma.chatThread.create({
        data: {
          participants: {
            create: [{ userId: me.id }, { userId: partner.id }],
          },
        },
      });
    }

    res.json({
      success: true,
      matchId: thread.id,
      data: {
        match: { matchId: thread.id, id: thread.id },
        partner: {
          uid: partner.clerkUserId,
          id: partner.id,
          name: partner.name,
          email: partner.email,
          photoUrl: partner.photoUrl,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
