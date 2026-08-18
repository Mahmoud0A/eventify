// Config — extends env schema, reads DATABASE_URL through this module
// Never process.env directly; always go through src/config.ts

import { config as dotenvConfig } from "dotenv";
import path from "path";

// Load .env file from the project root
dotenvConfig({ path: path.resolve("./.env") });

// Export configured variables
export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
};

// Type-safe accessor
export function getDbUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }
  return env.DATABASE_URL;
}