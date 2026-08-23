import { Request, Response, NextFunction } from "express";
import { getRedisClient, rateLimitKey } from "../infra/redis.ts";

interface RateLimitOptions {
  max: number;
  windowSec: number;
  keyGenerator: (req: Request) => string;
  message?: string;
}

const DEFAULT_MESSAGE = "Too many requests, please try again later";

export function createRateLimiter(options: RateLimitOptions) {
  const { max, windowSec, keyGenerator, message = DEFAULT_MESSAGE } = options;
  const client = getRedisClient();

  return async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
    // req.path is relative to the mounted router; prefix baseUrl so the key
    // holds the full path (e.g. /v1/auth/login, /v1/bookings) per contract.
    const fullPath = `${req.baseUrl}${req.path}`;
    const key = rateLimitKey(keyGenerator(req), fullPath, windowSec);
    const current = await client.incr(key);

    if (current === 1) {
      await client.expire(key, windowSec);
    }

    const remaining = Math.max(0, max - current);
    const resetTime = Math.floor(Date.now() / 1000) + windowSec;

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(resetTime));

    if (current > max) {
      const ttl = await client.ttl(key);
      res.setHeader("Retry-After", String(ttl > 0 ? ttl : windowSec));
      res.status(429).json({ error: message, retryAfter: ttl > 0 ? ttl : windowSec });
      return;
    }

    next();
  };
}

export const loginRateLimiter = createRateLimiter({
  max: 5,
  windowSec: 60 * 15,
  keyGenerator: (req) => req.ip ?? "unknown",
  message: "Too many login attempts, please try again later",
});

export const bookingRateLimiter = createRateLimiter({
  max: 30,
  windowSec: 60,
  keyGenerator: (req) => {
    if (!req.auth?.sub) {
      return `unauth:${req.ip ?? "unknown"}`;
    }
    return `user:${req.auth.sub}`;
  },
  message: "Too many booking requests, please slow down",
});