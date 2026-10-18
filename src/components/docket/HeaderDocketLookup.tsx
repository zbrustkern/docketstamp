'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={docketId}
          onChange={(e) => setDocketId(e.target.value)}
          placeholder="Track a mailed letter (ID)..."
          aria-label="Track a mailed letter by Docket ID"
          className="pl-8 pr-2.5 py-1.5 text-xs font-sans bg-slate-950/80 text-slate-100 placeholder-slate-400 border border-slate-700/80 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 w-44 sm:w-52 transition"
        />
      </div>
      <button
        type="submit"
        className="px-3 py-1.5 text-xs font-sans font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:text-white transition cursor-pointer"
      >
        Track
      </button>
    </form>
  );
}
