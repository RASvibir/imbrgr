-- AlterTable
ALTER TABLE "Media" ADD COLUMN "aiEdited" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AiPromptCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "enhancedPrompt" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPromptCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiPromptCache_cacheKey_key" ON "AiPromptCache"("cacheKey");

-- CreateIndex
CREATE INDEX "AiPromptCache_lastUsedAt_idx" ON "AiPromptCache"("lastUsedAt");
