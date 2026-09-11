import { createClient, RedisClientType } from "redis";
import { createNodeRedisClient } from "bullmq";
import { env } from "../config/config.ts";

// BullMQ requires a dedicated connection per blocking consumer (each Worker
// and each QueueEvents instance). This factory hands out a fresh node-redis
// client wrapped for BullMQ on every call — separate from the cache/limiter
// client in infra/redis.ts, avoiding blocking command interference.
const openClients: RedisClientType[] = [];

export function getBullRedisClient() {
  const raw = createClient({ url: env.REDIS_URL });

  raw.on("error", (err: Error) => {
    console.error("[bullmq-redis] Client error:", err);
  });
  raw.on("ready", () => {
    console.log("[bullmq-redis] Ready");
  });

  openClients.push(raw);
  void raw.connect();

  return createNodeRedisClient(raw);
}

export async function closeBullRedisClients(): Promise<void> {
  while (openClients.length > 0) {
    const client = openClients.pop();
    if (client) {
      await client.quit().catch(() => undefined);
    }
  }
}