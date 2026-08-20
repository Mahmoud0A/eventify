// Events router

import { Router } from "express";
import { eventsController } from "../events/events.controller.ts";
import { validateQuery } from "../middleware/validateQuery.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";
import { z } from "zod";

const router = Router();

const eventQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  venue: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const eventCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  venue: z.string().optional(),
  startsAt: z.string().datetime(),
  capacity: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
});

const eventUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  venue: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  capacity: z.number().int().positive().optional(),
  priceCents: z.number().int().nonnegative().optional(),
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

router.get("/", validateQuery(eventQuerySchema), (req, res, next) =>
  eventsController.getAll(req, res).catch(next)
);

router.get("/:id", (req, res, next) =>
  eventsController.getById(req, res).catch(next)
);

router.post(
  "/events",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  (req, res, next) => eventsController.create(req, res).catch(next)
);

router.patch(
  "/events/:id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  (req, res, next) => eventsController.update(req, res).catch(next)
);

router.delete(
  "/events/:id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  (req, res, next) => eventsController.delete(req, res).catch(next)
);

export const eventsRouter = router;