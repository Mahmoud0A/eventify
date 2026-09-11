import { Booking, Event, PaginatedEvents, Role } from "@/types";

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return "/api/backend";
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
}

let currentAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  currentAccessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("eventify_token", token);
    } else {
      localStorage.removeItem("eventify_token");
    }
  }
}

export function getAccessToken(): string | null {
  if (currentAccessToken) return currentAccessToken;
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("eventify_token");
    if (stored) {
      currentAccessToken = stored;
      return stored;
    }
  }
  return null;
}

export class ApiError extends Error {
  status: number;
  details?: Record<string, string[]>;

  constructor(status: number, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function handleResponse<T>(res: globalThis.Response): Promise<T> {
  if (res.status === 204) {
    return {} as T;
  }

  const contentType = res.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (data && typeof data === "object" && data.error) ? data.error : res.statusText || "Request failed";
    const details = (data && typeof data === "object" && data.details) ? data.details : undefined;
    throw new ApiError(res.status, message, details);
  }

  return data as T;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Include credentials for refresh cookie
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: "include",
  };

  try {
    const res = await fetch(url, fetchOptions);

    if (res.status === 401 && retryOn401 && !path.startsWith("/v1/auth/")) {
      // Try to refresh token once
      const newToken = await refreshTokenSilently();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        const retryRes = await fetch(url, { ...fetchOptions, headers });
        return handleResponse<T>(retryRes);
      }
    }

    return handleResponse<T>(res);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, error instanceof Error ? error.message : "Network error");
  }
}

async function refreshTokenSilently(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${getApiBase()}/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const data = await res.json();
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ================= AUTH API =================

export interface SignupPayload {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
}

export const authApi = {
  async signup(payload: SignupPayload): Promise<AuthResponse> {
    const data = await request<AuthResponse>("/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAccessToken(data.accessToken);
    return data;
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const data = await request<AuthResponse>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAccessToken(data.accessToken);
    return data;
  },

  async refresh(): Promise<AuthResponse> {
    const data = await request<AuthResponse>("/v1/auth/refresh", {
      method: "POST",
    }, false);
    setAccessToken(data.accessToken);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await request<void>("/v1/auth/logout", {
        method: "POST",
      }, false);
    } finally {
      setAccessToken(null);
    }
  },
};

// ================= EVENTS API =================

export interface EventQueryParams {
  page?: number;
  limit?: number;
  venue?: string;
  from?: string;
  to?: string;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  venue?: string | null;
  startsAt: string;
  capacity: number;
  priceCents: number;
}

export interface UpdateEventPayload {
  title?: string;
  description?: string;
  venue?: string | null;
  startsAt?: string;
  capacity?: number;
  priceCents?: number;
}

export const eventsApi = {
  async getAll(params: EventQueryParams = {}): Promise<PaginatedEvents> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", params.page.toString());
    if (params.limit) query.set("limit", params.limit.toString());
    if (params.venue) query.set("venue", params.venue);
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);

    const qs = query.toString();
    return request<PaginatedEvents>(`/v1/events${qs ? `?${qs}` : ""}`);
  },

  async getById(id: string): Promise<Event> {
    return request<Event>(`/v1/events/${id}`);
  },

  async create(payload: CreateEventPayload): Promise<Event> {
    return request<Event>("/v1/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async update(id: string, payload: UpdateEventPayload): Promise<Event> {
    return request<Event>(`/v1/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async delete(id: string): Promise<void> {
    return request<void>(`/v1/events/${id}`, {
      method: "DELETE",
    });
  },
};

// ================= BOOKINGS API =================

export const bookingsApi = {
  async getAll(): Promise<Booking[]> {
    return request<Booking[]>("/v1/bookings");
  },

  async getById(id: string): Promise<Booking> {
    return request<Booking>(`/v1/bookings/${id}`);
  },

  async create(eventId: string): Promise<Booking> {
    return request<Booking>("/v1/bookings", {
      method: "POST",
      body: JSON.stringify({ eventId }),
    });
  },

  async cancel(id: string): Promise<Booking> {
    return request<Booking>(`/v1/bookings/${id}`, {
      method: "DELETE",
    });
  },
};

// ================= HEALTH API =================

export interface HealthResponse {
  status: string;
  uptime: number;
}

export const healthApi = {
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>("/health");
  },
};
