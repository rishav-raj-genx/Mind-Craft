const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { completeSession, cancelSession } = require('../services/sessionRouter');
const { awardSessionComplete } = require('../services/tokenEconomy');
const { exportSessionToCalendar, getAuthUrl } = require('../services/calendarExport');
const { prisma } = require('../config/prisma');
const { v4: uuidv4 } = require('uuid');
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

function normalizeSession(s, currentUserId) {
  const isTeacher = s.teacherId === currentUserId;
  const peer = isTeacher ? s.learner : s.teacher;
  const scheduledTime = s.scheduledFor ? new Date(s.scheduledFor).getTime() : Date.now();
  const duration = 60;
  return {
    sessionId: s.id,
    matchId: s.threadId || '',
    teacherUid: s.teacher?.clerkUserId || s.teacherId,
    learnerUid: s.learner?.clerkUserId || s.learnerId,
    skill: s.title || 'General',
    scheduledAt: scheduledTime,
    duration,
    endTime: scheduledTime + duration * 60000,
    mode: s.mode === 'IN_PERSON' ? 'In-Person' : 'Online',
    meetLink: s.mode === 'ONLINE' ? `https://meet.jit.si/MindCraft-${s.id}` : '',
    location: '',
    notes: '',
    status: s.status,
    rating: 5,
    ratingComment: '',
    createdAt: new Date(s.createdAt).getTime(),
    peerName: peer?.name || 'Study Partner',
    partner: peer ? {
      uid: peer.clerkUserId,
      name: peer.name,
      photoUrl: peer.photoUrl,
    } : null,
  };
}

router.get('/auth/google', (_req, res) => {
  try {
    res.json({ success: true, data: { authUrl: getAuthUrl() } });
  } catch (_err) {
    res.status(503).json({ success: false, error: 'Google Calendar API not configured.' });
  }
});

router.post('/book', requireAuth, [
  body('matchId').trim().notEmpty(),
  body('teacherUid').trim().notEmpty(),
  body('learnerUid').trim().notEmpty(),
  body('skill').trim().notEmpty(),
  body('scheduledAt').notEmpty(),
  body('mode').isIn(['Online', 'In-Person']),
], async (req, res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);

    const [teacher, learner] = await Promise.all([
      findUser(req.body.teacherUid),
      findUser(req.body.learnerUid),
    ]);

    if (!teacher || !learner) {
      return res.status(404).json({ success: false, error: 'Teacher or Learner not found' });
    }

    if (![teacher.clerkUserId, learner.clerkUserId].includes(req.user.clerkUserId)) {
      return res.status(403).json({ success: false, error: 'Cannot book a session for unrelated users' });
    }

    const scheduledDate = new Date(Number(req.body.scheduledAt) || req.body.scheduledAt);
    const modeEnum = req.body.mode === 'In-Person' ? 'IN_PERSON' : 'ONLINE';

    const sessionRecord = await prisma.tutoringSession.create({
      data: {
        teacherId: teacher.id,
        learnerId: learner.id,
        threadId: req.body.matchId,
        title: req.body.skill,
        mode: modeEnum,
        status: 'UPCOMING',
        scheduledFor: scheduledDate,
      },
      include: { teacher: true, learner: true },
    });

    const normalized = normalizeSession(sessionRecord, teacher.id);

    // Notify Teacher
    broadcastToGlobal(teacher.clerkUserId, {
      type: 'global_notification',
      subType: 'session_booked',
      data: { message: `New session automatically booked for ${req.body.skill}`, partnerName: learner.name },
      sessionId: sessionRecord.id,
      timestamp: Date.now(),
    });

    // Notify Learner
    broadcastToGlobal(learner.clerkUserId, {
      type: 'global_notification',
      subType: 'session_booked',
      data: { message: `Your session for ${req.body.skill} is confirmed!`, partnerName: teacher.name },
      sessionId: sessionRecord.id,
      timestamp: Date.now(),
    });

    res.status(201).json({ success: true, data: normalized });
  } catch (err) {
    next(err);
  }
});

router.get('/:uid', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { status } = req.query;
    const { limit, offset } = getPagination(req.query);

    const user = await findUser(uid);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.clerkUserId !== req.user.clerkUserId) {
      return res.status(403).json({ success: false, error: "Cannot fetch another user's sessions" });
    }

    const statusFilter = status ? status.toUpperCase() : undefined;

    const rawSessions = await prisma.tutoringSession.findMany({
      where: {
        OR: [{ teacherId: user.id }, { learnerId: user.id }],
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: { teacher: true, learner: true },
      orderBy: { scheduledFor: 'asc' },
      skip: offset,
      take: limit,
    });

    const now = Date.now();
    const sessions = [];

    for (const s of rawSessions) {
      const scheduledTime = s.scheduledFor ? new Date(s.scheduledFor).getTime() : 0;
      const endTime = scheduledTime + 60 * 60000;

      if (s.status === 'UPCOMING' && endTime < now) {
        await completeSession(s.id).catch(() => {});
        try {
          await awardSessionComplete(s.teacher.clerkUserId, s.learner.clerkUserId, s.id);
        } catch (_e) {}
        s.status = 'COMPLETED';
      }

      sessions.push(normalizeSession(s, user.id));
    }

    res.json({
      success: true,
      count: sessions.length,
      limit,
      offset,
      hasMore: sessions.length === limit,
      data: sessions,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:sessionId/accept', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { googleTokens } = req.body;

    const session = await prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: { teacher: true, learner: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.teacher.clerkUserId !== req.user.clerkUserId) {
      return res.status(403).json({ success: false, error: 'Only the teacher can accept this session' });
    }

    let meetLink = session.mode === 'ONLINE' ? `https://meet.jit.si/MindCraft-${sessionId}` : '';

    if (googleTokens) {
      try {
        const calRes = await exportSessionToCalendar(
          { ...session, scheduledAt: new Date(session.scheduledFor).getTime() },
          googleTokens,
          session.learner.name,
          session.learner.email,
        );
        if (calRes?.meetLink) meetLink = calRes.meetLink;
      } catch (_calErr) {}
    }

    await prisma.tutoringSession.update({
      where: { id: sessionId },
      data: { status: 'UPCOMING' },
    });

    broadcastToGlobal(session.learner.clerkUserId, {
      type: 'global_new_message',
      notification: {
        title: 'Session Accepted! ✅',
        body: `Your session request for ${session.title || 'tutoring'} was accepted.`,
      },
      data: { type: 'session_booked', id: `session-${sessionId}-accept`, route: '/sessions', matchId: '' },
    });

    res.json({ success: true, message: 'Session accepted', meetLink });
  } catch (err) {
    next(err);
  }
});

router.patch('/:sessionId/reject', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: { teacher: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.teacher.clerkUserId !== req.user.clerkUserId) {
      return res.status(403).json({ success: false, error: 'Only the teacher can reject this session' });
    }

    await prisma.tutoringSession.update({
      where: { id: sessionId },
      data: { status: 'REJECTED' },
    });

    res.json({ success: true, message: 'Session rejected' });
  } catch (err) {
    next(err);
  }
});

router.patch('/:sessionId/complete', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: { teacher: true, learner: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (![session.teacher.clerkUserId, session.learner.clerkUserId].includes(req.user.clerkUserId)) {
      return res.status(403).json({ success: false, error: 'Not a participant in this session' });
    }

    const result = await completeSession(sessionId);
    if (!result.alreadyCompleted) {
      try {
        await awardSessionComplete(session.teacher.clerkUserId, session.learner.clerkUserId, sessionId);
      } catch (_e) {}
    }

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/:sessionId/rate', requireAuth, [
  body('rating').isFloat({ min: 1, max: 5 }),
], async (req, res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);

    const { sessionId } = req.params;
    const { rating } = req.body;

    const session = await prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: { teacher: true, learner: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.learner.clerkUserId !== req.user.clerkUserId) {
      return res.status(403).json({ success: false, error: 'Only the learner can rate this session' });
    }

    const numRating = parseFloat(rating);
    const newRating = Number(((Number(session.teacher.averageRating) * session.teacher.totalSessions + numRating) / Math.max(session.teacher.totalSessions + 1, 1)).toFixed(2));

    await prisma.user.update({
      where: { id: session.teacherId },
      data: { averageRating: newRating },
    });

    broadcastToGlobal(session.teacher.clerkUserId, {
      type: 'global_new_message',
      notification: { title: 'New Review Received! ⭐', body: `You received a ${numRating}-star rating.` },
      data: { type: 'new_review', id: `review-${sessionId}`, route: '/profile', matchId: '' },
    });

    res.json({ success: true, message: 'Rating submitted' });
  } catch (err) {
    next(err);
  }
});

router.post('/:sessionId/cancel', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: { teacher: true, learner: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (![session.teacher.clerkUserId, session.learner.clerkUserId].includes(req.user.clerkUserId)) {
      return res.status(403).json({ success: false, error: 'Not a participant in this session' });
    }

    const result = await cancelSession(sessionId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/:sessionId/export-calendar', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: { teacher: true, learner: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (![session.teacher.clerkUserId, session.learner.clerkUserId].includes(req.user.clerkUserId)) {
      return res.status(403).json({ success: false, error: 'Not a participant in this session' });
    }

    const isTeacher = session.teacher.clerkUserId === req.user.clerkUserId;
    const peer = isTeacher ? session.learner : session.teacher;

    const start = new Date(session.scheduledFor || Date.now());
    const durationMins = 60;
    const end = new Date(start.getTime() + durationMins * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

    const meetLink = `https://meet.jit.si/MindCraft-${sessionId}`;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `MindCraft Session: ${session.title || 'Tutoring'}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `MindCraft P2P Tutoring Session with ${peer.name}\nSkill: ${session.title || 'General'}\nMode: ${session.mode}\nJoin: ${meetLink}`,
      location: meetLink,
    });
    if (peer.email) params.append('add', peer.email);

    res.json({
      success: true,
      data: { htmlLink: `https://calendar.google.com/calendar/render?${params.toString()}` },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
