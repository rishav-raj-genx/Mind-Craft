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
    || 'Mindcraft learner';
}

function identityFields(data) {
  const email = getPrimaryEmail(data);
  if (!email) {
    throw Object.assign(new Error('Clerk user has no email address'), { statusCode: 422 });
  }

  return {
    clerkUserId: data.id,
    email,
    name: getDisplayName(data),
    photoUrl: data.image_url || null,
  };
}

async function syncCreatedUser(data) {
  const fields = identityFields(data);
  return prisma.user.upsert({
    where: { clerkUserId: fields.clerkUserId },
    create: fields,
    update: fields,
  });
}

async function syncUpdatedUser(data) {
  const fields = identityFields(data);
  return prisma.user.update({
    where: { clerkUserId: fields.clerkUserId },
    data: fields,
  }).catch(async (error) => {
    if (error.code !== 'P2025') throw error;
    return syncCreatedUser(data);
  });
}

async function deactivateUser(data) {
  return prisma.user.update({
    where: { clerkUserId: data.id },
    data: { deletedAt: new Date() },
  }).catch(async (error) => {
    if (error.code === 'P2025') return null;
    throw error;
  });
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
};
