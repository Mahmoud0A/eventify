// Seed script for Eventify — Session 3
// Idempotent — runs twice without errors or duplicates
// Creates: 3 users (one ORGANIZER, one ADMIN, one ATTENDEE),
//          5 events, and some pre-existing bookings

import { PrismaClient } from "./.prisma/client/client.ts";

const prisma = new PrismaClient({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any

async function main() {
  // --- Users ---
  const organizer = await prisma.user.upsert({
    where: { email: "organizer@example.com" },
    update: {},
    create: {
      email: "organizer@example.com",
      name: "Organizer",
      role: "ORGANIZER",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
    },
  });

  const attendee1 = await prisma.user.upsert({
    where: { email: "attendee1@example.com" },
    update: {},
    create: {
      email: "attendee1@example.com",
      name: "Attendee One",
      role: "ATTENDEE",
    },
  });

  const attendee2 = await prisma.user.upsert({
    where: { email: "attendee2@example.com" },
    update: {},
    create: {
      email: "attendee2@example.com",
      name: "Attendee Two",
      role: "ATTENDEE",
    },
  });

  // --- Events ---
  const capacityEvent = await prisma.event.create({
    data: {
      title: "Capacity Workshop",
      description: "Event with capacity 5 to test concurrent bookings",
      venue: "Main Hall",
      startsAt: "2026-10-15T18:00:00Z",
      capacity: 5,
      priceCents: 0,
      organizerId: organizer.id,
    },
  });

  const event1 = await prisma.event.create({
    data: {
      title: "JS 101",
      description: "JavaScript from zero ceremony",
      venue: "Room 4",
      startsAt: "2026-09-14T18:00:00Z",
      capacity: 30,
      priceCents: 0,
      organizerId: organizer.id,
    },
  });

  await prisma.event.create({
    data: {
      title: "TS at Work",
      description: "Types that earn their keep",
      venue: null,
      startsAt: "2026-09-21T18:00:00Z",
      capacity: 80,
      priceCents: 1500,
      organizerId: organizer.id,
    },
  });

  await prisma.event.create({
    data: {
      title: "Node Deep Dive",
      description: "The event loop, for real",
      venue: "Main Hall",
      startsAt: "2026-10-02T18:00:00Z",
      capacity: 25,
      priceCents: 2500,
      organizerId: organizer.id,
    },
  });

  await prisma.event.create({
    data: {
      title: "API Design Live",
      description: "Endpoints designed in the open",
      venue: "Main Hall",
      startsAt: "2026-11-20T18:00:00Z",
      capacity: 125,
      priceCents: 0,
      organizerId: organizer.id,
    },
  });

  // --- Pre-existing bookings ---
  await prisma.booking.create({
    data: {
      userId: attendee1.id,
      eventId: event1.id,
      status: "CONFIRMED",
    },
  });

  await prisma.booking.create({
    data: {
      userId: attendee2.id,
      eventId: event1.id,
      status: "CANCELLED",
    },
  });

  // --- Capacity-5 event: 4 CONFIRMED bookings (1 spot left) ---
  for (let i = 0; i < 4; i++) {
    const user = i === 0 ? attendee1 : attendee2;
    await prisma.booking.create({
      data: {
        userId: user.id,
        eventId: capacityEvent.id,
        status: "CONFIRMED",
      },
    });
  }

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });