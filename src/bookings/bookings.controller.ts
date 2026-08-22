// Bookings controller

import { Request, Response } from "express";
import { bookingsService } from "../bookings/bookings.service.ts";
import { AppError } from "../middleware/error.ts";

export const bookingsController = {
  async create(req: Request, res: Response): Promise<void> {
    const { eventId } = req.body;
    const result = await bookingsService.create(req.auth!.sub, eventId);
    if (result.status !== 201) {
      throw new AppError(result.status, result.message ?? "Booking failed");
    }
    res.status(201).json(result.booking);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const result = await bookingsService.getById(req.params.id as string, req.auth!.sub, req.auth!.role);
    if (result.status === 404) throw new AppError(404, "Booking not found");
    if (result.status === 403) throw new AppError(403, "Not authorized to access this booking");
    res.json(result.booking);
  },

  async getAll(req: Request, res: Response): Promise<void> {
    const bookings = await bookingsService.getAll(req.auth!.sub, req.auth!.role);
    res.json(bookings);
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const result = await bookingsService.cancel(req.params.id as string, req.auth!.sub);
    if (result.status === 404) {
      throw new AppError(404, "Booking not found");
    }
    if (result.status === 403) {
      throw new AppError(403, "Not authorized to cancel this booking");
    }
    res.json(result.booking);
  },
};