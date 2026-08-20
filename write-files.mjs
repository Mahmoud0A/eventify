import fs from "fs";
import path from "path";

const files = {
  "src/domain.ts": "// Domain types\n\nexport type Role = \"ATTENDEE\" | \"ORGANIZER\" | \"ADMIN\";\n\nexport type BookingStatus = \"CONFIRMED\" | \"CANCELLED\" | \"WAITLISTED\";\n\nexport interface Event {\n  id: string;\n  title: string;\n  description: string;\n  venue: string | null;\n  startsAt: string;\n  capacity: number;\n  priceCents: number;\n  organizerId: string;\n  createdAt: string;\n}\n\nexport interface User {\n  id: string;\n  email: string;\n  name: string;\n  role: Role;\n  createdAt: string;\n}\n\nexport interface Booking {\n  id: string;\n  userId: string;\n  eventId: string;\n  status: BookingStatus;\n  createdAt: string;\n}\n\nexport function findById<T extends { id: string }>(arr: Array<T>, id: string): T | undefined {\n  return arr.find((item) => item.id === id);\n}",
  "src/config/config.ts": "// Config \u2014 extends env schema\n\nimport { config as dotenvConfig } from \"dotenv\";\nimport path from \"path\";\nimport { z } from \"zod\";\n\ndotenvConfig({ path: path.resolve(\"./.env\") });\n\nconst envSchema = z.object({\n  DATABASE_URL: z.string().url().optional(),\n  PORT: z.string().default(\"3000\"),\n  JWT_ACCESS_SECRET: z.string().min(32),\n  WEB_ORIGIN: z.string().url().optional(),\n});\n\nexport const env = envSchema.parse(process.env);\n\nexport function getDbUrl(): string {\n  if (!env.DATABASE_URL) {\n    throw new Error(\"DATABASE_URL is not defined\");\n  }\n  return env.DATABASE_URL;\n}"
};
for (const [file, content] of Object.entries(files)) {
  fs.writeFileSync(file, content);
  console.log("Wrote:", file);
}
