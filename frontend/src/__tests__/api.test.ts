import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventsApi, ApiError, setAccessToken, getAccessToken } from "@/lib/api";

describe("API Client", () => {
  beforeEach(() => {
    localStorage.clear();
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it("manages access token storage correctly", () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken("test-token-123");
    expect(getAccessToken()).toBe("test-token-123");
    expect(localStorage.getItem("eventify_token")).toBe("test-token-123");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem("eventify_token")).toBeNull();
  });

  it("formats query parameters properly in eventsApi.getAll", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        data: [],
        page: 2,
        limit: 10,
        total: 0,
      }),
    } as unknown as Response);

    const res = await eventsApi.getAll({
      page: 2,
      limit: 10,
      venue: "Convention Center",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/v1/events?page=2&limit=10&venue=Convention+Center"),
      expect.anything()
    );
    expect(res.page).toBe(2);
    expect(res.limit).toBe(10);
  });

  it("throws typed ApiError on server error response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        error: "Event not found",
      }),
    } as unknown as Response);

    await expect(eventsApi.getById("non-existent-id")).rejects.toThrow(ApiError);
  });
});
