// Events service — business logic layer

import { eventsRepository } from "../events/events.repository.ts";
import { Event } from "../domain.ts";
import { AppError } from "../middleware/error.ts";

export const eventsService = {
  async getAll(filters?: {
    venue?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Event[]; page: number; limit: number; total: number }> {
    return eventsRepository.findAll(filters);
  },

  async getById(id: string): Promise<Event | null> {
    return eventsRepository.findById(id);
  },

  async create(
    data: Omit<Event, "id" | "createdAt">,
    organizerId: string
  ): Promise<Event> {
    return eventsRepository.create({
      ...data,
      organizerId,
      createdAt: new Date().toISOString(),
    });
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

    return eventsRepository.update(id, data);
  },

  async delete(id: string, userId: string, role: string): Promise<boolean> {
    const event = await eventsRepository.findById(id);
    if (!event) return false;

    if (role !== "ADMIN" && event.organizerId !== userId) {
      throw new AppError(403, "Not authorized to delete this event");
    }

    await eventsRepository.delete(id);
    return true;
  },
};