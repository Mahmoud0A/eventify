# Eventify

The event booking API built across Sessions 1–4 of the backend course. One progressive project, one repo — each session adds to the last.

## Prerequisites

- **Node 24.x** (`node --version` must print `v24`)
- **npm 11** (`npm --version`)
- **Docker Desktop** (PostgreSQL 18 + Redis 8)
- On **Windows**, `netsh` reserves `5433–5532` — the default `5432` may be occupied by a local PostgreSQL service. If `docker compose up -d` fails with `ports are not available` on `5432`, either stop the local `postgresql-x64-18` service or change the host port to `6000` in `docker-compose.yml` and `DATABASE_URL` in `.env` (see `setup-and-run.ps1`).

## Quick start (fresh clone)

```bash
git clone https://github.com/Mahmoud0A/eventify
cd eventify

npm install
cp .env.example .env
# edit .env — set a real JWT_ACCESS_SECRET (>=32 chars)

docker compose up -d
docker compose ps  # both healthy?

npx prisma migrate dev
npx prisma db seed
npm run dev        # http://localhost:3000  (tsx --env-file=.env src/server.ts)
```

Seeded accounts all use password `Password123!`:

- `organizer@example.com` (ORGANIZER)
- `organizer2@example.com` (ORGANIZER) — second organizer for BOLA proofs
- `admin@example.com` (ADMIN)
- `attendee1@example.com`, `attendee2@example.com` + 16 more ATTENDEEs

## Scripts

- `npm run dev` — `tsx --env-file=.env src/server.ts`
- `npm run typecheck` — `tsc --noEmit` (real gate; Node strips types without checking)
- `npm run lint` — `eslint .`
- `npm test` — placeholder until Session 6 (Vitest)

## Environment

`.env` is gitignored. Required keys (also in `src/config/config.ts` `envSchema`):

```
PORT=3000
DATABASE_URL=postgresql://eventify:eventify@localhost:5432/eventify
JWT_ACCESS_SECRET=change-me-to-a-long-random-secret-at-least-32-characters
WEB_ORIGIN=http://localhost:3000
TEST_AUTH_ENABLED=false   # true only for the Session-3 parallel-bookings script
```

## API

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | public |
| GET | `/v1/events?page=&limit=&venue=&from=&to=` | **public** (read-only catalog) |
| GET | `/v1/events/:id` | **public** |
| POST | `/v1/events` | ORGANIZER or ADMIN |
| PATCH | `/v1/events/:id` | owner ORGANIZER or ADMIN |
| DELETE | `/v1/events/:id` | owner ORGANIZER or ADMIN |
| POST | `/v1/bookings` | any authenticated user |
| GET | `/v1/bookings` | authenticated (own bookings; ADMIN sees all) |
| GET | `/v1/bookings/:id` | authenticated (own booking; ADMIN bypass) |
| DELETE | `/v1/bookings/:id` | authenticated (own booking only) |
| POST | `/v1/auth/signup` | public |
| POST | `/v1/auth/login` | public |
| POST | `/v1/auth/refresh` | public (refresh cookie) |
| POST | `/v1/auth/logout` | public (clears cookie) |

- Booking creation validates `z.strictObject({ eventId: uuid })`; `userId` is taken from the JWT (`req.auth.sub`), never the body.
- `GET /v1/events` is intentionally public — it returns only `title/venue/startsAt/price` with no user data, like a public event site. All mutating routes are protected.
- Ownership: `PATCH/DELETE /v1/events/:id` checks `organizerId === token.sub` unless `role === ADMIN`.

## Bookings — persistence, capacity, concurrency

- All bookings live in PostgreSQL (`prisma/schema.prisma` + `prisma/migrations/*`). Restarting `npm run dev` keeps them — no in-memory store.
- Capacity rule counts **only** `CONFIRMED` bookings.
- `@@unique([userId, eventId])` prevents duplicates. Inside a `Serializable` transaction:
  - no existing row → `create CONFIRMED`
  - existing `CANCELLED` → flip to `CONFIRMED` (same capacity check)
  - existing `CONFIRMED`/`WAITLISTED` → `409`
- `P2002` (unique violation) maps to `409`; serialization failures (`P2034` / `TransactionWriteConflict` from `@prisma/adapter-pg`) are retried up to 8×.

### Concurrency proof (Session 3, Task 2)

After `npx prisma db seed`, copy the `Capacity Workshop` event id and the first 20 user ids into `scripts/fixtures/parallel-users.json` (seed already writes correct ids there). Then:

```bash
# terminal 1
npm run dev

# terminal 2
node scripts/parallel-bookings.ts
# expected: { '201': 5, '409': 15 }  PASS
```

Verify in psql:

```sql
SELECT status, COUNT(*) FROM "Booking" WHERE "eventId"='<capacity-event>' GROUP BY status;
-- 5 CONFIRMED expected, never more
```

### Sandbox seed (Session 3, SQL)

`session-3-sandbox-seed.sql` (also `session-3-sandbox-seed.sql` in the HW folder) seeds a **separate** `sandbox` database (snake_case) with ~2k users / 200 events / 10k bookings. Mounted via `docker-compose.yml`:

```yaml
- ./session-3-sandbox-seed.sql:/docker-entrypoint-initdb.d/10-sandbox-seed.sql:ro
```

First `docker compose up -d` creates it; to re-seed: `docker compose down -v && docker compose up -d`.

## Auth & refresh rotation (Session 4)

- `JWT_ACCESS_SECRET` via `envSchema` (never `process.env` directly); `WEB_ORIGIN` optional.
- Access token: `HS256`, 15 min, claims `{ sub, role }`, verified with `algorithms: ["HS256"]` and Zod-parsed payload (no `as` cast).
- Refresh token: 32 random bytes, `base64url`, stored as `sha256` hex; raw value only in `httpOnly` + `Secure` (prod) + `SameSite=strict` cookie scoped to `path: /v1/auth/refresh` (`maxAge` 7 days, `expiresAt` 7 days).
- Rotation atomically `create new` + `revokedAt + replacedById` on old row. Re-presenting a rotated token is a theft signal → `401` + family revocation (`revokeAllForUser`). All refresh failures are the same generic `401` (no oracle).
- Passwords: `bcrypt` (10 rounds); seeded users all `Password123!`.

## Security triage

See `PR_DESCRIPTIONS.md` Session 4 — prompt *"Audit this endpoint against the OWASP API Security Top 10. For each finding: severity, line, fix."* Findings triaged as **fixed / false-positive / accepted-risk** with one-line justifications. Exit ticket answer included.

## Tech stack

Node 24, TypeScript strict (no `any`), Express 5, Zod 4, PostgreSQL 18, Prisma 7 (`prisma-client` + `@prisma/adapter-pg`), JWT HS256, bcrypt, tsx.

## Project status

Complete for Sessions 1–4; see `tasks/todo.md` and `PR_DESCRIPTIONS.md` for the per-session checklists and exit tickets.
