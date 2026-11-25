const { prisma } = require('../config/prisma');
const { resolveUser } = require('../utils/userResolver');

async function completeSession(sessionId) {
  const session = await prisma.tutoringSession.findUnique({
    where: { id: sessionId },
    include: { teacher: true, learner: true },
  });

  if (!session) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }

  const alreadyCompleted = session.status === 'COMPLETED';

  if (!alreadyCompleted) {
    if (session.status && session.status !== 'UPCOMING') {
      throw Object.assign(new Error(`Cannot complete session with status ${session.status}`), { statusCode: 409 });
    }

    await prisma.$transaction([
      prisma.tutoringSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: session.teacherId },
        data: { totalSessions: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: session.learnerId },
        data: { totalSessions: { increment: 1 } },
      }),
    ]);
  }

  let notificationSent = false;
  if (!alreadyCompleted && session.learner) {
    notificationSent = await sendRatingNotification(session.learner.clerkUserId, {
      sessionId: session.id,
      matchId: session.threadId,
      skill: session.title,
      teacherName: session.teacher?.name,
    });
  }

  return { success: true, notificationSent, alreadyCompleted };
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

async function sendRatingNotification(learnerUid, sessionData) {
  const title = '⭐ Rate Your Session';
  const body = `How was your ${sessionData.skill || ''} session with ${sessionData.teacherName || 'your tutor'}? Tap to leave a rating.`;
  return sendNotification(learnerUid, title, body, {
    type: 'rate_session',
    sessionId: sessionData.sessionId || '',
    matchId: sessionData.matchId || '',
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
