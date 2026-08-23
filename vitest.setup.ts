// Vitest global setup — runs BEFORE any test module is imported, so env
// overrides here take effect before config.ts / Prisma are loaded.
//
// Isolation strategy:
// - Tests ALWAYS target the `eventify_test` PostgreSQL database (never the
//   development `eventify` database — a hard guard enforces the `_test`
//   suffix on every resolved URL).
// - If eventify_test does not exist it is created automatically.
// - Migrations are applied to eventify_test once per run.
// - Every table is truncated after each test; Redis tests use DB 1 and get
//   flushed between tests.
//
// NOTE: application modules are imported DYNAMICALLY below on purpose.
// They parse environment variables at module-load time; a static import
// would be hoisted above the env overrides and bind Prisma to the dev DB.

import { execSync } from "node:child_process";
import { Client } from "pg";
import { afterAll, afterEach } from "vitest";
import { config as dotenvConfig } from "dotenv";

// Vitest does not auto-load .env. Load it here WITHOUT overriding variables
// that are already set (CI provides its own DATABASE_URL/REDIS_URL).
dotenvConfig();

function deriveTestUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "/eventify_test";
  return parsed.toString();
}

const sourceUrl =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

if (!sourceUrl) {
  throw new Error(
    "TEST_DATABASE_URL or DATABASE_URL must be set to run tests (got neither)"
  );
}

const testDbUrl = deriveTestUrl(sourceUrl);

if (!new URL(testDbUrl).pathname.endsWith("_test")) {
  throw new Error(
    `Refusing to run tests against non-test database: ${new URL(testDbUrl).pathname}`
  );
}

// Must be set before anything imports src/config/config.ts (module-load zod
// parse). dotenv never overrides pre-existing process.env keys.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDbUrl;
process.env.TEST_AUTH_ENABLED = "false";

// Dedicated Redis database for tests (db 1) so cache/rate-limit/queue state
// never touches the development Redis scope (db 0).
{
  const redis = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  redis.pathname = "/1";
  process.env.REDIS_URL = redis.toString();
}

async function ensureTestDatabaseExists(): Promise<void> {
  const admin = new URL(testDbUrl);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "eventify_test"`);
    console.log("[test-setup] created database eventify_test");
  } catch {
    // 42P04 duplicate_database — already exists, fine
  } finally {
    await client.end();
  }
}

function applyMigrations(): void {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testDbUrl },
  });
}

await ensureTestDatabaseExists();
applyMigrations();

const { prisma } = await import("./src/lib/prisma.ts");
const { getRedisClient } = await import("./src/infra/redis.ts");

async function truncateAll(): Promise<void> {
  // Schema tables only — _prisma_migrations is left intact.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Booking", "RefreshToken", "Event", "User" RESTART IDENTITY CASCADE`
  );
}

afterEach(async () => {
  await truncateAll();
  try {
    await getRedisClient().flushDb();
  } catch {
    // best-effort: Redis may be unavailable in some environments
  }
});

afterAll(async () => {
  await prisma.$disconnect();
  try {
    const redis = getRedisClient();
    await redis.flushDb();
    await redis.quit();
  } catch {
    // already closed / unreachable
  }
});