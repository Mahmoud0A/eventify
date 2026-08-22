# Eventify — Study Plan & Progress

## Session 1: First Server
- [x] Domain types in `src/domain.ts` (literal unions, `findById`)
- [x] Raw HTTP endpoints: `/health`, `/events`, `/events/:id` (later migrated to Express 5)
- [x] Error shape `{ "error": "..." }` + catch-all 404
- [x] Store migrated to PostgreSQL via Prisma (replaces the `events.json` file load)

## Session 2: Bookings, Pagination & Consistency
- [x] `/v1/bookings` POST/GET/DELETE (controller → service → repository)
- [x] Pagination + filtering on `/v1/events` (`{ data, page, limit, total }`)
- [x] `z.strictObject` validation + `validateQuery` → `res.locals.query`
- [x] Capacity + duplicate logic in the service layer
- [x] Consistency pass: single error middleware, no stray `res.status(500)`

## Session 3: Bookings That Survive a Restart
- [x] `docker-compose.yml` (Postgres)
- [x] `prisma.config.ts` + schema migration (User, Event, Booking, RefreshToken)
- [x] All `/events` endpoints on Postgres via Prisma repositories
- [x] Transactional booking service (`Serializable` + retry on P2034)
- [x] Rebooking-after-cancel + P2002→409 mapping
- [x] Seed script: organizers, admin, attendees, events, bookings + 20 users for parallel script (idempotent, fresh IDs logged)
- [x] `scripts/parallel-bookings.ts` + `scripts/fixtures/parallel-users.json` (verified 5×201 / 15×409)
- [x] Prove index with EXPLAIN ANALYZE — see PR_DESCRIPTIONS.md Session 3 (Index Scan via Booking_userId_eventId_key)

## Session 4: Locking Eventify Down
- [x] `requireAuth` / `requireRole` on all mutating routes
- [x] Ownership checks (BOLA): events (ORGANIZER owns / ADMIN bypass), bookings cancel = own only (403)
- [x] Booking `userId` taken from the JWT, never the request body (strictObject)
- [x] Refresh-token rotation (opaque token, SHA-256 hashed at rest, httpOnly/SameSite=strict cookie)
- [x] Reuse detection → family revocation (revoke all on theft signal)
- [x] bcrypt password hashing (replaced unsalted SHA-256)
- [x] JWT payload Zod-parsed (no `as` cast), HS256 pinned on verify
- [x] `z.email()` (Zod 4) + `z.strictObject` everywhere
- [x] `.env.example` lists `JWT_ACCESS_SECRET`, `WEB_ORIGIN`, `TEST_AUTH_ENABLED`
- [x] Test-only `X-User-Id` bypass gated behind `TEST_AUTH_ENABLED` (off in prod)

## Operational steps (fresh clone)
1. `docker compose up -d`
2. `npx prisma migrate dev`
3. `npx prisma db seed`  (seeded users use password `Password123!`)
4. Update `scripts/fixtures/parallel-users.json` with real ids + capacity-5 event id
5. `npm run dev`
