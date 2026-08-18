# Eventify HW123 — Study Plan

## Session 1: First Server
- [x] Domain types in `src/domain.ts` (literal unions, `findById`)
- [x] Raw HTTP endpoints: `/health`, `/events`, `/events/:id`
- [x] Error shape `{ "error": "..." }` + catch-all 404
- [ ] Async `data/events.json` loading with `node:fs/promises`

## Session 2: Bookings, Pagination & Consistency
- [x] `/v1/bookings` POST/GET/DELETE
- [x] Pagination + filtering on `/v1/events`
- [x] Zod `strictObject` + `validateQuery` → `res.locals.query`
- [x] Capacity + duplicate logic in service layer

## Session 3: Bookings That Survive a Restart
- [ ] `docker-compose.yml` (Postgres + Redis)
- [ ] `prisma.config.ts`
- [ ] Prisma schema migration (User, Event, Booking)
- [ ] All `/events` endpoints on Postgres via Prisma
- [ ] Transactional booking service (`create-booking.skeleton.ts`)
- [ ] Rebooking-after-cancel + P2002→409 mapping
- [ ] Seed script: 3+ users, 5 events, bookings + 20 users for parallel script
- [ ] `scripts/parallel-bookings.ts` + `scripts/fixtures/parallel-users.json`
- [ ] Prove index with EXPLAIN ANALYZE

## Commit Plan
1. `feat: add tasks/todo.md study plan`
2. `fix: load events.json async with fs/promises (Session 1)`
3. `feat: add docker-compose.yml and prisma.config.ts (Session 3 infra)`
4. `feat: migrate /events endpoints to Prisma repositories`
5. `feat: complete transactional booking service`
6. `feat: wire bookings controller to Prisma`
7. `feat: add parallel-bookings script and fixtures`
8. `chore: run migration, seed, and verify`
