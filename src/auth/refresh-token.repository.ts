// Refresh token repository

import { prisma } from "../lib/prisma.ts";
import crypto from "crypto";

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export const refreshTokenRepository = {
  async create(userId: string, expiresInDays = 30): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { token, tokenHash, expiresAt };
  },

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const token = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!token) return null;
    return {
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      replacedById: token.replacedById,
    };
  },

  async revokeAndReplace(
    oldTokenHash: string,
    newUserId: string,
    expiresInDays = 30
  ): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
    const newToken = generateToken();
    const newTokenHash = hashToken(newToken);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { tokenHash: oldTokenHash },
        data: {
          revokedAt: new Date(),
          replacedById: newTokenHash,
        },
      });

      await tx.refreshToken.create({
        data: {
          userId: newUserId,
          tokenHash: newTokenHash,
          expiresAt,
        },
      });
    });

    return { token: newToken, tokenHash: newTokenHash, expiresAt };
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async isValid(tokenHash: string): Promise<boolean> {
    const token = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!token) return false;
    if (token.revokedAt) return false;
    if (token.expiresAt < new Date()) return false;
    return true;
  },
};