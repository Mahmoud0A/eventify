// Config — extends env schema, reads DATABASE_URL through this module
// Never process.env directly; always go through src/config.ts

import { config as dotenvConfig } from "dotenv";
import path from "path";
import { z } from "zod";

// Load .env file from the project root
dotenvConfig({ path: path.resolve("./.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  PORT: z.string().default("3000"),
});

export const env = envSchema.parse(process.env);

export function getDbUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }
  return env.DATABASE_URL;
}