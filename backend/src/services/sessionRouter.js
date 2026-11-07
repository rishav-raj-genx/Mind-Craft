const { prisma } = require('../config/prisma');

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
  if (!alreadyCompleted) {
    notificationSent = await sendRatingNotification(session.learner.clerkUserId, {
      sessionId: session.id,
      matchId: session.threadId,
      skill: session.title,
      teacherName: session.teacher.name,
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

  await prisma.tutoringSession.update({
    where: { id: sessionId },
    data: { status: 'CANCELLED' },
  });

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
    const user = await findUser(uid);
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
