import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { EventCard, formatPrice, formatDateTime } from "@/components/EventCard";
import { Event } from "@/types";

const mockEvent: Event = {
  id: "test-event-1",
  title: "Cloud Architecture Summit 2026",
  description: "A deep dive into distributed cloud patterns and databases.",
  venue: "Istanbul Convention Center",
  startsAt: "2026-10-15T09:00:00.000Z",
  capacity: 150,
  priceCents: 4900,
  organizerId: "org-1",
  createdAt: "2026-08-01T12:00:00.000Z",
};

describe("EventCard component", () => {
  it("formats price correctly for free and paid events", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(4900)).toBe("$49.00");
    expect(formatPrice(1250)).toBe("$12.50");
  });

  it("renders event details properly", () => {
    render(<EventCard event={mockEvent} />);

    expect(screen.getByText("Cloud Architecture Summit 2026")).toBeInTheDocument();
    expect(screen.getByText("$49.00")).toBeInTheDocument();
    expect(screen.getByText("Istanbul Convention Center")).toBeInTheDocument();
    expect(screen.getByText("Capacity: 150 attendees")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view details/i })).toHaveAttribute("href", "/events/test-event-1");
  });

  it("displays CONFIRMED badge when booked", () => {
    render(<EventCard event={mockEvent} userBookingStatus="CONFIRMED" />);
    expect(screen.getByText("CONFIRMED")).toBeInTheDocument();
  });

  it("displays WAITLISTED badge when waitlisted", () => {
    render(<EventCard event={mockEvent} userBookingStatus="WAITLISTED" />);
    expect(screen.getByText("WAITLISTED")).toBeInTheDocument();
  });
});
