import { Prisma } from "../generated/prisma.ts";
import { prisma } from "../lib/prisma.ts";
import { Event } from "../domain.ts";

type EventWhereInput = Prisma.EventWhereInput;

export async function findEvents(filters?: {
  venue?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: Event[]; page: number; limit: number; total: number }> {
  const where: EventWhereInput = {};

  if (filters?.venue) {
    where.venue = filters.venue;
  }
  if (filters?.from || filters?.to) {
    where.startsAt = {};
    if (filters.from) {
      where.startsAt.gte = filters.from;
    }
    if (filters.to) {
      where.startsAt.lte = filters.to;
    }
  }

  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 20;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.event.findMany({ where, skip, take: limit, orderBy: { startsAt: "asc" } }),
    prisma.event.count({ where }),
  ]);

  return { data: data as Event[], page, limit, total };
}

export async function findEventById(id: string): Promise<Event | null> {
  return prisma.event.findUnique({ where: { id } }) as Promise<Event | null>;
}