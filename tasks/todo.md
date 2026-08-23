# Session 5 Implementation Tasks

## Background Job Choice: Option A — WAITLIST PROMOTION

### Phase 1: Infrastructure Setup
- [ ] Add dependencies: `ioredis`, `bullmq`, `@msgpack/msgpack` (for BullMQ v6)
- [ ] Create `src/infra/redis.ts` — node-redis client for cache + rate limiting
- [ ] Create `src/infra/queue-backend.ts` — SECOND Redis client wrapped with `createNodeRedisClient` for BullMQ v6
- [ ] Create `src/jobs/email.queue.ts` — `booking-email` Queue with `confirmation` job
- [ ] Create `src/worker.ts` — independent worker process (waitlist-promote + email consumers)
- [ ] Update `src/config/config.ts` with `REDIS_URL` validation
- [ ] Verify docker-compose.yml Redis service is usable

### Phase 2: Cache Implementation
- [ ] Implement cache-aside helper in `src/infra/cache.ts` (or extend redis.ts)
- [ ] Cache keys: `event:{id}`, `events:list:{v}:{page}`, `events:list:v`
- [ ] Event cache: TTL 60s + jitter
- [ ] List cache: version counter `events:list:v`, INCR on write invalidates all pages
- [ ] Instrument `getEvent` and `listEvents` in `src/events/events.service.ts`
- [ ] Implement cache metrics: hit/miss counters, ratio, structured JSON logging every 60s or 100 lookups
- [ ] On event update: DELETE cache key (do NOT SET fresh value)

### Phase 3: Rate Limiting
- [ ] Create `src/middleware/rateLimit.ts` — Redis sliding window limiter
- [ ] Apply to `POST /v1/auth/login` — strict, per-IP (`rl:{ip}:{path}:{win}`)
- [ ] Apply to `POST /v1/bookings` — per-user (authenticated user ID, NEVER req.ip)
- [ ] Document sensible max/window values with rationale
- [ ] Create executable burst test script proving: succeed → 429 → recover after window

### Phase 4: Waitlist Promotion (Option A)
- [ ] Modify `src/bookings/bookings.service.ts`:
  - When event at capacity, create `WAITLISTED` booking instead of returning 409
  - On `cancelBooking` (CONFIRMED): enqueue `waitlist-promote` job with `{ eventId }`
- [ ] Create waitlist-promote queue and worker consumer
- [ ] Worker promotes oldest WAITLISTED → CONFIRMED in transaction with capacity re-check
- [ ] Worker enqueues `booking-email` confirmation job with `{ bookingId }`
- [ ] Ensure idempotency: re-running promotion job must NOT double-promote
- [ ] Create executable test/script proving waitlist promotion behavior

### Phase 5: Email Queue Integration
- [ ] Identify existing mailer implementation (if any) or create minimal nodemailer wrapper
- [ ] Wire email queue consumer in worker to send confirmation emails
- [ ] Ensure booking creation (confirmed) and waitlist promotion both enqueue confirmation emails

### Phase 6: Verification & Testing
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Cache metrics proof: actual observed hit/miss/ratio output
- [ ] Rate limiter burst test proof: requests succeed → 429 → recover
- [ ] Waitlist promotion test proof: full event → waitlisted → cancel → promote → confirmed
- [ ] Worker process starts and processes jobs correctly
- [ ] Deployment prep: Render/Neon/Upstash accounts (document status)

### Phase 7: Documentation
- [ ] PR description with all required sections
- [ ] AI caching-strategy interrogation notes
- [ ] Exit ticket: Why does `updateEvent` DELETE the cache key instead of SETting the fresh value?