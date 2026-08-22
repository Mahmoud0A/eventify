// Events repository — Prisma implementation

import { Prisma } from "../generated/prisma.ts";
import { prisma } from "../lib/prisma.ts";
import { Event } from "../domain.ts";
import type { EventWhereInput } from "../generated/prisma.ts";

function toEventStringDates(event: Prisma.EventModel): Event {
  return {
    ...event,
    description: event.description ?? "",
    startsAt: event.startsAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
  };
}

export const eventsRepository = {
  async findAll(filters?: {
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

    return { data: data.map(toEventStringDates), page, limit, total };
  },

  async findById(id: string): Promise<Event | null> {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return null;
    return toEventStringDates(event);
  },

  async create(data: Prisma.EventCreateInput): Promise<Event> {
    const event = await prisma.event.create({ data });
    return toEventStringDates(event);
  },

  async update(id: string, data: Prisma.EventUpdateInput): Promise<Event | null> {
    const event = await prisma.event.update({ where: { id }, data });
    return toEventStringDates(event);
  },

  async delete(id: string): Promise<void> {
    await prisma.event.delete({ where: { id } });
  },
};