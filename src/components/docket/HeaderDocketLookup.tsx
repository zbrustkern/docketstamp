'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, X, ArrowRight, ShieldCheck } from 'lucide-react';

export function HeaderDocketLookup() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [docketId, setDocketId] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle outside click & escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = docketId.trim().toUpperCase();
    if (cleanId) {
      setIsOpen(false);
      router.push(`/docket/${encodeURIComponent(cleanId)}`);
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="header-tracking-popover"
        className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-sans font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:text-white transition cursor-pointer shrink-0"
        title="Track a mailed letter by Docket ID"
      >
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <span className="hidden min-[360px]:inline">Track a letter</span>
        <span className="min-[360px]:hidden">Track</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          id="header-tracking-popover"
          role="dialog"
          aria-label="Track a mailed letter"
          className="absolute right-0 top-full mt-2 z-50 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl animate-fadeIn"
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold font-sans text-white">
                Track Mailed Letter
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Close tracking popup"
              className="text-slate-400 hover:text-white p-1 rounded-md transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="header-docket-input"
                className="block text-[11px] font-medium text-slate-300 mb-1"
              >
                Track Docket ID
              </label>
              <input
                ref={inputRef}
                id="header-docket-input"
                type="text"
                value={docketId}
                onChange={(e) => setDocketId(e.target.value)}
                placeholder="Track Docket ID (DS-2026-...)"
                aria-label="Track Docket ID (DS-2026-...)"
                className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-950 text-slate-100 placeholder-slate-500 border border-slate-700 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Link
                href="/docket/DS-2026-88419-X"
                onClick={() => setIsOpen(false)}
                className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>Sample tracking record</span>
                <ArrowRight className="w-3 h-3" />
              </Link>

              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-sans font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition cursor-pointer"
              >
                Track
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
