"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Event } from "@/types";
import { eventsApi, UpdateEventPayload, ApiError } from "@/lib/api";
import { EventForm } from "@/components/EventForm";
import { ArrowLeft, Edit, ShieldAlert, Loader2 } from "lucide-react";

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;

  const router = useRouter();
  const { user, role, isAuthenticated, isLoading: authLoading } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvent() {
      setLoading(true);
      try {
        const data = await eventsApi.getById(eventId);
        setEvent(data);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load event for editing.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [eventId]);

  const isOwnerOrAdmin = isAuthenticated && (role === "ADMIN" || (role === "ORGANIZER" && user?.id === event?.organizerId));

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
        <p className="mt-3 text-sm text-slate-500">Loading event editor...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
        <ShieldAlert className="mx-auto h-12 w-12 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900">{error || "Event not found"}</h2>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Catalog</span>
        </Link>
      </div>
    );
  }

  if (!isOwnerOrAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
        <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-bold text-slate-900">Permission Denied</h2>
        <p className="text-sm text-slate-600">You are not authorized to edit this event.</p>
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Event</span>
        </Link>
      </div>
    );
  }

  const handleUpdate = async (payload: UpdateEventPayload) => {
    await eventsApi.update(eventId, payload);
    router.push(`/events/${eventId}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div>
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Event Details</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Edit className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Edit Event</h1>
            <p className="text-xs text-slate-500">Update event information and settings</p>
          </div>
        </div>

        <EventForm
          initialData={event}
          onSubmit={handleUpdate}
          submitButtonText="Save Changes"
          isEditing={true}
        />
      </div>
    </div>
  );
}
