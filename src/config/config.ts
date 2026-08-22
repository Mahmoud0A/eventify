// Config — extends env schema

import { config as dotenvConfig } from "dotenv";
import path from "path";
import { z } from "zod";

dotenvConfig({ path: path.resolve("./.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  PORT: z.string().default("3000"),
  JWT_ACCESS_SECRET: z.string().min(32),
  WEB_ORIGIN: z.string().url().optional(),
  TEST_AUTH_ENABLED: z.enum(["true", "false"]).default("false"),
});

export const env = envSchema.parse(process.env);

export function getDbUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }
  return env.DATABASE_URL;
}