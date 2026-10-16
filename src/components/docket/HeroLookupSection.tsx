'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, Search, ShieldCheck } from 'lucide-react';

export function HeroLookupSection() {
  const router = useRouter();
  const [docketIdInput, setDocketIdInput] = useState('');

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = docketIdInput.trim();
    if (cleanId) {
      router.push(`/docket/${encodeURIComponent(cleanId)}`);
    }
  };

  return (
    <div className="pt-2 flex flex-col items-center gap-6 max-w-2xl mx-auto w-full">
      {/* Primary CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
        <a
          href="#notice-catalog"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-sans font-bold text-sm transition shadow-lg shadow-sky-500/20 active:scale-[0.98]"
        >
          <span>Prepare a Statutory Notice</span>
          <ArrowDown className="w-4 h-4" />
        </a>
      </div>

      {/* Quick Docket ID Lookup Bar */}
      <form
        onSubmit={handleLookup}
        className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-2 sm:p-2.5 flex flex-col sm:flex-row items-center gap-2 shadow-xl"
      >
        <div className="relative w-full flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={docketIdInput}
            onChange={(e) => setDocketIdInput(e.target.value)}
            placeholder="Enter Docket ID (e.g., DS-2026-88419-X)..."
            className="w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
        </div>
        <button
          type="submit"
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs font-semibold transition shrink-0 hover:text-white"
        >
          Track Notice &rarr;
        </button>
      </form>

      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Try sample specimen record:</span>
        <a
          href="/docket/DS-2026-88419-X"
          className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
        >
          DS-2026-88419-X
        </a>
      </div>
    </div>
  );
}
