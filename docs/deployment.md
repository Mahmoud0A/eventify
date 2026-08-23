# Eventify — Deployment Guide (Render + Neon + Upstash)

> Status: **preparation only.** No accounts are provisioned yet and no live URL exists.
> Every step below is executable the moment the accounts exist. Nothing here claims a running deployment.

## Target topology

| Component | Provider | Plan note |
|---|---|---|
| API (`node --import tsx src/server.ts`) | Render Web Service (Docker) | Free tier works; cold starts after inactivity |
| Worker (`node --import tsx src/worker.ts`) | Render Background Worker | **Paid** — free tier has no background workers |
| PostgreSQL 18 | Neon | Free tier available; use the pooled connection string for serverless-friendly limits |
| Redis 8 | Upstash | Free tier; TLS endpoint (`rediss://…`) |

## 1. Neon Postgres

1. Create project → copy the **pooled** connection string (`...-pooler.../eventify?sslmode=require`).
2. Apply schema from any machine (never run destructive commands against unknown DBs):
   ```bash
   DATABASE_URL="<neon-pooled-url>" npx prisma migrate deploy
   ```
3. Seed demo data (idempotent; leaves open events with capacity — e.g. *JS 101* cap 30 — plus known accounts like `organizer@example.com` / `Password123!`):
   ```bash
   DATABASE_URL="<neon-pooled-url>" npx tsx prisma/seed.ts
   ```

## 2. Upstash Redis

1. Create a Redis database (region near the API).
2. Copy the TLS endpoint: `REDIS_URL=rediss://default:<password>@<host>:6379`.

## 3. Render API service

- **Type:** Web Service → **Deploy from Docker repo**, Dockerfile at repo root.
- **Pre-deploy command:** `npx prisma migrate deploy`
- **Health check path:** `/health`
- **Environment variables (dashboard only — never committed):**

| Key | Value |
|---|---|
| `DATABASE_URL` | Neon pooled URL |
| `REDIS_URL` | Upstash `rediss://…` URL |
| `JWT_ACCESS_SECRET` | freshly generated ≥32-char random string (real production secret) |
| `WEB_ORIGIN` | front-end origin, if any |
| `NODE_ENV` | `production` |

`PORT` is optional (defaults to 3000); if the platform injects one, bind follows it.

## 4. Worker service

- **Preferred:** paid Render Background Worker, same Docker image, start command:
  ```text
  node --import tsx src/worker.ts
  ```
  Same environment variables as the API (no port needed).
- **Free-tier trade-off:** Render's free tier offers no background workers. Without it, waitlist promotions and confirmation emails are processed only locally/in CI. Do not represent background jobs as running in production until this service exists.

## 5. Cold-start trade-off

Free Render services sleep after inactivity; first request pays a spin-up delay (tens of seconds). Health-check-based monitors or a paid plan remove this.

## 6. Verification checklist (only after provisioning)

```bash
curl https://<render-url>/health                                  # expect {"status":"ok"}
# signup an organizer via /v1/auth/signup, create an event, book it with a second account
```

Then — and only then — record the live URL in README.md and mark the deployment checkboxes in `tasks/todo.md`.
