/**
 * userResolver.js — Unified User Resolution & Auto-Provisioning Helper
 *
 * Resolves user records across all routes supporting either Clerk ID (`user_...`)
 * or internal PostgreSQL UUID, and auto-provisions newly verified Clerk accounts.
 */

const { prisma } = require('../config/prisma');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

/**
 * Resolves a user record by Clerk ID or Prisma UUID.
 *
 * @param {string} identifier - Clerk userId (e.g. 'user_...') or UUID
 * @param {object} [options] - Optional query parameters (e.g. include, includeDeleted)
 * @returns {Promise<object|null>}
 */
async function resolveUser(identifier, options = {}) {
  if (!identifier) return null;
  if (typeof identifier === 'object' && identifier.id && identifier.clerkUserId) {
    return identifier;
  }

  const cleanId = String(identifier).trim();
  const isIdUuid = isUuid(cleanId);

  if (prisma.user?.findFirst) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { clerkUserId: cleanId },
          ...(isIdUuid ? [{ id: cleanId }] : []),
        ],
        ...(options.includeDeleted ? {} : { deletedAt: null }),
      },
      include: options.include,
    });
    return user;
  }

  if (prisma.user?.findUnique) {
    const where = isIdUuid ? { id: cleanId } : { clerkUserId: cleanId };
    const user = await prisma.user.findUnique({
      where,
      include: options.include,
    });
    if (user && (!user.deletedAt || options.includeDeleted)) return user;
  }

  return null;

  return null;
}

/**
 * Auto-provisions a database user for an authenticated Clerk session if not yet present.
 *
 * @param {string} clerkUserId - Verified Clerk User ID
 * @param {object} [claims] - Decoded JWT claims
 * @param {object} [profileData] - Additional user profile data from request
 * @returns {Promise<object>}
 */
async function autoProvisionUser(clerkUserId, claims = {}, profileData = {}) {
  if (!clerkUserId) {
    throw new Error('clerkUserId is required to auto-provision user');
  }

  // Check if user already exists
  const existing = await resolveUser(clerkUserId, { includeDeleted: true, include: { college: true, department: true } });
  if (existing) {
    return existing;
  }

  let clerkUser = null;
  try {
    const { clerkClient } = require('../config/clerk');
    if (clerkClient?.users?.getUser) {
      clerkUser = await clerkClient.users.getUser(clerkUserId);
    }
  } catch (_err) {
    // Graceful fallback for offline / test environments
  }

  const primaryEmail =
    profileData.email ||
    clerkUser?.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    claims.email ||
    `${clerkUserId}@clerk.internal`;

  const cleanEmail = String(primaryEmail).toLowerCase().trim();

  const displayName =
    profileData.name ||
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
    clerkUser?.username ||
    claims.name ||
    (cleanEmail ? cleanEmail.split('@')[0] : 'Mindcraft learner');

  const photoUrl =
    profileData.photoUrl ||
    clerkUser?.imageUrl ||
    claims.picture ||
    '';

  // Check if an existing row matches this email (e.g. from prior invite or manual seed)
  if (prisma.user?.findFirst) {
    const existingByEmail = await prisma.user.findFirst({
      where: { email: cleanEmail, deletedAt: null },
      include: { college: true, department: true },
    });
    if (existingByEmail) {
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: { clerkUserId },
        include: { college: true, department: true },
      });
    }
  }

  if (prisma.user?.upsert) {
    try {
      return await prisma.user.upsert({
        where: { clerkUserId },
        create: {
          clerkUserId,
          email: cleanEmail,
          name: displayName,
          photoUrl,
          profileComplete: Boolean(profileData.profileComplete),
        },
        update: {
          ...(displayName ? { name: displayName } : {}),
          ...(photoUrl ? { photoUrl } : {}),
          ...(profileData.profileComplete ? { profileComplete: true } : {}),
        },
        include: { college: true, department: true },
      });
    } catch (upsertErr) {
      if (upsertErr.code === 'P2002') {
        const fallbackEmail = `${clerkUserId}_${Date.now()}@clerk.internal`;
        return await prisma.user.upsert({
          where: { clerkUserId },
          create: {
            clerkUserId,
            email: fallbackEmail,
            name: displayName,
            photoUrl,
            profileComplete: Boolean(profileData.profileComplete),
          },
          update: {
            ...(displayName ? { name: displayName } : {}),
            ...(photoUrl ? { photoUrl } : {}),
            ...(profileData.profileComplete ? { profileComplete: true } : {}),
          },
          include: { college: true, department: true },
        });
      }
      throw upsertErr;
    }
  }

  if (prisma.user?.create) {
    return prisma.user.create({
      data: {
        clerkUserId,
        email: cleanEmail,
        name: displayName,
        photoUrl,
        profileComplete: Boolean(profileData.profileComplete),
      },
      include: { college: true, department: true },
    });
  }

  return null;
}

module.exports = {
  isUuid,
  resolveUser,
  autoProvisionUser,
};
