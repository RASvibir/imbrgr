-- Additive archive tables for account-deletion and moderation retention (not served publicly).
CREATE TABLE "ArchivedPost" (
    "id" TEXT NOT NULL,
    "originalPostId" TEXT NOT NULL,
    "originalShortId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerUsername" TEXT,
    "ownerEmail" TEXT,
    "reason" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "ArchivedPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArchivedMedia" (
    "id" TEXT NOT NULL,
    "archivedPostId" TEXT,
    "originalMediaId" TEXT NOT NULL,
    "originalShortId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerUsername" TEXT,
    "reason" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    "storageKey" TEXT NOT NULL,
    "thumbSmKey" TEXT,
    "thumbMdKey" TEXT,

    CONSTRAINT "ArchivedMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArchivedPost_originalShortId_idx" ON "ArchivedPost"("originalShortId");
CREATE INDEX "ArchivedPost_originalPostId_idx" ON "ArchivedPost"("originalPostId");
CREATE INDEX "ArchivedPost_ownerUserId_idx" ON "ArchivedPost"("ownerUserId");
CREATE INDEX "ArchivedPost_deletedAt_idx" ON "ArchivedPost"("deletedAt");

CREATE INDEX "ArchivedMedia_originalShortId_idx" ON "ArchivedMedia"("originalShortId");
CREATE INDEX "ArchivedMedia_originalMediaId_idx" ON "ArchivedMedia"("originalMediaId");
CREATE INDEX "ArchivedMedia_archivedPostId_idx" ON "ArchivedMedia"("archivedPostId");
CREATE INDEX "ArchivedMedia_deletedAt_idx" ON "ArchivedMedia"("deletedAt");

ALTER TABLE "ArchivedMedia" ADD CONSTRAINT "ArchivedMedia_archivedPostId_fkey" FOREIGN KEY ("archivedPostId") REFERENCES "ArchivedPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
