import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { BookingButton } from "@/components/BookingButton";
import * as authContextModule from "@/context/AuthContext";
import { Event, Booking } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const mockEvent: Event = {
  id: "test-event-2",
  title: "React & Next.js Masterclass",
  description: "Advanced fullstack patterns",
  venue: "Online",
  startsAt: "2026-11-20T14:00:00.000Z",
  capacity: 100,
  priceCents: 0,
  organizerId: "org-2",
  createdAt: "2026-08-01T12:00:00.000Z",
};

describe("BookingButton component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Sign In prompt when not authenticated", () => {
    vi.spyOn(authContextModule, "useAuth").mockReturnValue({
      user: null,
      role: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    render(<BookingButton event={mockEvent} />);
    expect(screen.getByText("Sign In to Book")).toBeInTheDocument();
  });

  it("renders confirmed booking status when user is attending", () => {
    vi.spyOn(authContextModule, "useAuth").mockReturnValue({
      user: { id: "user-1", email: "user-1@example.com", role: "ATTENDEE" },
      role: "ATTENDEE",
      token: "mock-token",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    const mockBooking: Booking = {
      id: "booking-1",
      userId: "user-1",
      eventId: mockEvent.id,
      status: "CONFIRMED",
      createdAt: "2026-08-05T10:00:00.000Z",
    };

    render(<BookingButton event={mockEvent} currentBooking={mockBooking} />);

    expect(screen.getByText("You are attending this event")).toBeInTheDocument();
    expect(screen.getByText(/Status: CONFIRMED/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("renders waitlist state when user booking is WAITLISTED", () => {
    vi.spyOn(authContextModule, "useAuth").mockReturnValue({
      user: { id: "user-1", email: "user-1@example.com", role: "ATTENDEE" },
      role: "ATTENDEE",
      token: "mock-token",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
    });

    const mockWaitlistBooking: Booking = {
      id: "booking-waitlist-1",
      userId: "user-1",
      eventId: mockEvent.id,
      status: "WAITLISTED",
      createdAt: "2026-08-05T10:00:00.000Z",
    };

    render(<BookingButton event={mockEvent} currentBooking={mockWaitlistBooking} />);

    expect(screen.getByText("You are on the waitlist")).toBeInTheDocument();
    expect(screen.getByText(/Status: WAITLISTED/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /leave waitlist/i })).toBeInTheDocument();
  });
});
