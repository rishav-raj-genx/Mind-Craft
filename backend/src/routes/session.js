const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { completeSession, cancelSession } = require('../services/sessionRouter');
const { awardSessionComplete } = require('../services/tokenEconomy');
const { getSessionMeetLink, generateCalendarDeepLink, generateIcsCalendar, getAuthUrl } = require('../services/calendarExport');
const { prisma } = require('../config/prisma');
const { resolveUser } = require('../utils/userResolver');
const { getPagination } = require('../utils/pagination');
const { broadcastToGlobal } = require('../services/chatService');

const DEFAULT_SESSION_DURATION_MS = 60 * 60 * 1000;

function normalizeSession(s, currentUserId) {
  const isTeacher = s.teacherId === currentUserId;
  const peer = isTeacher ? s.learner : s.teacher;
  const scheduledTime = s.scheduledFor ? new Date(s.scheduledFor).getTime() : Date.now();
  const duration = Number(s.duration) || 60;

  let sessionRating = 0;
  let ratingComment = '';
  if (s.completionKey) {
    try {
      const parsed = JSON.parse(s.completionKey);
      const callerKey = isTeacher ? `teacher_${s.teacherId}` : `learner_${s.learnerId}`;
      const entry = parsed[callerKey] || (!isTeacher && parsed.rating ? { rating: parsed.rating, comment: parsed.comment } : null);
      sessionRating = Number(entry?.rating) || 0;
      ratingComment = entry?.comment || '';
    } catch (_e) {
      sessionRating = 0;
      ratingComment = '';
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
    meetLink: getSessionMeetLink(s),
    location: '',
    notes: '',
    status: s.status,
    rating: sessionRating,
    ratingComment,
    createdAt: new Date(s.createdAt).getTime(),
    peerName: peer?.name || 'Study Partner',
    partner: peer ? {
      uid: peer.clerkUserId,
      name: peer.name,
      photoUrl: peer.photoUrl,
    } : null,
  };
}

async function findOverlappingSession({ teacherId, learnerId, start, end, excludeSessionId = null }) {
  const participantClauses = [];
  if (teacherId) {
    participantClauses.push({ teacherId }, { learnerId: teacherId });
  }
  if (learnerId) {
    participantClauses.push({ teacherId: learnerId }, { learnerId });
  }

  const lookbackStart = new Date(start.getTime() - DEFAULT_SESSION_DURATION_MS);
  const candidate = await prisma.tutoringSession.findFirst({
    where: {
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      status: { in: ['UPCOMING', 'PENDING'] },
      OR: participantClauses,
      scheduledFor: {
        gt: lookbackStart,
        lt: end,
      },
    },
  });

  if (!candidate) return null;

  if (candidate.scheduledFor) {
    const existingStart = new Date(candidate.scheduledFor).getTime();
    const existingDurationMs = (Number(candidate.duration) || 60) * 60 * 1000;
    const existingEnd = existingStart + existingDurationMs;
    if (!(existingStart < end.getTime() && existingEnd > start.getTime())) {
      return null;
    }
  }

  return candidate;
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
    const endVal = req.body.endTime;
    const hasExplicitDuration = req.body.duration !== undefined && req.body.duration !== null && req.body.duration !== '';
    const parsedDuration = Number(req.body.duration);
    if (hasExplicitDuration && (!Number.isInteger(parsedDuration) || parsedDuration < 15 || parsedDuration > 240)) {
      return res.status(400).json({ success: false, error: 'Session duration must be an integer between 15 and 240 minutes' });
    }
    const requestedDuration = hasExplicitDuration ? parsedDuration : 60;
    const end = endVal
      ? new Date(Number(endVal) || endVal)
      : new Date(start.getTime() + (requestedDuration * 60 * 1000));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid session start or end time' });
    }

    if (start.getTime() >= end.getTime()) {
      return res.status(400).json({ success: false, error: 'Session start time must be before end time' });
    }

    if (start.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, error: 'Session must be scheduled in the future' });
    }

    const durationMins = Math.max(15, Math.min(240, Math.round((end.getTime() - start.getTime()) / 60000)));
    const { matchId, skill, mode } = req.body;

    // Atomically check availability overlap and create the session inside a serializable transaction
    let txResult;
    try {
      txResult = await prisma.$transaction(async (tx) => {
        const overlap = await findOverlappingSession({
          teacherId: teacher.id,
          learnerId: learner.id,
          start,
          end,
          tx,
        });

        if (overlap) {
          const teacherBusy = overlap.teacherId === teacher.id || overlap.learnerId === teacher.id;
          return {
            conflict: true,
            error: teacherBusy
              ? 'Tutor is not available at the selected time'
              : 'Learner is not available at the selected time',
          };
        }

        const created = await tx.tutoringSession.create({
          data: {
            teacherId: teacher.id,
            learnerId: learner.id,
            title: skill,
            mode: mode === 'In-Person' ? 'IN_PERSON' : 'ONLINE',
            scheduledFor: start,
            duration: durationMins,
            threadId: matchId,
            status: 'PENDING',
          },
          include: { teacher: true, learner: true },
        });

        return { conflict: false, session: created };
      }, { isolationLevel: 'Serializable' });
    } catch (txErr) {
      if (txErr?.code === 'P2034') {
        return res.status(409).json({ success: false, error: 'Time slot conflict — please retry' });
      }
      throw txErr;
    }

    if (txResult.conflict) {
      return res.status(409).json({ success: false, error: txResult.error });
    }

    const session = txResult.session;

    broadcastToGlobal(teacher.clerkUserId, {
      type: 'global_notification',
      subType: 'session_booked',
      notification: {
        title: 'New Session Request! 📅',
        body: `${learner.name} requested a ${skill} session.`,
      },
      data: { type: 'session_booked', id: `session-${session.id}`, route: '/sessions', matchId },
      timestamp: Date.now(),
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

    const meetLink = getSessionMeetLink({ ...session, id: sessionId });

    broadcastToGlobal(session.learner.clerkUserId, {
      type: 'global_notification',
      subType: 'session_accepted',
      notification: {
        title: 'Session Accepted! ✅',
        body: `Your session request for ${session.title || 'tutoring'} was accepted.`,
      },
      data: { type: 'session_booked', id: `session-${sessionId}-accept`, route: '/sessions', matchId: session.threadId || '' },
      timestamp: Date.now(),
    });

    res.json({ success: true, message: 'Session accepted', meetLink });
  } catch (err) {
    next(err);
  }
});

router.patch('/:sessionId/reschedule', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: { teacher: true, learner: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const isTeacher = session.teacher?.clerkUserId === req.user.clerkUserId || session.teacherId === req.user.id;
    const isLearner = session.learner?.clerkUserId === req.user.clerkUserId || session.learnerId === req.user.id;
    if (!isTeacher && !isLearner) {
      return res.status(403).json({ success: false, error: 'Not a participant in this session' });
    }

    if (!['PENDING', 'UPCOMING'].includes(session.status)) {
      return res.status(409).json({ success: false, error: `Cannot reschedule session with status ${session.status}` });
    }

    const startVal = req.body.startTime || req.body.scheduledAt || req.body.scheduledFor;
    if (!startVal) {
      return res.status(400).json({ success: false, error: 'Session start time is required' });
    }

    const start = new Date(Number(startVal) || startVal);
    const hasExplicitDuration = req.body.duration !== undefined && req.body.duration !== null && req.body.duration !== '';
    const parsedDuration = Number(req.body.duration);
    if (hasExplicitDuration && (!Number.isInteger(parsedDuration) || parsedDuration < 15 || parsedDuration > 240)) {
      return res.status(400).json({ success: false, error: 'Session duration must be an integer between 15 and 240 minutes' });
    }
    const requestedDuration = hasExplicitDuration ? parsedDuration : (Number(session.duration) || 60);
    const endVal = req.body.endTime;
    const end = endVal ? new Date(Number(endVal) || endVal) : new Date(start.getTime() + requestedDuration * 60 * 1000);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid session start or end time' });
    }
    if (start.getTime() >= end.getTime()) {
      return res.status(400).json({ success: false, error: 'Session start time must be before end time' });
    }
    if (start.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, error: 'Session must be scheduled in the future' });
    }

    const durationMins = Math.max(15, Math.min(240, Math.round((end.getTime() - start.getTime()) / 60000)));

    let rescheduleTx;
    try {
      rescheduleTx = await prisma.$transaction(async (tx) => {
        const overlap = await findOverlappingSession({
          teacherId: session.teacherId,
          learnerId: session.learnerId,
          start,
          end,
          excludeSessionId: sessionId,
          tx,
        });

        if (overlap) {
          const teacherBusy = overlap.teacherId === session.teacherId || overlap.learnerId === session.teacherId;
          return {
            conflict: true,
            error: teacherBusy
              ? 'Tutor is not available at the selected time'
              : 'Learner is not available at the selected time',
          };
        }

        const updatedSession = await tx.tutoringSession.update({
          where: { id: sessionId },
          data: { scheduledFor: start, duration: durationMins },
          include: { teacher: true, learner: true },
        });

        return { conflict: false, updated: updatedSession };
      }, { isolationLevel: 'Serializable' });
    } catch (txErr) {
      if (txErr?.code === 'P2034') {
        return res.status(409).json({ success: false, error: 'Time slot conflict — please retry' });
      }
      throw txErr;
    }

    if (rescheduleTx.conflict) {
      return res.status(409).json({ success: false, error: rescheduleTx.error });
    }

    const updated = rescheduleTx.updated;

    const peerClerkId = isTeacher ? session.learner?.clerkUserId : session.teacher?.clerkUserId;
    if (peerClerkId) {
      broadcastToGlobal(peerClerkId, {
        type: 'global_notification',
        subType: 'session_rescheduled',
        notification: {
          title: 'Session Rescheduled 📅',
          body: `Your ${session.title || 'tutoring'} session was rescheduled.`,
        },
        data: { type: 'session_rescheduled', id: `session-${sessionId}-reschedule`, route: '/sessions', matchId: session.threadId || '' },
        timestamp: Date.now(),
      });
    }

    const callerId = isTeacher ? session.teacherId : session.learnerId;
    res.json({
      success: true,
      message: 'Session rescheduled',
      data: normalizeSession(updated, callerId),
    });
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
        timestamp: Date.now(),
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

    if (session.status !== 'UPCOMING') {
      return res.status(409).json({ success: false, error: `Cannot complete session with status ${session.status}` });
    }

    const result = await completeSession(targetSessionId);
    if (!result.alreadyCompleted) {
      try {
        await awardSessionComplete(session.teacher.clerkUserId, session.learner.clerkUserId, targetSessionId);
      } catch (_e) { }
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
    const { rating, comment } = req.body;

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
    const cleanComment = typeof comment === 'string' ? comment.trim() : '';
    ratingData[callerKey] = { rating: numRating, comment: cleanComment, ratedAt: Date.now() };
    if (isLearner) ratingData.learnerRated = true;
    else ratingData.teacherRated = true;

    const targetUserId = isLearner ? session.teacherId : session.learnerId;
    const targetUser = isLearner ? session.teacher : session.learner;
    const targetField = isLearner ? 'teacherId' : 'learnerId';
    const targetRatingKey = isLearner ? 'learnerRated' : 'teacherRated';

    const { newRating, ratedSessionsCount } = await prisma.$transaction(async (tx) => {
      await tx.tutoringSession.update({
        where: { id: sessionId },
        data: { completionKey: JSON.stringify(ratingData) },
      });

      const ratedCountRaw = typeof tx.tutoringSession.count === 'function'
        ? await tx.tutoringSession.count({
          where: {
            [targetField]: targetUserId,
            status: 'COMPLETED',
            completionKey: { contains: targetRatingKey },
          },
        })
        : 1;
      const count = Math.max(ratedCountRaw || 1, 1);
      const prevRating = Number(targetUser?.averageRating) || 0;
      const computedRating = Number(((prevRating * (count - 1) + numRating) / count).toFixed(2));

      await tx.user.update({
        where: { id: targetUserId },
        data: { averageRating: computedRating },
      });

      return { newRating: computedRating, ratedSessionsCount: count };
    });

    if (targetUser?.clerkUserId) {
      broadcastToGlobal(targetUser.clerkUserId, {
        type: 'global_notification',
        subType: 'new_review',
        notification: { title: 'New Review Received! ⭐', body: `You received a ${numRating}-star rating.` },
        data: { type: 'new_review', id: `review-${sessionId}`, route: '/profile', matchId: session.threadId || '' },
      });
    }

    res.json({
      success: true,
      message: 'Rating submitted',
      data: { ratedUserId: targetUserId, averageRating: newRating, ratedSessionsCount },
    });
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
        timestamp: Date.now(),
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

const handleExportCalendar = async (req, res, next) => {
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

    const { htmlLink, meetLink } = generateCalendarDeepLink(
      { ...session, id: sessionId },
      peer?.name || 'Peer',
      peer?.email || null,
    );

    res.json({
      success: true,
      data: { htmlLink, meetLink },
    });
  } catch (err) {
    next(err);
  }
};

router.post('/:sessionId/export-calendar', requireAuth, handleExportCalendar);
router.get('/:sessionId/calendar', requireAuth, handleExportCalendar);

module.exports = router;
