// Session 1: Full domain model for Eventify
// Strict TypeScript, literal unions, no `any`, erasableSyntaxOnly

export type Role = "ATTENDEE" | "ORGANIZER" | "ADMIN";

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "WAITLISTED";

export interface Event {
  id: string;
  title: string;
  description: string;
  venue: string | null;
  startsAt: Date;
  capacity: number;
  priceCents: number;
  organizerId: string;
  createdAt: Date;
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
  createdAt: Date;
}

export function findById<T extends { id: string }>(arr: Array<T>, id: string): T | undefined {
  return arr.find((item) => item.id === id);
}