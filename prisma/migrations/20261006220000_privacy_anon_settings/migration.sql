-- User default visibility
ALTER TABLE "User" ADD COLUMN "defaultPostVisibility" TEXT NOT NULL DEFAULT 'UNLISTED';

-- Media metadata & anonymous ownership
ALTER TABLE "Media" ADD COLUMN "voterKey" TEXT;
ALTER TABLE "Media" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'UNLISTED';
ALTER TABLE "Media" ADD COLUMN "altText" TEXT;
ALTER TABLE "Media" ADD COLUMN "mature" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Media" ADD COLUMN "deleteTokenHash" TEXT;

CREATE INDEX "Media_voterKey_idx" ON "Media"("voterKey");
CREATE INDEX "Media_visibility_idx" ON "Media"("visibility");

-- Migrate legacy HIDDEN posts to PRIVATE
UPDATE "Post" SET "visibility" = 'PRIVATE' WHERE "visibility" = 'HIDDEN';

-- Anonymous AI usage by hashed IP
CREATE TABLE "AiAnonymousUsage" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiAnonymousUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiAnonymousUsage_ipHash_day_key" ON "AiAnonymousUsage"("ipHash", "day");
CREATE INDEX "AiAnonymousUsage_ipHash_idx" ON "AiAnonymousUsage"("ipHash");

-- Simple API rate limits
CREATE TABLE "ApiRateLimit" (
    "bucketKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiRateLimit_pkey" PRIMARY KEY ("bucketKey")
);
