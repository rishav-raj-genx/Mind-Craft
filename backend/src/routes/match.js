const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { findMatches, findBroadMatches, findAnyMatches } = require('../services/matchingEngine');
const { prisma } = require('../config/prisma');
const { getPagination } = require('../utils/pagination');
const { broadcastToGlobal } = require('../services/chatService');

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

router.get('/:uid', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req.params;
    if (uid !== req.user.clerkUserId && uid !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Cannot fetch matches for another user' });
    }
    const { limit, offset } = getPagination(req.query);
    const skill = req.query.skill || null;
    const matches = await findMatches(req.user.clerkUserId, { limit, offset, skillFilter: skill });
    res.json({ success: true, count: matches.length, limit, offset, hasMore: matches.length === limit, data: matches });
  } catch (err) {
    next(err);
  }
});

router.get('/:uid/broad', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req.params;
    if (uid !== req.user.clerkUserId && uid !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Cannot fetch matches for another user' });
    }
    const { limit, offset } = getPagination(req.query);
    let matches = await findBroadMatches(req.user.clerkUserId, limit, offset);
    if (matches.length === 0) {
      matches = await findAnyMatches(req.user.clerkUserId, limit, offset);
    }
    res.json({ success: true, count: matches.length, limit, offset, hasMore: matches.length === limit, data: matches });
  } catch (err) {
    next(err);
  }
});

router.post('/request', requireAuth, [
  body('toUid').trim().notEmpty(),
  body('sharedSkill').trim().notEmpty(),
], async (req, res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);

    const fromUid = req.user.clerkUserId;
    const { toUid, sharedSkill } = req.body;

    const [requester, recipient] = await Promise.all([
      findUser(fromUid),
      findUser(toUid),
    ]);

    if (!requester || !recipient) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (requester.id === recipient.id) {
      return res.status(400).json({ success: false, error: 'Cannot match with yourself' });
    }

    const existingPending = await prisma.matchRequest.findFirst({
      where: {
        requesterId: requester.id,
        recipientId: recipient.id,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      return res.status(409).json({ success: false, error: 'Match request already pending' });
    }

    const existingThread = await prisma.chatThread.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: requester.id } } },
          { participants: { some: { userId: recipient.id } } },
        ],
      },
    });

    if (existingThread) {
      return res.status(409).json({ success: false, error: 'Already matched with this user' });
    }

    const matchReq = await prisma.matchRequest.create({
      data: {
        requesterId: requester.id,
        recipientId: recipient.id,
        sharedSkill,
        status: 'PENDING',
      },
    });

    broadcastToGlobal(recipient.clerkUserId, {
      type: 'global_notification',
      subType: 'match_request',
      data: {
        message: `${requester.name} requested to study with you for ${sharedSkill}!`,
        requestId: matchReq.id,
        requesterName: requester.name,
      },
      timestamp: Date.now(),
    });

    res.status(201).json({
      success: true,
      data: {
        requestId: matchReq.id,
        fromUid: requester.clerkUserId,
        toUid: recipient.clerkUserId,
        sharedSkill,
        status: 'PENDING',
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/accept', requireAuth, [body('requestId').trim().notEmpty()], async (req, res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);

    const { requestId } = req.body;
    const request = await prisma.matchRequest.findUnique({
      where: { id: requestId },
      include: { requester: true, recipient: true },
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    if (request.recipient.clerkUserId !== req.user.clerkUserId) {
      return res.status(403).json({ success: false, error: 'Unauthorized to accept this request' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Request not pending' });
    }

    const thread = await prisma.$transaction(async (tx) => {
      await tx.matchRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      return tx.chatThread.create({
        data: {
          matchRequestId: request.id,
          participants: {
            create: [
              { userId: request.requesterId },
              { userId: request.recipientId },
            ],
          },
        },
      });
    });

    broadcastToGlobal(request.requester.clerkUserId, {
      type: 'global_notification',
      subType: 'match_accepted',
      data: {
        message: `${request.recipient.name} accepted your study request for ${request.sharedSkill}!`,
        matchId: thread.id,
      },
      timestamp: Date.now(),
    });

    res.json({ success: true, data: { matchId: thread.id } });
  } catch (err) {
    next(err);
  }
});

router.post('/decline', requireAuth, [body('requestId').trim().notEmpty()], async (req, res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);

    const { requestId } = req.body;
    const request = await prisma.matchRequest.findUnique({
      where: { id: requestId },
      include: { recipient: true },
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    if (request.recipient.clerkUserId !== req.user.clerkUserId) {
      return res.status(403).json({ success: false, error: 'Unauthorized to decline this request' });
    }

    await prisma.matchRequest.update({
      where: { id: requestId },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });

    res.json({ success: true, message: 'Match request declined' });
  } catch (err) {
    next(err);
  }
});

router.get('/requests/:uid', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req.params;
    const user = await findUser(uid);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.clerkUserId !== req.user.clerkUserId) {
      return res.status(403).json({ success: false, error: "Cannot fetch another user's requests" });
    }

    const { limit, offset } = getPagination(req.query);

    const requests = await prisma.matchRequest.findMany({
      where: {
        recipientId: user.id,
        status: 'PENDING',
      },
      include: { requester: true },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const data = requests.map((r) => ({
      requestId: r.id,
      fromUid: r.requester.clerkUserId,
      toUid: user.clerkUserId,
      sharedSkill: r.sharedSkill,
      status: r.status,
      createdAt: new Date(r.createdAt).getTime(),
      requesterName: r.requester.name,
      requesterPhoto: r.requester.photoUrl,
    }));

    res.json({
      success: true,
      count: data.length,
      limit,
      offset,
      hasMore: data.length === limit,
      data,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
