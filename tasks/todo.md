# Session 6 — Capstone: Eventify v1.0

Branch: `session-6/capstone-eventify-v1` (base: `session-5/caching-queues-background-jobs` @ `d82a949`)
Title: `capstone: Eventify v1.0`

## A. Testing foundation
- [x] Add devDependencies: `vitest`, `supertest`, `@types/supertest`; replace placeholder `npm test`
- [x] Create `vitest.config.ts` (node environment, setup file, per-file isolation)
- [x] Create `vitest.setup.ts`: unique `eventify_test` DB per run — apply migrations (`prisma migrate deploy`) + truncate tables between tests
- [x] Test env contract: `TEST_DATABASE_URL`, isolated Redis DB index (or flush scope) so tests never touch dev/prod data

## B. Integration tests (Vitest + Supertest, real HTTP against `app`)
- [x] Real JWT auth: signup/login return working access tokens used across suites
- [x] Refresh-token rotation: refresh exchanges token, old token rejected; reuse of rotated token triggers revocation (`Invalid token`)
- [x] Authorization: ORGANIZER can create/update/delete events; ATTENDEE gets 403; unauthenticated 401
- [x] Booking behavior: under-capacity → CONFIRMED; full event → WAITLISTED (Session 5 semantics); duplicate booking 409
- [x] Cancel-then-rebook: DELETE soft-cancels; rebook reopens CONFIRMED when seat free, WAITLISTED when full
- [x] Cache invalidation: GET event cached → PATCH event → next GET reflects fresh value; list version INCR invalidates cached page

## C. CI workflow (`.github/workflows/ci.yml`)
- [x] Add `redis` service container + `REDIS_URL` env to the existing test job (currently missing — S5 code requires it)
- [x] Keep typecheck+lint job; wire real `npm test` (Vitest) into the test job with Postgres + Redis services
- [x] Define stable job/check names for required-status-check configuration (`typecheck-and-lint`, `test`)
- [x] Branch protection: enable required checks on GitHub — `typecheck-and-lint` + `test` required on `main` (verified via API, strict mode)
- [x] Capture evidence of a deliberately broken commit showing CI red — temporary isolated branch `session-6/ci-red-proof` produced failing run [32637762176](https://github.com/Mahmoud0A/eventify/actions/runs/32637762176) (`typecheck-and-lint` failure, `test` success); temp branch deleted afterwards, Session 6 branch remained green

## D. Productionization
- [x] `Dockerfile` (two-stage, node:24-slim, prisma generate before type validation, USER node)
- [x] Extend `docker-compose.yml`: `api` + `worker` services alongside postgres (db) + `redis`
- [x] Graceful shutdown for API (`SIGTERM`/`SIGINT` → drain HTTP + close Redis/BullMQ/Prisma); worker shutdown hardened
- [x] Finalize environment contract in `.env.example` (+ any `NODE_ENV`/test additions) — no secrets committed

## E. Deployment preparation (accounts are user-manual actions)
- [x] Repository-side deployment documentation (`docs/deployment.md`: Render API service, optional paid worker, Neon Postgres, Upstash Redis, env vars, `npx prisma migrate deploy`, seeding, free-tier/cold-start trade-offs)
- [x] Render account + API service provisioned — live at <https://eventify-capstone.onrender.com> (Render Free Web Service, Docker, branch `session-6/capstone-eventify-v1`)
- [ ] Render worker service provisioned — **NOT deployed** (free-tier limitation); documented API-only trade-off stands: background jobs queue until a paid worker exists
- [x] Neon Postgres instance created + wired (`DATABASE_URL` via dashboard); migrations applied manually with `npx prisma migrate deploy` (Render Free has no Pre-Deploy Commands)
- [x] Upstash Redis instance created + wired (`REDIS_URL` via dashboard; exercised in production by rate-limited logins and cached event reads)
- [x] `npx prisma migrate deploy` executed against the real production database
- [x] Seed/demo data loaded into production — verified via public API: 5 seeded future events incl. open ones (*JS 101* cap 30, *API Design Live* cap 125)
- [x] Live `/health` verified — HTTP 200 `{"status":"ok"}` (HTTP + Playwright/Chromium)
- [x] Live booking flow executed and verified — signup → login → discover open event → **201 CONFIRMED** → persisted re-read (ownership/eventId/status) → anonymous booking rejected 401

## F. Documentation & delivery
- [x] README rewrite: portfolio-grade (pitch, architecture, endpoints, quickstart, Docker workflow, env table, testing, CI, deployment, decisions/trade-offs, AI usage)
- [x] AI usage documentation (what AI did, what was verified/corrected)
- [x] PR description draft (`docs/pr-description-session-6.md`)
- [x] Final gates: `npm run typecheck`, `npm run lint`, `npm test`, `docker build`, `docker compose config` all green

## Explicitly out of scope / remaining manual item
- Render **paid Background Worker** (would enable production waitlist promotions + confirmation emails). Everything else is deployed and live-verified as of 2026-08-23.
