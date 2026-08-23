import { Queue, QueueEvents } from "bullmq";
import { getBullRedisClient } from "../infra/queue-backend.ts";

export const WAITLIST_PROMOTE_QUEUE_NAME = "waitlist-promote";

export const waitlistPromoteQueue = new Queue(WAITLIST_PROMOTE_QUEUE_NAME, {
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

export const waitlistPromoteQueueEvents = new QueueEvents(WAITLIST_PROMOTE_QUEUE_NAME, {
  connection: getBullRedisClient(),
});

export interface WaitlistPromotePayload {
  eventId: string;
}

export async function addWaitlistPromoteJob(payload: WaitlistPromotePayload) {
  await waitlistPromoteQueue.add("promote", payload, {
    // BullMQ v6 forbids ":" in custom job ids — use dashes
    jobId: `promote-${payload.eventId}-${Date.now()}`,
  });
}

export async function closeWaitlistPromoteQueue(): Promise<void> {
  await waitlistPromoteQueue.close();
  await waitlistPromoteQueueEvents.close();
}