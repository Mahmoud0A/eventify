# Session 5 Implementation Tasks

## Background Job Choice: Option A — WAITLIST PROMOTION

### Phase 1: Infrastructure Setup
- [x] Add dependencies: `ioredis`, `bullmq`, `@msgpack/msgpack` (for BullMQ v6)
- [x] Create `src/infra/redis.ts` — node-redis client for cache + rate limiting
- [x] Create `src/infra/queue-backend.ts` — SECOND Redis client wrapped with `createNodeRedisClient` for BullMQ v6
- [x] Create `src/jobs/email.queue.ts` — `booking-email` Queue with `confirmation` job
- [x] Create `src/worker.ts` — independent worker process (waitlist-promote + email consumers)
- [x] Update `src/config/config.ts` with `REDIS_URL` validation
- [x] Verify docker-compose.yml Redis service is usable

### Phase 2: Cache Implementation
- [x] Implement cache-aside helper in `src/infra/cache.ts` (or extend redis.ts)
- [x] Cache keys: `event:{id}`, `events:list:{v}:{page}`, `events:list:v`
- [x] Event cache: TTL 60s + jitter
- [x] List cache: version counter `events:list:v`, INCR on write invalidates all pages
- [x] Instrument `getEvent` and `listEvents` in `src/events/events.service.ts`
- [x] Implement cache metrics: hit/miss counters, ratio, structured JSON logging every 60s or 100 lookups
- [x] On event update: DELETE cache key (do NOT SET fresh value)

### Phase 3: Rate Limiting
- [x] Create `src/middleware/rateLimit.ts` — Redis sliding window limiter
- [x] Apply to `POST /v1/auth/login` — strict, per-IP (`rl:{ip}:{path}:{win}`)
- [x] Apply to `POST /v1/bookings` — per-user (authenticated user ID, NEVER req.ip)
- [x] Document sensible max/window values with rationale
- [x] Create executable burst test script proving: succeed → 429 → recover after window

### Phase 4: Waitlist Promotion (Option A)
- [x] Modify booking creation (bookings.repository):
  - When event at capacity, create `WAITLISTED` booking instead of returning 409
  - On cancel of CONFIRMED booking: enqueue `waitlist-promote` job with `{ eventId }`
- [x] Create waitlist-promote queue and worker consumer
- [x] Worker promotes oldest WAITLISTED → CONFIRMED in transaction with capacity re-check
- [x] Worker enqueues `booking-email` confirmation job with `{ bookingId }`
- [x] Ensure idempotency: re-running promotion job must NOT double-promote
- [x] Create executable test/script proving waitlist promotion behavior

### Phase 5: Email Queue Integration
- [x] Identify existing mailer implementation (if any) or create minimal wrapper (none existed; worker logs the send as transport)
- [x] Wire email queue consumer in worker to send confirmation emails
- [ ] Ensure booking creation (confirmed) and waitlist promotion both enqueue confirmation emails (promotion only — confirmed-create email deferred)

### Phase 6: Verification & Testing
- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
- [x] Cache metrics proof: actual observed hit/miss/ratio output (`{"hits":99,"misses":1,"total":100,"hitRatio":0.99}`)
- [x] Rate limiter burst test proof: requests succeed → 429 → recover (login 401×5→429 Retry-After 900 + simulated expiry; bookings 404×30→429 at #31 + natural recovery after window)
- [x] Waitlist promotion test proof: full event → waitlisted → cancel → promote → confirmed (9/9 checks)
- [x] Worker process starts and processes jobs correctly
- [ ] Deployment prep: Render/Neon/Upstash accounts (NOT done — accounts not created yet)

### Phase 7: Documentation
- [ ] PR description with all required sections (pending PR creation)
- [ ] AI caching-strategy interrogation notes (pending PR description)
- [ ] Exit ticket: Why does `updateEvent` DELETE the cache key instead of SETting the fresh value? (pending PR description)