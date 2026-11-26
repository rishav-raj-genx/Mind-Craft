const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { findMatches, findBroadMatches, findAnyMatches } = require('../services/matchingEngine');
const { prisma } = require('../config/prisma');
const { resolveUser } = require('../utils/userResolver');
const { getPagination } = require('../utils/pagination');
const { broadcastToGlobal } = require('../services/chatService');

async function handleGetMatchRequests(req, res, next) {
  try {
    const uid = req.params.uid || req.params.id;
    let user = await resolveUser(uid);
    if (!user) {
      if (uid === req.user.clerkUserId || uid === req.user.id) {
        user = req.user;
      } else {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
    }

    if (user.clerkUserId !== req.user.clerkUserId && user.id !== req.user.id) {
      return res.status(403).json({ success: false, error: "Cannot fetch another user's requests" });
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

    const requests = await prisma.matchRequest.findMany({
      where: {
        recipientId: user.id,
        status: 'PENDING',
      },
      select: {
        id: true,
        sharedSkill: true,
        status: true,
        createdAt: true,
        requester: {
          select: {
            clerkUserId: true,
            name: true,
            photoUrl: true,
          },
        },
      },
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
}

function parseMatchFilters(query = {}) {
  const { limit, offset } = getPagination(query);
  const skillFilter = typeof query.skill === 'string' && query.skill.trim() ? query.skill.trim() : null;
  const college = typeof query.college === 'string' && query.college.trim() ? query.college.trim() : null;
  const department = typeof query.department === 'string' && query.department.trim() ? query.department.trim() : null;
  const year = query.year !== undefined && query.year !== null && String(query.year).trim()
    ? String(query.year).trim()
    : null;
  const parsedRating = Number(query.minRating);
  const minRating = Number.isFinite(parsedRating) && parsedRating > 0 ? parsedRating : 0;
  const sortBy = ['relevance', 'rating', 'name'].includes(query.sortBy) ? query.sortBy : 'relevance';
  const sameCollegeOnly = query.sameCollegeOnly === 'true' || query.sameCollegeOnly === true;
  const cursor = typeof query.cursor === 'string' && query.cursor.trim() ? query.cursor.trim() : null;

  return {
    limit,
    offset,
    skillFilter,
    college,
    department,
    year,
    minRating,
    sortBy,
    sameCollegeOnly,
    cursor,
  };
}

function formatMatchRequest(record, requester, recipient) {
  return {
    id: record.id,
    requestId: record.id,
    requesterId: record.requesterId,
    recipientId: record.recipientId,
    fromUid: requester?.clerkUserId || record.requesterId,
    toUid: recipient?.clerkUserId || record.recipientId,
    sharedSkill: record.sharedSkill,
    status: record.status,
    createdAt: record.createdAt ? new Date(record.createdAt).getTime() : Date.now(),
  };
}

router.get('/requests/:uid', requireAuth, handleGetMatchRequests);
router.get('/requests/:id', requireAuth, handleGetMatchRequests);

router.get('/recommendations', requireAuth, async (req, res, next) => {
  try {
    const filters = parseMatchFilters(req.query);
    const matches = await findMatches(req.user.clerkUserId, filters);
    res.json({
      success: true,
      count: matches.length,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: matches.length === filters.limit,
      data: matches,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:uid', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req.params;
    if (uid !== req.user.clerkUserId && uid !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Cannot fetch matches for another user' });
    }
    const filters = parseMatchFilters(req.query);
    const matches = await findMatches(req.user.clerkUserId, filters);
    res.json({
      success: true,
      count: matches.length,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: matches.length === filters.limit,
      data: matches,
    });
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
    const filters = parseMatchFilters(req.query);
    let matches = await findBroadMatches(req.user.clerkUserId, { ...filters, sameCollegeOnly: false });
    const hasCustomFilters = Boolean(
      filters.skillFilter
      || filters.college
      || filters.department
      || filters.year
      || filters.minRating > 0
      || (filters.sortBy && filters.sortBy !== 'relevance')
      || Boolean(req.query.sortBy),
    );
    if (matches.length === 0 && !hasCustomFilters) {
      matches = await findAnyMatches(req.user.clerkUserId, filters.limit, filters.offset);
    }
    res.json({
      success: true,
      count: matches.length,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: matches.length === filters.limit,
      data: matches,
    });
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
      resolveUser(fromUid),
      resolveUser(toUid),
    ]);

    if (!requester || !recipient) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (requester.id === recipient.id) {
      return res.status(400).json({ success: false, error: 'Cannot match with yourself' });
    }

    let txResult;
    try {
      txResult = await prisma.$transaction(async (tx) => {
        const existingThread = await tx.chatThread.findFirst({
          where: {
            AND: [
              { participants: { some: { userId: requester.id } } },
              { participants: { some: { userId: recipient.id } } },
            ],
          },
        });

        if (existingThread) {
          return { alreadyMatched: true };
        }

        const existingPending = await tx.matchRequest.findFirst({
          where: {
            OR: [
              { requesterId: requester.id, recipientId: recipient.id, status: 'PENDING' },
              { requesterId: recipient.id, recipientId: requester.id, status: 'PENDING' },
            ],
          },
        });

        if (existingPending) {
          return { requestRecord: existingPending, alreadyRequested: true };
        }

        const created = await tx.matchRequest.create({
          data: {
            requesterId: requester.id,
            recipientId: recipient.id,
            sharedSkill: sharedSkill.trim(),
            status: 'PENDING',
          },
        });

        return { requestRecord: created, alreadyRequested: false };
      });
    } catch (txErr) {
      if (txErr.code === 'P2002') {
        const existingPending = await prisma.matchRequest.findFirst({
          where: {
            OR: [
              { requesterId: requester.id, recipientId: recipient.id, status: 'PENDING' },
              { requesterId: recipient.id, recipientId: requester.id, status: 'PENDING' },
            ],
          },
        });
        if (existingPending) {
          return res.status(200).json({
            success: true,
            alreadyRequested: true,
            data: formatMatchRequest(existingPending, requester, recipient),
          });
        }
      }
      throw txErr;
    }

    if (txResult.alreadyMatched) {
      return res.status(409).json({ success: false, error: 'Already matched with this user' });
    }

    if (txResult.alreadyRequested) {
      return res.status(200).json({
        success: true,
        alreadyRequested: true,
        data: formatMatchRequest(txResult.requestRecord, requester, recipient),
      });
    }

    const matchReq = txResult.requestRecord;

    broadcastToGlobal(recipient.clerkUserId, {
      type: 'global_notification',
      subType: 'match_request',
      notification: {
        title: 'New Match Request!',
        body: `${requester.name} requested to study with you for ${sharedSkill}!`,
      },
      data: {
        message: `${requester.name} requested to study with you for ${sharedSkill}!`,
        requestId: matchReq.id,
        requesterName: requester.name,
        route: '/notifications',
      },
      timestamp: Date.now(),
    });

    res.status(201).json({
      success: true,
      alreadyRequested: false,
      data: formatMatchRequest(matchReq, requester, recipient),
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

    if (request.recipient.clerkUserId !== req.user.clerkUserId && request.recipient.id !== req.user.id) {
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
      notification: {
        title: 'Match Request Accepted!',
        body: `${request.recipient.name} accepted your study request for ${request.sharedSkill}!`,
      },
      data: {
        message: `${request.recipient.name} accepted your study request for ${request.sharedSkill}!`,
        matchId: thread.id,
        route: `/chat/${thread.id}`,
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

    if (request.recipient.clerkUserId !== req.user.clerkUserId && request.recipient.id !== req.user.id) {
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

module.exports = router;
