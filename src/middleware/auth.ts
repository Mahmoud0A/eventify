// Authentication middleware

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/config.ts";
import { Role } from "../domain.ts";

export interface AuthPayload {
  sub: string;
  role: Role;
}

const authPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(["ATTENDEE", "ORGANIZER", "ADMIN"]),
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // TEST-ONLY bypass: lets the Session-3 concurrency script (scripts/parallel-bookings.ts)
  // identify distinct users without a real JWT. Disabled by default — only active when
  // TEST_AUTH_ENABLED=true in the environment. NEVER enable this in production.
  if (env.TEST_AUTH_ENABLED === "true") {
    const testUserId = req.headers["x-user-id"];
    if (typeof testUserId === "string" && !req.headers.authorization) {
      req.auth = { sub: testUserId, role: "ATTENDEE" };
      next();
      return;
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
    });
    const payload = authPayloadSchema.parse(decoded);
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
