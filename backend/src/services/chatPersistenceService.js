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

async function persistMessage({ threadId, senderId, clientMessageId, text, createdAt }) {
  await assertParticipant(threadId, senderId);

  return prisma.$transaction(async (tx) => {
    const message = await tx.chatMessage.upsert({
      where: {
        senderId_clientMessageId: { senderId, clientMessageId },
      },
      create: {
        threadId,
        senderId,
        clientMessageId,
        text,
        createdAt: createdAt ? new Date(createdAt) : undefined,
      },
      update: {},
    });

    await tx.chatThread.update({
      where: { id: threadId },
      data: {
        lastMessage: message.text,
        lastMessageAt: message.createdAt,
        lastSenderId: senderId,
      },
    });

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
