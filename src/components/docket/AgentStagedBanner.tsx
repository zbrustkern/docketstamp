'use client';

/**
 * AgentStagedBanner: Institutional Banner for AI Pre-Staged Docket Notices
 *
 * Implements Section 4.1 & 4.2 of docs/DOCKETSTAMP_AGENTIC_EXPANSION.md:
 * - Institutional dark slate aesthetic (#0F172A / bg-slate-900/95) with backdrop blur
 * - High-contrast cyan/sky (border-sky-500/30) and action amber (border-amber-500/30) accents
 * - Pre-staged status pills, Staged ID badge (e.g., DS-STAGE-84A19F), and action counters
 * - Human-in-the-loop review confirmation: "Agents Stage, Humans Sign & Pay"
 */

import React, { useState } from 'react';
import { Bot, Sparkles, CheckCircle2, AlertCircle, ArrowRight, X } from 'lucide-react';

export interface AgentStagedBannerProps {
  isStaged: boolean;
  stageId?: string | null;
  stagedSource?: 'stage' | 'url_params' | null;
  preStagedFieldCount?: number;
  remainingActionCount?: number;
  isReadyForSignature?: boolean;
  isLoadingStage?: boolean;
  onDismiss?: () => void;
  onJumpToNextAction?: () => void;
}

export const AgentStagedBanner: React.FC<AgentStagedBannerProps> = ({
  isStaged,
  stageId,
  stagedSource,
  preStagedFieldCount = 0,
  remainingActionCount = 1,
  isReadyForSignature = false,
  isLoadingStage = false,
  onDismiss,
  onJumpToNextAction,
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

  const statusPillText = isReadyForSignature || remainingActionCount === 0
    ? 'All details pre-staged • Ready for signature'
    : `${preStagedFieldCount} field${preStagedFieldCount === 1 ? '' : 's'} pre-staged by AI agent • ${remainingActionCount} action${remainingActionCount === 1 ? '' : 's'} remaining`;

  return (
    <div
      role="region"
      aria-label="Agent Pre-Staged Docket Notice"
      className={`relative w-full rounded-lg border transition-all duration-200 overflow-hidden shadow-xl ${
        isReadyForSignature
          ? 'bg-slate-900/95 border-amber-500/40 shadow-amber-950/20'
          : 'bg-slate-900/95 border-sky-500/30 shadow-sky-950/20'
      } backdrop-blur-md p-4 sm:p-4.5`}
    >
      {/* Top Meta Line: Badges & Dismiss */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          {/* Agent Staged Tag */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-mono text-[11px] font-semibold tracking-wider uppercase">
            <Bot className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>AI AGENT PRE-STAGED</span>
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
          aria-label="Dismiss pre-staged notice banner"
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
              DOCKET PRE-STAGED:
            </span>
            <span>Review highlighted fields, adopt your signature, and dispatch via USPS.</span>
          </p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            {isLoadingStage ? (
              <span className="inline-flex items-center gap-2 text-sky-300 animate-pulse font-mono">
                Hydrating staged draft parameters from server...
              </span>
            ) : (
              'Instrument parameters were staged deterministically by your agent. Verify highlighted items on the 8.5×11 live paper sheet before signing and dispatching.'
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
            <span>{isReadyForSignature ? 'Adopt Signature' : 'Next Action'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
