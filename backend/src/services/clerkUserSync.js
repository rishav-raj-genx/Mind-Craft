const { prisma } = require('../config/prisma');

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

async function syncCreatedUser(data) {
  const fields = identityFields(data);
  try {
    const existingByClerkId = await prisma.user.findUnique({
      where: { clerkUserId: fields.clerkUserId },
    });
    if (existingByClerkId) {
      const updated = await prisma.user.update({
        where: { id: existingByClerkId.id },
        data: fields,
      });
      console.log(`[Clerk Webhook] Updated existing user by clerkUserId: ${fields.clerkUserId}`);
      return updated;
    }

    const existingByEmail = await prisma.user.findUnique({
      where: { email: fields.email },
    });
    if (existingByEmail) {
      const updated = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: fields,
      });
      console.log(`[Clerk Webhook] Linked existing user by email: ${fields.email} to clerkUserId: ${fields.clerkUserId}`);
      return updated;
    }

    const created = await prisma.user.create({
      data: fields,
    });
    console.log(`[Clerk Webhook] Created new user with clerkUserId: ${fields.clerkUserId}`);
    return created;
  } catch (err) {
    console.error(`[Clerk Webhook] Failed to sync user ${fields.clerkUserId}:`, err.message);
    throw err;
  }
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
        data: fields,
      });
      console.log(`[Clerk Webhook] Updated user ${fields.clerkUserId}`);
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
      data: { deletedAt: new Date() },
    });
    console.log(`[Clerk Webhook] Deactivated user ${data.id}`);
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
