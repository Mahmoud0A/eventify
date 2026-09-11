"use client";

import React, { useState } from "react";
import { Event } from "@/types";
import { CreateEventPayload, UpdateEventPayload, ApiError } from "@/lib/api";
import { Calendar, DollarSign, MapPin, Users, FileText, AlertCircle, Loader2 } from "lucide-react";

interface EventFormProps {
  initialData?: Partial<Event>;
  onSubmit: (payload: CreateEventPayload | UpdateEventPayload) => Promise<void>;
  submitButtonText?: string;
  isEditing?: boolean;
}

export const EventForm: React.FC<EventFormProps> = ({
  initialData,
  onSubmit,
  submitButtonText = "Save Event",
  isEditing = false,
}) => {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [venue, setVenue] = useState(initialData?.venue || "");
  
  // Format initial ISO date to YYYY-MM-DDTHH:MM for datetime-local
  const getInitialDateTime = () => {
    if (initialData?.startsAt) {
      try {
        const d = new Date(initialData.startsAt);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      } catch {
        return "";
      }
    }
    // Default tomorrow at 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [startsAt, setStartsAt] = useState(getInitialDateTime());
  const [capacity, setCapacity] = useState(initialData?.capacity?.toString() || "50");
  const [price, setPrice] = useState(
    initialData?.priceCents !== undefined ? (initialData.priceCents / 100).toFixed(2) : "0.00"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side validations
    const errors: Record<string, string[]> = {};
    if (!title.trim()) errors.title = ["Event title is required"];
    if (!startsAt) errors.startsAt = ["Event start date and time are required"];
    
    const parsedCapacity = parseInt(capacity, 10);
    if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
      errors.capacity = ["Capacity must be a positive number"];
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      errors.price = ["Price cannot be negative"];
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const payload: CreateEventPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        venue: venue.trim() || null,
        startsAt: new Date(startsAt).toISOString(),
        capacity: parsedCapacity,
        priceCents: Math.round(parsedPrice * 100),
      };

      await onSubmit(payload);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to save event");
        if (err.details) {
          setFieldErrors(err.details);
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-semibold text-slate-800">
          Event Title *
        </label>
        <div className="mt-1">
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Cloud Architecture Summit 2026"
            className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        {fieldErrors.title && (
          <p className="mt-1 text-xs text-rose-600">{fieldErrors.title.join(", ")}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-semibold text-slate-800">
          Description
        </label>
        <div className="mt-1">
          <textarea
            id="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the agenda, speakers, or requirements..."
            className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Venue & Date Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Venue */}
        <div>
          <label htmlFor="venue" className="block text-sm font-semibold text-slate-800">
            Venue / Location
          </label>
          <div className="mt-1 relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MapPin className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="venue"
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g., Tech Hub Auditorium (or leave blank for Virtual)"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {fieldErrors.venue && (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.venue.join(", ")}</p>
          )}
        </div>

        {/* Date & Time */}
        <div>
          <label htmlFor="startsAt" className="block text-sm font-semibold text-slate-800">
            Start Date & Time *
          </label>
          <div className="mt-1 relative">
            <input
              id="startsAt"
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {fieldErrors.startsAt && (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.startsAt.join(", ")}</p>
          )}
        </div>
      </div>

      {/* Capacity & Price Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Capacity */}
        <div>
          <label htmlFor="capacity" className="block text-sm font-semibold text-slate-800">
            Capacity (Seats) *
          </label>
          <div className="mt-1 relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="capacity"
              type="number"
              min="1"
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {fieldErrors.capacity && (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.capacity.join(", ")}</p>
          )}
        </div>

        {/* Price ($) */}
        <div>
          <label htmlFor="price" className="block text-sm font-semibold text-slate-800">
            Ticket Price (USD) *
          </label>
          <div className="mt-1 relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <DollarSign className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {fieldErrors.price && (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.price.join(", ")}</p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{submitButtonText}</span>
        </button>
      </div>
    </form>
  );
};
