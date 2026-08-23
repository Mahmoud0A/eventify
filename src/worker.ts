import { Worker } from "bullmq";
import { getBullRedisClient, closeBullRedisClients } from "./infra/queue-backend.ts";
import { WAITLIST_PROMOTE_QUEUE_NAME, waitlistPromoteQueueEvents } from "./jobs/waitlist.queue.ts";
import { EMAIL_QUEUE_NAME, emailQueueEvents } from "./jobs/email.queue.ts";
import { prisma } from "./lib/prisma.ts";

async function promoteWaitlistedBooking(eventId: string): Promise<string | null> {
  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    const waitlistedBooking = await tx.booking.findFirst({
      where: { eventId, status: "WAITLISTED" },
      orderBy: { createdAt: "asc" },
    });

    if (!waitlistedBooking) {
      return null;
    }

    const confirmedCount = await tx.booking.count({
      where: { eventId, status: "CONFIRMED" },
    });

    if (confirmedCount >= event.capacity) {
      return null;
    }

    const promoted = await tx.booking.update({
      where: { id: waitlistedBooking.id },
      data: { status: "CONFIRMED" },
    });

    return promoted.id;
  }, {
    isolationLevel: "Serializable",
  });

  return result;
}

async function sendConfirmationEmail(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { event: true, user: true },
  });

  if (!booking) {
    console.warn(`[worker] Booking ${bookingId} not found for confirmation email`);
    return;
  }

  console.log(`[worker] Sending confirmation email for booking ${bookingId} (event: ${booking.event.title}, user: ${booking.user.email})`);
}

const waitlistWorker = new Worker(
  WAITLIST_PROMOTE_QUEUE_NAME,
  async (job) => {
    const { eventId } = job.data as { eventId: string };
    console.log(`[worker] Processing waitlist promotion for event ${eventId}`);

    const promotedBookingId = await promoteWaitlistedBooking(eventId);

    if (promotedBookingId) {
      console.log(`[worker] Promoted booking ${promotedBookingId} to CONFIRMED`);
      await import("./jobs/email.queue.ts").then(({ addConfirmationEmailJob }) =>
        addConfirmationEmailJob({ bookingId: promotedBookingId })
      );
    } else {
      console.log(`[worker] No waitlisted booking to promote for event ${eventId}`);
    }
  },
  {
    connection: getBullRedisClient(),
    concurrency: 5,
  }
);

const emailWorker = new Worker(
  EMAIL_QUEUE_NAME,
  async (job) => {
    if (job.name === "confirmation") {
      const { bookingId } = job.data as { bookingId: string };
      await sendConfirmationEmail(bookingId);
    }
  },
  {
    connection: getBullRedisClient(),
    concurrency: 10,
  }
);

waitlistWorker.on("completed", (job) => {
  console.log(`[worker] Waitlist promotion job ${job.id} completed`);
});

waitlistWorker.on("failed", (job, err) => {
  console.error(`[worker] Waitlist promotion job ${job?.id} failed:`, err);
});

emailWorker.on("completed", (job) => {
  console.log(`[worker] Email job ${job.id} completed`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`[worker] Email job ${job?.id} failed:`, err);
});

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[worker] Shutting down...");

  const forceExit = setTimeout(() => {
    console.error("[worker] forced exit after timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await waitlistWorker.close().catch(() => undefined);
  await emailWorker.close().catch(() => undefined);
  await waitlistPromoteQueueEvents.close().catch(() => undefined);
  await emailQueueEvents.close().catch(() => undefined);
  await closeBullRedisClients().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);

  console.log("[worker] shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

console.log("[worker] Started - waiting for jobs...");
console.log(`[worker] Listening on queues: ${WAITLIST_PROMOTE_QUEUE_NAME}, ${EMAIL_QUEUE_NAME}`);