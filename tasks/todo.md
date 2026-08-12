# Session 1 Homework — Eventify's First Server

## Tasks

- [x] **Domain types** — Create `src/domain.ts` with model types (Role, BookingStatus, Event, User, Booking) and generic `findById`
- [x] **Raw HTTP server** — Implement `src/server.ts` with routes: `GET /health`, `GET /events`, `GET /events/:id`, 404 for others
- [x] **Async data loading** — Load `data/events.json` lazily with `node:fs/promises` and async/await
- [x] **Error handling** — Graceful 500 JSON on file read failure; process never crashes
- [x] **Manual URL parsing** — Use string split to extract `:id` from `req.url`
- [x] **Verify all endpoints** — curl test: health, events list, get by id, missing id (404), garbage path (404)
- [x] **Stretch** — `POST /events` (optional) ✅ Implemented

---

## Implementation Summary

### ✅ Completed Features

**1. Domain Model** (`src/domain.ts`)
- Literal type unions: `Role` (ATTENDEE | ORGANIZER | ADMIN), `BookingStatus` (CONFIRMED | CANCELLED | WAITLISTED)
- Interfaces: `Event`, `User`, `Booking` matching exact contract
- Generic `findById<T>(items: T[], id: string)` utility
- Strict TypeScript, no `any` types

**2. HTTP Server** (`src/server.ts`)
- Raw `node:http` server, no frameworks
- Endpoint implementations:
  - `GET /health` → `200` with status and uptime (ms)
  - `GET /events` → `200` with Event[] array from data/events.json
  - `GET /events/:id` → `200` with Event or `404` { "error": "Event not found" }
  - Any other path → `404` { "error": "Not found" }
  - All responses: `Content-Type: application/json`

**3. Async Data Loading**
- Lazy load on first request with `readFile()` from `node:fs/promises`
- Cached after first load (no repeated file reads)
- Proper async/await (no `.then()` chains)
- On read failure: `500` JSON error, logs to console, process never crashes

**4. Error Handling Verified**
- ✅ Missing data file → `500 { "error": "Failed to load events" }` 
- ✅ Invalid event ID → `404 { "error": "Event not found" }`
- ✅ Invalid path → `404 { "error": "Not found" }`
- ✅ `/health` works even when data file is missing
- ✅ Process remains stable; can recover when file is restored

**5. URL Parsing**
- Manual string splitting: `pathname.split("/").filter(Boolean)`
- Extracts `resource` and `id` parameters manually (the "deliberate pain")
- Handles query strings correctly

**6. Stretch Feature: POST /events**
- Accepts JSON body with: title, description, capacity, organizerId, startsAt, venue, priceCents
- Validates required fields
- Returns `201` with created Event
- Returns `400` for missing/invalid fields or bad JSON
- Accumulates body chunks, parses manually (no Express yet)

---

## Notes

- TypeScript imports use `.ts` extensions per `allowImportingTsExtensions` in tsconfig
- Type-only imports for interfaces: `import type { Event } from "./domain.ts"`
- Runtime imports for functions: `import { findById } from "./domain.ts"`
- Seed data: 4 events (evt-1 through evt-4) from `data/events.json`
- Dev server: `npm run dev` with `node --watch`
- Typecheck passes: `npm run typecheck` ✅

