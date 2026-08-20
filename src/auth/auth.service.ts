// Auth service

import jwt from "jsonwebtoken";
import { env } from "../config/config.ts";
import { refreshTokenRepository } from "../auth/refresh-token.repository.ts";
import { prisma } from "../lib/prisma.ts";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: "15m",
  });
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  async signup(email: string, password: string, name: string, role = "ATTENDEE"): Promise<AuthTokens> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error("User already exists");
    }

    const passwordHash = hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role },
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const { token: refreshToken } = await refreshTokenRepository.create(user.id);

    return { accessToken, refreshToken };
  },

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error("Invalid credentials");
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const { token: refreshToken } = await refreshTokenRepository.create(user.id);

    return { accessToken, refreshToken };
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("base64url");
    const stored = await refreshTokenRepository.findByHash(tokenHash);

    if (!stored || !(await refreshTokenRepository.isValid(tokenHash))) {
      throw new Error("Invalid refresh token");
    }

    if (stored.revokedAt && stored.replacedById) {
      await refreshTokenRepository.revokeAllForUser(stored.userId);
      throw new Error("Token reuse detected");
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      throw new Error("User not found");
    }

    const { token: newRefreshToken } = await refreshTokenRepository.revokeAndReplace(tokenHash, user.id);
    const accessToken = generateAccessToken(user.id, user.role);

    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("base64url");
    const stored = await refreshTokenRepository.findByHash(tokenHash);
    if (stored) {
      await refreshTokenRepository.revokeAllForUser(stored.userId);
    }
  },
};