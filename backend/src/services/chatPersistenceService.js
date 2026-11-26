const { randomUUID } = require('node:crypto');
const { prisma } = require('../config/prisma');

async function assertParticipant(threadId, userId) {
  const participant = await prisma.chatParticipant.findUnique({
    where: { threadId_userId: { threadId, userId } },
    select: { threadId: true, userId: true, leftAt: true },
  });
  if (!participant || participant.leftAt) {
    throw Object.assign(new Error('Not a participant in this chat thread'), { statusCode: 403 });
  }
}

async function persistMessage({ id, messageId, threadId, senderId, clientMessageId, text, createdAt }) {
  await assertParticipant(threadId, senderId);
  const resolvedId = id || messageId;
  const effectiveClientMessageId = clientMessageId || resolvedId || randomUUID();

  return prisma.$transaction(async (tx) => {
    const message = await tx.chatMessage.upsert({
      where: {
        senderId_clientMessageId: { senderId, clientMessageId: effectiveClientMessageId },
      },
      create: {
        ...(resolvedId ? { id: resolvedId } : {}),
        threadId,
        senderId,
        clientMessageId: effectiveClientMessageId,
        text,
        createdAt: createdAt ? new Date(createdAt) : undefined,
      },
      update: {},
    });

    // Guard thread summary update against out-of-order concurrent worker writes
    if (typeof tx.chatThread.updateMany === 'function') {
      await tx.chatThread.updateMany({
        where: {
          id: threadId,
          OR: [
            { lastMessageAt: null },
            { lastMessageAt: { lte: message.createdAt } },
          ],
        },
        data: {
          lastMessage: message.text,
          lastMessageAt: message.createdAt,
          lastSenderId: senderId,
          updatedAt: new Date(),
        },
      });
    } else {
      await tx.chatThread.update({
        where: { id: threadId },
        data: {
          lastMessage: message.text,
          lastMessageAt: message.createdAt,
          lastSenderId: senderId,
        },
      });
    }

    return message;
  });
}

async function markThreadRead(threadId, userId) {
  await assertParticipant(threadId, userId);
  return prisma.chatParticipant.update({
    where: { threadId_userId: { threadId, userId } },
    data: { lastReadAt: new Date() },
  });
}

module.exports = { assertParticipant, persistMessage, markThreadRead };
