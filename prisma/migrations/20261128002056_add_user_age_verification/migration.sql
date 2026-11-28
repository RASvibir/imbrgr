-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_userId_fkey";

-- DropIndex
DROP INDEX "Post_hiddenByAdmin_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adultVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "birthDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Media_thumbSmKey_idx" ON "Media"("thumbSmKey");

-- CreateIndex
CREATE INDEX "Media_thumbMdKey_idx" ON "Media"("thumbMdKey");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Post_hot_public_idx" RENAME TO "Post_hotScore_createdAt_idx";

-- RenameIndex
ALTER INDEX "Report_target_voter_key" RENAME TO "Report_targetType_targetId_voterKey_key";
