// Auth router

import { Router } from "express";
import { authController } from "../auth/auth.controller.ts";
import { validate } from "../middleware/validate.ts";
import { z } from "zod";

const router = Router();

const signupSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  role: z.enum(["ATTENDEE", "ORGANIZER", "ADMIN"]).default("ATTENDEE"),
});

const loginSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1),
});

router.post("/signup", validate(signupSchema), (req, res, next) =>
  authController.signup(req, res).catch(next)
);

router.post("/login", validate(loginSchema), (req, res, next) =>
  authController.login(req, res).catch(next)
);

router.post("/refresh", (req, res, next) =>
  authController.refresh(req, res).catch(next)
);

router.post("/logout", (req, res, next) =>
  authController.logout(req, res).catch(next)
);

export const authRouter = router;