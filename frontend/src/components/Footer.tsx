import React from "react";
import Link from "next/link";
import { Calendar, Server, Database, Zap, Code2 } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white">
              <Calendar className="h-4 w-4" />
            </div>
            <span>Eventify</span>
            <span className="text-xs text-slate-400 font-normal">Full-Stack Event Platform</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-indigo-500" />
              Next.js &amp; React
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Server className="h-3.5 w-3.5 text-emerald-500" />
              Express &amp; TypeScript
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Database className="h-3.5 w-3.5 text-cyan-600" />
              PostgreSQL &amp; Prisma
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-rose-500">
              Redis &amp; BullMQ
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Mahmoud0A/eventify"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Code2 className="h-4 w-4" />
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Eventify. Production-ready full-stack portfolio implementation.
        </div>
      </div>
    </footer>
  );
};
