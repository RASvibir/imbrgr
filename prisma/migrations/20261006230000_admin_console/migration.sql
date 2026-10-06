-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');

-- User admin fields
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "storageQuotaBytesOverride" BIGINT;
ALTER TABLE "User" ADD COLUMN "aiDailyLimitOverride" INTEGER;

UPDATE "User" SET "role" = 'SUPERADMIN' WHERE LOWER("username") = 'vibir';

-- Reports moderation
ALTER TABLE "Report" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Report" ADD COLUMN "resolvedAt" TIMESTAMP(3);
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- Content moderation flags
ALTER TABLE "Post" ADD COLUMN "hiddenByAdmin" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Post_hiddenByAdmin_idx" ON "Post"("hiddenByAdmin");

-- Site settings (singleton)
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "anonymousUploadsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "anonymousAiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "anonAiDailyLimit" INTEGER,
    "announcementBanner" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SiteSetting" ("id", "anonymousUploadsEnabled", "anonymousAiEnabled", "updatedAt")
VALUES ('global', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Admin audit log
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_actorUserId_idx" ON "AdminAuditLog"("actorUserId");
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
