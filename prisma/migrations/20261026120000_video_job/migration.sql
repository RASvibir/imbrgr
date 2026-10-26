-- CreateTable
CREATE TABLE "VideoJob" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "input" JSONB NOT NULL,
    "shots" JSONB NOT NULL,
    "nextShot" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoJob_ownerKey_createdAt_idx" ON "VideoJob"("ownerKey", "createdAt");

-- CreateIndex
CREATE INDEX "VideoJob_userId_idx" ON "VideoJob"("userId");

-- AddForeignKey
ALTER TABLE "VideoJob" ADD CONSTRAINT "VideoJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

