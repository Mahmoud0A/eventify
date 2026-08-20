// Debug helper — prints the current booking tally for the capacity-test event.
// Run after seeding: `npx tsx scripts/debug-parallel.ts`

import { prisma } from "../src/lib/prisma.ts";

const eventId = "565737d2-86e2-408d-8d5a-776418629279";

async function main(): Promise<void> {
  const [confirmed, cancelled, total] = await Promise.all([
    prisma.booking.count({ where: { eventId, status: "CONFIRMED" } }),
    prisma.booking.count({ where: { eventId, status: "CANCELLED" } }),
    prisma.booking.count({ where: { eventId } }),
  ]);

  console.log(`Event ${eventId}`);
  console.log(`  CONFIRMED: ${confirmed}`);
  console.log(`  CANCELLED: ${cancelled}`);
  console.log(`  total rows: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
