import { createClient, RedisClientType } from "redis";
import { env } from "../config/config.ts";

let redisClient: RedisClientType | null = null;
let isConnecting = false;

export function getRedisClient(): RedisClientType {
  if (redisClient) return redisClient;

  if (isConnecting) {
    throw new Error("Redis client connection already in progress");
  }

  isConnecting = true;

  redisClient = createClient({
    url: env.REDIS_URL,
  });

  redisClient.on("error", (err: Error) => {
    console.error("[redis] Client error:", err);
  });

  redisClient.on("connect", () => {
    console.log("[redis] Connected");
  });

  redisClient.on("ready", () => {
    console.log("[redis] Ready");
  });

  redisClient.on("reconnecting", () => {
    console.log("[redis] Reconnecting...");
  });

  redisClient.connect().catch((err: Error) => {
    isConnecting = false;
    redisClient = null;
    throw err;
  });

  isConnecting = false;
  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export function getCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(":")}`;
}

export function rateLimitKey(ip: string, path: string, windowSec: number): string {
  return getCacheKey("rl", ip, path, String(windowSec));
}