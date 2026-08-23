# Eventify — Event Booking API (v1.0 Capstone)

Eventify is a production-style event booking API built progressively across six course sessions: an Express + TypeScript core with transactional Postgres bookings, JWT auth with refresh-token rotation, Redis-backed caching / rate limiting / queues, and a separate background worker — containerized, CI-tested, and deployment-ready.

**Live URL: <https://eventify-capstone.onrender.com>** — Render Free-tier Web Service (Docker), API-only. Verified live: `/health` 200, registration, login, event discovery, and a CONFIRMED booking against the seeded catalog (see *Deployment* below).

---

## Architecture

```
                ┌─────────────────────────────┐
  clients ────▶ │  API (Express, node+tsx)    │────▶ PostgreSQL 18 (Prisma 7)
                │  src/app.ts · src/server.ts │        users · events · bookings
                └────────┬─────────┬──────────┘        refresh_tokens
              enqueue    │         │ cache-aside,
              jobs       ▼         ▼ rate limiting
                ┌─────────────────────────────┐
                │  Redis 8                    │
                │  db0 dev · db1 tests        │
                └────────┬────────────────────┘
                         │ BullMQ (separate connection)
                ┌────────▼────────────────────┐
                │  Worker (separate process)  │
                │  src/worker.ts              │
                │  waitlist-promote · booking-email │
                └─────────────────────────────┘
```

- **Layered API:** routers → controllers → services → repositories → Prisma.
- **Bookings:** serializable transactions with bounded retry on write conflicts; `@@unique([userId, eventId])`; soft cancellation; WAITLISTED when full.
- **Queues:** BullMQ v6 over node-redis via `createNodeRedisClient`, on its **own** connection (`src/infra/queue-backend.ts`), distinct from the cache/rate-limit client (`src/infra/redis.ts`).
- **Worker:** independent process consuming `waitlist-promote` and `booking-email`.

## API endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | – | liveness + uptime |
| POST | `/v1/auth/signup` | – | `{email,password,name,role?}` → accessToken + refresh cookie |
| POST | `/v1/auth/login` | – | rate-limited: 5 req / 15 min / IP |
| POST | `/v1/auth/refresh` | cookie | rotates refresh token; reuse revokes the whole family |
| POST | `/v1/auth/logout` | cookie | revokes all refresh tokens for the user |
| GET | `/v1/events` | – | `page,limit,venue,from,to`; cached per list version |
| GET | `/v1/events/:id` | – | cached 60 s + jitter |
| POST | `/v1/events` | ORGANIZER/ADMIN | |
| PATCH | `/v1/events/:id` | owner ORGANIZER/ADMIN | invalidates event cache + bumps list version |
| DELETE | `/v1/events/:id` | owner ORGANIZER/ADMIN | |
| POST | `/v1/bookings` | ATTENDEE+ | rate-limited per user (30/min); CONFIRMED or **WAITLISTED** when full |
| GET | `/v1/bookings` | user (ADMIN: all) | |
| GET | `/v1/bookings/:id` | owner/ADMIN | |
| DELETE | `/v1/bookings/:id` | owner | soft cancel → `CANCELLED`, row kept; enqueues waitlist promotion |

## Local setup (fresh clone)

Prerequisites: Node ≥ 24, Docker Desktop.

```bash
npm ci
docker compose up -d          # postgres + redis (+ api + worker)
cp .env.example .env          # then adjust ports if needed
npx prisma migrate deploy && npm run dev
```

Windows note: if host port 5432 is reserved, set `POSTGRES_HOST_PORT=6000` in `.env` (compose maps it) and point `DATABASE_URL` at `localhost:6000`. Seed demo data any time:

```bash
npx tsx --env-file=.env prisma/seed.ts   # idempotent; demo users incl. organizer@example.com / Password123!
```

## Docker / local production workflow

The production image is built by `Dockerfile` (two-stage, `node:24-slim`):

1. **build stage:** full deps → `prisma generate` → `npm run typecheck` as the build gate.
2. **runtime stage:** prod-only deps, generated client copied in, runs as `USER node`.

```bash
docker compose build          # or let `up` build
docker compose up -d          # api :3000, worker, postgres, redis
curl http://localhost:3000/health
```

**Runtime/build-model decision (honest note):** this repo's `tsconfig.json` intentionally uses `noEmit` + `allowImportingTsExtensions` — source files import each other with real `.ts` extensions and Node strips types natively. There is therefore **no emitted `dist/server.js`**, and inventing one would mean rewriting every import. The production image instead runs the repository-compatible equivalent:

```text
node --import tsx src/server.ts     # api
node --import tsx src/worker.ts     # worker
```

`--import tsx` loads TypeScript inside the same Node process (no shell/tsx parent wrapper), so SIGTERM reaches Node directly — which the graceful-shutdown handlers rely on. The typecheck gate still runs inside the image build.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `REDIS_URL` | yes (defaults `redis://localhost:6379`) | cache + rate limiting + BullMQ |
| `JWT_ACCESS_SECRET` | yes (≥32 chars) | HS256 access-token signing — treat as a real secret in production |
| `WEB_ORIGIN` | no | allowed CORS origin for the refresh cookie |
| `PORT` | no (default 3000) | API listen port |
| `TEST_DATABASE_URL` | tests only | overrides base URL for deriving `eventify_test` |

Never commit `.env`. All production values are provided via the hosting dashboard.

## Testing

16 integration tests (Vitest + Supertest) run against the real app via `src/app.ts` using **real signed JWTs** (`TEST_AUTH_ENABLED` is forced off):

```bash
npm test
```

Isolation: `vitest.setup.ts` derives an `eventify_test` database from `DATABASE_URL`/`TEST_DATABASE_URL`, **hard-refuses any database whose name doesn't end in `_test`**, creates it if missing, applies migrations, truncates every table after each test, and flushes dedicated Redis DB 1. The development database is never touched. Suites run with `fileParallelism: false` so truncation isolation is deterministic.

Coverage highlights: signup/login, refresh rotation + reuse-revokes-family, RBAC (ORGANIZER vs ATTENDEE vs anonymous), full-event → WAITLISTED, duplicate-booking 409, cancel-then-rebook reuses the same row, event-cache invalidation after PATCH.

## CI

GitHub Actions (`.github/workflows/ci.yml`) on every push to `session-*`/`main` and PRs to `main`, with two stable check names suitable for branch protection:

- **`typecheck-and-lint`** — `tsc --noEmit` + ESLint.
- **`test`** — Postgres 18 + Redis 8 service containers; `DATABASE_URL` targets `eventify_test`, `REDIS_URL` uses DB 1, CI-only `JWT_ACCESS_SECRET`; migrations apply inside `vitest.setup.ts`; runs the full integration suite.

Branch protection on `main` is enabled and requires both checks — `typecheck-and-lint` and `test` — before merging (strict: branches must be up to date).

## Deployment (live)

Deployed on **Render Free** at <https://eventify-capstone.onrender.com> from branch `session-6/capstone-eventify-v1`:

- **API:** Render Web Service running the production Docker image (`node --import tsx src/server.ts`), `NODE_ENV=production`.
- **Database:** Neon PostgreSQL — schema applied via `npx prisma migrate deploy` run manually against the production URL, because **Render Free does not offer Pre-Deploy Commands**.
- **Redis:** Upstash — used by the cache and rate limiters in production (every rate-limited login and cached event read exercises it).
- **Worker:** not deployed. Render's free tier has no background workers, so waitlist promotions and confirmation emails remain queued until a worker service is added. This is the documented API-only trade-off.
- **Demo data:** seeded catalog verified live via `GET /v1/events` (e.g., *JS 101* capacity 30, future date); demo accounts exist from the seed script.

Live verification performed (2026-08-23): `/health` → 200; attendee signup → 201; login → JWT; open-event discovery; booking → **201 CONFIRMED**; persisted-booking re-read with correct ownership; anonymous booking rejected 401; browser-level check of `/health` via Playwright. Full details in [`docs/deployment.md`](docs/deployment.md).

## Decisions & trade-offs

- **tsx runtime instead of `dist/*.js`:** honors the repo's `.ts`-extension/noEmit conventions; see the Docker section above.
- **node-redis everywhere:** cache/limiter use node-redis directly; BullMQ wraps it via `createNodeRedisClient` on a second connection — one Redis client library, two isolated clients.
- **Cache strategy:** cache-aside; `event:{id}` TTL 60 s + jitter; list pages keyed by a version counter `events:list:{v}:{page}` — a single `INCR events:list:v` invalidates every page; writes **delete** the event key rather than setting fresh values (avoids racing a concurrent read into caching stale data again).
- **Rate limiting:** fixed-window counters `rl:{identity}:{path}:{window}`; login strict per-IP (5/15 min), bookings per-user (30/min) keyed by the authenticated subject, never `req.ip`.
- **Waitlist semantics (Session 5):** full event returns **201 WAITLISTED** (not 409); cancelling a CONFIRMED booking enqueues `waitlist-promote {eventId}`; the worker promotes the oldest WAITLISTED booking inside a serializable transaction that re-checks capacity, then enqueues `booking-email` `confirmation {bookingId}`. Re-running promotion is idempotent.
- **Refresh rotation:** every refresh mints a new token and revokes the old one (`replacedById` chain); replaying a rotated token is treated as theft and revokes the entire family.
- **Graceful shutdown:** both processes handle SIGTERM/SIGINT with re-entry guards — API drains HTTP then closes Redis/BullMQ/Prisma; worker stops consuming jobs before releasing connections.
- **Free-tier reality:** Render's free tier does not include background workers; until a paid worker exists, waitlist emails/promotions are proven locally but must not be assumed to run in production. Free services also cold-start slowly.

## AI usage disclosure

AI (pair-programming agents) assisted with: scaffolding infrastructure files (Redis/BullMQ clients, queues), writing the Vitest/Supertest harness and integration suites, the CI workflow, Dockerfile/compose authoring, and documentation drafts. Every AI-generated line was reviewed, executed, and verified by running the actual gates (`typecheck`, `lint`, 16-test suite, `docker build`, live compose smoke test). Notable corrections made during verification: BullMQ requires one connection per blocking consumer (the initial shared-client design silently starved workers — diagnosed via Redis queue inspection and fixed with a connection factory); BullMQ v6 forbids `:` in custom job IDs; the generated Prisma client had to move out of devDependencies to survive `--omit=dev`; CI initially lacked a Redis service and a `JWT_ACCESS_SECRET`, both added. Session 5 interrogation notes (why `updateEvent` deletes rather than sets the cache key) are reflected in the cache-strategy decision above.

## Session map

| Session | Delivered |
|---|---|
| 1–2 | Express skeleton, domain types, Zod validation, in-memory → DB migration |
| 3 | Transactional Prisma bookings, seed data, concurrency script |
| 4 | JWT auth, refresh rotation, RBAC, BOLA protection |
| 5 | Redis cache-aside + metrics, rate limiting, BullMQ queues, worker, waitlist promotion |
| 6 | Test suite, CI, Docker/compose, graceful shutdown, deployment prep, docs |
