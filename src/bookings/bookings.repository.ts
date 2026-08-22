// Bookings repository — Prisma implementation

import { Prisma } from "../generated/prisma.ts";
import { prisma } from "../lib/prisma.ts";
import { Booking } from "../domain.ts";

function toBookingStringDates(booking: Prisma.BookingModel): Booking {
  return {
    ...booking,
    createdAt: booking.createdAt.toISOString(),
  };
}

export const bookingsRepository = {
  async create(
    userId: string,
    eventId: string
  ): Promise<{ booking: Booking | null; status: number; message?: string }> {
    const maxRetries = 8;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            const event = await tx.event.findUnique({ where: { id: eventId } });
            if (!event) {
              return { booking: null as Booking | null, status: 404 as number, message: "Event not found" };
            }

            const existing = await tx.booking.findUnique({
              where: { userId_eventId: { userId, eventId } },
            });

            if (existing) {
              if (existing.status === "CANCELLED") {
                const confirmedCount = await tx.booking.count({
                  where: { eventId, status: "CONFIRMED" },
                });
                if (confirmedCount >= event.capacity) {
                  return { booking: null, status: 409, message: "Event at capacity" };
                }

                const updated = await tx.booking.update({
                  where: { id: existing.id },
                  data: { status: "CONFIRMED" },
                });
                return { booking: toBookingStringDates(updated), status: 201 };
              }
              if (existing.status === "CONFIRMED") {
                return { booking: null, status: 409, message: "Duplicate booking" };
              }
              return { booking: null, status: 409, message: "Booking already exists" };
            }

            const confirmedCount = await tx.booking.count({
              where: { eventId, status: "CONFIRMED" },
            });
            if (confirmedCount >= event.capacity) {
              return { booking: null, status: 409, message: "Event at capacity" };
            }

            const booking = await tx.booking.create({
              data: {
                userId,
                eventId,
                status: "CONFIRMED",
              },
            });

            return { booking: toBookingStringDates(booking), status: 201 };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          }
        );

        return result;
      } catch (error) {
        const prismaError = error as { code?: string; message?: string };
        if (process.env.NODE_ENV === "development") {
          console.error(`[booking-create] attempt ${attempt}/${maxRetries} failed:`, JSON.stringify({ code: prismaError.code, message: prismaError.message }));
        }
        // Serializable isolation makes concurrent bookings abort with a write
        // conflict. Prisma wraps these as P2034, but @prisma/adapter-pg can also
        // surface a raw `TransactionWriteConflict` error with no `.code`, so we
        // detect both and retry the whole transaction a bounded number of times.
        const isSerializationFailure =
          prismaError.code === "P2034" ||
          /TransactionWriteConflict|write conflict|serialization|deadlock/i.test(prismaError.message ?? "");
        if (isSerializationFailure && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
          continue;
        }
        return {
          booking: null,
          status: prismaError.code === "P2002" ? 409 : 500,
          message:
            prismaError.code === "P2002"
              ? "Duplicate booking for this user and event"
              : `Internal server error (${prismaError.code})`,
        };
      }
    }

    return { booking: null, status: 500, message: "Internal server error" };
  },

  async findById(id: string): Promise<Booking | null> {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return null;
    return toBookingStringDates(booking);
  },

  async findAll(): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({ orderBy: { createdAt: "desc" } });
    return bookings.map(toBookingStringDates);
  },

  async findByUserId(userId: string): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return bookings.map(toBookingStringDates);
  },

  async cancel(id: string, userId: string): Promise<{ booking: Booking | null; status: number }> {
    try {
      const existing = await prisma.booking.findUnique({ where: { id } });

      if (!existing) {
        return { booking: null, status: 404 };
      }
      if (existing.userId !== userId) {
        return { booking: null, status: 403 };
      }

      const booking = await prisma.booking.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return { booking: toBookingStringDates(booking), status: 200 };
    } catch {
      return { booking: null, status: 500 };
    }
  },
};