-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ATTENDEE', 'ORGANIZER', 'ADMIN');

-- AlterTable: TEXT -> ENUM with an explicit cast (data preserved)
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role"
  USING ("role"::text::"Role");
