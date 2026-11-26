const { prisma } = require('../config/prisma');
const { invalidateMatchingFeeds } = require('./matchingCache');
const { invalidateAuthUserCache } = require('./authUserCache');

async function safeInvalidate(userId, ...clerkUserIds) {
  await Promise.all([
    typeof invalidateMatchingFeeds === 'function' ? invalidateMatchingFeeds(userId) : undefined,
    invalidateAuthUserCache(...clerkUserIds),
  ]);
}

function getPrimaryEmail(data) {
  const addresses = data.email_addresses || [];
  const primaryId = data.primary_email_address_id;
  const primary = addresses.find((address) => address.id === primaryId) || addresses[0];
  return primary?.email_address?.toLowerCase().trim() || null;
}

function getDisplayName(data) {
  return [data.first_name, data.last_name].filter(Boolean).join(' ')
    || data.username
    || (data.email_addresses?.[0]?.email_address ? data.email_addresses[0].email_address.split('@')[0] : '')
    || 'Mindcraft learner';
}

function identityFields(data) {
  const email = getPrimaryEmail(data) || (data.id ? `${data.id}@clerk.internal` : `user_${Date.now()}@clerk.internal`);

  return {
    clerkUserId: data.id,
    email,
    name: getDisplayName(data),
    photoUrl: data.image_url || data.profile_image_url || null,
  };
}

async function findUserByIdentity(fields) {
  const byClerkId = await prisma.user.findUnique({
    where: { clerkUserId: fields.clerkUserId },
  });
  if (byClerkId) return byClerkId;

  return prisma.user.findFirst({
    where: {
      email: {
        equals: fields.email,
        mode: 'insensitive',
      },
    },
  });
}

async function updateExistingUser(existing, fields) {
  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...fields,
      deletedAt: null,
    },
  });
  await safeInvalidate(updated.id, fields.clerkUserId, existing.clerkUserId);
  return updated;
}

async function syncCreatedUser(data) {
  const fields = identityFields(data);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const existing = await findUserByIdentity(fields);
      if (existing) {
        const updated = await updateExistingUser(existing, fields);
        console.log(`[Clerk Webhook] Updated existing user: ${fields.clerkUserId}`);
        return updated;
      }

      const created = await prisma.user.create({ data: fields });
      console.log(`[Clerk Webhook] Created new user with clerkUserId: ${fields.clerkUserId}`);
      await safeInvalidate(created.id, fields.clerkUserId);
      return created;
    } catch (err) {
      if (!['P2002', 'P2025', 'P2034'].includes(err.code) || attempt === 2) {
        console.error(`[Clerk Webhook] Failed to sync user ${fields.clerkUserId}:`, err.message);
        throw err;
      }

      const racedUser = await findUserByIdentity(fields);
      if (racedUser) {
        try {
          return await updateExistingUser(racedUser, fields);
        } catch (retryErr) {
          if (!['P2025', 'P2002', 'P2034'].includes(retryErr.code) || attempt === 2) {
            console.error(`[Clerk Webhook] Failed to resolve user race ${fields.clerkUserId}:`, retryErr.message);
            throw retryErr;
          }
        }
      }
    }
  }

  throw new Error(`Unable to synchronize Clerk user ${fields.clerkUserId}`);
}

async function syncUpdatedUser(data) {
  const fields = identityFields(data);
  try {
    const existing = await prisma.user.findUnique({
      where: { clerkUserId: fields.clerkUserId },
    });
    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          ...fields,
          deletedAt: null,
        },
      });
      console.log(`[Clerk Webhook] Updated user ${fields.clerkUserId}`);
      await safeInvalidate(updated.id, fields.clerkUserId, existing.clerkUserId);
      return updated;
    }
    return syncCreatedUser(data);
  } catch (err) {
    console.error(`[Clerk Webhook] Failed to update user ${fields.clerkUserId}:`, err.message);
    throw err;
  }
}

async function deactivateUser(data) {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: data.id },
    });
    if (!user) return null;
    const deleted = await prisma.user.update({
      where: { id: user.id },
      data: {
        deletedAt: new Date(),
        profileComplete: false,
      },
    });
    console.log(`[Clerk Webhook] Deactivated user ${data.id}`);
    await safeInvalidate(deleted.id, deleted.clerkUserId);
    return deleted;
  } catch (err) {
    console.error(`[Clerk Webhook] Failed to deactivate user ${data.id}:`, err.message);
    throw err;
  }
}

async function processClerkEvent(event) {
  switch (event.type) {
    case 'user.created':
      return syncCreatedUser(event.data);
    case 'user.updated':
      return syncUpdatedUser(event.data);
    case 'user.deleted':
      return deactivateUser(event.data);
    default:
      return null;
  }
}

module.exports = {
  processClerkEvent,
  identityFields,
  getPrimaryEmail,
  getDisplayName,
};
