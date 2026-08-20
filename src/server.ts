// Eventify — Sessions 1–4

import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/error.ts";
import { eventsRouter } from "./events/events.router.ts";
import { bookingsRouter } from "./bookings/bookings.router.ts";
import { authRouter } from "./auth/auth.router.ts";

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/v1/events", eventsRouter);
app.use("/v1/bookings", bookingsRouter);
app.use("/v1/auth", authRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

const port = parseInt(process.env.PORT || "3000", 10);
console.log(`Eventify listening on port ${port}`);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});