// Events router

import { Router } from "express";
import { eventsController } from "../events/events.controller.ts";
import { validateQuery } from "../middleware/validateQuery.ts";
import { validate } from "../middleware/validate.ts";
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

const eventCreateSchema = z.strictObject({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  venue: z.string().nullable().optional(),
  startsAt: z.string().datetime(),
  capacity: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
});

const eventUpdateSchema = z.strictObject({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  venue: z.string().nullable().optional(),
  startsAt: z.string().datetime().optional(),
  capacity: z.number().int().positive().optional(),
  priceCents: z.number().int().nonnegative().optional(),
});

router.get("/", validateQuery(eventQuerySchema), (req, res, next) =>
  eventsController.getAll(req, res).catch(next)
);

router.get("/:id", (req, res, next) =>
  eventsController.getById(req, res).catch(next)
);

router.post(
  "/",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  validate(eventCreateSchema),
  (req, res, next) => eventsController.create(req, res).catch(next)
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  validate(eventUpdateSchema),
  (req, res, next) => eventsController.update(req, res).catch(next)
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  (req, res, next) => eventsController.delete(req, res).catch(next)
);

export const eventsRouter = router;