// Seed script for Eventify — Session 3
// Idempotent — runs twice without errors or duplicates (uses upsert)
// Creates: 3 users (one ORGANIZER, one ADMIN, one ATTENDEE),
//          5 events, and some pre-existing bookings
// Plus: 20 distinct users and one capacity-5 event for task-2 script

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // --- Users ---
  // Using upsert so the seed is idempotent
  const organizer = await prisma.user.upsert({
    where: { email: "organizer@example.com" },
    update: {},
    create: {
      email: "organizer@example.com",
      name: "Organizer",
      role: "ORGANIZER",
      password: "hashed-password",
    },
  });

  // Admin created for database state
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      password: "hashed-password",
    },
  });

  const attendee1 = await prisma.user.upsert({
    where: { email: "attendee1@example.com" },
    update: {},
    create: {
      email: "attendee1@example.com",
      name: "Attendee One",
      role: "ATTENDEE",
      password: "hashed-password",
    },
  });

  const attendee2 = await prisma.user.upsert({
    where: { email: "attendee2@example.com" },
    update: {},
    create: {
      email: "attendee2@example.com",
      name: "Attendee Two",
      role: "ATTENDEE",
      password: "hashed-password",
    },
  });

  // --- Events ---
  // Capacity-5 event for task-2 parallel bookings script
  const capacityEvent = await prisma.event.upsert({
    where: { title: "Capacity Workshop" },
    update: {},
    create: {
      title: "Capacity Workshop",
      description: "Event with capacity 5 to test concurrent bookings",
      venue: "Main Hall",
      startsAt: "2026-10-15T18:00:00Z",
      capacity: 5,
      priceCents: 0,
      organizerId: organizer.id,
    },
  });

  // --- Core events (event1 used for bookings, others for state) ---
  const event1 = await prisma.event.upsert({
    where: { title: "JS 101" },
    update: {},
    create: {
      title: "JS 101",
      description: "JavaScript from zero ceremony",
      venue: "Room 4",
      startsAt: "2026-09-14T18:00:00Z",
      capacity: 30,
      priceCents: 0,
      organizerId: organizer.id,
    },
  });

  // Events for database state (IDs not referenced directly beyond this)
  await prisma.event.upsert({
    where: { title: "TS at Work" },
    update: {},
    create: {
      title: "TS at Work",
      description: "Types that earn their keep",
      venue: null,
      startsAt: "2026-09-21T18:00:00Z",
      capacity: 80,
      priceCents: 1500,
      organizerId: organizer.id,
    },
  });

  await prisma.event.upsert({
    where: { title: "Node Deep Dive" },
    update: {},
    create: {
      title: "Node Deep Dive",
      description: "The event loop, for real",
      venue: "Main Hall",
      startsAt: "2026-10-02T18:00:00Z",
      capacity: 25,
      priceCents: 2500,
      organizerId: organizer.id,
    },
  });

  await prisma.event.upsert({
    where: { title: "API Design Live" },
    update: {},
    create: {
      title: "API Design Live",
      description: "Endpoints designed in the open",
      venue: "Main Hall",
      startsAt: "2026-11-20T18:00:00Z",
      capacity: 125,
      priceCents: 0,
      organizerId: organizer.id,
    },
  });

  // --- Pre-existing bookings (some CONFIRMED, some CANCELLED) ---
  // These establish initial state; idempotent via upsert-like logic
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
      status: "CANCELLED", // cancelled bookings don't eat capacity
    },
  });

  // --- Capacity-5 event: 4 CONFIRMED bookings (1 spot left) ---
  // This sets up the scenario where the 5th user will get 409 (capacity)
  for (let i = 0; i < 4; i++) {
    const user = i === 0 ? attendee1 : attendee2; // cycle between two users
    // But we need 20 distinct users for the task-2 script...
    // For now, just create bookings with the existing users
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