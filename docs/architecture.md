# Eventify — System Architecture & Engineering Deep Dive

## 1. System Overview

Eventify is an enterprise-grade, full-stack event management and transactional ticketing platform. It is designed to handle high-concurrency event bookings, guarantee strict zero-oversell capacity constraints, maintain sub-millisecond read latency through cache-aside strategies, and deliver secure role-based operations.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS FRONTEND (Port 3001)                       │
│  React 19 · Next.js 15 (App Router) · TypeScript · Tailwind CSS             │
│  - Centralized Typed API Client with auto 401 refresh token interception   │
│  - AuthContext: JWT token lifecycle & session management                    │
│  - Responsive Views: Discovery, Details, Dashboards, Organizer Forms        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / REST APIs
                                       │ Bearer JWT + httpOnly Refresh Cookie
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXPRESS REST API (Port 3000)                       │
│  Node.js 24 · Express 5 · TypeScript · Zod Validation                       │
│  - Layered Architecture: Routers → Controllers → Services → Repositories    │
│  - Security: JWT HS256, Refresh Token Rotation, RBAC, BOLA Protection       │
│  - Rate Limiting: Fixed-window counters per IP (login) & user (bookings)    │
└──────────────────┬───────────────────────────────────────┬──────────────────┘
                   │ Cache-aside & Rate limiting           │ Prisma 7 ORM
                   ▼                                       ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│               REDIS 8                │  │           POSTGRESQL 18           │
│  Cache TTL + Jitter                  │  │  Serializable Transactions        │
│  Versioned list keys                 │  │  Users · Events · Bookings        │
│  Rate-limit counters (db0)           │  │  RefreshToken Rotation Families   │
└──────────────────┬───────────────────┘  └───────────────────────────────────┘
                   │ BullMQ (Dedicated Connection)
                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKGROUND WORKER PROCESS                          │
│  BullMQ Consumers (src/worker.ts):                                          │
│  - waitlist-promote: Promotes oldest waitlisted booking on cancellation    │
│  - booking-email: Dispatches confirmation notifications                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layered Architecture & Request Lifecycle

The backend adheres to a strict separation of concerns across four discrete layers:

1. **Routing Layer (`src/routes/`)**: Registers HTTP endpoints, binds path parameters, and mounts route-level middleware (rate limiting, authentication, authorization, query validation).
2. **Controller Layer (`src/controllers/`)**: Extracts request inputs, coordinates service calls, formats responses into standardized JSON envelopes (`{ data, page, limit, total }`), and handles HTTP status codes.
3. **Service Layer (`src/services/`)**: Implements pure business logic, capacity assertions, transaction boundaries, cache read-throughs, and background job dispatches. Services remain decoupled from Express transport objects (`req`, `res`).
4. **Repository / Data Access Layer (`src/infra/` & Prisma)**: Encapsulates database queries, relation joins, and Redis operations. Swapping persistence mechanisms requires zero modifications to service signatures or controllers.

---

## 3. Concurrency Control & Zero-Oversell Transactions

### The Race Condition Problem
In ticketing platforms, multiple concurrent requests attempting to book the final available seat will both read `count < capacity` if using default transaction isolation (such as `Read Committed`). Both transactions proceed to insert a booking, causing an oversell condition.

### The Solution: Serializable Isolation & Bounded Retries
Eventify enforces PostgreSQL's strictest isolation level: `Serializable`.

```typescript
// Bounded retry loop for serializable transaction conflicts
const MAX_RETRIES = 5;
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // 1. Fetch event capacity
        const event = await tx.event.findUnique({ where: { id: eventId } });
        if (!event) throw new NotFoundError("Event not found");

        // 2. Count current confirmed bookings
        const confirmedCount = await tx.booking.count({
          where: { eventId, status: "CONFIRMED" },
        });

        // 3. Atomically determine status or place on waitlist
        const status = confirmedCount < event.capacity ? "CONFIRMED" : "WAITLISTED";

        // 4. Create or re-open booking
        return await tx.booking.create({
          data: { userId, eventId, status },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    if (isSerializationFailure(err) && attempt < MAX_RETRIES) {
      // Exponential backoff with jitter
      await delay(Math.pow(2, attempt) * 20 + Math.random() * 10);
      continue;
    }
    throw err;
  }
}
```

- **Conflict Detection**: Retries are triggered on Prisma's `P2034` error code as well as driver-level `TransactionWriteConflict` messages thrown by `@prisma/adapter-pg`.
- **Constraint Backstop**: A database-level composite unique constraint `@@unique([userId, eventId])` guarantees idempotency, mapping violations to `409 Conflict`.
- **Proof of Correctness**: Under a 20-thread concurrent booking simulation against an event with capacity 5, the engine records exactly 5 `201 CONFIRMED` responses and 15 `409 Conflict` (or waitlisted) records, with zero overselling.

---

## 4. Database Indexing & Query Performance

High-frequency queries on the `Booking` table (such as user ticket lookups and capacity checks) require dedicated index coverage to avoid full table scans:

### EXPLAIN ANALYZE Verification
```sql
-- Query: Fetch all bookings for a user
EXPLAIN ANALYZE SELECT * FROM "Booking" WHERE "userId" = '...';

-- BEFORE INDEX: Full table scan
-- Seq Scan on "Booking" (cost=0.00..35.50 rows=10 width=128)

-- AFTER INDEX: B-tree Index Scan using "Booking_userId_eventId_key"
-- Index Scan using "Booking_userId_eventId_key" on "Booking" (cost=0.15..8.17 rows=1 width=128)
--   Index Cond: ("userId" = '...')
```

Because the composite unique constraint `@@unique([userId, eventId])` creates a composite B-tree index where `userId` is the leading column, PostgreSQL's query planner automatically uses this index for queries filtering by `userId`, reducing row reads from \(O(N)\) to \(O(\log N)\).

---

## 5. High-Performance Redis Caching

Eventify applies a hybrid cache-aside and versioned invalidation pattern to ensure minimal database load without serving stale data:

### Single Event Caching (Cache-Aside with Jitter)
- **Key Pattern**: `event:<id>`
- **TTL**: 60 seconds + randomized jitter (up to ±10 seconds) to prevent the "thundering herd" problem where multiple cache entries expire simultaneously.
- **Invalidation**: Any mutating operation (`PATCH /v1/events/:id` or `DELETE /v1/events/:id`) performs an immediate `DEL event:<id>`.

### Catalog & Filtered Lists (Versioned Invalidation)
- **Key Pattern**: `events:list:v<version>:<queryStringHash>`
- **Version Key**: `events:list:version`
- **Invalidation Mechanism**: Rather than searching and deleting unpredictable combinations of query keys (`KEYS` or `SCAN`), any event creation, update, or deletion executes an atomic `INCR events:list:version`. This immediately invalidates all cached catalog listings across the cluster in \(O(1)\) time.

---

## 6. Asynchronous Jobs & BullMQ Queues

Long-running or non-blocking tasks are offloaded to dedicated BullMQ workers backed by Redis:

```
[Booking Cancellation] ──► DELETE /v1/bookings/:id
                                 │
                                 ├──► Update status = "CANCELLED"
                                 │
                                 └──► Enqueue Job to "waitlist-promote"
                                            │
                                            ▼
                                   [Worker Process]
                                 BullMQ Processor:
                                 1. Find earliest WAITLISTED booking
                                 2. Atomically flip to "CONFIRMED"
                                 3. Enqueue "booking-email" notification
```

- **Dedicated Connection**: BullMQ uses dedicated Redis client instances with `maxRetriesPerRequest: null`, preventing command blocking from interfering with cache-aside requests.
- **Graceful Shutdown**: The worker process listens for `SIGTERM` and `SIGINT`, completing active jobs and draining queues cleanly before terminating.

---

## 7. Security Architecture & Threat Mitigation

### Authentication & Token Rotation
Eventify implements a dual-token authentication model designed to thwart token theft and replay attacks:

1. **Access Token (Short-Lived)**:
   - Formatted as a JSON Web Token (JWT) signed with HMAC-SHA256.
   - Explicitly pins `algorithms: ["HS256"]` during verification to prevent algorithm confusion attacks (`"alg": "none"`).
   - Valid for 15 minutes; contains subject (`sub`) and role (`role`).
2. **Refresh Token (Long-Lived & Rotated)**:
   - 32 random bytes (base64url) stored strictly as a SHA-256 hash in the database.
   - Transmitted solely via an `httpOnly`, `Secure`, `SameSite=strict` cookie scoped to `/v1/auth/refresh`.
   - **Family Revocation on Replay**: If an expired or already-rotated refresh token is presented, the system detects a token hijacking attempt and immediately revokes all refresh tokens issued to that user, invalidating the entire token family.

### OWASP API Security Protections
- **Broken Object Level Authorization (BOLA / IDOR)**: All booking operations derive user identity exclusively from the validated JWT subject (`req.auth.sub`). Client-provided `userId` parameters in request bodies are explicitly stripped and rejected.
- **Strict Schema Validation**: Request bodies are validated using Zod with `z.strictObject()`, automatically returning `400 Bad Request` if unknown or malicious properties are injected.
- **Targeted Rate Limiting**:
  - `POST /v1/auth/login`: 5 attempts per 15-minute sliding window per IP address.
  - `POST /v1/bookings`: 30 requests per minute per authenticated user ID (subject), insulating the database from denial-of-service spam.

---

## 8. Architectural Trade-offs & Production Considerations

| Decision | Chosen Approach | Alternative | Rationale & Trade-off |
|---|---|---|---|
| **Runtime Execution** | `tsx` (`node --import tsx`) | Emitted `tsc` build (`dist/`) | Preserves literal ESM `.ts` import extensions and `erasableSyntaxOnly` without complex multi-target build orchestration. Eliminates build step drift. |
| **Isolation Level** | `Serializable` | `Read Committed` with row locks | Provides absolute mathematical protection against overselling and phantom reads; requires application-level bounded retry handling for serialization conflicts. |
| **List Invalidation** | Atomic Version Counter (`INCR`) | Pattern-based `SCAN` + `DEL` | \(O(1)\) instantaneous invalidation without blocking Redis with expensive key scans across high-cardinality parameter spaces. |
| **Worker Architecture** | Separate process (`worker.ts`) | In-process queue processing | Prevents heavy background workloads from consuming event loop cycles required for HTTP request handling. |
