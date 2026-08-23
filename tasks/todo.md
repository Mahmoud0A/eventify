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
- [ ] Render account + API service actually provisioned (manual — pending)
- [ ] Render worker service provisioned, or free-tier limitation accepted and documented as such (manual decision — pending)
- [ ] Neon Postgres instance created + connection string wired (manual — pending)
- [ ] Upstash Redis instance created + `REDIS_URL` wired (manual — pending)
- [ ] `npx prisma migrate deploy` executed against the real production database (pending — requires D+E)
- [ ] Seed/demo data loaded into production so grading accounts/events exist (pending — requires D+E)
- [ ] Live `/health` verified at the deployed URL (pending — no URL exists yet)
- [ ] Live booking flow executed against the deployment (pending)

## F. Documentation & delivery
- [x] README rewrite: portfolio-grade (pitch, architecture, endpoints, quickstart, Docker workflow, env table, testing, CI, deployment, decisions/trade-offs, AI usage)
- [x] AI usage documentation (what AI did, what was verified/corrected)
- [x] PR description draft (`docs/pr-description-session-6.md`)
- [x] Final gates: `npm run typecheck`, `npm run lint`, `npm test`, `docker build`, `docker compose config` all green

## Explicitly out of scope / pending user action
- Render/Neon/Upstash account creation and any live deployment verification (manual; nothing is claimed as deployed until a live URL responds)
