'use client';

/**
 * AgentStagedBanner: Draft Continuity & Prefill Notification
 *
 * Implements truthful prefill and draft recovery per §6 of DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md:
 * - Neutral draft/prefill messages (never asserts false AI agent provenance)
 * - Clear status indicators for loaded draft fields and remaining actions
 * - Graceful stage error recovery with explicit retry and fresh-start actions
 * - Preserves human-in-the-loop review before signature adoption and dispatch
 */

import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  X,
} from 'lucide-react';

export interface AgentStagedBannerProps {
  isStaged: boolean;
  stageId?: string | null;
  stagedSource?: 'stage' | 'url_params' | null;
  preStagedFieldCount?: number;
  remainingActionCount?: number;
  isReadyForSignature?: boolean;
  isLoadingStage?: boolean;
  stageError?: string | null;
  onDismiss?: () => void;
  onJumpToNextAction?: () => void;
  onRetryStageLoad?: () => void;
  onStartFresh?: () => void;
}

export const AgentStagedBanner: React.FC<AgentStagedBannerProps> = ({
  isStaged,
  stageId,
  stagedSource,
  preStagedFieldCount = 0,
  remainingActionCount = 1,
  isReadyForSignature = false,
  isLoadingStage = false,
  stageError = null,
  onDismiss,
  onJumpToNextAction,
  onRetryStageLoad,
  onStartFresh,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isStaged || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  // Case 1: Error loading server-staged draft
  if (stageError) {
    return (
      <div
        role="region"
        aria-label="Draft load notification"
        className="relative w-full rounded-lg border border-amber-500/40 bg-slate-900/95 backdrop-blur-md p-4 sm:p-4.5 shadow-xl shadow-amber-950/20 transition-all duration-200"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-semibold tracking-wider uppercase">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>SAVED DRAFT NOTICE</span>
            </div>
            {stageId && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/90 border border-slate-700 text-slate-300 font-mono text-[11px]">
                <span className="text-slate-500">STAGE ID:</span>
                <span className="font-bold text-amber-300 tracking-wide">{stageId}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-800/60"
            aria-label="Dismiss draft load notification"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span className="text-amber-400 font-mono text-xs uppercase tracking-wider font-bold">
                NOTICE:
              </span>
              <span>{"We couldn't load this saved draft. Your existing details were preserved."}</span>
            </p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              You can retry loading the saved draft or start fresh with your current letter details.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRetryStageLoad && (
              <button
                type="button"
                onClick={onRetryStageLoad}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
            {onStartFresh && (
              <button
                type="button"
                onClick={onStartFresh}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Start fresh</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Standard loaded or loading draft
  const statusPillText = isReadyForSignature || remainingActionCount === 0
    ? 'All details filled • Ready for signature'
    : `${preStagedFieldCount} field${preStagedFieldCount === 1 ? '' : 's'} filled • ${remainingActionCount} action${remainingActionCount === 1 ? '' : 's'} remaining`;

  const tagLabel = stageId ? 'SAVED DRAFT' : 'PREFILLED DRAFT';

  return (
    <div
      role="region"
      aria-label="Prepared notice draft"
      className={`relative w-full rounded-lg border transition-all duration-200 overflow-hidden shadow-xl ${
        isReadyForSignature
          ? 'bg-slate-900/95 border-amber-500/40 shadow-amber-950/20'
          : 'bg-slate-900/95 border-sky-500/30 shadow-sky-950/20'
      } backdrop-blur-md p-4 sm:p-4.5`}
    >
      {/* Top Meta Line: Badges & Dismiss */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          {/* Neutral Draft Tag */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-mono text-[11px] font-semibold tracking-wider uppercase">
            <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>{tagLabel}</span>
          </div>

          {/* Staged Draft ID Badge */}
          {stageId && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/90 border border-slate-700 text-slate-300 font-mono text-[11px]">
              <span className="text-slate-500">STAGE ID:</span>
              <span className="font-bold text-sky-300 tracking-wide">{stageId}</span>
            </div>
          )}

          {/* Completion Status Pill */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-medium ${
              isReadyForSignature
                ? 'bg-amber-950/70 border border-amber-500/50 text-amber-300'
                : 'bg-slate-800/80 border border-slate-700/80 text-slate-300'
            }`}
          >
            {isReadyForSignature ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            )}
            <span>{statusPillText}</span>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-800/60"
          aria-label="Dismiss draft notification"
          title="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Message Body */}
      <div className="pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span className="text-sky-400 font-mono text-xs uppercase tracking-wider font-bold">
              DRAFT READY:
            </span>
            <span>Review the details and sign before mailing via USPS.</span>
          </p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            {isLoadingStage ? (
              <span className="inline-flex items-center gap-2 text-sky-300 animate-pulse font-mono">
                Loading your draft…
              </span>
            ) : (
              'Your draft is ready to continue. Review the details before signing.'
            )}
          </p>
        </div>

        {onJumpToNextAction && (
          <button
            type="button"
            onClick={onJumpToNextAction}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-sm ${
              isReadyForSignature
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-900/30'
                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-900/30'
            }`}
          >
            <span>{isReadyForSignature ? 'Review and Sign' : 'Next Action'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
