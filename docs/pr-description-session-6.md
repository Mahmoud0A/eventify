# PR: capstone: Eventify v1.0

Branch: `session-6/capstone-eventify-v1` → base `session-5/caching-queues-background-jobs`

## What was built

Session 6 capstone completing Eventify v1.0:

1. **Testing foundation** — Vitest + Supertest; `vitest.config.ts` (`fileParallelism: false`), `vitest.setup.ts` deriving an `eventify_test` database (hard `_test` suffix guard, auto-create, migrations, per-test truncation) and dedicated Redis DB 1 with flush isolation.
2. **Integration tests (16)** — real signed JWTs only: auth signup/login, refresh rotation incl. reuse-revokes-family, RBAC (ORGANIZER/ATTENDEE/anonymous), full-event → **WAITLISTED** (Session 5 semantics), duplicate 409, cancel-then-rebook reusing the same row, event-cache invalidation after PATCH. App exported from new `src/app.ts`; `server.ts` remains the listening entry.
3. **CI** — `.github/workflows/ci.yml`: stable checks `typecheck-and-lint` and `test`; test job runs Postgres 18 **and Redis 8** services, targets `eventify_test`, CI-only `JWT_ACCESS_SECRET`, real `npm test`.
4. **Productionization** — two-stage `node:24-slim` Dockerfile (prisma generate → typecheck gate → prod-only runtime as `USER node`); compose stack api+worker+postgres+redis sharing one image; graceful SIGTERM/SIGINT shutdown for API and worker (drain HTTP / stop workers → close Redis/BullMQ/Prisma, re-entry guarded). Runtime is `node --import tsx src/server.ts` / `src/worker.ts` — the repository-compatible equivalent of a dist build under this repo's noEmit + `.ts`-extension conventions (no `dist/*.js` exists, by design).
5. **Deployment prep** — `docs/deployment.md` for Render (API; worker is paid-only trade-off), Neon Postgres (`npx prisma migrate deploy`), Upstash Redis, dashboard env vars. **Live deployment verified 2026-08-23** (see Testing evidence).
6. **Docs** — portfolio README (architecture, endpoints, quickstart, decisions/trade-offs, AI disclosure); updated `tasks/todo.md`.

## Test coverage

16 integration tests across auth/RBAC/bookings/cache (+health smoke), all against real HTTP via Supertest and isolated `eventify_test`. Gates: `npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` 16/16 ✅ · `docker build` ✅ · `docker compose config` ✅ · live compose smoke: `/health` 200, worker consuming queues, authenticated signup→event→booking flow CONFIRMED.

CI evidence:
- Green: run [32637178761](https://github.com/Mahmoud0A/eventify/actions/runs/32637178761) — `typecheck-and-lint` ✅ · `test` ✅ (Postgres + Redis service containers).
- Red proof: deliberately broken temporary branch produced failing run [32637762176](https://github.com/Mahmoud0A/eventify/actions/runs/32637762176) — `typecheck-and-lint` ❌ (isolated type error), `test` ✅ untouched; temp branch deleted after capture.

Live deployment evidence (<https://eventify-capstone.onrender.com>, Render Free API-only, 2026-08-23):
- `/health` → 200 `{"status":"ok"}` — verified via HTTP and Playwright/Chromium
- attendee signup → 201 · login → JWT · seeded catalog discovered via `GET /v1/events` (5 future demo events)
- booking on open event → **201 CONFIRMED**; persisted re-read verified (ownership + eventId + status); anonymous booking rejected 401
- Worker: not deployed (Render free-tier limitation) — background jobs queue until a paid worker exists

## Security/auth work carried forward & verified

Refresh-token rotation with theft detection (replayed token revokes whole family), BOLA-protected bookings/events, role gates, login rate limit 5/15 min per IP, bookings rate limit 30/min per user subject (never IP).

## Known trade-offs

- tsx runtime instead of emitted JS (documented rationale in README).
- Render free tier has no background workers → production background jobs pending paid worker.
- Free-tier cold starts; migrations applied manually because Render Free lacks Pre-Deploy Commands.
- Branch protection on `main` requires both CI checks (`typecheck-and-lint`, `test`) — enabled and verified via API.
- PR conflict with the reconstructed `origin/main` line resolved in merge commit `7e2201a` (kept this branch's tested implementations; tree verified byte-identical to the tested pre-merge state).
