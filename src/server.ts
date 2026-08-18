// Eventify — Sessions 1–2 (raw → Express)
// Strict TypeScript, Zod validation, layered: routes → controller → service

import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Event, User, Booking, Role, BookingStatus, findById } from "./domain.js";

// ==== Data (in-memory, same shape as Session 1) ====

const events: Event[] = [
  { id: "evt-1", title: "JS 101", description: "JavaScript from zero ceremony", venue: "Room 4", startsAt: "2026-09-14T18:00:00Z", capacity: 30, priceCents: 0, organizerId: "usr-1", createdAt: "2026-08-01T09:00:00Z" },
  { id: "evt-2", title: "TS at Work", description: "Types that earn their keep", venue: null, startsAt: "2026-09-21T18:00:00Z", capacity: 80, priceCents: 1500, organizerId: "usr-1", createdAt: "2026-08-01T09:05:00Z" },
  { id: "evt-3", title: "Node Deep Dive", description: "The event loop, for real", venue: "Main Hall", startsAt: "2026-10-02T18:00:00Z", capacity: 25, priceCents: 2500, organizerId: "usr-2", createdAt: "2026-08-02T10:00:00Z" },
  { id: "evt-4", title: "API Design Live", description: "Endpoints designed in the open", venue: "Main Hall", startsAt: "2026-11-20T18:00:00Z", capacity: 125, priceCents: 0, organizerId: "usr-2", createdAt: "2026-08-03T11:00:00Z" },
];

const users: User[] = [
  { id: "usr-1", email: "alice@example.com", name: "Alice", role: "ATTENDEE", createdAt: "2026-08-01T08:00:00Z" },
  { id: "usr-2", email: "bob@example.com", name: "Bob", role: "ATTENDEE", createdAt: "2026-08-02T08:00:00Z" },
];

// In-memory bookings store
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
  } catch (err) {
    return res.status(400).json({ error: "Invalid query parameters" });
  }
}

// Booking ID schema
const bookingIdSchema = z.string();

// ==== Service Layer ====

function getEventById(id: string): Event | undefined {
  return findById(events, id);
}

function getBookingById(id: string): Booking | undefined {
  return findById(bookings, id);
}

// Create booking — returns [booking | null, statusCode]
function createBooking(eventId: string, userId: string): [Booking | null, number] {
  // 1. Validate event exists
  const event = getEventById(eventId);
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
    createdAt: new Date().toISOString(),
  };
  bookings.push(newBooking);
  return [newBooking, 201];
}

// Soft cancel: flip status to CANCELLED, keep the record
function cancelBooking(bookingId: string, userId: string): [Booking | null, number] {
  const target = bookings.find((b) => b.id === bookingId && b.userId === userId);
  if (!target) {
    return [null, 404];
  }
  target.status = "CANCELLED";
  return [target, 200];
}

// ==== Controller Layer ====

function handleGetHealth(req: Request, res: Response) {
  res.json({ status: "ok", uptime: process.uptime() });
}

function handleGetEvents(req: Request, res: Response) {
  const { page, limit, venue, from, to } = res.locals.query;

  let result = [...events];

  // Filtering — happens before pagination
  if (venue) {
    result = result.filter((e) => e.venue === venue);
  }
  if (from) {
    result = result.filter((e) => e.startsAt >= from);
  }
  if (to) {
    result = result.filter((e) => e.startsAt <= to);
  }

  // Pagination
  const start = (page - 1) * limit;
  const end = start + limit;
  const pageResult = result.slice(start, end);

  const total = result.length;

  res.json({ data: pageResult, page, limit, total });
}

function handleGetEventById(req: Request, res: Response) {
  const id = req.params.id as string;
  const event = getEventById(id);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
  } else {
    res.json(event);
  }
}

function handleCreateBooking(req: Request, res: Response) {
  try {
    const result = bookingBodySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid body" });
    }

    const { eventId } = result.data;
    const [booking, status] = createBooking(eventId, CURRENT_USER_ID);

    if (status === 404) {
      return res.status(404).json({ error: "Event not found" });
    }
    if (status === 409) {
      return res.status(409).json({ error: "Duplicate booking or event at capacity" });
    }

    res.status(201).json(booking);
  } catch (err) {
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

function handleDeleteBooking(req: Request, res: Response) {
  const result = bookingIdSchema.safeParse(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid booking id" });
  }

  const [booking, status] = cancelBooking(result.data, CURRENT_USER_ID);
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
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error middleware — registered last, the only place a 500 should come from
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // The spec says every error body has one shape: { "error": "<message>" }
  // No stack traces to the client, ever
  res.status(500).json({ error: "Internal server error" });
});

// ==== Start Server ====

const port = parseInt(process.env.PORT || "3000", 10);

console.log(`Eventify Sessions 1–2 listening on port ${port}`);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});