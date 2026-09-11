// Express app construction — exported separately from the listening entry
// point so integration tests (Supertest) can drive the real app in-process.

import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/config.ts";
import { errorHandler } from "./middleware/error.ts";
import { eventsRouter } from "./events/events.router.ts";
import { bookingsRouter } from "./bookings/bookings.router.ts";
import { authRouter } from "./auth/auth.router.ts";

const app = express();

const allowedOrigins = [
  env.WEB_ORIGIN,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);
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

export { app };