// Cache invalidation integration test — one focused scenario: a cached event
// must reflect fresh data after a write, never the stale cached value.
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.ts";
import { createEvent, signup } from "./helpers/api.ts";

describe("event cache invalidation", () => {
  it("serves fresh data after an update invalidates the cached event", async () => {
    const organizer = await signup("cache-org", "ORGANIZER");
    const event = await createEvent(organizer.accessToken, {
      priceCents: 1500,
      description: "before update",
    });

    // populate the cache (miss -> SET event:{id})
    const firstRead = await request(app).get(`/v1/events/${event.id}`);
    expect(firstRead.status).toBe(200);
    expect(firstRead.body.priceCents).toBe(1500);

    // second read is served from the cache
    const cachedRead = await request(app).get(`/v1/events/${event.id}`);
    expect(cachedRead.status).toBe(200);
    expect(cachedRead.body.priceCents).toBe(1500);

    // write -> PATCH deletes event:{id} and bumps the list version
    const patch = await request(app)
      .patch(`/v1/events/${event.id}`)
      .set("Authorization", `Bearer ${organizer.accessToken}`)
      .send({ priceCents: 5555, description: "after update" });
    expect(patch.status).toBe(200);
    expect(patch.body.priceCents).toBe(5555);

    // read again: must reflect the new state, not stale cached data
    const afterUpdate = await request(app).get(`/v1/events/${event.id}`);
    expect(afterUpdate.status).toBe(200);
    expect(afterUpdate.body.priceCents).toBe(5555);
    expect(afterUpdate.body.description).toBe("after update");
    expect(afterUpdate.body.id).toBe(event.id);
  });
});
