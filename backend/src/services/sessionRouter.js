const { prisma } = require('../config/prisma');
const { resolveUser } = require('../utils/userResolver');

async function completeSession(sessionId) {
  const { session, alreadyCompleted } = await prisma.$transaction(async (tx) => {
    const current = await tx.tutoringSession.findUnique({
      where: { id: sessionId },
      include: { teacher: true, learner: true },
    });

    if (!current) {
      throw Object.assign(new Error('Session not found'), { statusCode: 404 });
    }

    if (current.status && current.status !== 'UPCOMING') {
      throw Object.assign(new Error(`Cannot complete session with status ${current.status}`), { statusCode: 409 });
    }

    const updated = await tx.tutoringSession.updateMany({
      where: {
        id: sessionId,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
      },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    if (!updated || updated.count === 0) {
      throw Object.assign(new Error('Session already completed or cannot be completed'), { statusCode: 409 });
    }

    await tx.user.update({
      where: { id: current.teacherId },
      data: { totalSessions: { increment: 1 } },
    });
    await tx.user.update({
      where: { id: current.learnerId },
      data: { totalSessions: { increment: 1 } },
    });

    return { session: current, alreadyCompleted: false };
  });

  let notificationSent = false;
  if (!alreadyCompleted) {
    if (session.learner?.clerkUserId) {
      notificationSent = await sendRatingNotification(session.learner.clerkUserId, {
        sessionId: session.id,
        matchId: session.threadId,
        skill: session.title,
        peerName: session.teacher?.name,
      });
    }
    if (session.teacher?.clerkUserId) {
      await sendRatingNotification(session.teacher.clerkUserId, {
        sessionId: session.id,
        matchId: session.threadId,
        skill: session.title,
        peerName: session.learner?.name,
      });
    }
  }

  return {
    success: true,
    notificationSent,
    alreadyCompleted,
    meetLink: session.mode === 'ONLINE' ? `https://meet.jit.si/MindCraft-${session.id}` : '',
  };
}

async function cancelSession(sessionId) {
  const session = await prisma.tutoringSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }

  if (session.status && ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(session.status)) {
    throw Object.assign(new Error(`Cannot cancel session with status ${session.status}`), { statusCode: 409 });
  }

  const txOperations = [
    prisma.tutoringSession.update({
      where: { id: sessionId },
      data: { status: 'CANCELLED' },
    }),
  ];

  // Atomic token refund if the learner paid or held tokens for this session
  if (session.learnerId && prisma.tokenTransaction && typeof prisma.tokenTransaction.findFirst === 'function') {
    const debitTx = await prisma.tokenTransaction.findFirst({
      where: {
        userId: session.learnerId,
        type: 'DEBIT',
        OR: [
          { reason: 'session_booking' },
          { idempotencyKey: `session_${sessionId}_booking` },
          { idempotencyKey: `booking_${sessionId}` },
        ],
      },
    });

    if (debitTx) {
      txOperations.push(
        prisma.user.update({
          where: { id: session.learnerId },
          data: { mindTokens: { increment: debitTx.amount } },
        }),
        prisma.tokenTransaction.create({
          data: {
            userId: session.learnerId,
            amount: debitTx.amount,
            type: 'CREDIT',
            reason: 'session_refund',
            idempotencyKey: `session_${sessionId}_refund`,
            metadata: { sessionId },
          },
        }),
      );
    }
  }

  await prisma.$transaction(txOperations);

  return { success: true };
}

async function sendRatingNotification(recipientUid, sessionData) {
  const peerLabel = sessionData.peerName || sessionData.teacherName || 'your study partner';
  const title = '⭐ Rate Your Session';
  const body = `How was your ${sessionData.skill || ''} session with ${peerLabel}? Tap to leave a rating.`;
  return sendNotification(recipientUid, title, body, {
    type: 'rate_session',
    sessionId: sessionData.sessionId || '',
    matchId: sessionData.matchId || '',
    route: '/sessions',
  });
}

async function sendNotification(uid, title, body, data = {}) {
  try {
    const user = await resolveUser(uid);
    if (!user) return false;

    const { emitToUser } = require('../config/socket');
    emitToUser(user.id, 'global_notification', {
      type: 'global_notification',
      subType: data.type || 'notification',
      notification: { title, body },
      data,
      sessionId: data.sessionId || null,
      timestamp: Date.now(),
    });
    return true;
  } catch (_err) {
    return false;
  }
}

module.exports = {
  completeSession,
  cancelSession,
  sendRatingNotification,
  sendNotification,
};
