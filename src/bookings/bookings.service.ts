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

  async getById(id: string, requesterId: string, role: string): Promise<{ booking: Booking | null; status: number }> {
    const booking = await bookingsRepository.findById(id);
    if (!booking) return { booking: null, status: 404 };
    if (role !== "ADMIN" && booking.userId !== requesterId) {
      return { booking: null, status: 403 };
    }
    return { booking, status: 200 };
  },

  async getAll(requesterId: string, role: string): Promise<Booking[]> {
    if (role === "ADMIN") return bookingsRepository.findAll();
    return bookingsRepository.findByUserId(requesterId);
  },

  async cancel(
    id: string,
    userId: string
  ): Promise<{ booking: Booking | null; status: number }> {
    return bookingsRepository.cancel(id, userId);
  },
};