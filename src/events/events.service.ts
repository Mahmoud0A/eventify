// Events service — business logic layer

import { eventsRepository } from "../events/events.repository.ts";
import { Event } from "../domain.ts";
import { AppError } from "../middleware/error.ts";
import {
  cacheGet,
  cacheSet,
  cacheDel,
  eventCacheKey,
  eventsListCacheKey,
  getEventsListVersion,
  invalidateEventsListCache,
} from "../infra/cache.ts";

export const eventsService = {
  async getAll(filters?: {
    venue?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Event[]; page: number; limit: number; total: number }> {
    const page = filters?.page ?? 1;
    const version = await getEventsListVersion();
    const cacheKey = eventsListCacheKey(version, page);

    const cached = await cacheGet<{ data: Event[]; page: number; limit: number; total: number }>(cacheKey);
    if (cached) return cached;

    const result = await eventsRepository.findAll(filters);
    await cacheSet(cacheKey, result);
    return result;
  },

  async getById(id: string): Promise<Event | null> {
    const cacheKey = eventCacheKey(id);
    const cached = await cacheGet<Event>(cacheKey);
    if (cached) return cached;

    const event = await eventsRepository.findById(id);
    if (event) {
      await cacheSet(cacheKey, event);
    }
    return event;
  },

  async create(
    data: Omit<Event, "id" | "createdAt">,
    organizerId: string
  ): Promise<Event> {
    const event = await eventsRepository.create({
      ...data,
      organizerId,
      createdAt: new Date().toISOString(),
    });
    await invalidateEventsListCache();
    return event;
  },

  async update(
    id: string,
    data: Partial<Event>,
    userId: string,
    role: string
  ): Promise<Event | null> {
    const event = await eventsRepository.findById(id);
    if (!event) return null;

    if (role !== "ADMIN" && event.organizerId !== userId) {
      throw new AppError(403, "Not authorized to update this event");
    }

    const updated = await eventsRepository.update(id, data);
    if (updated) {
      await cacheDel(eventCacheKey(id));
      await invalidateEventsListCache();
    }
    return updated;
  },

  async delete(id: string, userId: string, role: string): Promise<boolean> {
    const event = await eventsRepository.findById(id);
    if (!event) return false;

    if (role !== "ADMIN" && event.organizerId !== userId) {
      throw new AppError(403, "Not authorized to delete this event");
    }

    await eventsRepository.delete(id);
    await cacheDel(eventCacheKey(id));
    await invalidateEventsListCache();
    return true;
  },
};