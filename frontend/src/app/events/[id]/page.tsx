"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Event, Booking } from "@/types";
import { eventsApi, bookingsApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { BookingButton } from "@/components/BookingButton";
import { formatPrice, formatDateTime } from "@/components/EventCard";
import {
  Calendar,
  MapPin,
  Users,
  Tag,
  ArrowLeft,
  Edit,
  Trash2,
  ShieldAlert,
  Clock,
  Loader2,
  CheckCircle,
} from "lucide-react";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;

  const { user, role, isAuthenticated } = useAuth();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const eventData = await eventsApi.getById(eventId);
        setEvent(eventData);

        if (isAuthenticated) {
          try {
            const userBookings = await bookingsApi.getAll();
            const existing = userBookings.find((b) => b.eventId === eventId && b.status !== "CANCELLED");
            if (existing) setBooking(existing);
          } catch {
            // non-fatal
          }
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.status === 404 ? "Event not found" : err.message);
        } else {
          setError("Failed to load event details.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [eventId, isAuthenticated]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this event? This action cannot be undone.")) {
      return;
    }

    setDeleteLoading(true);
    try {
      await eventsApi.delete(eventId);
      router.push("/dashboard");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete event");
    } finally {
      setDeleteLoading(false);
    }
  };

  const isOwnerOrAdmin = isAuthenticated && (role === "ADMIN" || (role === "ORGANIZER" && user?.id === event?.organizerId));

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
        <p className="mt-3 text-sm text-slate-500">Loading event details...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <ShieldAlert className="mx-auto h-12 w-12 text-rose-500" />
        <h2 className="text-2xl font-bold text-slate-900">{error || "Event not found"}</h2>
        <p className="text-sm text-slate-600">The event you are looking for may have been removed or does not exist.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Catalog</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to all events</span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm space-y-8">
        {/* Title & Badge */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-100">
              <Tag className="h-3.5 w-3.5" />
              {formatPrice(event.priceCents)}
            </span>

            {isOwnerOrAdmin && (
              <div className="flex items-center gap-2">
                <Link
                  href={`/events/${event.id}/edit`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Edit Event</span>
                </Link>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            {event.title}
          </h1>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-xl bg-slate-50 p-4 sm:p-6 border border-slate-100 text-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Date &amp; Time</p>
              <p className="font-semibold text-slate-900">{formatDateTime(event.startsAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Location / Venue</p>
              <p className="font-semibold text-slate-900 truncate max-w-[200px]" title={event.venue || "Virtual"}>
                {event.venue || "Virtual Event"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Total Capacity</p>
              <p className="font-semibold text-slate-900">{event.capacity} seats</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">About this event</h2>
          <div className="prose max-w-none text-slate-700 leading-relaxed whitespace-pre-line text-sm sm:text-base">
            {event.description || "No detailed description provided for this event."}
          </div>
        </div>

        {/* Booking / Waitlist Action Area */}
        <div className="pt-6 border-t border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Registration &amp; Tickets</h2>
          <BookingButton
            event={event}
            currentBooking={booking}
            onBookingUpdated={(b) => setBooking(b)}
          />
        </div>
      </div>
    </div>
  );
}
