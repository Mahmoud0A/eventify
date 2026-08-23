# Session 6 — Capstone: Eventify v1.0

Branch: `session-6/capstone-eventify-v1` (base: `session-5/caching-queues-background-jobs` @ `d82a949`)
Title: `capstone: Eventify v1.0`

## A. Testing foundation
- [ ] Add devDependencies: `vitest`, `supertest`, `@types/supertest`; replace placeholder `npm test`
- [ ] Create `vitest.config.ts` (node environment, setup file, per-file isolation)
- [ ] Create `vitest.setup.ts`: unique `eventify_test` DB per run — apply migrations (`prisma migrate deploy`) + truncate tables between tests
- [ ] Test env contract: `TEST_DATABASE_URL`, isolated Redis DB index (or flush scope) so tests never touch dev/prod data

## B. Integration tests (Vitest + Supertest, real HTTP against `app`)
- [ ] Real JWT auth: signup/login return working access tokens used across suites
- [ ] Refresh-token rotation: refresh exchanges token, old token rejected; reuse of rotated token triggers revocation (`Invalid token`)
- [ ] Authorization: ORGANIZER can create/update/delete events; ATTENDEE gets 403; unauthenticated 401
- [ ] Booking behavior: under-capacity → CONFIRMED; full event → WAITLISTED (Session 5 semantics); duplicate booking 409
- [ ] Cancel-then-rebook: DELETE soft-cancels; rebook reopens CONFIRMED when seat free, WAITLISTED when full
- [ ] Cache invalidation: GET event cached → PATCH event → next GET reflects fresh value; list version INCR invalidates cached page

## C. CI workflow (`.github/workflows/ci.yml`)
- [ ] Add `redis` service container + `REDIS_URL` env to the existing test job (currently missing — S5 code requires it)
- [ ] Keep typecheck+lint job; wire real `npm test` (Vitest) into the test job with Postgres + Redis services
- [ ] Define stable job/check names for required-status-check configuration
- [ ] Branch protection prep: document required checks (typecheck-and-lint, test) for `main` merges
- [ ] Capture screenshot/evidence of a deliberately broken CI run (red), then fix and show green

## D. Productionization
- [ ] `Dockerfile` (multi-stage; runtime uses tsx — tsconfig is noEmit/allowImportingTsExtensions by design)
- [ ] Extend `docker-compose.yml`: `api` + `worker` services alongside `db` + `redis`
- [ ] Graceful shutdown for API (`SIGTERM`/`SIGINT` → `server.close()` + close Redis/BullMQ connections); verify worker shutdown path
- [ ] Finalize environment contract in `.env.example` (+ any `NODE_ENV`/test additions) — no secrets committed

## E. Deployment preparation (accounts are user-manual actions)
- [ ] Render: web service from Dockerfile + worker service; document settings
- [ ] Neon Postgres: connection string wiring, `npx prisma migrate deploy` against it
- [ ] Upstash Redis: `REDIS_URL` wiring (TLS URL) for both api and worker
- [ ] Seed demo data against Neon (organizer demo account + sample events)
- [ ] Live `/health` verification + end-to-end live booking flow evidence (curl/output)

## F. Documentation & delivery
- [ ] README rewrite: portfolio-grade (architecture diagram/description, sessions map, quickstart, env table, deployment section)
- [ ] AI usage documentation (what AI did, what was verified/corrected, interrogation notes carried from S5)
- [ ] PR description draft: what changed, evidence links (cache metrics, rate-limit burst, waitlist, CI red/green, live health + booking)
- [ ] Final gates: `npm run typecheck`, `npm run lint`, `npm test`, production image build (`docker build`) all green

## Explicitly out of scope / pending user action
- Render/Neon/Upstash account creation (manual, cannot be verified locally until done)
