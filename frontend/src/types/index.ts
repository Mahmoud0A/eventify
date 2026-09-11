export type Role = "ATTENDEE" | "ORGANIZER" | "ADMIN";

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "WAITLISTED";

export interface Event {
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

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
}

export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  status: BookingStatus;
  createdAt: string;
  event?: Event;
}

export interface PaginatedEvents {
  data: Event[];
  page: number;
  limit: number;
  total: number;
}

export interface ApiErrorResponse {
  error: string;
  details?: Record<string, string[]>;
}
