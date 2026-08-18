import { readFile } from "node:fs/promises";

interface UserFixture {
  userId: string;
  token: string;
}

interface Fixtures {
  baseUrl: string;
  eventId: string;
  capacity: number;
  users: UserFixture[];
}

async function loadFixtures(): Promise<Fixtures> {
  const raw = await readFile(new URL("./fixtures/parallel-users.json", import.meta.url), "utf-8");
  return JSON.parse(raw) as Fixtures;
}

async function book(fixtures: Fixtures, userId: string): Promise<number> {
  const res = await fetch(`${fixtures.baseUrl}/v1/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ eventId: fixtures.eventId }),
  });
  return res.status;
}

async function main() {
  const fixtures = await loadFixtures();

  if (fixtures.users.length !== fixtures.capacity * 4) {
    console.error(`Expected ${fixtures.capacity * 4} users, got ${fixtures.users.length}`);
    process.exit(1);
  }

  const results = await Promise.all(
    fixtures.users.map((u) => book(fixtures, u.userId))
  );

  const tally: Record<number, number> = {};
  for (const status of results) {
    tally[status] = (tally[status] || 0) + 1;
  }

  console.log("Status tally:", tally);

  const expected201 = fixtures.capacity;
  const actual201 = tally[201] || 0;
  if (actual201 !== expected201) {
    console.error(`Expected exactly ${expected201}× 201, got ${actual201}× 201`);
    process.exit(1);
  }

  console.log("PASS: oversell prevented");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});