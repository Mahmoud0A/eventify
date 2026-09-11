"use client";

import React, { useEffect, useState } from "react";
import { healthApi, HealthResponse } from "@/lib/api";
import { Activity, CheckCircle2, AlertCircle } from "lucide-react";

export const HealthBadge: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        const data = await healthApi.getHealth();
        if (mounted) {
          setHealth(data);
          setError(false);
        }
      } catch {
        if (mounted) {
          setError(true);
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (error) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 border border-rose-200">
        <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
        <span>API Offline</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        <Activity className="h-3.5 w-3.5 text-slate-400 animate-pulse" />
        <span>Connecting API...</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span>REST API Live ({Math.floor(health.uptime)}s uptime)</span>
    </div>
  );
};
