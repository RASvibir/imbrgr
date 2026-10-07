-- AlterTable
ALTER TABLE "Media" ADD COLUMN "rootMediaId" TEXT;

-- CreateTable
CREATE TABLE "LibraryFolder" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "voterKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibrarySave" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "folderId" TEXT,
    "userId" TEXT,
    "voterKey" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "label" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibrarySave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryFolder_shortId_key" ON "LibraryFolder"("shortId");
CREATE INDEX "LibraryFolder_userId_idx" ON "LibraryFolder"("userId");
CREATE INDEX "LibraryFolder_voterKey_idx" ON "LibraryFolder"("voterKey");

CREATE UNIQUE INDEX "LibrarySave_shortId_key" ON "LibrarySave"("shortId");
CREATE INDEX "LibrarySave_userId_idx" ON "LibrarySave"("userId");
CREATE INDEX "LibrarySave_voterKey_idx" ON "LibrarySave"("voterKey");
CREATE INDEX "LibrarySave_folderId_idx" ON "LibrarySave"("folderId");
CREATE INDEX "LibrarySave_mediaId_idx" ON "LibrarySave"("mediaId");

CREATE INDEX "Media_rootMediaId_idx" ON "Media"("rootMediaId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_rootMediaId_fkey" FOREIGN KEY ("rootMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LibraryFolder" ADD CONSTRAINT "LibraryFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibrarySave" ADD CONSTRAINT "LibrarySave_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibrarySave" ADD CONSTRAINT "LibrarySave_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "LibraryFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LibrarySave" ADD CONSTRAINT "LibrarySave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill locked roots
UPDATE "Media" SET "rootMediaId" = "id" WHERE "parentMediaId" IS NULL;
UPDATE "Media" m SET "rootMediaId" = COALESCE(p."rootMediaId", p."id")
FROM "Media" p WHERE m."parentMediaId" = p."id" AND m."rootMediaId" IS NULL;
