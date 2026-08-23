// Session 5 acceptance — Option A: WAITLIST PROMOTION
// Run: npx tsx --env-file=.env scripts/session5-waitlist.ts
// Requires: API on :3000, worker running, Postgres + Redis healthy.

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const stamp = Date.now();

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}`, detail ?? "");
  }
}

interface BookingJson {
  id: string;
  userId: string;
  eventId: string;
  status: string;
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function signup(label: string): Promise<{ token: string; userId: string }> {
  const role = label.startsWith("org") ? "ORGANIZER" : "ATTENDEE";
  const res = await fetch(`${BASE}/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `s5-${label}-${stamp}@test.local`,
      password: "password123",
      name: `S5 ${label}`,
      role,
    }),
  });
  if (res.status !== 201) throw new Error(`signup ${label} failed: ${res.status} ${await res.text()}`);
  const body = await json<{ accessToken: string }>(res);
  // decode JWT payload to obtain the real user id for the X-User-Id test bypass
  const payloadB64 = body.accessToken.split(".")[1]!;
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { sub: string };
  return { token: body.accessToken, userId: payload.sub };
}

async function createEvent(organizerToken: string, capacity: number): Promise<string> {
  const res = await fetch(`${BASE}/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${organizerToken}` },
    body: JSON.stringify({
      title: `S5 Waitlist Proof ${stamp}`,
      description: "capacity-aware waitlist acceptance",
      venue: "Test Hall",
      startsAt: new Date(stamp + 7 * 24 * 3600 * 1000).toISOString(),
      capacity,
      priceCents: 0,
    }),
  });
  if (res.status !== 201) throw new Error(`event create failed: ${res.status} ${await res.text()}`);
  const body = await json<{ id: string }>(res);
  return body.id;
}

async function book(userId: string, eventId: string): Promise<{ status: number; booking: BookingJson | null }> {
  const res = await fetch(`${BASE}/v1/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
    body: JSON.stringify({ eventId }),
  });
  const text = await res.text();
  return { status: res.status, booking: res.status === 201 ? (JSON.parse(text) as BookingJson) : null };
}

async function getBooking(id: string, userId: string): Promise<BookingJson> {
  const res = await fetch(`${BASE}/v1/bookings/${id}`, { headers: { "X-User-Id": userId } });
  if (res.status !== 200) throw new Error(`get booking failed: ${res.status}`);
  return json<BookingJson>(res);
}

async function cancel(id: string, userId: string): Promise<number> {
  const res = await fetch(`${BASE}/v1/bookings/${id}`, {
    method: "DELETE",
    headers: { "X-User-Id": userId },
  });
  return res.status;
}

async function waitFor(condition: () => Promise<boolean>, timeoutMs: number, label: string): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(`TIMEOUT waiting for ${label}`);
  return false;
}

async function main(): Promise<void> {
  // -- setup -----------------------------------------------------------------
  const organizer = await signup(`org-${stamp}`);
  const eventId = await createEvent(organizer.token, 2);
  const u1 = (await signup(`att1-${stamp}`)).userId;
  const u2 = (await signup(`att2-${stamp}`)).userId;
  const u3 = (await signup(`att3-${stamp}`)).userId;
  console.log(`event=${eventId}`);

  // -- 1. full event -> CONFIRMED, CONFIRMED, WAITLISTED ----------------------
  const b1 = await book(u1, eventId);
  check("booking1 CONFIRMED (201)", b1.status === 201 && b1.booking?.status === "CONFIRMED", b1);

  const b2 = await book(u2, eventId);
  check("booking2 CONFIRMED (201)", b2.status === 201 && b2.booking?.status === "CONFIRMED", b2);

  const b3 = await book(u3, eventId);
  check("full event -> WAITLISTED created (201, not 409)", b3.status === 201 && b3.booking?.status === "WAITLISTED", b3);

  const dup = await book(u3, eventId);
  check("duplicate waitlisted booking rejected 409", dup.status === 409, dup.status);

  // -- 2. cancel a CONFIRMED booking -> enqueue promote ----------------------
  const cancelStatus = await cancel(b1.booking!.id, u1);
  check("cancel CONFIRMED booking -> 200 soft-cancel", cancelStatus === 200, cancelStatus);
  const afterCancel = await getBooking(b1.booking!.id, u1);
  check("cancellation is soft (row kept, CANCELLED)", afterCancel.status === "CANCELLED", afterCancel);

  // -- 3. worker promotes OLDEST waitlisted inside tx ------------------------
  let promoted: BookingJson | null = null;
  const promotedInTime = await waitFor(async () => {
    const cur = await getBooking(b3.booking!.id, u3);
    if (cur.status === "CONFIRMED") {
      promoted = cur;
      return true;
    }
    return false;
  }, 15000, "waitlist promotion");
  check("oldest WAITLISTED promoted to CONFIRMED by worker", promotedInTime, promoted);

  // exactly one seat filled: u2 CONFIRMED + u3 CONFIRMED, u1 stays CANCELLED
  const u1b = await getBooking(b1.booking!.id, u1);
  const u2b = await getBooking(b2.booking!.id, u2);
  check(
    "post-promotion state: u1=CANCELLED u2=CONFIRMED u3=CONFIRMED",
    u1b.status === "CANCELLED" && u2b.status === "CONFIRMED" && promoted !== null,
    { u1: u1b.status, u2: u2b.status, u3: promoted }
  );

  // -- 5. re-run promotion does NOT double-promote ----------------------------
  // Enqueue a second promote job for the same event directly against the queue.
  const { addWaitlistPromoteJob } = await import("../src/jobs/waitlist.queue.ts");
  await addWaitlistPromoteJob({ eventId });
  await new Promise((r) => setTimeout(r, 4000)); // allow worker to consume it

  const reU1 = await getBooking(b1.booking!.id, u1);
  const reU2 = await getBooking(b2.booking!.id, u2);
  const reU3 = await getBooking(b3.booking!.id, u3);
  const confirmedCount = [reU1, reU2, reU3].filter((b) => b.status === "CONFIRMED").length;
  check("re-run promotion is idempotent (still exactly 2 CONFIRMED)", confirmedCount === 2, {
    confirmedCount,
    states: [reU1.status, reU2.status, reU3.status],
  });

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(2);
});
