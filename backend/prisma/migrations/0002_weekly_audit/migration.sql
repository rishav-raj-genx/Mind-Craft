-- CreateEnum
CREATE TYPE "WeeklyAuditStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "emoji" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "userId" UUID NOT NULL,
    "badgeId" TEXT NOT NULL,
    "auditWeek" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("userId","badgeId","auditWeek")
);

-- CreateTable
CREATE TABLE "WeeklyAuditRun" (
    "id" UUID NOT NULL,
    "weekKey" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "status" "WeeklyAuditStatus" NOT NULL DEFAULT 'RUNNING',
    "usersScanned" INTEGER NOT NULL DEFAULT 0,
    "usersEvaluated" INTEGER NOT NULL DEFAULT 0,
    "winners" INTEGER NOT NULL DEFAULT 0,
    "newlyAwarded" INTEGER NOT NULL DEFAULT 0,
    "lastUserId" UUID,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeeklyAuditRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyAuditRun_weekKey_key" ON "WeeklyAuditRun"("weekKey");
CREATE INDEX "UserBadge_userId_awardedAt_idx" ON "UserBadge"("userId", "awardedAt");
CREATE INDEX "UserBadge_badgeId_auditWeek_idx" ON "UserBadge"("badgeId", "auditWeek");
CREATE INDEX "WeeklyAuditRun_status_updatedAt_idx" ON "WeeklyAuditRun"("status", "updatedAt");

ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey"
  FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
