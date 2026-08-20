/*
  Warnings:

  - Added the required column 'passwordHash' to the 'User' table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add passwordHash as nullable first
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- Update existing users with a placeholder hash (they'll need to reset password)
UPDATE "User" SET "passwordHash" = '\\\' WHERE "passwordHash" IS NULL;

-- Now make it NOT NULL
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;