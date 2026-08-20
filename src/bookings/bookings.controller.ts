// Bookings controller

import { Request, Response } from "express";
import { bookingsService } from "../bookings/bookings.service.ts";
import { AppError } from "../middleware/error.ts";

export const bookingsController = {
  async create(req: Request, res: Response): Promise<void> {
    const { userId, eventId } = req.body;
    const result = await bookingsService.create(userId, eventId);
    if (result.status !== 201) {
      throw new AppError(result.status, result.message ?? "Booking failed");
    }
    res.status(201).json(result.booking);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const booking = await bookingsService.getById(req.params.id as string);
    if (!booking) {
      throw new AppError(404, "Booking not found");
    }
    res.json(booking);
  },

  async getAll(req: Request, res: Response): Promise<void> {
    const bookings = await bookingsService.getAll();
    res.json(bookings);
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const { userId } = req.body;
    const result = await bookingsService.cancel(req.params.id as string, userId);
    if (result.status === 404) {
      throw new AppError(404, "Booking not found");
    }
    res.json(result.booking);
  },
};