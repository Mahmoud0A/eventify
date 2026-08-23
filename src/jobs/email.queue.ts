import { Queue, QueueEvents } from "bullmq";
import { getBullRedisClient } from "../infra/queue-backend.ts";

export const EMAIL_QUEUE_NAME = "booking-email";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: getBullRedisClient(),
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: getBullRedisClient(),
});

export interface ConfirmationEmailPayload {
  bookingId: string;
}

export async function addConfirmationEmailJob(payload: ConfirmationEmailPayload) {
  await emailQueue.add("confirmation", payload, {
    // BullMQ v6 forbids ":" in custom job ids — use dashes
    jobId: `confirmation-${payload.bookingId}`,
  });
}

export async function closeEmailQueue(): Promise<void> {
  await emailQueue.close();
  await emailQueueEvents.close();
}