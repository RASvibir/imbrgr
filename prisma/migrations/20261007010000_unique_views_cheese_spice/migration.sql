-- Unique viewers (PostView ledger) + cheese/spice engagement heat.
-- Legacy Post.viewCount was incremented on every page hit; reset so counts reflect
-- unique viewers recorded in PostView going forward.

ALTER TABLE "Post" ADD COLUMN "spiceScore" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PostView" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "voterKey" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostView_postId_voterKey_key" ON "PostView"("postId", "voterKey");
CREATE INDEX "PostView_postId_idx" ON "PostView"("postId");

ALTER TABLE "PostView" ADD CONSTRAINT "PostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Post" SET "viewCount" = 0, "spiceScore" = 0;
