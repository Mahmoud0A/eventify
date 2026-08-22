// Events controller

import { Request, Response } from "express";
import { eventsService } from "../events/events.service.ts";
import { AppError } from "../middleware/error.ts";

export const eventsController = {
  async getAll(req: Request, res: Response): Promise<void> {
    const filters = res.locals.query as {
      venue?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    };
    const result = await eventsService.getAll(filters);
    res.json(result);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const event = await eventsService.getById(req.params.id as string);
    if (!event) {
      throw new AppError(404, "Event not found");
    }
    res.json(event);
  },

  async create(req: Request, res: Response): Promise<void> {
    const event = await eventsService.create(req.body, req.auth!.sub);
    res.status(201).json(event);
  },

  async update(req: Request, res: Response): Promise<void> {
    const event = await eventsService.update(req.params.id as string, req.body, req.auth!.sub, req.auth!.role);
    if (!event) {
      throw new AppError(404, "Event not found");
    }
    res.json(event);
  },

  async delete(req: Request, res: Response): Promise<void> {
    const deleted = await eventsService.delete(req.params.id as string, req.auth!.sub, req.auth!.role);
    if (!deleted) {
      throw new AppError(404, "Event not found");
    }
    res.status(204).send();
  },
};