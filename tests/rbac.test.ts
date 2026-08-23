// RBAC integration tests — ORGANIZER vs ATTENDEE vs unauthenticated.
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.ts";
import { prisma } from "../src/lib/prisma.ts";
import { createEvent, signup } from "./helpers/api.ts";

describe("rbac (events)", () => {
  it("ORGANIZER can create an event that is persisted", async () => {
    const organizer = await signup("org", "ORGANIZER");
    const event = await createEvent(organizer.accessToken, { capacity: 5 });

    expect(event.id).toBeTruthy();
    expect(event.organizerId).toBe(organizer.userId);
    expect(event.capacity).toBe(5);

    const persisted = await prisma.event.findUnique({ where: { id: event.id } });
    expect(persisted).not.toBeNull();
    expect(persisted!.title).toBe(event.title);
  });

  it("ATTENDEE receives 403 when creating an event", async () => {
    const attendee = await signup("att-forbidden", "ATTENDEE");
    const res = await request(app)
      .post("/v1/events")
      .set("Authorization", `Bearer ${attendee.accessToken}`)
      .send({
        title: `S6 Forbidden ${Date.now()}`,
        startsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        capacity: 1,
        priceCents: 0,
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Insufficient permissions");
  });

  it("unauthenticated request receives 401", async () => {
    const res = await request(app)
      .post("/v1/events")
      .send({
        title: `S6 Anon ${Date.now()}`,
        startsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        capacity: 1,
        priceCents: 0,
      });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });
});
