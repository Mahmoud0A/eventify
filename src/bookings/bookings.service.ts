// Booking service — transactional, capacity-aware, rebook-after-cancel
// Session 3: all logic moves to Prisma transactions against Postgres

import { Prisma } from "../generated/prisma.ts";
import { prisma } from "../lib/prisma.ts";
import { Booking } from "../domain.ts";

type PrismaError = { code: string };

function mapPrismaError(error: PrismaError): { message: string; status: number } {
  if (error.code === "P2002") {
    return { message: "Duplicate booking for this user and event", status: 409 };
  }
  if (error.code === "P2003") {
    return { message: "Invalid user or event reference", status: 404 };
  }
  if (error.code === "P2025") {
    return { message: "Record not found", status: 404 };
  }
  if (error.code === "P2034") {
    return { message: "Concurrent modification detected", status: 500 };
  }
  return { message: "Internal server error", status: 500 };
}

function checkCapacity(
  confirmedCount: number,
  eventCapacity: number
): { ok: boolean; message?: string } {
  if (confirmedCount >= eventCapacity) {
    return { ok: false, message: "Event at capacity" };
  }
  return { ok: true };
}

function toBookingStringDates(booking: Prisma.BookingModel): Booking {
  return {
    ...booking,
    createdAt: booking.createdAt.toISOString(),
  };
}

export async function createBooking(
  userId: string,
  eventId: string
): Promise<{ booking: Booking | null; status: number; message?: string }> {
  const maxRetries = 3;
  let lastError: unknown;

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
              const capacityCheck = checkCapacity(confirmedCount, event.capacity);
              if (!capacityCheck.ok) {
                return { booking: null, status: 409, message: capacityCheck.message };
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
          const capacityCheck = checkCapacity(confirmedCount, event.capacity);
          if (!capacityCheck.ok) {
            return { booking: null, status: 409, message: capacityCheck.message };
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
      lastError = error;
      const prismaError = error as PrismaError;
      if (prismaError.code === "P2034" && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        continue;
      }
      const mapped = mapPrismaError(prismaError);
      return { booking: null, status: mapped.status, message: mapped.message };
    }
  }

  const mapped = mapPrismaError(lastError as PrismaError);
  return { booking: null, status: mapped.status, message: mapped.message };
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return null;
  return toBookingStringDates(booking);
}

export async function getAllBookings(): Promise<Booking[]> {
  const bookings = await prisma.booking.findMany({ orderBy: { createdAt: "desc" } });
  return bookings.map(toBookingStringDates);
}

export async function cancelBooking(
  id: string,
  userId: string
): Promise<{ booking: Booking | null; status: number }> {
  try {
    const existing = await prisma.booking.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      return { booking: null, status: 404 };
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return { booking: toBookingStringDates(booking), status: 200 };
  } catch (error) {
    const mapped = mapPrismaError(error as PrismaError);
    return { booking: null, status: mapped.status };
  }
}