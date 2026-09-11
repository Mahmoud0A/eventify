"use client";

import React, { useState } from "react";
import { Search, MapPin, Calendar, X, Filter } from "lucide-react";

interface EventFiltersProps {
  venue: string;
  from: string;
  to: string;
  onFilterChange: (filters: { venue: string; from: string; to: string }) => void;
  onReset: () => void;
}

export const EventFilters: React.FC<EventFiltersProps> = ({
  venue: initialVenue,
  from: initialFrom,
  to: initialTo,
  onFilterChange,
  onReset,
}) => {
  const [venue, setVenue] = useState(initialVenue);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ venue, from, to });
  };

  const handleClear = () => {
    setVenue("");
    setFrom("");
    setTo("");
    onReset();
  };

  const hasFilters = venue || from || to;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-4 items-end">
        {/* Venue Filter */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Venue / Location
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MapPin className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Search by venue name..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Date From */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            From Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={from ? from.split("T")[0] : ""}
              onChange={(e) => setFrom(e.target.value ? new Date(e.target.value).toISOString() : "")}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </button>

          {hasFilters && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              title="Clear filters"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
