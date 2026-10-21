'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { getNoticeBySlug, ALL_NOTICE_CARTRIDGES } from '@/lib/docket/notices';
import { NoticeTemplateDefinition } from '@/lib/docket/types';
import { interpolateNotice } from '@/lib/docket/renderer/interpolate';
import { LivePaperSheet } from '@/src/components/docket/LivePaperSheet';
import { HomeLetterChooser } from '@/src/components/docket/HomeLetterChooser';
import {
  buildChooserWorkspaceUrl,
  getVerifiedRecipientById,
} from '@/lib/docket/chooser-routing';
import { trackFunnelEvent } from '@/lib/telemetry';
import { useTemplateAvailability } from '@/src/hooks/useTemplateAvailability';

export interface InteractiveHomeWorkbenchProps {
  initialSlug?: string;
}

/**
 * Isolated representative sample preview values for unselected initial state.
 * These values never enter real user drafts, never hydrate workspace, and never lock or dispatch.
 */
const SAMPLE_PREVIEW_VALUES: Record<string, string> = {
  senderFullName: 'Jordan Taylor',
  senderAddressLine1: '410 Broadway, Apt 4B',
  senderCity: 'Santa Monica',
  senderState: 'CA',
  senderZip: '90401',
  recipientFormalName: 'Oakridge Property Management LLC',
  recipientAddressLine1: '100 Wilshire Blvd, Suite 800',
  recipientCity: 'Santa Monica',
  recipientState: 'CA',
  recipientZip: '90401',
  depositAmount: '$2,450.00',
  balanceRequested: '$2,450.00',
  vacatedPremisesAddress: '1420 Ocean Ave, Apt 4B, Santa Monica, CA 90401',
  moveOutDate: 'September 30, 2026',
  propertyState: 'CA',
};

export function InteractiveHomeWorkbench(props: InteractiveHomeWorkbenchProps) {
  const availability = useTemplateAvailability();
  const availableSlugs = useMemo(() => availability.data?.templates.filter(entry => entry.available).map(entry => entry.slug) || [], [availability.data]);
  if (availability.loading || availability.error || availableSlugs.length === 0) {
    return <section id="workbench" className="mx-auto max-w-7xl px-4 py-6 text-white">
      <h1 className="text-2xl font-serif font-bold sm:text-3xl">Make it formal. We’ll print and mail it.</h1>
      <p role={availability.error ? 'alert' : 'status'} className="mt-4 text-slate-300">{availability.loading ? 'Loading available letters…' : availability.error || 'Letters are temporarily unavailable. Please check back later.'}</p>
      {!availability.loading && <button type="button" onClick={availability.refresh} className="mt-4 rounded-lg bg-sky-700 px-4 py-2">Check again</button>}
    </section>;
  }
  return <AvailableHomeWorkbench initialSlug={availableSlugs.includes(props.initialSlug || '') ? props.initialSlug : undefined} availableSlugs={availableSlugs} />;
}

function AvailableHomeWorkbench({
  initialSlug, availableSlugs,
}: InteractiveHomeWorkbenchProps & { availableSlugs: string[] }) {
  const router = useRouter();

  // Selection state received from HomeLetterChooser
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug || null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);

  // Mobile expandable preview state
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);

  // Real user values entered on home (strictly empty per §5; no personal data collected on home)
  const userValues: Record<string, string> = useMemo(() => ({}), []);

  // Track deduplicated homepage v2 landing view
  useEffect(() => {
    trackFunnelEvent({
      eventName: 'landing_view',
      step: 1,
      experienceVersion: 'home_v2',
      entrySource: 'home_chooser',
    });
  }, []);

  // Listen for selection changes from HomeLetterChooser
  const handleSelectionChange = useCallback(
    (selection: {
      slug: string | null;
      recipientId: string | null;
      isComplete: boolean;
    }) => {
      setSelectedSlug(selection.slug);
      setSelectedRecipientId(selection.recipientId);
    },
    []
  );

  // Default notice cartridge for unselected example preview (guaranteed non-null)
  const defaultNotice: NoticeTemplateDefinition = useMemo(
    () =>
      ALL_NOTICE_CARTRIDGES.find(
        (n) => n.slug === 'security-deposit-return-demand-letter'
        && availableSlugs.includes(n.slug)
      ) || ALL_NOTICE_CARTRIDGES.find(n => availableSlugs.includes(n.slug))!,
    [availableSlugs]
  );

  // Active notice cartridge for preview rendering
  const activeNotice: NoticeTemplateDefinition = useMemo(() => {
    if (selectedSlug) {
      return getNoticeBySlug(selectedSlug) || defaultNotice;
    }
    return defaultNotice;
  }, [selectedSlug, defaultNotice]);

  // Selected verified recipient entry (if user chose a pre-addressed company)
  const selectedRecipient = useMemo(() => {
    if (selectedRecipientId) {
      return getVerifiedRecipientById(selectedRecipientId) || null;
    }
    return null;
  }, [selectedRecipientId]);

  /**
   * Separate effectivePreviewValues used strictly for document preview rendering.
   * - Unselected state: renders isolated sample values with "Example letter — preview only" badge.
   * - Selected state: renders blank personal fields ([ REQUIRED: YOUR FULL NAME ]) and populated recipient details.
   */
  const effectivePreviewValues = useMemo(() => {
    if (!selectedSlug) {
      return activeNotice.slug === 'security-deposit-return-demand-letter' ? SAMPLE_PREVIEW_VALUES : {};
    }

    const values: Record<string, string> = {};
    if (selectedRecipient) {
      values.recipientFormalName =
        selectedRecipient.formalRecipientLine ||
        selectedRecipient.name ||
        selectedRecipient.brandName;
      values.recipientAddressLine1 = selectedRecipient.addressLine1;
      values.recipientAddressLine2 = selectedRecipient.addressLine2 || '';
      values.recipientCity = selectedRecipient.city;
      values.recipientState = selectedRecipient.state;
      values.recipientZip = selectedRecipient.zip;
      values.bureauEntityId = selectedRecipient.id;
    }
    return values;
  }, [selectedSlug, selectedRecipient, activeNotice.slug]);

  // Interpolated AST document for LivePaperSheet
  const interpolatedDoc = useMemo(() => {
    return interpolateNotice({
      notice: activeNotice,
      userValues: effectivePreviewValues,
      docketId: 'DS-2026-SPECIMEN-PREVIEW',
    });
  }, [activeNotice, effectivePreviewValues]);

  /**
   * Helper generating safe workspace URL bound strictly to real userValues.
   * Preserves contract expected by tests and external callers.
   */
  const buildHydrationUrl = useCallback(
    (focusKey?: string) => {
      const targetSlug = selectedSlug || defaultNotice.slug;
      const baseUrl = buildChooserWorkspaceUrl(targetSlug, selectedRecipientId);
      const url = new URL(baseUrl, 'https://docketstamp.com');

      if (focusKey) {
        url.searchParams.set('focus', focusKey);
      }

      // Safe iteration strictly over real userValues (empty on homepage)
      for (const [key, val] of Object.entries(userValues)) {
        if (val && typeof val === 'string' && val.trim().length > 0 && !val.startsWith('[')) {
          url.searchParams.set(`field.${key}`, val.trim());
        }
      }

      return `${url.pathname}${url.search}`;
    },
    [selectedSlug, selectedRecipientId, userValues, defaultNotice.slug]
  );

  // Clicking an interactive highlighted blank on the preview sheet
  const handleTokenClick = useCallback(
    (fieldKey: string) => {
      setActiveFieldKey(fieldKey);
      if (selectedSlug) {
        // Navigate directly to the workspace for the selected letter, focusing the clicked field
        const targetUrl = buildHydrationUrl(fieldKey);
        router.push(targetUrl);
      } else {
        // Prompt user to select a letter first in the chooser
        const searchInput = document.getElementById('docket-chooser-search');
        if (searchInput) {
          searchInput.focus();
          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    },
    [selectedSlug, buildHydrationUrl, router]
  );

  return (
    <section id="workbench" className="py-5 sm:py-6 lg:py-7 px-4 sm:px-6 max-w-7xl mx-auto scroll-mt-16">
      {/* Baseline Hero Copy per §6 */}
      <div className="mb-4 sm:mb-5">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-white tracking-tight">
          Make it formal. We’ll print and mail it.
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
          Demand your deposit back, dispute an error, or send a cancellation notice. Prepare and review your letter, then send it by USPS. Certified Mail available.
        </p>
      </div>

      {/* Two-Column Balanced Hero: Chooser (Left) + Shared Preview (Right) */}
      <div className="lg:grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Focused Letter Chooser */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-3">
          <HomeLetterChooser
            initialSlug={initialSlug}
            availableSlugs={availableSlugs}
            onSelectionChange={handleSelectionChange}
          />

          {/* Mobile Expandable Preview Disclosure Button */}
          <div className="lg:hidden pt-1">
            <button
              type="button"
              onClick={() => setIsMobilePreviewOpen((prev) => !prev)}
              aria-expanded={isMobilePreviewOpen}
              aria-controls="mobile-letter-preview-sheet"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white flex lg:hidden items-center justify-between transition cursor-pointer shadow-sm"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <span>
                  {selectedSlug ? 'Preview selected letter' : 'Preview example letter'}
                </span>
              </span>
              <span className="text-[11px] text-sky-400 font-medium flex items-center gap-1">
                {isMobilePreviewOpen ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide preview</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview letter</span>
                  </>
                )}
              </span>
            </button>

            {/* Mobile Expanded Preview Sheet */}
            {isMobilePreviewOpen && (
              <div
                id="mobile-letter-preview-sheet"
                className="mt-3 space-y-2 animate-fadeIn"
              >
                <div className="flex items-center justify-between gap-2 bg-slate-900/95 border border-slate-800 px-3 py-2 rounded-lg text-xs">
                  {selectedSlug ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-semibold text-white">
                        Letter preview — add your details next
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      <span className="font-semibold text-white">
                        Example letter — preview only
                      </span>
                    </div>
                  )}
                  {selectedSlug && (
                    <Link
                      href={buildHydrationUrl()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded text-[11px] transition"
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                <div className="w-full flex justify-center overflow-x-auto p-2 rounded-xl bg-slate-950/80 border border-slate-800 shadow-xl max-h-[520px] overflow-y-auto">
                  <div className="w-full max-w-[850px] scale-[0.9] sm:scale-100 origin-top">
                    <LivePaperSheet
                      doc={interpolatedDoc}
                      onTokenClick={handleTokenClick}
                      activeFieldKey={activeFieldKey}
                      isSignatureAdopted={false}
                      selectedTier="certified"
                      verificationStatus="unverified"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Desktop Balanced Live Paper Preview */}
        <div
          data-testid="desktop-preview-column"
          className="hidden lg:block lg:col-span-6 xl:col-span-6 space-y-3"
        >
          {/* Preview Status Bar */}
          <div className="flex items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-xl text-xs">
            {selectedSlug ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-white">
                    Letter preview — add your details next
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-amber-300/90 text-[11px]">
                    Click highlighted fields to edit
                  </span>
                </div>
                <Link
                  href={buildHydrationUrl()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs transition cursor-pointer shadow-sm"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="font-semibold text-white">
                  Example letter — preview only
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 text-[11px]">
                  Choose a letter on the left to start your draft
                </span>
              </div>
            )}
          </div>

          {/* Desktop Live Paper Sheet Preview Container */}
          <div className="w-full flex justify-center overflow-x-auto p-3 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800 shadow-2xl max-h-[560px] overflow-y-auto">
            <div className="w-full max-w-[850px] scale-[0.88] xl:scale-[0.92] origin-top">
              <LivePaperSheet
                doc={interpolatedDoc}
                onTokenClick={handleTokenClick}
                activeFieldKey={activeFieldKey}
                isSignatureAdopted={false}
                selectedTier="certified"
                verificationStatus="unverified"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
