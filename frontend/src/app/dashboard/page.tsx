"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Booking, Event } from "@/types";
import { bookingsApi, eventsApi, ApiError } from "@/lib/api";
import { formatPrice, formatDateTime } from "@/components/EventCard";
import { HealthBadge } from "@/components/HealthBadge";
import {
  Calendar,
  Ticket,
  PlusCircle,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  Edit,
  ExternalLink,
  Shield,
  Sparkles,
  User,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

export default function DashboardPage() {
  const { user, role, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"bookings" | "events" | "system">("bookings");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [eventsMap, setEventsMap] = useState<Map<string, Event>>(new Map());
  const [organizedEvents, setOrganizedEvents] = useState<Event[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);

  const isOrganizerOrAdmin = role === "ORGANIZER" || role === "ADMIN";

  const loadDashboardData = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch user bookings
      const userBookings = await bookingsApi.getAll();
      setBookings(userBookings);

      // 2. Fetch all events to map details
      const eventsRes = await eventsApi.getAll({ limit: 100 });
      const map = new Map<string, Event>();
      eventsRes.data.forEach((ev) => map.set(ev.id, ev));
      setEventsMap(map);

      // 3. Filter organized events for this user (or all if ADMIN)
      if (role === "ADMIN") {
        setOrganizedEvents(eventsRes.data);
      } else if (role === "ORGANIZER") {
        setOrganizedEvents(eventsRes.data.filter((ev) => ev.organizerId === user?.id));
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to load dashboard data.");
      } else {
        setError("Network error fetching dashboard details.");
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, role, user?.id]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login?redirect=/dashboard");
      return;
    }
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [authLoading, isAuthenticated, router, loadDashboardData]);

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;

    setCancelLoadingId(bookingId);
    try {
      const updated = await bookingsApi.cancel(bookingId);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to cancel booking.");
    } finally {
      setCancelLoadingId(null);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm("Are you sure you want to delete this event? This will remove all associated data.")) {
      return;
    }

    try {
      await eventsApi.delete(eventId);
      setOrganizedEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete event.");
    }
  };

  if (authLoading || (loading && bookings.length === 0 && organizedEvents.length === 0)) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
        <p className="mt-3 text-sm text-slate-500">Loading user dashboard...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow">
            <User className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{user?.name || "User Dashboard"}</h1>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-100">
                {role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <HealthBadge />
          <button
            onClick={() => loadDashboardData()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("bookings")}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-semibold transition-colors ${
              activeTab === "bookings"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Ticket className="h-4 w-4" />
            <span>My Bookings ({bookings.length})</span>
          </button>

          {isOrganizerOrAdmin && (
            <button
              onClick={() => setActiveTab("events")}
              className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-semibold transition-colors ${
                activeTab === "events"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>My Organized Events ({organizedEvents.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("system")}
            className={`flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-semibold transition-colors ${
              activeTab === "system"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Architecture &amp; System</span>
          </button>
        </nav>
      </div>

      {/* Tab 1: Bookings */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {bookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Ticket className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-base font-semibold text-slate-900">No bookings yet</h3>
              <p className="mt-1 text-sm text-slate-500">
                You have not booked any events yet. Explore upcoming events to reserve your tickets.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Browse Catalog
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {bookings.map((booking) => {
                const event = eventsMap.get(booking.eventId);
                const isCancelled = booking.status === "CANCELLED";
                const isWaitlisted = booking.status === "WAITLISTED";
                const isConfirmed = booking.status === "CONFIRMED";

                return (
                  <div
                    key={booking.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isConfirmed
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isWaitlisted
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {isConfirmed ? (
                            <CheckCircle className="h-3 w-3 text-emerald-600" />
                          ) : isWaitlisted ? (
                            <Clock className="h-3 w-3 text-amber-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-slate-400" />
                          )}
                          <span>{booking.status}</span>
                        </span>

                        <span className="text-xs text-slate-400">
                          Booked on {formatDateTime(booking.createdAt)}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900">
                        {event ? event.title : `Event ID: ${booking.eventId}`}
                      </h3>

                      {event && (
                        <p className="text-xs text-slate-600">
                          {formatDateTime(event.startsAt)} • {event.venue || "Virtual"} •{" "}
                          {formatPrice(event.priceCents)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {event && (
                        <Link
                          href={`/events/${event.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          <span>View Event</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}

                      {!isCancelled && (
                        <button
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={cancelLoadingId === booking.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                        >
                          {cancelLoadingId === booking.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          <span>Cancel Booking</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Organized Events */}
      {activeTab === "events" && isOrganizerOrAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Events You Manage</h2>
            <Link
              href="/events/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create New Event</span>
            </Link>
          </div>

          {organizedEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-base font-semibold text-slate-900">No events organized yet</h3>
              <p className="mt-1 text-sm text-slate-500">
                You haven&apos;t created any events yet. Create your first event to start accepting attendees.
              </p>
              <Link
                href="/events/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Create Event</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {organizedEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        Capacity: {event.capacity} seats
                      </span>
                      <span className="text-xs text-indigo-600 font-semibold">
                        {formatPrice(event.priceCents)}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      <Link href={`/events/${event.id}`} className="hover:text-indigo-600 transition-colors">
                        {event.title}
                      </Link>
                    </h3>

                    <p className="text-xs text-slate-500">
                      {formatDateTime(event.startsAt)} • {event.venue || "Virtual Venue"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Link
                      href={`/events/${event.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>View</span>
                    </Link>
                    <Link
                      href={`/events/${event.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </Link>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: System Architecture */}
      {activeTab === "system" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">System Architecture &amp; Integration Details</h2>
            <p className="text-xs text-slate-500 mt-1">
              Live configuration overview proving the full-stack architecture claimed on CV.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <span className="text-xs font-bold text-indigo-600 uppercase">Frontend Layer</span>
              <p className="text-sm font-semibold text-slate-900">Next.js 15 &amp; React 19</p>
              <p className="text-xs text-slate-600">TypeScript, Tailwind CSS, typed REST client with automatic 401 refresh interception.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <span className="text-xs font-bold text-emerald-600 uppercase">Backend API</span>
              <p className="text-sm font-semibold text-slate-900">Express 5 &amp; TypeScript</p>
              <p className="text-xs text-slate-600">Layered routers/controllers/services with Zod validation, JWT HS256 auth, and RBAC.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <span className="text-xs font-bold text-cyan-600 uppercase">Database &amp; Transactions</span>
              <p className="text-sm font-semibold text-slate-900">PostgreSQL 18 &amp; Prisma 7</p>
              <p className="text-xs text-slate-600">Serializable transactions with bounded retries, composite uniqueness, and soft cancellation.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <span className="text-xs font-bold text-rose-600 uppercase">Cache &amp; Rate Limiting</span>
              <p className="text-sm font-semibold text-slate-900">Redis 8 &amp; node-redis</p>
              <p className="text-xs text-slate-600">Cache-aside with versioned list keys, TTL + jitter, and sliding/fixed window rate limiters.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <span className="text-xs font-bold text-amber-600 uppercase">Background Queues</span>
              <p className="text-sm font-semibold text-slate-900">BullMQ v6 &amp; Dedicated Worker</p>
              <p className="text-xs text-slate-600">Decoupled queue backend consuming waitlist-promote and booking-email jobs.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <span className="text-xs font-bold text-violet-600 uppercase">Security Model</span>
              <p className="text-sm font-semibold text-slate-900">JWT &amp; Refresh Token Rotation</p>
              <p className="text-xs text-slate-600">HttpOnly cookies, replay theft detection revoking token families, and BOLA protection.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
