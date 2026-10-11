"use client";

import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";

interface ActionBarProps {
  priceDisplay?: string;
  priceSubtext?: string;
  primaryLabel?: string;
  onPrimaryClick: () => void;
  isDisabled?: boolean;
  isLoading?: boolean;
  secondaryAction?: React.ReactNode;
}

export function ActionBar({
  priceDisplay = "$9 total",
  priceSubtext = "USPS mailing included",
  primaryLabel = "Write your note",
  onPrimaryClick,
  isDisabled = false,
  isLoading = false,
  secondaryAction,
}: ActionBarProps) {
  return (
    <aside
      aria-label="Order summary and action"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-lg pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-4"
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Total & details */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tracking-tight text-stone-900 font-serif">
              {priceDisplay}
            </span>
          </div>
          <span className="text-[11px] text-stone-700 truncate font-medium">
            {priceSubtext}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {secondaryAction}

          <button
            type="button"
            onClick={onPrimaryClick}
            disabled={isDisabled || isLoading}
            className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:bg-stone-300 disabled:text-stone-500 text-white font-medium text-base px-5 py-3 rounded-xl min-h-[44px] min-w-[140px] shadow-sm transition focus:outline-hidden focus-visible:ring-3 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <span>{primaryLabel}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
