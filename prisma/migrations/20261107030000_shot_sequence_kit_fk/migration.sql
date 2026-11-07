-- AddForeignKey
ALTER TABLE "ShotSequence" ADD CONSTRAINT "ShotSequence_kitShortId_fkey" FOREIGN KEY ("kitShortId") REFERENCES "CharacterKit"("shortId") ON DELETE SET NULL ON UPDATE CASCADE;
