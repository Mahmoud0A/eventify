// Auth controller

import { Request, Response } from "express";
import { authService, AuthTokens } from "../auth/auth.service.ts";
import { AppError } from "../middleware/error.ts";

function setRefreshCookie(res: Response, token: string): void {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/v1/auth/refresh",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/v1/auth/refresh",
  });
}

export const authController = {
  async signup(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name, role } = req.body;
      const tokens = await authService.signup(email, password, name, role);
      setRefreshCookie(res, tokens.refreshToken);
      res.status(201).json({ accessToken: tokens.accessToken });
    } catch (error) {
      if (error instanceof Error && error.message === "User already exists") {
        throw new AppError(409, "Email already registered");
      }
      throw error;
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const tokens = await authService.login(email, password);
      setRefreshCookie(res, tokens.refreshToken);
      res.json({ accessToken: tokens.accessToken });
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid credentials") {
        throw new AppError(401, "Invalid credentials");
      }
      throw error;
    }
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new AppError(401, "Refresh token required");
    }

    try {
      const tokens = await authService.refresh(refreshToken);
      setRefreshCookie(res, tokens.refreshToken);
      res.json({ accessToken: tokens.accessToken });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Token reuse detected" || error.message === "Invalid refresh token") {
          throw new AppError(401, "Invalid token");
        }
      }
      throw error;
    }
  },

  async logout(req: Request, res: Response): Promise<void> {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    clearRefreshCookie(res);
    res.status(204).send();
  },
};