-- CreateTable
CREATE TABLE "ShotSequence" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "userId" TEXT,
    "voterKey" TEXT,
    "title" TEXT NOT NULL,
    "look" TEXT,
    "narration" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "stylePreset" TEXT,
    "kitShortId" TEXT,
    "beats" JSONB NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShotSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShotSequence_shortId_key" ON "ShotSequence"("shortId");

-- CreateIndex
CREATE INDEX "ShotSequence_userId_idx" ON "ShotSequence"("userId");

-- CreateIndex
CREATE INDEX "ShotSequence_voterKey_idx" ON "ShotSequence"("voterKey");

-- CreateIndex
CREATE INDEX "ShotSequence_kitShortId_idx" ON "ShotSequence"("kitShortId");

-- AddForeignKey
ALTER TABLE "ShotSequence" ADD CONSTRAINT "ShotSequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
