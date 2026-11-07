const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { prisma } = require('../config/prisma');
const { getPagination } = require('../utils/pagination');
const { emitToThread } = require('../config/socket');
const { broadcastToGlobal } = require('../services/chatService');
const { assertParticipant, persistMessage, markThreadRead } = require('../services/chatPersistenceService');

async function findUser(uid) {
  if (!uid) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid);
  return prisma.user.findFirst({
    where: {
      OR: [
        { clerkUserId: uid },
        ...(isUuid ? [{ id: uid }] : []),
      ],
      deletedAt: null,
    },
  });
}

router.get('/:matchId/history', requireAuth, async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { limit, offset } = getPagination(req.query);
    const before = req.query.before ? parseInt(req.query.before, 10) : null;

    const user = await findUser(req.user.clerkUserId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    await assertParticipant(matchId, user.id);

    const messages = await prisma.chatMessage.findMany({
      where: {
        threadId: matchId,
        deletedAt: null,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const formatted = messages.map((m) => ({
      messageId: m.id,
      senderUid: m.sender.clerkUserId,
      text: m.text,
      timestamp: new Date(m.createdAt).getTime(),
      read: true,
      isEdited: Boolean(m.editedAt),
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
    next(err);
  }
});

router.post('/:matchId/send', requireAuth, [body('text').trim().notEmpty()], async (req, res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);

    const { matchId } = req.params;
    const { text } = req.body;
    const user = await findUser(req.user.clerkUserId);
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
    const user = await findUser(req.user.clerkUserId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    await markThreadRead(matchId, user.id);

    try {
      emitToThread(matchId, 'chat:read', {
        threadId: matchId,
        userId: user.id,
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
    const user = await findUser(req.user.clerkUserId);
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
    const user = await findUser(req.user.clerkUserId);
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

router.get('/threads/:uid', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req.params;
    const user = await findUser(uid);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (user.clerkUserId !== req.user.clerkUserId) {
      return res.status(403).json({ success: false, error: "Cannot fetch another user's chat threads" });
    }

    const { limit, offset } = getPagination(req.query);

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
      const unread = p.lastReadAt && t.lastMessageAt ? new Date(p.lastReadAt) < new Date(t.lastMessageAt) : Boolean(t.lastMessage);

      return {
        matchId: t.id,
        partner: partnerUser ? {
          uid: partnerUser.clerkUserId,
          name: partnerUser.name,
          email: partnerUser.email,
          photoUrl: partnerUser.photoUrl,
        } : { uid: '', name: 'Study Partner' },
        lastMessage: t.lastMessage || '',
        lastMessageTime,
        lastMessageSender: t.lastSender?.clerkUserId || '',
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
});

router.get('/:matchId/detail', requireAuth, async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const user = await findUser(req.user.clerkUserId);
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
          name: partner.name,
          email: partner.email,
          photoUrl: partner.photoUrl,
        } : { uid: '', name: 'Study Partner' },
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
    const fromUid = req.user.clerkUserId;
    const { partnerUid } = req.body;
    if (!partnerUid) return res.status(400).json({ success: false, error: 'partnerUid is required' });

    const [me, partner] = await Promise.all([
      findUser(fromUid),
      findUser(partnerUid),
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
