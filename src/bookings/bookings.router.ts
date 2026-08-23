// Bookings router

import { Router } from "express";
import { bookingsController } from "../bookings/bookings.controller.ts";
import { validate } from "../middleware/validate.ts";
import { requireAuth } from "../middleware/auth.ts";
import { bookingRateLimiter } from "../middleware/rateLimit.ts";
import { z } from "zod";

const router = Router();

const createBookingSchema = z.strictObject({
  eventId: z.string().uuid(),
});

router.post(
  "/",
  requireAuth,
  bookingRateLimiter,
  validate(createBookingSchema),
  (req, res, next) => bookingsController.create(req, res).catch(next)
);

router.get("/:id", requireAuth, (req, res, next) =>
  bookingsController.getById(req, res).catch(next)
);

router.get("/", requireAuth, (req, res, next) =>
  bookingsController.getAll(req, res).catch(next)
);

router.delete(
  "/:id",
  requireAuth,
  (req, res, next) => bookingsController.cancel(req, res).catch(next)
);

export const bookingsRouter = router;
