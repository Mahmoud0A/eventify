"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Event, PaginatedEvents, Booking } from "@/types";
import { eventsApi, bookingsApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { EventCard } from "@/components/EventCard";
import { EventFilters } from "@/components/EventFilters";
import { HealthBadge } from "@/components/HealthBadge";
import { Calendar, Sparkles, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Layers } from "lucide-react";

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [venueFilter, setVenueFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [userBookings, setUserBookings] = useState<Map<string, Booking>>(new Map());

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventsApi.getAll({
        page,
        limit,
        venue: venueFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setEvents(res.data);
      setTotalEvents(res.total);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to load events from the API.");
      } else {
        setError("Network error connecting to Eventify REST API.");
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, venueFilter, fromDate, toDate]);

  // Fetch user bookings to display booking badges on cards
  const fetchUserBookings = useCallback(async () => {
    if (!isAuthenticated) {
      setUserBookings(new Map());
      return;
    }
    try {
      const bookings = await bookingsApi.getAll();
      const map = new Map<string, Booking>();
      bookings.forEach((b) => map.set(b.eventId, b));
      setUserBookings(map);
    } catch {
      // Non-critical, ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchUserBookings();
  }, [fetchUserBookings]);

  const handleFilterChange = (filters: { venue: string; from: string; to: string }) => {
    setVenueFilter(filters.venue);
    setFromDate(filters.from);
    setToDate(filters.to);
    setPage(1); // Reset to first page
  };

  const handleReset = () => {
    setVenueFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const totalPages = Math.ceil(totalEvents / limit) || 1;

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/60 via-white to-slate-50 border-b border-slate-200 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 mb-2">
              <HealthBadge />
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Seamless Event Discovery &amp; Bookings
            </h1>

            <p className="text-lg text-slate-600 sm:text-xl max-w-2xl mx-auto">
              Production-grade full-stack platform featuring transactional bookings, waitlist queues, role-based controls, and high-performance Redis caching.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#events-list"
                className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                Browse Events
              </a>
              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div id="events-list" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Upcoming Events</h2>
            <p className="text-sm text-slate-600">
              Showing {events.length} of {totalEvents} available events
            </p>
          </div>

          <button
            onClick={() => fetchEvents()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh catalog</span>
          </button>
        </div>

        {/* Filter Bar */}
        <EventFilters
          venue={venueFilter}
          from={fromDate}
          to={toDate}
          onFilterChange={handleFilterChange}
          onReset={handleReset}
        />

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-rose-600 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Failed to connect to API</h3>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => fetchEvents()}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700 transition-colors shrink-0"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
              >
                <div className="flex justify-between">
                  <div className="h-5 w-16 bg-slate-200 rounded-full" />
                  <div className="h-5 w-20 bg-slate-200 rounded-full" />
                </div>
                <div className="h-6 w-3/4 bg-slate-200 rounded" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-slate-100 rounded" />
                  <div className="h-4 w-2/3 bg-slate-100 rounded" />
                </div>
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <div className="h-3 w-1/2 bg-slate-100 rounded" />
                  <div className="h-3 w-1/3 bg-slate-100 rounded" />
                </div>
                <div className="h-9 w-full bg-slate-200 rounded-lg mt-4" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && events.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">No events found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {venueFilter || fromDate || toDate
                ? "No events match your search criteria. Try clearing your filters."
                : "No events are currently scheduled in the catalog."}
            </p>
            {(venueFilter || fromDate || toDate) && (
              <button
                onClick={handleReset}
                className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* Events Grid */}
        {!loading && !error && events.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const booking = userBookings.get(event.id);
              return (
                <EventCard
                  key={event.id}
                  event={event}
                  userBookingStatus={booking ? booking.status : null}
                />
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && totalEvents > limit && (
          <div className="flex items-center justify-between border-t border-slate-200 pt-6">
            <div className="text-xs text-slate-600">
              Page <span className="font-semibold text-slate-900">{page}</span> of{" "}
              <span className="font-semibold text-slate-900">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
