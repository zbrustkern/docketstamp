"use client";

import React from "react";
import Link from "next/link";
import { PenTool } from "lucide-react";

interface FlowHeaderProps {
  showClearDraft?: boolean;
  onClearDraft?: () => void;
}

export function FlowHeader({ showClearDraft = false, onClearDraft }: FlowHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 text-stone-900 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-md py-1 px-1.5 -ml-1.5"
          aria-label="SendMyNotes Home"
        >
          <span className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs">
            <PenTool className="w-4 h-4 text-emerald-50" aria-hidden="true" />
          </span>
          <span className="font-serif font-bold text-lg tracking-tight text-stone-900">
            SendMyNotes
          </span>
        </Link>

        {/* Action or reassurance pill */}
        <div className="flex items-center gap-3">
          {showClearDraft && onClearDraft && (
            <button
              type="button"
              onClick={onClearDraft}
              className="text-xs text-stone-700 hover:text-stone-900 underline underline-offset-2 min-h-[44px] flex items-center px-2 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-md"
            >
              Reset draft
            </button>
          )}
          <span className="hidden xs:inline-flex items-center text-xs font-medium text-stone-700 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200">
            $9 flat • USPS postage included
          </span>
        </div>
      </div>
    </header>
  );
}
