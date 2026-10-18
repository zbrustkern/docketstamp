'use client';

/**
 * StickyExecutionBar: Top Execution and Progress Controller
 *
 * Implements Sprint S4 requirements conforming to Sections 7.5 and 7.6 of
 * docs/DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md:
 * - 3-stage customer progression status:
 *   1. Step 1: Letter details
 *   2. Step 2: Review and sign
 *   3. Step 3: Ready for delivery
 * - Honest progress counter: X of Y Details Completed
 * - Contextual primary action:
 *   - "Next detail ↓" when details are missing or invalid
 *   - "Review and sign ↓" when all details are valid and only signature remains
 *   - "Choose delivery and pay →" when details are complete and signature is adopted
 * - Plain customer-facing mobile toggle ("View letter →" / "Edit details →")
 */

import React from 'react';

export interface StickyExecutionBarProps {
  completedFieldsCount: number;
  totalFieldsCount: number;
  isSignatureAdopted: boolean;
  isValid?: boolean;
  onNextRequiredField: () => void;
  onProceedToCheckout: () => void;
  mobileView: 'document' | 'drawer';
  onToggleMobileView: () => void;
  docketId: string;
}

export const StickyExecutionBar: React.FC<StickyExecutionBarProps> = ({
  completedFieldsCount,
  totalFieldsCount,
  isSignatureAdopted,
  isValid = false,
  onNextRequiredField,
  onProceedToCheckout,
  mobileView,
  onToggleMobileView,
  docketId,
}) => {
  const isDetailsComplete = isValid || (completedFieldsCount >= totalFieldsCount && totalFieldsCount > 0);
  const percentComplete = Math.min(
    100,
    Math.round((completedFieldsCount / Math.max(totalFieldsCount, 1)) * 100)
  );

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 text-white px-4 py-3 sm:px-6 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand, Docket ID & Stage Status Badge */}
        <div className="flex items-center gap-3">
          <a href="/" className="font-bold tracking-tight text-white flex items-center gap-1.5 hover:text-sky-400 transition">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-base font-extrabold tracking-tight">DocketStamp</span>
          </a>

          <div className="hidden sm:inline-block h-4 w-px bg-slate-800" />

          <div className="hidden md:flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {docketId}
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                isDetailsComplete && isSignatureAdopted
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : isDetailsComplete
                  ? 'bg-sky-950 text-sky-400 border border-sky-800'
                  : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}
            >
              {isDetailsComplete && isSignatureAdopted
                ? 'Step 3: Ready for delivery'
                : isDetailsComplete
                ? 'Step 2: Review and sign'
                : 'Step 1: Letter details'}
            </span>
          </div>
        </div>

        {/* Progress & Counter */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <div className="text-xs font-mono text-slate-300">
              <span className="font-bold text-white">{completedFieldsCount}</span> of{' '}
              <span className="text-slate-400">{totalFieldsCount}</span> Details Completed
            </div>
            <div className="w-32 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isDetailsComplete && isSignatureAdopted
                    ? 'bg-emerald-500'
                    : isDetailsComplete
                    ? 'bg-sky-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          {/* Mobile View Toggle */}
          <button
            type="button"
            onClick={onToggleMobileView}
            className="md:hidden bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs font-mono border border-slate-700"
          >
            {mobileView === 'document' ? 'Edit details →' : 'View letter →'}
          </button>

          {/* Next Action Buttons */}
          <div className="flex items-center gap-2">
            {!isDetailsComplete ? (
              <button
                type="button"
                onClick={onNextRequiredField}
                className="bg-amber-600 hover:bg-amber-500 text-white px-3 sm:px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition shadow-sm font-mono flex items-center gap-1.5"
              >
                <span>Next detail</span>
                <span className="text-amber-200">↓</span>
              </button>
            ) : !isSignatureAdopted ? (
              <button
                type="button"
                onClick={onNextRequiredField}
                className="bg-sky-600 hover:bg-sky-500 text-white px-3 sm:px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition shadow-sm font-mono flex items-center gap-1.5"
              >
                <span>Review and sign</span>
                <span className="text-sky-200">↓</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onProceedToCheckout}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition shadow-lg font-mono flex items-center gap-1.5"
              >
                <span>Choose delivery and pay</span>
                <span>→</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
