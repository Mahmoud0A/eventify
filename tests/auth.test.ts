// Auth integration tests — real signed JWTs, real refresh-token rotation.
import crypto from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.ts";
import { prisma } from "../src/lib/prisma.ts";
import { extractRefreshCookie, signup } from "./helpers/api.ts";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

describe("auth", () => {
  it("registers a new user and returns a real access token + refresh cookie", async () => {
    const res = await request(app)
      .post("/v1/auth/signup")
      .send({
        email: `s6-auth-reg-${Date.now()}@test.local`,
        password: "password123",
        name: "Auth Reg",
        role: "ATTENDEE",
      });

    expect(res.status).toBe(201);
    const token = res.body.accessToken as string;
    expect(token.split(".")).toHaveLength(3); // real signed JWT shape
    expect(extractRefreshCookie(res)).toMatch(/^refreshToken=.+/);

    const payload = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")
    ) as { sub: string; role: string };
    expect(payload.sub).toBeTruthy();
    expect(payload.role).toBe("ATTENDEE");
  });

  it("rejects duplicate signup email with 409", async () => {
    const user = await signup("dup");
    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: user.email, password: "password123", name: "Dup" });
    expect(res.status).toBe(409);
  });

  it("logs in with valid credentials and rejects bad ones", async () => {
    const user = await signup("login");

    const ok = await request(app)
      .post("/v1/auth/login")
      .send({ email: user.email, password: "password123" });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.accessToken).toBe("string");
    expect(ok.headers["set-cookie"]).toBeDefined();

    const bad = await request(app)
      .post("/v1/auth/login")
      .send({ email: user.email, password: "wrong-password" });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toBe("Invalid credentials");
  });

  it("rotates the refresh token on /refresh (old row revoked, replacedById set)", async () => {
    const user = await signup("rotate");
    const oldCookie = user.refreshCookie;
    const oldRaw = oldCookie.split("=")[1]!;

    const refreshed = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", oldCookie);
    expect(refreshed.status).toBe(200);
    expect(typeof refreshed.body.accessToken).toBe("string");

    const newRaw = extractRefreshCookie(refreshed).split("=")[1]!;
    expect(newRaw).not.toBe(oldRaw);

    // persisted rotation state in eventify_test
    const oldRow = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(oldRaw) },
    });
    expect(oldRow).not.toBeNull();
    expect(oldRow!.revokedAt).not.toBeNull();
    expect(oldRow!.replacedById).not.toBeNull();

    // the NEW refresh cookie is itself valid for another rotation
    const again = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", extractRefreshCookie(refreshed));
    expect(again.status).toBe(200);
  });

  it("rejects reuse of a rotated token with 401 and revokes the whole family", async () => {
    const user = await signup("reuse");

    const first = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", user.refreshCookie);
    expect(first.status).toBe(200);
    const latestCookie = extractRefreshCookie(first);

    // replay the OLD (already rotated) token — theft signal
    const replay = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", user.refreshCookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error).toBe("Invalid token");

    // family revocation: even the newest token is now dead
    const afterReuse = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", latestCookie);
    expect(afterReuse.status).toBe(401);
    expect(afterReuse.body.error).toBe("Invalid token");
  });
});
