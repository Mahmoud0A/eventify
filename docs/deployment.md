# Eventify — Deployment Guide (Render + Neon + Upstash)

> **Status: DEPLOYED & VERIFIED (2026-08-23).**
> Live API: <https://eventify-capstone.onrender.com> — Render Free Web Service (Docker), branch `main`, backed by Neon PostgreSQL and Upstash Redis.
> Worker: not deployed (free-tier limitation) — background jobs queue until a worker service is added.

## Verified deployment record

| Item | Actual value |
|---|---|
| Render service type | Web Service (Docker image from repo `Dockerfile`) |
| Branch deployed | `main` |
| Health endpoint | `/health` → HTTP 200 `{"status":"ok",…}` (verified live and via Playwright/Chromium) |
| Migrations | `npx prisma migrate deploy` executed manually against the Neon production URL |
| Seed | idempotent `prisma/seed.ts` applied; 5 demo events observed live via public API (incl. open future events) |
| Live functional checks | signup 201 → login 200 → event discovery → booking **201 CONFIRMED** → persisted re-read with correct ownership → anonymous booking rejected 401 |

### Important correction for Render Free users

Render's **Free plan does not provide Pre-Deploy Commands**. The original guidance below assumes they exist. On the free plan:

1. Deploy the service first (it will boot fine but database-backed routes return 500 until schema exists).
2. Apply migrations manually from your machine: `$env:DATABASE_URL="<neon-pooled-url>"; npx prisma migrate deploy` (PowerShell) or `DATABASE_URL="<neon-pooled-url>" npx prisma migrate deploy` (bash).
3. Restart/redeploy is not required — Prisma picks up the new tables immediately.

Paid plans can instead set Pre-Deploy Command: `npx prisma migrate deploy`.

## Target topology

| Component | Provider | Plan note |
|---|---|---|
| API (`node --import tsx src/server.ts`) | Render Web Service (Docker) | Free tier works; cold starts after inactivity |
| Worker (`node --import tsx src/worker.ts`) | Render Background Worker | **Paid** — free tier has no background workers; NOT deployed yet |
| PostgreSQL 18 | Neon | Free tier; pooled connection string |
| Redis 8 | Upstash | Free tier; TLS endpoint (`rediss://…`) |

## 1. Neon Postgres

1. Create project → copy the **pooled** connection string (`...-pooler.../eventify?sslmode=require`).
2. Apply schema (done for the live deployment):
   ```bash
   DATABASE_URL="<neon-pooled-url>" npx prisma migrate deploy
   ```
3. Seed demo data — idempotent, leaves open events with capacity plus known accounts like `organizer@example.com` / `Password123!`:
   ```bash
   DATABASE_URL="<neon-pooled-url>" npx tsx prisma/seed.ts
   ```

## 2. Upstash Redis

1. Create a Redis database (region near the API).
2. Copy the TLS endpoint: `REDIS_URL=rediss://default:<password>@<host>:6379`.

## 3. Render API service

- **Type:** Web Service → deploy from Docker repo, Dockerfile at repo root.
- **Branch:** `main`
- **Health check path:** `/health`
- **Environment variables (dashboard only — never committed):**

| Key | Value |
|---|---|
| `DATABASE_URL` | Neon pooled URL |
| `REDIS_URL` | Upstash `rediss://…` URL |
| `JWT_ACCESS_SECRET` | freshly generated ≥32-char random string (real production secret) |
| `WEB_ORIGIN` | Deployed frontend origin (e.g., `https://eventify.vercel.app`) |
| `NODE_ENV` | `production` |

`PORT` is optional (defaults to 3000); if the platform injects one, bind follows it.

## 4. Frontend Deployment

### Option A: Vercel (Recommended — Free Tier)
1. Navigate to [Vercel Dashboard](https://vercel.com/new) and import `https://github.com/Mahmoud0A/eventify`.
2. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
3. Set Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://eventify-capstone.onrender.com`
4. Click **Deploy**. Vercel will build and assign a production URL (e.g., `https://eventify-<user>.vercel.app`).
5. Update `WEB_ORIGIN` in Render API settings to your Vercel URL to allow secure CORS cookies.

### Option B: Render Web Service (`render.yaml`)
1. From the Render Dashboard, choose **New Blueprint** and connect `Mahmoud0A/eventify`.
2. Render will automatically detect `render.yaml` and provision both the `eventify-api` (Docker) and `eventify-frontend` (Node/Next.js) web services.
3. Supply `DATABASE_URL` and `REDIS_URL` secrets when prompted.

## 5. Background Worker Service (Optional)

- **Preferred:** Paid Render Background Worker, same Docker image, start command:
  ```text
  node --import tsx src/worker.ts
  ```
  Same environment variables as the API (no port needed).
- **Free-tier trade-off (current state):** no worker is deployed on Render Free. Waitlist promotions and confirmation emails are verified in automated test suites and locally, but background jobs queue in Redis until a worker service is added.

## 6. Cold-start trade-off

Free Render services sleep after inactivity; first request pays a spin-up delay (tens of seconds). Health-check-based monitors or a paid plan remove this.

## 7. Verification performed on the live deployment

```text
GET  /health                    -> 200 {"status":"ok"}
POST /v1/auth/signup            -> 201 (unique test attendee)
POST /v1/auth/login             -> 200 (JWT for same subject)
GET  /v1/events                 -> 200, 5 seeded events, all with future dates
POST /v1/bookings               -> 201 status=CONFIRMED ("API Design Live")
GET  /v1/bookings/:id           -> 200, ownership + eventId + CONFIRMED verified
POST /v1/bookings (anonymous)   -> 401 rejected
Playwright (Chromium) /health   -> JSON body rendered, content-type application/json
```

Demo/test data note: verification created one clearly-named test account (`live-attendee-<timestamp>@test.local`) and one booking on *API Design Live*; both are harmless demo-database records.
