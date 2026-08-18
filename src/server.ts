// Eventify — Sessions 1–3
// Strict TypeScript, Zod validation, layered: routes → controller → service
import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Booking } from "./domain.js";
import { findEventById, findEvents } from "./events/events.service.js";

// In-memory bookings store (Session 3 will migrate this to Prisma)
const bookings: Booking[] = [];

// Hard-coded "current user" — Session 2 passes it as a parameter
const CURRENT_USER_ID = "usr-1";

// ==== Zod Schemas ====

const bookingBodySchema = z.strictObject({
  eventId: z.string(),
});

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const venueSchema = z.string().optional();
const fromSchema = z.string().optional();
const toSchema = z.string().optional();

// Query validation middleware: puts parsed result in res.locals.query
function validateQuery(req: Request, res: Response, next: NextFunction) {
  try {
    const page = pageSchema.safeParse(req.query.page);
    const limit = limitSchema.safeParse(req.query.limit);
    const venue = venueSchema.safeParse(req.query.venue);
    const from = fromSchema.safeParse(req.query.from);
    const to = toSchema.safeParse(req.query.to);

    if (!page.success || !limit.success || !venue.success || !from.success || !to.success) {
      return res.status(400).json({ error: "Invalid query parameters" });
    }

    res.locals.query = {
      page: page.data,
      limit: limit.data,
      venue: venue.data,
      from: from.data,
      to: to.data,
    };
    next();
  } catch {
    return res.status(400).json({ error: "Invalid query parameters" });
  }
}

// Booking ID schema
const bookingIdSchema = z.string();

// ==== Service Layer ====

function getBookingById(id: string): Booking | undefined {
  return bookings.find((b) => b.id === id);
}

// Create booking — returns [booking | null, statusCode]
async function createBooking(eventId: string, userId: string): Promise<[Booking | null, number]> {
  // 1. Validate event exists
  const event = await findEventById(eventId);
  if (!event) {
    return [null, 404]; // event not found
  }

  // 2. Check duplicate: userId+eventId pair already has a booking (any status, including CANCELLED)
  const duplicate = bookings.find((b) => b.userId === userId && b.eventId === eventId);
  if (duplicate) {
    // If existing is CANCELLED → rebook-after-cancel → flip it back to CONFIRMED
    if (duplicate.status === "CANCELLED") {
      duplicate.status = "CONFIRMED";
      return [duplicate, 201];
    }
    // If existing is CONFIRMED → duplicate → 409
    if (duplicate.status === "CONFIRMED") {
      return [null, 409];
    }
    // If existing is WAITLISTED → leave it alone, treat as duplicate
    return [null, 409];
  }

  // 3. Capacity check: only CONFIRMED bookings count toward capacity; cancelled don't eat capacity
  const confirmedCount = bookings.filter((b) => b.eventId === eventId && b.status === "CONFIRMED").length;
  if (confirmedCount >= event.capacity) {
    return [null, 409]; // event at capacity
  }

  // 4. Create booking
  const newBooking: Booking = {
    id: crypto.randomUUID(),
    userId,
    eventId,
    status: "CONFIRMED",
    createdAt: new Date(),
  };
  bookings.push(newBooking);
  return [newBooking, 201];
}

// Soft cancel: flip status to CANCELLED, keep the record
async function cancelBooking(bookingId: string, userId: string): Promise<[Booking | null, number]> {
  const target = bookings.find((b) => b.id === bookingId && b.userId === userId);
  if (!target) {
    return [null, 404];
  }
  target.status = "CANCELLED";
  return [target, 200];
}

// ==== Controller Layer ====

async function handleGetHealth(_req: Request, res: Response) {
  res.json({ status: "ok", uptime: process.uptime() });
}

async function handleGetEvents(req: Request, res: Response) {
  const { page, limit, venue, from, to } = res.locals.query;

  const result = await findEvents({ venue, from, to, page, limit });

  res.json(result);
}

async function handleGetEventById(req: Request, res: Response) {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  const event = await findEventById(id);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
  } else {
    res.json(event);
  }
}

async function handleCreateBooking(req: Request, res: Response) {
  try {
    const result = bookingBodySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid body" });
    }

    const { eventId } = result.data;
    const [booking, status] = await createBooking(eventId, CURRENT_USER_ID);

    if (status === 404) {
      return res.status(404).json({ error: "Event not found" });
    }
    if (status === 409) {
      return res.status(409).json({ error: "Duplicate booking or event at capacity" });
    }

    res.status(201).json(booking);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

function handleGetBookingById(req: Request, res: Response) {
  const result = bookingIdSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid booking id" });
  }

  const booking = getBookingById(result.data);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  res.json(booking);
}

async function handleDeleteBooking(req: Request, res: Response) {
  const result = bookingIdSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid booking id" });
  }

  const [booking, status] = await cancelBooking(result.data, CURRENT_USER_ID);
  if (status === 404) {
    return res.status(404).json({ error: "Booking not found" });
  }
  res.json(booking);
}

// ==== Express App Setup ====

const app = express();
app.use(express.json());

// Health check
app.get("/health", handleGetHealth);

// GET /events — with query validation
app.get("/events", validateQuery, handleGetEvents);

// GET /events/:id
app.get("/events/:id", handleGetEventById);

// POST /v1/bookings
app.post("/v1/bookings", handleCreateBooking);

// GET /v1/bookings/:id
app.get("/v1/bookings/:id", handleGetBookingById);

// DELETE /v1/bookings/:id
app.delete("/v1/bookings/:id", handleDeleteBooking);

// Catch-all 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error middleware — registered last, the only place a 500 should come from
app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: "Internal server error" });
});

// ==== Start Server ====

const port = parseInt(process.env.PORT || "3000", 10);

console.log(`Eventify Sessions 1–3 listening on port ${port}`);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});