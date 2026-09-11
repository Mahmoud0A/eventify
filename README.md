# Eventify — Full-Stack Event Management Platform

[![CI](https://github.com/Mahmoud0A/eventify/actions/workflows/ci.yml/badge.svg)](https://github.com/Mahmoud0A/eventify/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/Node-%3E%3D24-brightgreen.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791.svg)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-7.9-2D3748.svg)](https://www.prisma.io)
[![Redis](https://img.shields.io/badge/Redis-8.10-DC382D.svg)](https://redis.io)

Eventify is a full-stack event management and booking platform built with a modern React / Next.js frontend and a resilient Node.js / Express REST API. The platform delivers transactional event bookings, automatic waitlist queues, role-based access control (RBAC), cache-aside performance with Redis, and complete end-to-end integration.

**Live Frontend Application:** <https://eventify-hub.vercel.app> (also available at <https://eventify-fullstack.vercel.app>) — Vercel Serverless Edge, verified live: user registration, authenticated session management, event creation & editing, transactional bookings, and dashboards.

**Live Backend REST API:** <https://eventify-capstone.onrender.com> — Render Web Service (Docker), verified live: `/health` 200, JWT auth, event discovery, and confirmed transactional bookings against Neon PostgreSQL & Upstash Redis.

---

## Visual Walkthrough & Screenshots

### 1. Event Discovery & Public Catalog
Explore upcoming events with dynamic venue search, date range filtering, and pagination.
![Event Discovery](docs/screenshots/01_homepage_events.png)

### 2. Event Details & Transactional Booking
Comprehensive event information, live capacity tracking, and one-click booking or automatic waitlisting when capacity is reached.
![Event Details](docs/screenshots/02_event_details.png)

### 3. Confirmed Booking State & Cancellation
Real-time confirmation backed by serializable database transactions, with soft-cancellation triggering automatic waitlist promotion.
![Booking Confirmed](docs/screenshots/04_booking_confirmed.png)

### 4. Attendee Dashboard
Manage your reserved tickets, track waitlist status in real time, and monitor system health.
![Attendee Dashboard](docs/screenshots/05_dashboard_with_booking.png)

### 5. Organizer Event Management
Organizers can create, publish, edit, and delete events with validated forms and instant cache invalidation.
![Create Event Form](docs/screenshots/07_create_event_form.png)
![Organizer Dashboard](docs/screenshots/06_dashboard_organizer.png)

---

## Full-Stack Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS FRONTEND (Port 3001)                       │
│  React 19 · Next.js 15 (App Router) · TypeScript · Tailwind CSS             │
│  - Centralized Typed API Client with auto 401 refresh interception         │
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

> 📖 **Deep Dive Documentation:** For in-depth analysis of PostgreSQL `Serializable` transaction isolation, bounded retry loops, `EXPLAIN ANALYZE` index performance, Redis versioned cache invalidation, BullMQ worker topologies, and OWASP API security defenses, see [docs/architecture.md](docs/architecture.md).

---

## Features Matrix

| Domain | Capability | Implementation Details |
|---|---|---|
| **Discovery** | Public Catalog | Paginated events (`GET /v1/events`), venue filter, date range filters, Redis versioned caching |
| **Discovery** | Event Details | Detailed metadata (`GET /v1/events/:id`), organizer info, capacity status, cached 60s + jitter |
| **Authentication** | Registration & Login | Passwords hashed with bcrypt (10 rounds), HS256 access tokens (15m expiry), rate limited (5/15m/IP) |
| **Authentication** | Refresh Token Rotation | HttpOnly refresh cookie (7d), rotation on refresh; token replay theft detection revokes entire family |
| **RBAC** | Role Hierarchy | Roles: `ATTENDEE`, `ORGANIZER`, `ADMIN`. Enforced on endpoints via middleware and reflected in UI |
| **Event Management** | Create / Edit / Delete | Allowed for `ORGANIZER` (owned events) and `ADMIN`. Instant Redis cache invalidation on write |
| **Booking Engine** | Transactional Bookings | PostgreSQL `Serializable` transaction isolation with bounded retries; enforces `@@unique([userId, eventId])` |
| **Booking Engine** | Waitlist Handling | When event is full, booking is placed as `WAITLISTED`; cancellation triggers BullMQ `waitlist-promote` |
| **User Dashboard** | My Bookings | Attendee view of tickets with badges (`CONFIRMED`, `WAITLISTED`, `CANCELLED`) and cancellation action |
| **User Dashboard** | My Events | Organizer view listing created events, capacity metrics, edit links, and deletion triggers |
| **System Diagnostics** | Live Health Monitor | Real-time polling of `/health` showing API status, uptime, and database connectivity |

---

## API Endpoints Reference

| Method | Path | Auth Required | Description |
|---|---|---|---|
| `GET` | `/health` | None | API liveness and uptime diagnostics |
| `POST` | `/v1/auth/signup` | None | Register account (`{email, password, name, role?}`) → JWT + refresh cookie |
| `POST` | `/v1/auth/login` | None | Login (`{email, password}`) (rate-limited: 5/15 min/IP) |
| `POST` | `/v1/auth/refresh` | Cookie | Rotates refresh token; revokes family on reuse |
| `POST` | `/v1/auth/logout` | Cookie | Revokes refresh token chain |
| `GET` | `/v1/events` | None | List events (`page, limit, venue, from, to`) |
| `GET` | `/v1/events/:id` | None | Get single event details (cached) |
| `POST` | `/v1/events` | ORGANIZER / ADMIN | Create new event |
| `PATCH` | `/v1/events/:id` | Owner ORGANIZER / ADMIN | Update event details & invalidate cache |
| `DELETE` | `/v1/events/:id` | Owner ORGANIZER / ADMIN | Delete event |
| `POST` | `/v1/bookings` | ATTENDEE+ | Book event (returns `CONFIRMED` or `WAITLISTED` if full) |
| `GET` | `/v1/bookings` | Authenticated | Get user's bookings (or all if ADMIN) |
| `GET` | `/v1/bookings/:id` | Owner / ADMIN | Get booking details |
| `DELETE` | `/v1/bookings/:id` | Owner | Soft cancel booking (`CANCELLED`), enqueues waitlist promotion |

---

## Local Development Setup

### Prerequisites
- Node.js ≥ 24
- PostgreSQL 18
- Redis 8

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Mahmoud0A/eventify.git
cd eventify

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Environment Configuration
Create a `.env` file at the root:
```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eventify"
REDIS_URL="redis://localhost:6379"
JWT_ACCESS_SECRET="super-secret-jwt-key-min-32-chars-long-123456"
WEB_ORIGIN="http://localhost:3001"
TEST_AUTH_ENABLED=false
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

### 3. Database Migration & Seeding
```bash
# Run migrations
npx prisma migrate deploy

# Seed demo events and accounts
npx tsx --env-file=.env prisma/seed.ts
```

### 4. Run Development Servers
```bash
# Terminal 1: Backend API (port 3000)
npm run dev

# Terminal 2: Frontend App (port 3001)
npm run dev:frontend
```

Now open <http://localhost:3001> in your browser.

Demo accounts:
- **Organizer**: `organizer@example.com` / `Password123!`
- **Attendee**: `attendee1@example.com` / `Password123!`

---

## Testing & Verification

The project includes both backend integration suites and frontend component/API suites.

```bash
# Run all tests across backend and frontend (26 tests)
npm run test:all

# Run backend integration tests (Vitest + Supertest against isolated eventify_test DB)
npm test

# Run frontend unit & component tests (Vitest + React Testing Library)
npm run test:frontend

# Run full TypeScript typechecks
npm run typecheck:all

# Run code linter
npm run lint

# Run Next.js production build
npm run build:frontend
```

### Test Isolation
- **Backend:** `vitest.setup.ts` creates and targets a dedicated `eventify_test` database (never touches dev), executes migrations, truncates tables after each test, and uses Redis DB 1. real signed JWTs are verified without auth mocks.
- **Frontend:** Vitest with jsdom environment tests `EventCard`, `BookingButton`, API client queries, and JWT state management.

---

## Docker Workflow

```bash
# Build and run API, Worker, PostgreSQL, and Redis
docker compose up -d

# Verify health
curl http://localhost:3000/health
```

---

## Production Deployment

| Service | Provider | Status | Public URL |
|---|---|---|---|
| **Frontend Web App** | Vercel (Edge / Serverless) | Live & Verified | [`https://eventify-hub.vercel.app`](https://eventify-hub.vercel.app) *(alias: [`eventify-fullstack.vercel.app`](https://eventify-fullstack.vercel.app))* |
| **Backend REST API** | Render (Docker Web Service) | Live & Verified | [`https://eventify-capstone.onrender.com`](https://eventify-capstone.onrender.com) |
| **Database** | Neon PostgreSQL 18 | Live & Verified | Managed Cloud PostgreSQL (SSL) |
| **Redis Cache & Queues** | Upstash Redis 8 | Live & Verified | Managed Serverless Redis (TLS) |

For complete production deployment instructions, environment variable configurations, and zero-cost hosting setup, refer to [docs/deployment.md](docs/deployment.md).

---

## License

MIT
