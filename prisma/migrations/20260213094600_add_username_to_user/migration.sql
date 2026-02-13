-- AlterTable: Add username column to User table
-- First add as nullable, backfill from email prefix, then make NOT NULL + UNIQUE

ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill existing users: use the part before @ in email as username
UPDATE "User" SET "username" = LOWER(REPLACE(SPLIT_PART("email", '@', 1), '.', ''));

-- Now make it required and unique
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
