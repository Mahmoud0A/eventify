// Shared integration-test helpers — thin wrappers over the real HTTP API.
// Real signed JWTs only: TEST_AUTH_ENABLED is forced false by vitest.setup.ts.
import type { Response } from "supertest";
import request from "supertest";
import { app } from "../../src/app.ts";

export interface AuthContext {
  email: string;
  userId: string;
  accessToken: string;
  /** raw "refreshToken=<value>" cookie suitable for a Cookie header */
  refreshCookie: string;
}

export interface EventJson {
  id: string;
  title: string;
  description: string;
  venue: string | null;
  startsAt: string;
  capacity: number;
  priceCents: number;
  organizerId: string;
  createdAt: string;
}

export interface BookingJson {
  id: string;
  userId: string;
  eventId: string;
  status: string;
  createdAt: string;
}

export function extractRefreshCookie(res: Response): string {
  const raw = res.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = cookies.find((c) => c.startsWith("refreshToken="));
  if (!found) throw new Error("refreshToken cookie missing on auth response");
  return found.split(";")[0]!;
}

function decodeJwtSub(token: string): string {
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")
  ) as { sub: string };
  return payload.sub;
}

export async function signup(
  label: string,
  role: "ATTENDEE" | "ORGANIZER" | "ADMIN" = "ATTENDEE"
): Promise<AuthContext> {
  const email = `s6-${label}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@test.local`;
  const res = await request(app)
    .post("/v1/auth/signup")
    .send({ email, password: "password123", name: `S6 ${label}`, role });
  if (res.status !== 201) {
    throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const accessToken = res.body.accessToken as string;
  return {
    email,
    userId: decodeJwtSub(accessToken),
    accessToken,
    refreshCookie: extractRefreshCookie(res),
  };
}

const futureDate = () => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

export async function createEvent(
  organizerToken: string,
  overrides: Partial<{
    title: string;
    description: string;
    venue: string | null;
    startsAt: string;
    capacity: number;
    priceCents: number;
  }> = {}
): Promise<EventJson> {
  const res = await request(app)
    .post("/v1/events")
    .set("Authorization", `Bearer ${organizerToken}`)
    .send({
      title: `S6 Event ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: "Session 6 integration test event",
      venue: "Test Hall",
      startsAt: futureDate(),
      capacity: 10,
      priceCents: 1500,
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`event create failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body as EventJson;
}

export function book(attendeeToken: string, eventId: string) {
  return request(app)
    .post("/v1/bookings")
    .set("Authorization", `Bearer ${attendeeToken}`)
    .send({ eventId });
}
