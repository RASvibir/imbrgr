-- AlterEnum
ALTER TYPE "LibraryAssetKind" ADD VALUE 'LOGO';

-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "userId" TEXT,
    "voterKey" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "styleLock" TEXT,
    "paletteJson" JSONB,
    "typographyLock" TEXT,
    "stylePreset" TEXT,
    "logoSafeZone" TEXT NOT NULL DEFAULT 'BOTTOM_RIGHT',
    "logoMediaId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandKit_shortId_key" ON "BrandKit"("shortId");
CREATE INDEX "BrandKit_userId_idx" ON "BrandKit"("userId");
CREATE INDEX "BrandKit_voterKey_idx" ON "BrandKit"("voterKey");

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
