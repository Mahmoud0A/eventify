"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Booking, BookingStatus, Event } from "@/types";
import { bookingsApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Ticket, Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface BookingButtonProps {
  event: Event;
  currentBooking?: Booking | null;
  onBookingUpdated?: (booking: Booking | null) => void;
  className?: string;
}

export const BookingButton: React.FC<BookingButtonProps> = ({
  event,
  currentBooking: initialBooking,
  onBookingUpdated,
  className = "",
}) => {
  const { isAuthenticated, role } = useAuth();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(initialBooking || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleBook = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/events/${event.id}`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const created = await bookingsApi.create(event.id);
      setBooking(created);
      onBookingUpdated?.(created);

      if (created.status === "WAITLISTED") {
        setSuccessMessage("Event is currently full. You have been placed on the WAITLIST! If a spot opens up, the background worker will automatically promote your booking.");
      } else {
        setSuccessMessage("Booking CONFIRMED! Your ticket has been reserved successfully.");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError("Rate limit reached. Please wait a minute before booking again.");
        } else {
          setError(err.message || "Failed to book event.");
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!booking) return;

    if (!window.confirm("Are you sure you want to cancel your booking?")) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const cancelled = await bookingsApi.cancel(booking.id);
      setBooking(cancelled);
      onBookingUpdated?.(cancelled);
      setSuccessMessage("Booking cancelled successfully.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to cancel booking.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  // If user is not logged in:
  if (!isAuthenticated) {
    return (
      <div className={`space-y-3 ${className}`}>
        <Link
          href={`/login?redirect=/events/${event.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Ticket className="h-5 w-5" />
          <span>Sign In to Book</span>
        </Link>
        <p className="text-center text-xs text-slate-500">
          Attendees can register for free or join the waitlist.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Success banner */}
      {successMessage && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>{successMessage}</div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Booking State Actions */}
      {booking && booking.status === "CONFIRMED" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">You are attending this event</p>
                <p className="text-xs text-emerald-700">Status: CONFIRMED</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              <span>Cancel</span>
            </button>
          </div>
        </div>
      ) : booking && booking.status === "WAITLISTED" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="flex items-center gap-2.5">
              <Clock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">You are on the waitlist</p>
                <p className="text-xs text-amber-700">Status: WAITLISTED (auto-promotes on vacancy)</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              <span>Leave Waitlist</span>
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={handleBook}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Ticket className="h-5 w-5" />
                <span>Book Ticket / Join Waitlist</span>
              </>
            )}
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">
            Backed by serializable transactions. If full, you will be placed on the waitlist automatically.
          </p>
        </div>
      )}
    </div>
  );
};
