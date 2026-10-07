-- New accounts default to public gallery posts unless they change settings.
ALTER TABLE "User" ALTER COLUMN "defaultPostVisibility" SET DEFAULT 'PUBLIC';
-- Existing rows still had the old column default (UNLISTED), not an explicit user choice.
UPDATE "User" SET "defaultPostVisibility" = 'PUBLIC' WHERE "defaultPostVisibility" = 'UNLISTED';
