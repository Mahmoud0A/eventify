import { defineConfig } from "@prisma/config";
import { getDbUrl } from "./src/config/config.ts";

export default defineConfig({
  datasource: {
    url: getDbUrl(),
  },
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx ./prisma/seed.ts",
  },
});