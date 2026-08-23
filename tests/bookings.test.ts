// Booking integration tests — real JWT auth against the Session 5 semantics:
// full events produce WAITLISTED (not 409), cancellation is soft, and
// cancel-then-rebook reopens the SAME row instead of duplicating it.
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.ts";
import { prisma } from "../src/lib/prisma.ts";
import { book, createEvent, signup } from "./helpers/api.ts";

describe("bookings", () => {
  it("books an under-capacity event as CONFIRMED and persists it", async () => {
    const organizer = await signup("b-org", "ORGANIZER");
    const attendee = await signup("b-att");
    const event = await createEvent(organizer.accessToken, { capacity: 2 });

    const res = await book(attendee.accessToken, event.id);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("CONFIRMED");
    expect(res.body.userId).toBe(attendee.userId);
    expect(res.body.eventId).toBe(event.id);

    const persisted = await prisma.booking.findUnique({
      where: { id: res.body.id },
    });
    expect(persisted?.status).toBe("CONFIRMED");
  });

  it("rejects a duplicate CONFIRMED booking with 409", async () => {
    const organizer = await signup("d-org", "ORGANIZER");
    const attendee = await signup("d-att");
    const event = await createEvent(organizer.accessToken, { capacity: 5 });

    const first = await book(attendee.accessToken, event.id);
    expect(first.status).toBe(201);

    const second = await book(attendee.accessToken, event.id);
    expect(second.status).toBe(409);
  });

  it("creates a WAITLISTED booking when the event is full (Session 5 behavior)", async () => {
    const organizer = await signup("w-org", "ORGANIZER");
    const firstAttendee = await signup("w-first");
    const secondAttendee = await signup("w-second");
    const event = await createEvent(organizer.accessToken, { capacity: 1 });

    const confirmed = await book(firstAttendee.accessToken, event.id);
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.status).toBe("CONFIRMED");

    // event at capacity -> still 201, but WAITLISTED instead of 409
    const waitlisted = await book(secondAttendee.accessToken, event.id);
    expect(waitlisted.status).toBe(201);
    expect(waitlisted.body.status).toBe("WAITLISTED");

    const persisted = await prisma.booking.findUnique({
      where: { id: waitlisted.body.id },
    });
    expect(persisted?.status).toBe("WAITLISTED");
  });

  it("cancel-then-rebook reopens the SAME row to CONFIRMED without duplicates", async () => {
    const organizer = await signup("c-org", "ORGANIZER");
    const attendee = await signup("c-att");
    const event = await createEvent(organizer.accessToken, { capacity: 2 });

    const booked = await book(attendee.accessToken, event.id);
    expect(booked.status).toBe(201);
    const bookingId = booked.body.id as string;

    // soft cancel: row must remain, status CANCELLED
    const cancel = await request(app)
      .delete(`/v1/bookings/${bookingId}`)
      .set("Authorization", `Bearer ${attendee.accessToken}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe("CANCELLED");

    const cancelledRow = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    expect(cancelledRow).not.toBeNull();
    expect(cancelledRow!.status).toBe("CANCELLED");

    // rebook the same event: seat is free -> reopened CONFIRMED
    const rebooked = await book(attendee.accessToken, event.id);
    expect(rebooked.status).toBe(201);
    expect(rebooked.body.status).toBe("CONFIRMED");

    // no duplicate row for this (user, event) pair
    const rowsForPair = await prisma.booking.findMany({
      where: { userId: attendee.userId, eventId: event.id },
    });
    expect(rowsForPair).toHaveLength(1);
    expect(rowsForPair[0]!.id).toBe(bookingId);
    expect(rowsForPair[0]!.status).toBe("CONFIRMED");
  });

  it("prevents attendees from cancelling someone else's booking", async () => {
    const organizer = await signup("x-org", "ORGANIZER");
    const owner = await signup("x-owner");
    const stranger = await signup("x-stranger");
    const event = await createEvent(organizer.accessToken, { capacity: 3 });

    const booked = await book(owner.accessToken, event.id);
    expect(booked.status).toBe(201);

    const res = await request(app)
      .delete(`/v1/bookings/${booked.body.id}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(res.status).toBe(403);

    const row = await prisma.booking.findUnique({
      where: { id: booked.body.id },
    });
    expect(row!.status).toBe("CONFIRMED"); // untouched
  });
});
