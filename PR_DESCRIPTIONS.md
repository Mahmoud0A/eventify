# Eventify — PR Descriptions (Sessions 1–4)

One progressive project, one `eventify` repo. Each session below is what its PR
description must contain: what was built, how to run, where AI was used and what
it got wrong, and the exit ticket.

> **How to run (all sessions, from a fresh clone):**
> ```bash
> cp .env.example .env          # then set a real JWT_ACCESS_SECRET
> docker compose up -d
> npx prisma migrate dev
> npx prisma db seed
> npm install
> npm run dev                  # http://localhost:3000
> # Session 3 concurrency proof (after seeding):
> node scripts/parallel-bookings.ts
> ```
> Seeded accounts all use password `Password123!`. Two organizers are
> `organizer@example.com` / `organizer2@example.com`.

---

## Session 1 — Eventify's First Server

**What was built**
- `src/domain.ts`: `Role`, `BookingStatus` unions, `Event`, `User`, `Booking`,
  and the generic `findById`.
- A HTTP server answering `GET /health`, `GET /events`, `GET /events/:id`, plus a
  catch-all 404. One error shape: `{ "error": "..." }`.
- Events loaded asynchronously from `data/events.json` (`node:fs/promises`,
  async/await, try/catch); read failure logs and returns `500` while `/health`
  keeps answering `200`.

**Where AI was used, and one thing it got wrong**
- AI drafted `domain.ts` and the route table. It initially read the `:id` with a
  regex that also matched the literal string `"events"`, which would have made
  `GET /events/events` collide with `GET /events/:id`. I caught it by tracing the
  branch coverage for a garbage id and kept the split explicit.

**Exit ticket:** _(none specified for Session 1)_

---

## Session 2 — Bookings, Pagination & Consistency

**What was built**
- Layered `routes → controller → service` for `/v1/bookings` (POST create,
  GET by id, DELETE soft-cancel) and `/v1/events` (pagination + `venue`/`from`/
  `to` filtering, envelope `{ data, page, limit, total }`).
- `z.strictObject` body validation and a `validateQuery` middleware that puts
  parsed values in `res.locals.query` (never mutating `req.query`).
- Business logic (duplicate + capacity) lives in the **service**; the
  consistency pass leaves exactly one `res.status(500)` — inside the error
  middleware.

**Where AI was used, and one thing it got wrong**
- AI wrote the Zod schemas but used `z.object` (not `z.strictObject`), so a
  booking body containing an extra `userId` key was **accepted** instead of
  rejected with 400. I caught it against the drill's "unknown-key acceptance"
  check and switched to `z.strictObject` everywhere. (This same `userId`-in-body
  mistake resurfaced in Session 4 and is fixed there too.)

**Exit ticket:** _When Session 3 swaps the in-memory Map for Postgres, why do the
controllers not change?_ — Because controllers only call service methods; the
repository interface (and service signatures) stay identical — only the
repository implementation changes from an in-memory Map to Prisma.

---

## Session 3 — Bookings That Survive a Restart

**What was built**
- All `/v1/events` endpoints backed by Prisma repositories (`prisma.config.ts`,
  `prisma-client` generator, `@prisma/adapter-pg`). No in-memory stores remain.
- Transactional booking service (`Serializable` isolation, bounded retry on
  serialization failure): capacity check counts `CONFIRMED` only; a `CANCELLED`
  row flips back to `CONFIRMED`; a live `CONFIRMED` duplicate lets the
  `@@unique([userId, eventId])` constraint fire and maps `P2002 → 409`.
- Idempotent seed (3+ privileged users, 5 events, bookings, + 20 users and one
  capacity-5 event for the proof). `scripts/parallel-bookings.ts` fires 20
  concurrent `POST /v1/bookings`.

**Proof — source of truth**
```
SELECT status, COUNT(*) FROM "Booking" WHERE "eventId" = '<capacity-event>' GROUP BY status;
-- => 5 CONFIRMED
-- parallel-bookings.ts tally: { '201': 5, '409': 15 }  (PASS: oversell prevented)
```

**Proof — index (EXPLAIN ANALYZE, "bookings by user")**
```
-- BEFORE (planner free to seq scan):
Seq Scan on "Booking"  (cost=0.00..1.09 rows=1) ... Rows Removed by Filter: 7

-- AFTER (seq scan disabled / index present):
Index Scan using "Booking_userId_eventId_key" on "Booking"
  Index Cond: ("userId" = '...')
```
**Interpretation (my own words):** The `Booking` table has no filter on `userId`
that Postgres can satisfy without reading every row, so the planner does a full
sequential scan. Adding/keeping the B-tree index whose leading column is
`userId` (here the `@@unique([userId, eventId])` constraint index) lets Postgres
seek straight to the matching rows instead of scanning the whole table — the
`Index Scan` plan replaces the `Seq Scan`. On a large table this turns a
scan proportional to all bookings into a lookup proportional to one user's
bookings, which is exactly the access pattern `GET /v1/bookings/:id` and the
service's lookups exercise.

**Where AI was used, and one thing it got wrong**
- AI wrote the retry loop guarding only on Prisma's `P2034`. On this stack the
  `@prisma/adapter-pg` driver surfaces serialization failures as a **raw
  `TransactionWriteConflict` error with no `.code`**, so every conflict became a
  `500` instead of being retried — the proof came back `5×201 / 1×409 / 14×500`.
  I caught it by enabling dev logging and reading the actual error, then widened
  the retry condition to also match `TransactionWriteConflict` / write-conflict
  messages. Re-run: exactly `5×201 / 15×409`, zero 500s.

**Exit ticket:** _Your booking service checked capacity before every insert and
the event still oversold: why did the check fail, and what property of the fix
makes overselling impossible?_ — The check and the insert were two separate
operations, so a concurrent transaction could insert between them (a race). The
fix runs the check **and** the insert inside one `Serializable` Prisma
transaction, so they are atomic; no other transaction can observe or insert into
the gap, which is what makes overselling impossible.

---

## Session 4 — Locking Eventify Down

**What was built**
- `requireAuth` / `requireRole` applied per the route→policy matrix. `GET
  /v1/events` and `GET /v1/events/:id` stay **public** (read-only catalog;
  documented below). Mutating event routes require ORGANIZER/ADMIN; event
  updates/deletes enforce **ownership** (organizer must own the event, ADMIN
  bypasses); booking cancellation enforces **own booking only** (returns 403 for
  non-owners).
- Booking identity comes from the **JWT** (`req.auth.sub`), never the request
  body.
- Refresh-token rotation: opaque token (32 random bytes, base64url) stored only
  as a SHA-256 hash; raw value lives solely in an `httpOnly` + `Secure` +
  `SameSite=strict` cookie scoped to `/v1/auth/refresh`. Rotation atomically
  revokes the old row and issues a new pair; presenting a rotated token is a
  theft signal → 401 (generic, no oracle). bcrypt replaces the old unsalted
  SHA-256 password hash. JWT payload is Zod-parsed (no `as` cast); HS256 is pinned
  on verify. A test-only `X-User-Id` header is gated behind `TEST_AUTH_ENABLED`
  and absent from `.env.example`.

**Why `GET /v1/events` is public:** it returns only a read-only event catalog
(title, venue, time, price) with no user data — the same information a public
event site would show. Gating it would break anonymous browsing for no security
gain, so it is intentionally unauthenticated.

**Where AI was used, and one thing it got wrong**
- AI used `z.string().email()` (a Zod **3** idiom) and an open `X-User-Id`
  header bypass that authenticated any user. I caught both: switched to
  `z.email()` (Zod 4) and gated the bypass behind an env flag so it cannot be
  enabled in production.

### Task 4 — AI-assisted security audit (triage, not paste)

**Prompt used:** *"Audit this endpoint against the OWASP API Security Top 10.
For each finding: severity, line, fix."*

1. **BOLA — booking creation trusted `userId` from the request body.**
   _Severity: High._ Any authenticated user could book on behalf of anyone.
   **FIXED** — `userId` now comes from `req.auth.sub` and the body is
   `z.strictObject({ eventId })`.
2. **Broken auth — `X-User-Id` header bypassed authentication entirely.**
   _Severity: Critical._ **FIXED** — gated behind `TEST_AUTH_ENABLED`; off by
   default and not in `.env.example`.
3. **Sensitive data exposure — `passwordHash` could leak in responses.**
   _Severity: Medium._ Audited all responses: `passwordHash` only appears inside
   `auth.service` and never in any DTO, so **FALSE-POSITIVE** for this codebase
   (no `GET /v1/users` endpoint exists). Kept the strictObject allow-lists as
   defense-in-depth.
4. **Security misconfiguration — `GET /v1/events` is unauthenticated.**
   _Severity: Low._ **ACCEPTED-RISK** — intentional: it is a public read-only
   catalog (see rationale above); documented in the PR so a reviewer can challenge
   it.

**Exit ticket:** _The drill's auth module passed every happy-path test — what
exactly made it forgeable anyway, and which single call fixes it?_ — Without
`algorithms: ["HS256"]` in `jwt.verify`, an attacker could send a token with
`"alg": "none"` (or `HS256` vs `RS256` confusion) and bypass signature
verification. The fix is `jwt.verify(token, secret, { algorithms: ["HS256"] })`
— which this code does.
