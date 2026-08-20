// Seed script for Eventify — Session 3
// Idempotent — runs twice without errors or duplicates
// Creates: 21 users (two ORGANIZERs, one ADMIN, attendees),
//          6 events, and some pre-existing bookings
// Plus: 20 distinct users and one capacity-5 event for task-2 script

import { PrismaClient } from "../.prisma/client/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { getDbUrl } from "../src/config/config.ts";
import { Role } from "../src/domain.ts";

const adapter = new PrismaPg(getDbUrl());
const prisma = new PrismaClient({ adapter });

// Known password for every seeded user so the accounts are usable for testing auth.
const DEFAULT_PASSWORD = "Password123!";
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

async function main() {
  // --- Users ---
  const users = [];
  const userEmails: { email: string; name: string; role: Role }[] = [
    { email: "organizer@example.com", name: "Organizer", role: "ORGANIZER" },
    { email: "organizer2@example.com", name: "Organizer Two", role: "ORGANIZER" },
    { email: "admin@example.com", name: "Admin", role: "ADMIN" },
    { email: "attendee1@example.com", name: "Attendee One", role: "ATTENDEE" },
    { email: "attendee2@example.com", name: "Attendee Two", role: "ATTENDEE" },
  ];

  for (let i = 3; i < 20; i++) {
    userEmails.push({
      email: "user-" + i + "@example.com",
      name: "User " + i,
      role: "ATTENDEE",
    });
  }

  for (const u of userEmails) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { email: u.email },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: DEFAULT_PASSWORD_HASH,
      },
    });
    users.push(user);
  }

  const organizer = users[0]!;
  const organizer2 = users[1]!;
  const attendee1 = users[3]!;
  const attendee2 = users[4]!;

  // --- Events ---
  const eventsData = [
    { title: "Capacity Workshop", description: "Event with capacity 5 to test concurrent bookings", venue: "Main Hall", startsAt: "2026-10-15T18:00:00Z", capacity: 5, priceCents: 0, organizerId: organizer.id },
    { title: "JS 101", description: "JavaScript from zero ceremony", venue: "Room 4", startsAt: "2026-09-14T18:00:00Z", capacity: 30, priceCents: 0, organizerId: organizer.id },
    { title: "TS at Work", description: "Types that earn their keep", venue: null, startsAt: "2026-09-21T18:00:00Z", capacity: 80, priceCents: 1500, organizerId: organizer2.id },
    { title: "Node Deep Dive", description: "The event loop, for real", venue: "Main Hall", startsAt: "2026-10-02T18:00:00Z", capacity: 25, priceCents: 2500, organizerId: organizer.id },
    { title: "API Design Live", description: "Endpoints designed in the open", venue: "Main Hall", startsAt: "2026-11-20T18:00:00Z", capacity: 125, priceCents: 0, organizerId: organizer2.id },
  ];

  for (const ev of eventsData) {
    await prisma.event.upsert({
      where: { title: ev.title },
      create: ev,
      update: ev,
    });
  }

  const capacityEvent = await prisma.event.findUniqueOrThrow({ where: { title: "Capacity Workshop" } });
  const event1 = await prisma.event.findUniqueOrThrow({ where: { title: "JS 101" } });

  // --- Pre-existing bookings ---
  await prisma.booking.upsert({
    where: { userId_eventId: { userId: attendee1.id, eventId: event1.id } },
    create: { userId: attendee1.id, eventId: event1.id, status: "CONFIRMED" },
    update: { status: "CONFIRMED" },
  });

  await prisma.booking.upsert({
    where: { userId_eventId: { userId: attendee2.id, eventId: event1.id } },
    create: { userId: attendee2.id, eventId: event1.id, status: "CANCELLED" },
    update: { status: "CANCELLED" },
  });

  console.log("Seed completed successfully");
  console.log("Capacity event ID:", capacityEvent.id);
  console.log("User IDs:", users.map((u) => u!.id).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });