-- CreateEnum
CREATE TYPE "LibraryAssetKind" AS ENUM ('GENERAL', 'CHARACTER', 'PROP', 'BACKGROUND', 'OTHER');

-- AlterTable
ALTER TABLE "LibrarySave" ADD COLUMN "kind" "LibraryAssetKind" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "CharacterKit" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "userId" TEXT,
    "voterKey" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "styleLock" TEXT,
    "paletteJson" JSONB,
    "stylePreset" TEXT,
    "coverMediaId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterKitRef" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'REFERENCE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterKitRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CharacterKit_shortId_key" ON "CharacterKit"("shortId");
CREATE INDEX "CharacterKit_userId_idx" ON "CharacterKit"("userId");
CREATE INDEX "CharacterKit_voterKey_idx" ON "CharacterKit"("voterKey");

CREATE UNIQUE INDEX "CharacterKitRef_kitId_mediaId_key" ON "CharacterKitRef"("kitId", "mediaId");
CREATE INDEX "CharacterKitRef_mediaId_idx" ON "CharacterKitRef"("mediaId");

CREATE INDEX "LibrarySave_kind_idx" ON "LibrarySave"("kind");

-- AddForeignKey
ALTER TABLE "CharacterKit" ADD CONSTRAINT "CharacterKit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterKit" ADD CONSTRAINT "CharacterKit_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CharacterKitRef" ADD CONSTRAINT "CharacterKitRef_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "CharacterKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterKitRef" ADD CONSTRAINT "CharacterKitRef_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
