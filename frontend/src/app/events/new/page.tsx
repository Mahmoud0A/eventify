"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { eventsApi, CreateEventPayload, UpdateEventPayload } from "@/lib/api";
import { EventForm } from "@/components/EventForm";
import { ArrowLeft, PlusCircle, ShieldAlert } from "lucide-react";

export default function CreateEventPage() {
  const router = useRouter();
  const { role, isAuthenticated, isLoading } = useAuth();

  const isOrganizerOrAdmin = role === "ORGANIZER" || role === "ADMIN";

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?redirect=/events/new");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <div className="p-16 text-center text-sm text-slate-500">Loading authorizer...</div>;
  }

  if (!isOrganizerOrAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
        <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-bold text-slate-900">Organizer Access Required</h2>
        <p className="text-sm text-slate-600">
          Only users with the ORGANIZER or ADMIN role can create new events.
        </p>
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

  const handleCreate = async (payload: CreateEventPayload | UpdateEventPayload) => {
    const newEvent = await eventsApi.create(payload as CreateEventPayload);
    router.push(`/events/${newEvent.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Create New Event</h1>
            <p className="text-xs text-slate-500">Publish a new event to the Eventify platform</p>
          </div>
        </div>

        <EventForm
          onSubmit={handleCreate}
          submitButtonText="Publish Event"
        />
      </div>
    </div>
  );
}
