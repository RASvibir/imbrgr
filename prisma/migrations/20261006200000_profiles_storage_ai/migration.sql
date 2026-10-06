-- AlterTable
ALTER TABLE "User" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "avatarKey" TEXT,
ADD COLUMN     "bannerKey" TEXT,
ADD COLUMN     "links" JSONB,
ADD COLUMN     "favoritesPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "storageBytesUsed" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiPrompt" TEXT;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "userId" TEXT,
ADD COLUMN     "parentMediaId" TEXT,
ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiPrompt" TEXT,
ALTER COLUMN "postId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AnonymousStorage" (
    "voterKey" TEXT NOT NULL,
    "bytesUsed" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "AnonymousStorage_pkey" PRIMARY KEY ("voterKey")
);

-- CreateTable
CREATE TABLE "AiGenerationUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiGenerationUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_userId_idx" ON "Post"("userId");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE INDEX "Media_userId_idx" ON "Media"("userId");

-- CreateIndex
CREATE INDEX "Media_parentMediaId_idx" ON "Media"("parentMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "AiGenerationUsage_userId_day_key" ON "AiGenerationUsage"("userId", "day");

-- CreateIndex
CREATE INDEX "AiGenerationUsage_userId_idx" ON "AiGenerationUsage"("userId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_parentMediaId_fkey" FOREIGN KEY ("parentMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGenerationUsage" ADD CONSTRAINT "AiGenerationUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
