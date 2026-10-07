-- Thumbnails & placeholders
ALTER TABLE "Media" ADD COLUMN "thumbSmKey" TEXT;
ALTER TABLE "Media" ADD COLUMN "thumbMdKey" TEXT;
ALTER TABLE "Media" ADD COLUMN "placeholderCss" TEXT;

-- Remix lineage
ALTER TABLE "Post" ADD COLUMN "remixedFromPostId" TEXT;
CREATE INDEX "Post_remixedFromPostId_idx" ON "Post"("remixedFromPostId");
ALTER TABLE "Post" ADD CONSTRAINT "Post_remixedFromPostId_fkey" FOREIGN KEY ("remixedFromPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hot listing (denormalized; refreshed on engagement)
ALTER TABLE "Post" ADD COLUMN "hotScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE INDEX "Post_hot_public_idx" ON "Post"("hotScore" DESC, "createdAt" DESC) WHERE "visibility" = 'PUBLIC' AND "hiddenByAdmin" = false;

-- Collections
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'UNLISTED',
    "coverPostId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Collection_shortId_key" ON "Collection"("shortId");
CREATE INDEX "Collection_userId_idx" ON "Collection"("userId");
CREATE INDEX "Collection_visibility_idx" ON "Collection"("visibility");

ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CollectionPost" (
    "collectionId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionPost_pkey" PRIMARY KEY ("collectionId","postId")
);

CREATE INDEX "CollectionPost_postId_idx" ON "CollectionPost"("postId");
ALTER TABLE "CollectionPost" ADD CONSTRAINT "CollectionPost_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionPost" ADD CONSTRAINT "CollectionPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reports: polymorphic targets + visitor dedupe
ALTER TABLE "Report" ADD COLUMN "targetType" TEXT NOT NULL DEFAULT 'POST';
ALTER TABLE "Report" ADD COLUMN "targetId" TEXT;
ALTER TABLE "Report" ADD COLUMN "voterKey" TEXT;
UPDATE "Report" SET "targetId" = "postId" WHERE "targetId" IS NULL;
ALTER TABLE "Report" ALTER COLUMN "targetId" SET NOT NULL;
ALTER TABLE "Report" ALTER COLUMN "postId" DROP NOT NULL;

CREATE UNIQUE INDEX "Report_target_voter_key" ON "Report"("targetType", "targetId", "voterKey");
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
