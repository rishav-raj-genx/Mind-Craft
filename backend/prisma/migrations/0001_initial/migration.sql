-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SkillKind" AS ENUM ('TEACHES', 'LEARNS');

-- CreateEnum
CREATE TYPE "DoubtStatus" AS ENUM ('ACTIVE', 'CLOSED', 'DELETED');

-- CreateEnum
CREATE TYPE "AiAssistStatus" AS ENUM ('SKIPPED', 'GENERATED', 'FALLBACK', 'FAILED', 'EMPTY');

-- CreateEnum
CREATE TYPE "ChatParticipantRole" AS ENUM ('MEMBER', 'OWNER');

-- CreateEnum
CREATE TYPE "MatchRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'UPCOMING', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('ONLINE', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "TokenTransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "bannerUrl" TEXT,
    "gender" TEXT,
    "collegeId" UUID,
    "collegeLocation" TEXT,
    "departmentId" UUID,
    "year" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "lastLocationUpdate" TIMESTAMP(3),
    "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "mindTokens" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "totalActiveDays" INTEGER NOT NULL DEFAULT 0,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "College" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "College_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkill" (
    "userId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "kind" "SkillKind" NOT NULL,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("userId","skillId","kind")
);

-- CreateTable
CREATE TABLE "Doubt" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "primaryTag" TEXT,
    "status" "DoubtStatus" NOT NULL DEFAULT 'ACTIVE',
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,
    "answerCount" INTEGER NOT NULL DEFAULT 0,
    "aiHint" TEXT,
    "aiAssistProvider" TEXT,
    "aiAssistModel" TEXT,
    "aiAssistStatus" "AiAssistStatus" NOT NULL DEFAULT 'SKIPPED',
    "aiAssistUsage" JSONB,
    "aiAssistGeneratedAt" TIMESTAMP(3),
    "aiAssistError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Doubt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoubtAnswer" (
    "id" UUID NOT NULL,
    "doubtId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DoubtAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoubtImage" (
    "id" UUID NOT NULL,
    "doubtId" UUID NOT NULL,
    "uploadedBy" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoubtImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoubtTag" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoubtTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoubtTagAssignment" (
    "doubtId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "DoubtTagAssignment_pkey" PRIMARY KEY ("doubtId","tagId")
);

-- CreateTable
CREATE TABLE "DoubtVote" (
    "doubtId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoubtVote_pkey" PRIMARY KEY ("doubtId","userId")
);

-- CreateTable
CREATE TABLE "MatchRequest" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "sharedSkill" TEXT NOT NULL,
    "status" "MatchRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "MatchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" UUID NOT NULL,
    "matchRequestId" UUID,
    "lastMessage" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastSenderId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatParticipant" (
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ChatParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "ChatParticipant_pkey" PRIMARY KEY ("threadId","userId")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "clientMessageId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutoringSession" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "learnerId" UUID NOT NULL,
    "threadId" UUID,
    "title" TEXT,
    "mode" "SessionMode" NOT NULL DEFAULT 'ONLINE',
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutoringSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "TokenTransactionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityDay" (
    "userId" UUID NOT NULL,
    "activityDate" DATE NOT NULL,
    "activityTypes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityDay_pkey" PRIMARY KEY ("userId","activityDate")
);

-- CreateTable
CREATE TABLE "ClerkWebhookEvent" (
    "id" UUID NOT NULL,
    "clerkEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClerkWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_collegeId_departmentId_idx" ON "User"("collegeId", "departmentId");

-- CreateIndex
CREATE INDEX "User_mindTokens_idx" ON "User"("mindTokens");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "College_name_key" ON "College"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE INDEX "Skill_name_idx" ON "Skill"("name");

-- CreateIndex
CREATE INDEX "UserSkill_skillId_kind_userId_idx" ON "UserSkill"("skillId", "kind", "userId");

-- CreateIndex
CREATE INDEX "UserSkill_userId_kind_idx" ON "UserSkill"("userId", "kind");

-- CreateIndex
CREATE INDEX "Doubt_status_createdAt_idx" ON "Doubt"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Doubt_primaryTag_createdAt_idx" ON "Doubt"("primaryTag", "createdAt");

-- CreateIndex
CREATE INDEX "Doubt_authorId_createdAt_idx" ON "Doubt"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "DoubtAnswer_doubtId_createdAt_idx" ON "DoubtAnswer"("doubtId", "createdAt");

-- CreateIndex
CREATE INDEX "DoubtAnswer_authorId_createdAt_idx" ON "DoubtAnswer"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "DoubtImage_doubtId_sortOrder_idx" ON "DoubtImage"("doubtId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DoubtTag_name_key" ON "DoubtTag"("name");

-- CreateIndex
CREATE INDEX "DoubtTagAssignment_tagId_doubtId_idx" ON "DoubtTagAssignment"("tagId", "doubtId");

-- CreateIndex
CREATE INDEX "DoubtVote_userId_createdAt_idx" ON "DoubtVote"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchRequest_recipientId_status_createdAt_idx" ON "MatchRequest"("recipientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MatchRequest_requesterId_status_createdAt_idx" ON "MatchRequest"("requesterId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MatchRequest_requesterId_recipientId_status_idx" ON "MatchRequest"("requesterId", "recipientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThread_matchRequestId_key" ON "ChatThread"("matchRequestId");

-- CreateIndex
CREATE INDEX "ChatThread_updatedAt_idx" ON "ChatThread"("updatedAt");

-- CreateIndex
CREATE INDEX "ChatParticipant_userId_joinedAt_idx" ON "ChatParticipant"("userId", "joinedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_id_idx" ON "ChatMessage"("threadId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_createdAt_idx" ON "ChatMessage"("senderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_senderId_clientMessageId_key" ON "ChatMessage"("senderId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "TutoringSession_completionKey_key" ON "TutoringSession"("completionKey");

-- CreateIndex
CREATE INDEX "TutoringSession_teacherId_status_scheduledFor_idx" ON "TutoringSession"("teacherId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "TutoringSession_learnerId_status_scheduledFor_idx" ON "TutoringSession"("learnerId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "TokenTransaction_userId_createdAt_idx" ON "TokenTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenTransaction_reason_idempotencyKey_idx" ON "TokenTransaction"("reason", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "TokenTransaction_userId_reason_idempotencyKey_key" ON "TokenTransaction"("userId", "reason", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ActivityDay_activityDate_idx" ON "ActivityDay"("activityDate");

-- CreateIndex
CREATE UNIQUE INDEX "ClerkWebhookEvent_clerkEventId_key" ON "ClerkWebhookEvent"("clerkEventId");

-- CreateIndex
CREATE INDEX "ClerkWebhookEvent_eventType_createdAt_idx" ON "ClerkWebhookEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doubt" ADD CONSTRAINT "Doubt_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubtAnswer" ADD CONSTRAINT "DoubtAnswer_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "Doubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubtAnswer" ADD CONSTRAINT "DoubtAnswer_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubtImage" ADD CONSTRAINT "DoubtImage_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "Doubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubtImage" ADD CONSTRAINT "DoubtImage_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubtTagAssignment" ADD CONSTRAINT "DoubtTagAssignment_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "Doubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubtTagAssignment" ADD CONSTRAINT "DoubtTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "DoubtTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubtVote" ADD CONSTRAINT "DoubtVote_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "Doubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubtVote" ADD CONSTRAINT "DoubtVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRequest" ADD CONSTRAINT "MatchRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRequest" ADD CONSTRAINT "MatchRequest_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_matchRequestId_fkey" FOREIGN KEY ("matchRequestId") REFERENCES "MatchRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_lastSenderId_fkey" FOREIGN KEY ("lastSenderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutoringSession" ADD CONSTRAINT "TutoringSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutoringSession" ADD CONSTRAINT "TutoringSession_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutoringSession" ADD CONSTRAINT "TutoringSession_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenTransaction" ADD CONSTRAINT "TokenTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityDay" ADD CONSTRAINT "ActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

