/**
 * Domain types for Eventify
 */

export type Role = "ATTENDEE" | "ORGANIZER" | "ADMIN";
export type BookingStatus = "CONFIRMED" | "CANCELLED" | "WAITLISTED";

export interface Event {
  id: string; // "evt-1" tonight; UUIDv7 from Session 3
  title: string;
  description: string;
  venue: string | null; // null = venue not announced yet
  startsAt: string; // ISO date
  capacity: number;
  priceCents: number; // 0 = free
  organizerId: string; // User.id
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  status: BookingStatus;
  createdAt: string;
}

/**
 * Generic findById utility
 */
export function findById<T extends { id: string }>(
  items: T[],
  id: string
): T | undefined {
  return items.find((item) => item.id === id);
}
