-- AlterTable: Add username column to users table
-- First add as nullable, backfill from email prefix, then make NOT NULL + UNIQUE

ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- Backfill existing users: use the part before @ in email as username
UPDATE "users" SET "username" = LOWER(REPLACE(SPLIT_PART("email", '@', 1), '.', ''));

-- Now make it required and unique
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "users"("username");
