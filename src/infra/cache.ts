import { getRedisClient, getCacheKey } from "./redis.ts";

const CACHE_TTL_BASE = 60;
const JITTER_MAX = 10;

let hitCount = 0;
let missCount = 0;
let lookupCount = 0;
let lastEmitTime = Date.now();

function getTtlWithJitter(): number {
  return CACHE_TTL_BASE + Math.floor(Math.random() * JITTER_MAX);
}

function maybeEmitMetrics(): void {
  const now = Date.now();
  if (lookupCount >= 100 || now - lastEmitTime >= 60_000) {
    const total = hitCount + missCount;
    const ratio = total > 0 ? hitCount / total : 0;
    console.log(JSON.stringify({
      type: "cache_metrics",
      hits: hitCount,
      misses: missCount,
      total: total,
      hitRatio: Math.round(ratio * 10000) / 10000,
      timestamp: new Date().toISOString(),
    }));
    hitCount = 0;
    missCount = 0;
    lookupCount = 0;
    lastEmitTime = now;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  const value = await client.get(key);
  lookupCount++;
  if (value === null) {
    missCount++;
    maybeEmitMetrics();
    return null;
  }
  hitCount++;
  maybeEmitMetrics();
  return JSON.parse(value) as T;
}

export async function cacheSet(key: string, value: unknown, ttl?: number): Promise<void> {
  const client = getRedisClient();
  const finalTtl = ttl ?? getTtlWithJitter();
  await client.setEx(key, finalTtl, JSON.stringify(value));
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedisClient();
  await client.del(key);
}

export async function cacheIncr(key: string): Promise<number> {
  const client = getRedisClient();
  return await client.incr(key);
}

export function eventCacheKey(id: string): string {
  return getCacheKey("event", id);
}

export function eventsListCacheKey(version: number, page: number): string {
  return getCacheKey("events:list", String(version), String(page));
}

export function eventsListVersionKey(): string {
  return getCacheKey("events:list", "v");
}

export async function getEventsListVersion(): Promise<number> {
  const client = getRedisClient();
  const version = await client.get(eventsListVersionKey());
  return version ? parseInt(version, 10) : 1;
}

export async function invalidateEventsListCache(): Promise<void> {
  await cacheIncr(eventsListVersionKey());
}