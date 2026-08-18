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

export async function createBooking(
  userId: string,
  eventId: string
): Promise<{ booking: Booking | null; status: number; message?: string }> {
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
            return { booking: updated as Booking, status: 201 };
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

        return { booking: booking as Booking, status: 201 };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    console.log("Transaction result:", result);
    return result;
  } catch (error) {
    console.error("Transaction error:", error);
    const mapped = mapPrismaError(error as PrismaError);
    return { booking: null, status: mapped.status, message: mapped.message };
  }
}

export async function getBookingById(id: string): Promise<Booking | null> {
  return prisma.booking.findUnique({ where: { id } }) as Promise<Booking | null>;
}

export async function getAllBookings(): Promise<Booking[]> {
  return prisma.booking.findMany({ orderBy: { createdAt: "desc" } }) as Promise<Booking[]>;
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

    return { booking: booking as Booking, status: 200 };
  } catch (error) {
    const mapped = mapPrismaError(error as PrismaError);
    return { booking: null, status: mapped.status };
  }
}