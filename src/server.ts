// HTTP entry point — owns listening and process lifecycle; app wiring lives
// in src/app.ts.

import { app } from "./app.ts";
import { closeRedisClient } from "./infra/redis.ts";
import { closeBullRedisClients } from "./infra/queue-backend.ts";
import { prisma } from "./lib/prisma.ts";

const port = parseInt(process.env.PORT || "3000", 10);
console.log(`Eventify listening on port ${port}`);

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown: SIGTERM/SIGINT stop new connections, drain the HTTP
// server, then release Redis/BullMQ/Prisma resources owned by this process.
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} received — shutting down`);

  const forceExit = setTimeout(() => {
    console.error("[api] forced exit after timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  await closeBullRedisClients().catch(() => undefined);
  await closeRedisClient().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);

  console.log("[api] shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));