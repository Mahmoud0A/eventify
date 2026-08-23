// Testing-foundation smoke test — proves Supertest drives the real app and
// that the test environment is bound to eventify_test (not the dev DB).
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.ts";
import { prisma } from "../src/lib/prisma.ts";
import { env } from "../src/config/config.ts";

describe("testing foundation", () => {
  it("GET /health responds 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("Prisma is connected to the eventify_test database", async () => {
    expect(new URL(env.DATABASE_URL ?? "").pathname).toBe("/eventify_test");

    // Round-trip through eventify_test: insert + read back + cleanup proves
    // writes land in the test database.
    const user = await prisma.user.create({
      data: {
        email: `smoke-${Date.now()}@test.local`,
        passwordHash: "not-a-real-hash",
        role: "ATTENDEE",
      },
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.email).toBe(user.email);
    await prisma.user.delete({ where: { id: user.id } });
  });
});