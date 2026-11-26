const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { completeSession, cancelSession } = require('../services/sessionRouter');
const { awardSessionComplete } = require('../services/tokenEconomy');
const { exportSessionToCalendar, generateIcsCalendar, getAuthUrl } = require('../services/calendarExport');
const { prisma } = require('../config/prisma');
const { resolveUser } = require('../utils/userResolver');
const { getPagination } = require('../utils/pagination');
const { broadcastToGlobal } = require('../services/chatService');

function normalizeSession(s, currentUserId) {
  const isTeacher = s.teacherId === currentUserId;
  const peer = isTeacher ? s.learner : s.teacher;
  const scheduledTime = s.scheduledFor ? new Date(s.scheduledFor).getTime() : Date.now();
  const duration = 60;

  let sessionRating = 0;
  if (s.completionKey) {
    try {
      const parsed = JSON.parse(s.completionKey);
      const callerKey = isTeacher ? `teacher_${s.teacherId}` : `learner_${s.learnerId}`;
      sessionRating = parsed[callerKey]?.rating || parsed[`learner_${s.learnerId}`]?.rating || parsed.rating || 0;
    } catch (_e) {
      sessionRating = 0;
    }
  }

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
    rating: sessionRating,
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
  body('skill').trim().notEmpty(),
  body('mode').isIn(['Online', 'In-Person']),
], async (req, res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);

    const tutorParam = req.body.teacherUid || req.body.tutorId || req.body.teacherId;
    if (!tutorParam) {
      return res.status(400).json({ success: false, error: 'Teacher ID is required' });
    }

    // Prevent booking a tutoring session with oneself
    if (tutorParam === req.user.id || tutorParam === req.user.clerkUserId) {
      return res.status(400).json({ success: false, error: 'Cannot book a tutoring session with yourself' });
    }

    const teacher = await resolveUser(tutorParam);
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher or Learner not found' });
    }

    if (teacher.id === req.user.id || teacher.clerkUserId === req.user.clerkUserId) {
      return res.status(400).json({ success: false, error: 'Cannot book a tutoring session with yourself' });
    }

    const learnerParam = req.body.learnerUid || req.body.learnerId || req.user.clerkUserId;
    const learner = learnerParam === req.user.clerkUserId || learnerParam === req.user.id
      ? req.user
      : await resolveUser(learnerParam);

    if (!learner) {
      return res.status(404).json({ success: false, error: 'Teacher or Learner not found' });
    }

    if (teacher.id === learner.id) {
      return res.status(400).json({ success: false, error: 'Cannot book a tutoring session with yourself' });
    }

    // Validate startTime < endTime and session is in the future
    const startVal = req.body.startTime || req.body.scheduledAt || req.body.scheduledFor;
    if (!startVal) {
      return res.status(400).json({ success: false, error: 'Session start time is required' });
    }
    const start = new Date(Number(startVal) || startVal);
    const durationMins = Number(req.body.duration) || 60;
    const endVal = req.body.endTime;
    const end = endVal ? new Date(Number(endVal) || endVal) : new Date(start.getTime() + durationMins * 60 * 1000);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid session start or end time' });
    }

    if (start.getTime() >= end.getTime()) {
      return res.status(400).json({ success: false, error: 'Session start time must be before end time' });
    }

    if (start.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, error: 'Session must be scheduled in the future' });
    }

    // Check tutor availability overlap against existing sessions
    const overlap = await prisma.tutoringSession.findFirst({
      where: {
        teacherId: teacher.id,
        status: { in: ['UPCOMING', 'PENDING'] },
        OR: [
          {
            scheduledFor: {
              gte: start,
              lt: end,
            },
          },
        ],
      },
    });

    if (overlap) {
      return res.status(409).json({ success: false, error: 'Tutor is not available at the selected time' });
    }

    const { matchId, skill, mode } = req.body;

    const session = await prisma.tutoringSession.create({
      data: {
        teacherId: teacher.id,
        learnerId: learner.id,
        title: skill,
        mode: mode === 'In-Person' ? 'IN_PERSON' : 'ONLINE',
        scheduledFor: start,
        threadId: matchId,
        status: 'PENDING',
      },
      include: { teacher: true, learner: true },
    });

    broadcastToGlobal(teacher.clerkUserId, {
      type: 'global_notification',
      subType: 'session_booked',
      notification: {
        title: 'New Session Request! 📅',
        body: `${learner.name} requested a ${skill} session.`,
      },
      data: { type: 'session_booked', id: `session-${session.id}`, route: '/sessions', matchId },
    });

    res.status(201).json({
      success: true,
      data: normalizeSession(session, teacher.id),
    });
  } catch (err) {
    next(err);
  }
});

const handleGetUserSessions = async (req, res, next) => {
  try {
    const targetUid = req.params.uid || req.params.id;
    const { status } = req.query;
    const { limit, offset } = getPagination(req.query);

    let user = await resolveUser(targetUid);
    if (!user) {
      if (targetUid === req.user.clerkUserId || targetUid === req.user.id) {
        user = req.user;
      } else {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
    }

    if (user.clerkUserId !== req.user.clerkUserId && user.id !== req.user.id) {
      return res.status(403).json({ success: false, error: "Cannot fetch another user's sessions" });
    }

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

    const sessions = (rawSessions || []).map((s) => normalizeSession(s, user.id));

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
};

router.get('/user/:uid', requireAuth, handleGetUserSessions);
router.get('/user/:id', requireAuth, handleGetUserSessions);
router.get('/:uid', requireAuth, handleGetUserSessions);

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

    if (session.teacher.clerkUserId !== req.user.clerkUserId && session.teacher.id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Only the teacher can accept this session' });
    }

    if (session.status !== 'PENDING') {
      return res.status(409).json({ success: false, error: `Cannot accept session with status ${session.status}` });
    }

    const updateResult = await prisma.tutoringSession.updateMany({
      where: { id: sessionId, status: 'PENDING' },
      data: { status: 'UPCOMING' },
    });

    if (updateResult.count === 0) {
      return res.status(409).json({ success: false, error: 'Session was already accepted or modified' });
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

    broadcastToGlobal(session.learner.clerkUserId, {
      type: 'global_notification',
      subType: 'session_accepted',
      notification: {
        title: 'Session Accepted! ✅',
        body: `Your session request for ${session.title || 'tutoring'} was accepted.`,
      },
      data: { type: 'session_booked', id: `session-${sessionId}-accept`, route: '/sessions', matchId: session.threadId || '' },
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
      include: { teacher: true, learner: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.teacher.clerkUserId !== req.user.clerkUserId && session.teacher.id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Only the teacher can reject this session' });
    }

    if (session.status !== 'PENDING') {
      return res.status(409).json({ success: false, error: `Cannot reject session with status ${session.status}` });
    }

    const updateResult = await prisma.tutoringSession.updateMany({
      where: { id: sessionId, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });

    if (updateResult.count === 0) {
      return res.status(409).json({ success: false, error: 'Session was already rejected or modified' });
    }

    if (session.learner?.clerkUserId) {
      broadcastToGlobal(session.learner.clerkUserId, {
        type: 'global_notification',
        subType: 'session_rejected',
        notification: {
          title: 'Session Declined',
          body: `Your session request for ${session.title || 'tutoring'} was declined.`,
        },
        data: { type: 'session_rejected', id: `session-${sessionId}-reject`, route: '/sessions', matchId: session.threadId || '' },
      });
    }

    res.json({ success: true, message: 'Session rejected' });
  } catch (err) {
    next(err);
  }
});

const handleCompleteSession = async (req, res, next) => {
  try {
    const targetSessionId = req.params.sessionId || req.params.id;
    const session = await prisma.tutoringSession.findUnique({
      where: { id: targetSessionId },
      include: { teacher: true, learner: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (![session.teacher.clerkUserId, session.learner.clerkUserId].includes(req.user.clerkUserId) &&
        ![session.teacherId, session.learnerId].includes(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Not a participant in this session' });
    }

    if (session.status !== 'UPCOMING' && session.status !== 'COMPLETED') {
      return res.status(409).json({ success: false, error: `Cannot complete session with status ${session.status}` });
    }

    const result = await completeSession(targetSessionId);
    if (!result.alreadyCompleted) {
      try {
        await awardSessionComplete(session.teacher.clerkUserId, session.learner.clerkUserId, targetSessionId);
      } catch (_e) {}
    }

    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ success: false, error: err.message });
    }
    next(err);
  }
};

router.patch('/:sessionId/complete', requireAuth, handleCompleteSession);
router.post('/:sessionId/complete', requireAuth, handleCompleteSession);
router.post('/:id/complete', requireAuth, handleCompleteSession);

const handleRateSession = async (req, res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);

    const sessionId = req.params.sessionId || req.params.id;
    const { rating } = req.body;

    const session = await prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: { teacher: true, learner: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, error: 'Cannot rate a session that is not completed' });
    }

    const isLearner = session.learner.clerkUserId === req.user.clerkUserId || session.learnerId === req.user.id;
    const isTeacher = session.teacher.clerkUserId === req.user.clerkUserId || session.teacherId === req.user.id;

    if (!isLearner && !isTeacher) {
      return res.status(403).json({ success: false, error: 'Only participants can rate this session' });
    }

    let ratingData = {};
    if (session.completionKey) {
      try {
        ratingData = JSON.parse(session.completionKey);
      } catch (_e) {
        ratingData = {};
      }
    }

    const callerKey = isLearner ? `learner_${session.learnerId}` : `teacher_${session.teacherId}`;
    if (ratingData[callerKey] || (isLearner && ratingData.learnerRated) || (!isLearner && ratingData.teacherRated)) {
      return res.status(400).json({ success: false, error: 'You have already rated this session' });
    }

    const numRating = parseFloat(rating);
    ratingData[callerKey] = { rating: numRating, ratedAt: Date.now() };
    if (isLearner) ratingData.learnerRated = true;
    else ratingData.teacherRated = true;

    const prevSessions = Math.max(session.teacher.totalSessions - 1, 0);
    const newRating = Number(((Number(session.teacher.averageRating) * prevSessions + numRating) / Math.max(session.teacher.totalSessions, 1)).toFixed(2));

    await prisma.$transaction([
      prisma.tutoringSession.update({
        where: { id: sessionId },
        data: { completionKey: JSON.stringify(ratingData) },
      }),
      prisma.user.update({
        where: { id: session.teacherId },
        data: { averageRating: newRating },
      }),
    ]);

    broadcastToGlobal(session.teacher.clerkUserId, {
      type: 'global_notification',
      subType: 'new_review',
      notification: { title: 'New Review Received! ⭐', body: `You received a ${numRating}-star rating.` },
      data: { type: 'new_review', id: `review-${sessionId}`, route: '/profile', matchId: session.threadId || '' },
    });

    res.json({ success: true, message: 'Rating submitted' });
  } catch (err) {
    next(err);
  }
};

router.post('/:sessionId/rate', requireAuth, [
  body('rating').isFloat({ min: 1, max: 5 }),
], handleRateSession);

router.post('/:id/rate', requireAuth, [
  body('rating').isFloat({ min: 1, max: 5 }),
], handleRateSession);

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

    if (![session.teacher.clerkUserId, session.learner.clerkUserId].includes(req.user.clerkUserId) &&
        ![session.teacherId, session.learnerId].includes(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Not a participant in this session' });
    }

    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(session.status)) {
      return res.status(409).json({ success: false, error: `Cannot cancel session with status ${session.status}` });
    }

    const result = await cancelSession(sessionId);

    const isTeacher = session.teacher.clerkUserId === req.user.clerkUserId || session.teacherId === req.user.id;
    const peerClerkId = isTeacher ? session.learner?.clerkUserId : session.teacher?.clerkUserId;
    if (peerClerkId) {
      broadcastToGlobal(peerClerkId, {
        type: 'global_notification',
        subType: 'session_cancelled',
        notification: {
          title: 'Session Cancelled',
          body: `The tutoring session for ${session.title || 'tutoring'} was cancelled.`,
        },
        data: { type: 'session_cancelled', id: `session-${sessionId}-cancel`, route: '/sessions', matchId: session.threadId || '' },
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ success: false, error: err.message });
    }
    next(err);
  }
});

router.get('/:sessionId/ics', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: { teacher: true, learner: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (![session.teacher.clerkUserId, session.learner.clerkUserId].includes(req.user.clerkUserId) &&
        ![session.teacherId, session.learnerId].includes(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Not a participant in this session' });
    }

    const isTeacher = session.teacher.clerkUserId === req.user.clerkUserId || session.teacherId === req.user.id;
    const peer = isTeacher ? session.learner : session.teacher;

    const icsContent = generateIcsCalendar(session, peer?.name || 'Peer');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}.ics"`);
    res.send(icsContent);
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

    if (![session.teacher.clerkUserId, session.learner.clerkUserId].includes(req.user.clerkUserId) &&
        ![session.teacherId, session.learnerId].includes(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Not a participant in this session' });
    }

    const isTeacher = session.teacher.clerkUserId === req.user.clerkUserId || session.teacherId === req.user.id;
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
