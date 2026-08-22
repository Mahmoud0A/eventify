-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_replacedById_key" ON "RefreshToken"("replacedById");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
