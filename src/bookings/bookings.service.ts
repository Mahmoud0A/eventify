// Booking service — transactional, capacity-aware, rebook-after-cancel
// Session 3: all logic moves to Prisma transactions against Postgres
// The `tx` parameter is a Prisma transaction object (from prisma.$transaction)
// Errors are mapped via mapPrismaError helper below.

import { Event, Booking, BookingStatus, findById } from "../domain.js";

/**
 * Check capacity: count only CONFIRMED bookings for the event.
 * Returns the confirmed count and whether capacity is exceeded.
 */
function checkCapacity(
  confirmedCount: number,
  eventCapacity: number
): { ok: boolean; message?: string } {
  // Only CONFIRMED bookings count toward capacity
  // cancelled bookings must not eat capacity
  if (confirmedCount >= eventCapacity) {
    return { ok: false, message: "Event at capacity" };
  }
  return { ok: true };
}

/**
 * Map Prisma error codes to HTTP status codes.
 * P2002 → 409 (unique constraint violation = duplicate booking)
 * P2034 → 500 (serialization failure — handled by retry stretch)
 */
function mapPrismaError(error: any): { message: string; status: number } {
  if (error.code === "P2002") {
    return { message: "Duplicate booking for this user and event", status: 409 };
  }
  if (error.code === "P2034") {
    return { message: "Concurrent modification detected", status: 500 };
  }
  if (error.code === "P2025") {
    return { message: "Record not found", status: 404 };
  }
  return { message: "Internal server error", status: 500 };
}

export { checkCapacity, mapPrismaError };