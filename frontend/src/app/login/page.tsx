"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { Calendar, LogIn, AlertCircle, Loader2, KeyRound } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ email: email.trim(), password });
      router.push(redirect);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError("Too many login attempts. Please try again in 15 minutes (backend rate limit).");
        } else {
          setError(err.message || "Invalid email or password.");
        }
      } else {
        setError("Network error connecting to authentication service.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Calendar className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to Eventify</h1>
          <p className="text-xs text-slate-500">Access your bookings and manage events</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-700 uppercase">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-1 w-full rounded-lg border border-slate-300 py-2 px-3 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-slate-300 py-2 px-3 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            <span>Sign In</span>
          </button>
        </form>

        {/* Demo Accounts Helper */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <KeyRound className="h-3.5 w-3.5 text-indigo-600" />
            <span>Quick Demo Accounts</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => fillDemoAccount("organizer@example.com", "Password123!")}
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors"
            >
              <span className="font-medium block text-indigo-600">Organizer</span>
              <span className="text-[10px] text-slate-500 truncate block">organizer@example.com</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount("user-1@example.com", "Password123!")}
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors"
            >
              <span className="font-medium block text-emerald-600">Attendee</span>
              <span className="text-[10px] text-slate-500 truncate block">user-1@example.com</span>
            </button>
          </div>
        </div>

        {/* Register link */}
        <div className="text-center text-xs text-slate-500">
          Don&apos;t have an account yet?{" "}
          <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-800">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading login form...</div>}>
      <LoginForm />
    </Suspense>
  );
}
