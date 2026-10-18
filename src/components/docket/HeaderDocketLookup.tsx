'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';

export function HeaderDocketLookup() {
  const router = useRouter();
  const [docketId, setDocketId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = docketId.trim().toUpperCase();
    if (cleanId) {
      router.push(`/docket/${encodeURIComponent(cleanId)}`);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={docketId}
            onChange={(e) => setDocketId(e.target.value)}
            placeholder="Track Docket ID (DS-2026-...)"
            aria-label="Track Docket ID"
            className="pl-8 pr-2.5 py-1 text-xs font-mono bg-slate-950/70 text-slate-100 placeholder-slate-500 border border-slate-700/80 rounded focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 w-44 sm:w-56 transition"
          />
        </div>
        <button
          type="submit"
          className="px-2.5 py-1 text-xs font-mono font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:text-white transition cursor-pointer"
        >
          Track
        </button>
      </form>
      <Link
        href="/docket/DS-2026-88419-X"
        className="hidden lg:inline-flex items-center text-[11px] font-mono text-slate-400 hover:text-sky-400 underline decoration-slate-600 underline-offset-2 transition ml-1"
      >
        Specimen: DS-2026-88419-X
      </Link>
    </div>
  );
}
