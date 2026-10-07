-- New accounts default to public gallery posts unless they change settings.
ALTER TABLE "User" ALTER COLUMN "defaultPostVisibility" SET DEFAULT 'PUBLIC';
