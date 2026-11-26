#!/usr/bin/env node
/**
 * cleanTestUsers.js — Safely wipes test user records from PostgreSQL
 *
 * Deletes all user-generated records (chats, sessions, doubts, tokens, badges, user skills, users)
 * while strictly preserving master seeded taxonomy (Colleges, Departments, Skills, Badges).
 *
 * Safety requirement: must be run with `--confirm`.
 */

require('dotenv').config();
const { prisma, disconnectPrisma } = require('../src/config/prisma');

async function cleanTestUsers(options = {}) {
  const isConfirmed = options.confirm || process.argv.includes('--confirm');

  if (!isConfirmed) {
    console.error('\n⚠️  SAFETY GUARD: You must pass --confirm to execute this script.');
    console.error('   Usage: node scripts/cleanTestUsers.js --confirm\n');
    if (options.throwOnMissingConfirm) {
      throw new Error('Missing --confirm flag');
    }
    process.exit(1);
  }

  console.log('\n🧹 Starting cleanTestUsers wipe...');

  try {
    const deletedCounts = await prisma.$transaction(async (tx) => {
      // 1. Delete dependent messages and participants
      const chatMessages = await tx.chatMessage.deleteMany({});
      const chatParticipants = await tx.chatParticipant.deleteMany({});

      // 2. Delete tutoring sessions and threads
      const tutoringSessions = await tx.tutoringSession.deleteMany({});
      const chatThreads = await tx.chatThread.deleteMany({});
      const matchRequests = await tx.matchRequest.deleteMany({});

      // 3. Delete doubts and interactions
      const doubtVotes = await tx.doubtVote.deleteMany({});
      const doubtImages = await tx.doubtImage.deleteMany({});
      const doubtTagAssignments = await tx.doubtTagAssignment.deleteMany({});
      const doubtAnswers = await tx.doubtAnswer.deleteMany({});
      const doubts = await tx.doubt.deleteMany({});

      // 4. Delete tokens, activity, badges, user skills
      const tokenTransactions = await tx.tokenTransaction.deleteMany({});
      const activityDays = await tx.activityDay.deleteMany({});
      const userBadges = await tx.userBadge.deleteMany({});
      const userSkills = await tx.userSkill.deleteMany({});

      // 5. Delete users
      const users = await tx.user.deleteMany({});

      return {
        chatMessages: chatMessages.count,
        chatParticipants: chatParticipants.count,
        tutoringSessions: tutoringSessions.count,
        chatThreads: chatThreads.count,
        matchRequests: matchRequests.count,
        doubtVotes: doubtVotes.count,
        doubtImages: doubtImages.count,
        doubtTagAssignments: doubtTagAssignments.count,
        doubtAnswers: doubtAnswers.count,
        doubts: doubts.count,
        tokenTransactions: tokenTransactions.count,
        activityDays: activityDays.count,
        userBadges: userBadges.count,
        userSkills: userSkills.count,
        users: users.count,
      };
    });

    console.log('\n✅ User-generated data successfully wiped:');
    console.table(deletedCounts);

    // Verify master seeded data is intact
    const [collegeCount, departmentCount, skillCount, badgeCount] = await Promise.all([
      prisma.college.count(),
      prisma.department.count(),
      prisma.skill.count(),
      prisma.badge.count(),
    ]);

    console.log('🏛️  Master Seed Data Preserved:');
    console.log(`   Colleges:    ${collegeCount}`);
    console.log(`   Departments: ${departmentCount}`);
    console.log(`   Skills:      ${skillCount}`);
    console.log(`   Badges:      ${badgeCount}\n`);

    return { success: true, deletedCounts, preserved: { collegeCount, departmentCount, skillCount, badgeCount } };
  } catch (error) {
    console.error('❌ Failed to clean test users:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

if (require.main === module) {
  cleanTestUsers().catch(() => {
    process.exit(1);
  });
}

module.exports = { cleanTestUsers };
