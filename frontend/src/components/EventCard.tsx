"use client";

import React from "react";
import Link from "next/link";
import { Event, BookingStatus } from "@/types";
import { Calendar, MapPin, Users, Tag, ArrowRight, CheckCircle, Clock } from "lucide-react";

interface EventCardProps {
  event: Event;
  userBookingStatus?: BookingStatus | null;
}

export function formatPrice(priceCents: number): string {
  if (priceCents === 0) return "Free";
  return `$${(priceCents / 100).toFixed(2)}`;
}

export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export const EventCard: React.FC<EventCardProps> = ({ event, userBookingStatus }) => {
  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all">
      <div>
        {/* Header badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            <Tag className="h-3 w-3" />
            {formatPrice(event.priceCents)}
          </span>

          {userBookingStatus && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                userBookingStatus === "CONFIRMED"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : userBookingStatus === "WAITLISTED"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {userBookingStatus === "CONFIRMED" ? (
                <CheckCircle className="h-3 w-3 text-emerald-600" />
              ) : (
                <Clock className="h-3 w-3 text-amber-600" />
              )}
              {userBookingStatus}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
          <Link href={`/events/${event.id}`}>{event.title}</Link>
        </h3>

        {/* Description */}
        <p className="mt-2 text-sm text-slate-600 line-clamp-2 min-h-[2.5rem]">
          {event.description || "No description provided."}
        </p>

        {/* Event Meta */}
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <span>{formatDateTime(event.startsAt)}</span>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="truncate">{event.venue || "Online / Virtual Venue"}</span>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400 shrink-0" />
            <span>Capacity: {event.capacity} attendees</span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
        <Link
          href={`/events/${event.id}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          <span>View Details</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};
