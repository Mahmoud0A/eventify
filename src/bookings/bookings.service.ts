// Bookings service

import { bookingsRepository } from "../bookings/bookings.repository.ts";
import { Booking } from "../domain.ts";

export const bookingsService = {
  async create(
    userId: string,
    eventId: string
  ): Promise<{ booking: Booking | null; status: number; message?: string }> {
    return bookingsRepository.create(userId, eventId);
  },

  async getById(id: string): Promise<Booking | null> {
    return bookingsRepository.findById(id);
  },

  async getAll(): Promise<Booking[]> {
    return bookingsRepository.findAll();
  },

  async cancel(
    id: string,
    userId: string
  ): Promise<{ booking: Booking | null; status: number }> {
    return bookingsRepository.cancel(id, userId);
  },
};