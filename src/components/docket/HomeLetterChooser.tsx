'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Check,
  AlertCircle,
  Building2,
  FileText,
  ArrowRight,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import {
  CHOOSER_LETTERS,
  CHOOSER_PRICE_CUE,
  HARDWARE_OEM_PURPOSE_OPTIONS,
  ChooserLetterMetadata,
  CompanyPurposeOption,
  searchChooser,
  resolveRecipientCompatibility,
  buildChooserWorkspaceUrl,
  getVerifiedRecipientById,
} from '@/lib/docket/chooser-routing';
import { VerifiedRecipientEntry } from '@/lib/docket/types';
import { trackFunnelEvent } from '@/lib/telemetry';

export interface HomeLetterChooserProps {
  onSelectionChange?: (selection: {
    slug: string | null;
    recipientId: string | null;
    isComplete: boolean;
  }) => void;
  className?: string;
  initialSlug?: string | null;
  initialRecipientId?: string | null;
  availableSlugs: string[];
}

export function HomeLetterChooser({
  onSelectionChange,
  className = '',
  initialSlug = null,
  initialRecipientId = null,
  availableSlugs,
}: HomeLetterChooserProps) {
  const router = useRouter();
  const availableSlugSet = useMemo(() => new Set(availableSlugs), [availableSlugs]);

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // Selected item state (initial state: null, zero personal data)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(initialRecipientId);

  // Listen for selection events from catalog or external callers
  useEffect(() => {
    const handleSelectNoticeEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ slug?: string; recipientId?: string }>;
      if (customEvent.detail) {
        const { slug, recipientId } = customEvent.detail;
        if (slug && availableSlugSet.has(slug)) {
          setSelectedSlug(slug);
        }
        if (recipientId) {
          setSelectedRecipientId(recipientId);
        }
      }
    };
    window.addEventListener('docketstamp:select-notice', handleSelectNoticeEvent);
    return () => {
      window.removeEventListener('docketstamp:select-notice', handleSelectNoticeEvent);
    };
  }, [availableSlugSet]);

  // Sync initialSlug prop changes if provided
  useEffect(() => {
    if (initialSlug && availableSlugSet.has(initialSlug) && initialSlug !== selectedSlug) {
      setSelectedSlug(initialSlug);
    }
  }, [initialSlug, availableSlugSet]);

  useEffect(() => { if (selectedSlug && !availableSlugSet.has(selectedSlug)) setSelectedSlug(null); }, [availableSlugSet, selectedSlug]);

  // Purpose disambiguation state (for tech_hardware_legal recipients like Sonos)
  const [pendingHardwareRecipient, setPendingHardwareRecipient] =
    useState<VerifiedRecipientEntry | null>(null);

  // Polite cleared notice when an incompatible letter is chosen
  const [clearedNotice, setClearedNotice] = useState<string | null>(null);

  // Keyboard navigation focus index
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const listboxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Perform search
  const searchResult = useMemo(() => {
    const result = searchChooser(searchQuery);
    const letters = result.letters.filter(letter => availableSlugSet.has(letter.slug));
    const companies = result.companies.filter(company => resolveRecipientCompatibility(company, null).compatibleSlugs.some(slug => availableSlugSet.has(slug)));
    return { ...result, letters, companies, totalMatches: letters.length + companies.length };
  }, [searchQuery, availableSlugSet]);

  const selectedRecipient = useMemo(
    () => (selectedRecipientId ? getVerifiedRecipientById(selectedRecipientId) : null),
    [selectedRecipientId]
  );

  const selectedLetter = useMemo(
    () => CHOOSER_LETTERS.find((l) => l.slug === selectedSlug) || null,
    [selectedSlug, availableSlugSet]
  );

  // Check if current selection is complete and ready to continue
  const isComplete = useMemo(() => {
    // CRITICAL: Cannot continue if a fitness entity search is active, even if a letter was selected
    if (searchResult.isFitnessBlocked) return false;
    if (!selectedSlug || !availableSlugSet.has(selectedSlug)) return false;
    // If pending hardware recipient needs purpose selection, not complete
    if (pendingHardwareRecipient && !selectedSlug) return false;
    return true;
  }, [selectedSlug, pendingHardwareRecipient, searchResult.isFitnessBlocked, availableSlugSet]);

  // Sync selection change to parent if callback provided
  useEffect(() => {
    onSelectionChange?.({
      slug: selectedSlug,
      recipientId: selectedRecipientId,
      isComplete,
    });
  }, [selectedSlug, selectedRecipientId, isComplete, onSelectionChange]);

  // Handle letter click
  const handleSelectLetter = useCallback(
    (letter: ChooserLetterMetadata) => {
      if (!availableSlugSet.has(letter.slug)) return;
      setClearedNotice(null);

      // If a recipient was previously selected, check compatibility
      if (selectedRecipientId) {
        const compat = resolveRecipientCompatibility(selectedRecipientId, letter.slug);
        if (!compat.isCompatible) {
          // Clear the incompatible company selection and show polite notice
          setSelectedRecipientId(null);
          setPendingHardwareRecipient(null);
          setClearedNotice(compat.clearedReason || null);
        }
      } else if (pendingHardwareRecipient) {
        // Checking if chosen letter matches hardware recipient purposes
        const compat = resolveRecipientCompatibility(
          pendingHardwareRecipient,
          letter.slug
        );
        if (compat.isCompatible) {
          setSelectedRecipientId(pendingHardwareRecipient.id);
          setPendingHardwareRecipient(null);
        } else {
          setPendingHardwareRecipient(null);
        }
      }

      setSelectedSlug(letter.slug);

      trackFunnelEvent({
        eventName: 'product_select',
        step: 2,
        noticeSlug: letter.slug,
        recipientId: selectedRecipientId || undefined,
        experienceVersion: 'home_v2',
        entrySource: 'home_chooser',
      });
    },
    [selectedRecipientId, pendingHardwareRecipient, availableSlugSet]
  );

  // Handle company click
  const handleSelectCompany = useCallback(
    (company: VerifiedRecipientEntry) => {
      setClearedNotice(null);
      const compat = resolveRecipientCompatibility(company, selectedSlug);

      if (compat.status === 'multi_purpose') {
        // Hardware OEM (Sonos, Withings, etc.)
        // If current letter is already compatible with hardware, keep it
        if (selectedSlug && compat.compatibleSlugs.includes(selectedSlug)) {
          setSelectedRecipientId(company.id);
          setPendingHardwareRecipient(null);
        } else {
          // Must disambiguate purpose! NEVER silently default to refund
          setSelectedRecipientId(company.id);
          setSelectedSlug(null);
          setPendingHardwareRecipient(company);
        }
      } else if (compat.suggestedSlug && availableSlugSet.has(compat.suggestedSlug)) {
        // Single purpose (credit bureau, debt collector, service cancellation)
        setSelectedSlug(compat.suggestedSlug);
        setSelectedRecipientId(company.id);
        setPendingHardwareRecipient(null);
      }
    },
    [selectedSlug, availableSlugSet]
  );

  // Handle hardware purpose selection
  const handleSelectHardwarePurpose = useCallback(
    (purpose: CompanyPurposeOption) => {
      if (!availableSlugSet.has(purpose.slug)) return;
      setSelectedSlug(purpose.slug);
      if (pendingHardwareRecipient) {
        setSelectedRecipientId(pendingHardwareRecipient.id);
        setPendingHardwareRecipient(null);
      }
      setClearedNotice(null);
    },
    [pendingHardwareRecipient, availableSlugSet]
  );

  // Continue to workspace
  const handleContinue = useCallback(() => {
    if (searchResult.isFitnessBlocked) return;
    if (!selectedSlug || !availableSlugSet.has(selectedSlug)) return;

    trackFunnelEvent({
      eventName: 'product_select',
      step: 2,
      noticeSlug: selectedSlug,
      recipientId: selectedRecipientId || undefined,
      experienceVersion: 'home_v2',
      entrySource: 'home_chooser',
    });

    const targetUrl = buildChooserWorkspaceUrl(selectedSlug, selectedRecipientId);
    router.push(targetUrl);
  }, [selectedSlug, selectedRecipientId, searchResult.isFitnessBlocked, router, availableSlugSet]);

  // Reset search
  const handleResetSearch = useCallback(() => {
    setSearchQuery('');
    setClearedNotice(null);
    searchInputRef.current?.focus();
  }, []);

  // Compute combined list for keyboard navigation
  const combinedItems = useMemo(() => {
    const items: Array<
      | { type: 'company'; item: VerifiedRecipientEntry }
      | { type: 'letter'; item: ChooserLetterMetadata }
    > = [];

    // Companies first if query matches any
    searchResult.companies.forEach((company) => {
      items.push({ type: 'company', item: company });
    });

    // Then letters
    searchResult.letters.forEach((letter) => {
      items.push({ type: 'letter', item: letter });
    });

    return items;
  }, [searchResult]);

  // Keyboard navigation on listbox
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (combinedItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < combinedItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : combinedItems.length - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(combinedItems.length - 1);
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && focusedIndex < combinedItems.length) {
        e.preventDefault();
        const entry = combinedItems[focusedIndex];
        if (entry.type === 'company') {
          handleSelectCompany(entry.item);
        } else {
          handleSelectLetter(entry.item);
        }
      } else if (isComplete) {
        e.preventDefault();
        handleContinue();
      }
    }
  };

  // Announce text for screen readers (aria-live)
  const ariaAnnouncement = useMemo(() => {
    if (searchResult.isFitnessBlocked) {
      return searchResult.fitnessBlockerNotice || 'Notice category restricted.';
    }
    if (searchQuery.trim() && searchResult.totalMatches === 0) {
      return 'No matching letter or company found.';
    }
    if (searchQuery.trim()) {
      return `${searchResult.letters.length} letter${
        searchResult.letters.length === 1 ? '' : 's'
      } and ${searchResult.companies.length} compan${
        searchResult.companies.length === 1 ? 'y' : 'ies'
      } found.`;
    }
    return 'Showing all 9 statutory letters.';
  }, [searchResult, searchQuery]);

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 text-slate-100 shadow-xl ${className}`}
      data-testid="home-letter-chooser"
    >
      {/* Header section with exact §7.3 copy */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5 pb-3 sm:pb-3.5 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
            What do you need to send?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Choose a notice below or search for a letter or pre-addressed company.
          </p>
        </div>
        <div className="text-xs sm:text-sm font-medium text-sky-400 bg-sky-950/40 border border-sky-800/50 px-2.5 py-1 rounded-md self-start sm:self-auto">
          {CHOOSER_PRICE_CUE}
        </div>
      </div>

      {/* Search Bar with exact §7.3 label and placeholder */}
      <div className="mt-3 sm:mt-3.5">
        <label
          htmlFor="docket-chooser-search"
          className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
        >
          Find a letter or company
        </label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            id="docket-chooser-search"
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setFocusedIndex(-1);
            }}
            placeholder="Try “deposit return” or “Equifax”"
            aria-label="Find a letter or company"
            className="w-full bg-slate-950 text-slate-100 placeholder-slate-400 text-sm pl-10 pr-9 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleResetSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded focus:outline-none cursor-pointer"
              aria-label="Clear search query"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Screen reader live announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {ariaAnnouncement}
      </div>

      {/* Polite cleared recipient notice */}
      {clearedNotice && (
        <div
          role="status"
          className="mt-3 p-3 text-xs bg-amber-950/40 border border-amber-500/40 rounded-lg text-amber-200 flex items-start gap-2 animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{clearedNotice}</span>
        </div>
      )}

      {/* NAICS 713940 Fitness Blocker state */}
      {searchResult.isFitnessBlocked && (
        <div
          role="alert"
          className="mt-4 p-4 bg-red-950/40 border border-red-700/60 rounded-xl text-red-200"
          data-testid="fitness-blocker-message"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white text-sm">
                Category Not Supported
              </p>
              <p className="text-xs sm:text-sm text-red-200 mt-1 leading-relaxed">
                {searchResult.fitnessBlockerNotice}
              </p>
              <button
                type="button"
                onClick={handleResetSearch}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear search and view supported letters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Matches Found state */}
      {!searchResult.isFitnessBlocked &&
        searchQuery.trim() !== '' &&
        searchResult.totalMatches === 0 && (
          <div className="mt-5 p-6 text-center bg-slate-950/50 border border-slate-800 rounded-xl">
            <p className="text-sm font-semibold text-slate-200">
              No matching letter or company found.
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Any custom corporate or recipient address can be entered manually
              on the next step once you choose your letter type.
            </p>
            <button
              type="button"
              onClick={handleResetSearch}
              className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Browse available letters
            </button>
          </div>
        )}

      {/* Inline Hardware Purpose Picker (Sonos, Withings, etc.) */}
      {pendingHardwareRecipient && (
        <div
          role="region"
          aria-labelledby="purpose-picker-heading"
          className="mt-4 p-4 bg-amber-950/30 border border-amber-500/50 rounded-xl"
          data-testid="hardware-purpose-picker"
        >
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
            <h3
              id="purpose-picker-heading"
              className="text-sm font-semibold text-amber-200"
            >
              What would you like to send to {pendingHardwareRecipient.brandName}?
            </h3>
          </div>
          <p className="text-xs text-amber-300/80 mb-3">
            Corporate legal notice address: {pendingHardwareRecipient.formalRecipientLine},{' '}
            {pendingHardwareRecipient.city}, {pendingHardwareRecipient.state}. Choose your notice purpose:
          </p>
          <div className="space-y-2">
            {HARDWARE_OEM_PURPOSE_OPTIONS.filter(purpose => availableSlugSet.has(purpose.slug)).map((purpose) => (
              <button
                key={purpose.slug}
                type="button"
                onClick={() => handleSelectHardwarePurpose(purpose)}
                className={`w-full text-left p-3 rounded-lg border text-xs sm:text-sm transition cursor-pointer flex items-start justify-between gap-3 ${
                  selectedSlug === purpose.slug
                    ? 'bg-sky-950/80 border-sky-400 text-white ring-1 ring-sky-400'
                    : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:border-amber-400/70 hover:bg-slate-800/80'
                }`}
              >
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    {purpose.label}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {purpose.description}
                  </div>
                </div>
                {selectedSlug === purpose.slug && (
                  <Check className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Accessible Unified Chooser List */}
      {!searchResult.isFitnessBlocked && searchResult.totalMatches > 0 && (
        <div
          ref={listboxRef}
          role="listbox"
          tabIndex={0}
          aria-label="Letters and pre-addressed companies"
          aria-activedescendant={focusedIndex >= 0 ? `chooser-option-${focusedIndex}` : undefined}
          onKeyDown={handleKeyDown}
          style={{ maxHeight: '220px' }}
          className="mt-3 max-h-[220px] sm:max-h-[240px] overflow-y-auto space-y-2 pr-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 rounded-lg"
        >
          {/* Matching Companies Section (when user searches a company) */}
          {searchResult.companies.length > 0 && (
            <div className="space-y-2 mb-3">
              <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider px-1">
                Pre-addressed Corporate Recipients ({searchResult.companies.length})
              </div>
              {searchResult.companies.map((company, idx) => {
                const isSelected = selectedRecipientId === company.id;
                const isItemFocused = focusedIndex === idx;

                return (
                  <div
                    key={company.id}
                    id={`chooser-option-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectCompany(company)}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-sky-950/70 border-sky-500 text-white ring-1 ring-sky-500'
                        : isItemFocused
                        ? 'bg-slate-800 border-slate-600 text-white ring-1 ring-slate-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 p-1.5 rounded-md bg-slate-800/80 text-sky-400 shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-white flex items-center gap-2">
                          {company.brandName}
                          <span className="text-[10px] font-medium bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                            {company.category === 'credit_bureau'
                              ? 'Credit Bureau'
                              : company.category === 'debt_collector'
                              ? 'Debt Collector'
                              : company.category === 'tech_hardware_legal'
                              ? 'Connected Hardware OEM'
                              : 'Corporate Recipient'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {company.formalRecipientLine} • {company.city}, {company.state}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* All 9 Letters Section */}
          <div className="space-y-2">
            {searchResult.companies.length > 0 && (
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 pt-1">
                Letters ({searchResult.letters.length})
              </div>
            )}
            {searchResult.letters.map((letter, idx) => {
              const adjustedIndex = searchResult.companies.length + idx;
              const isSelected = selectedSlug === letter.slug;
              const isItemFocused = focusedIndex === adjustedIndex;

              return (
                <div
                  key={letter.slug}
                  id={`chooser-option-${adjustedIndex}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectLetter(letter)}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-sky-950/70 border-sky-500 text-white ring-1 ring-sky-500'
                      : isItemFocused
                      ? 'bg-slate-800 border-slate-600 text-white ring-1 ring-slate-500'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 p-1.5 rounded-md bg-slate-800/80 text-sky-400 shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white">
                        {letter.displayTitle}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {letter.subtitle}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Summary and Primary Action Bar */}
      <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="text-xs">
          {selectedLetter ? (
            <div>
              <span className="text-slate-400">Selected letter: </span>
              <strong className="text-white font-semibold">
                {selectedLetter.displayTitle}
              </strong>
              {selectedRecipient && (
                <div className="text-[11px] text-sky-400 mt-0.5 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  Pre-addressed to {selectedRecipient.brandName} (
                  {selectedRecipient.city}, {selectedRecipient.state})
                </div>
              )}
            </div>
          ) : pendingHardwareRecipient ? (
            <div className="text-amber-300 font-medium">
              Please choose a purpose for {pendingHardwareRecipient.brandName} above.
            </div>
          ) : (
            <span className="text-slate-400">
              Select a letter or company above to continue.
            </span>
          )}
          <p className="text-[11px] text-slate-400 mt-0.5">
            You’ll review your letter before paying.
          </p>
        </div>

        <form
          {...({
            toolname: 'stage_homepage_notice',
            tooldescription:
              'Launch pre-populated statutory notice workspace on DocketStamp',
          } as any)}
          onSubmit={(e) => {
            e.preventDefault();
            if (isComplete) {
              handleContinue();
            }
          }}
          className="shrink-0"
        >
          <button
            type="submit"
            disabled={!isComplete}
            aria-disabled={!isComplete}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md ${
              isComplete
                ? 'bg-sky-600 hover:bg-sky-500 text-white focus:ring-2 focus:ring-sky-400'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
            }`}
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Dedicated /companies directory utility link */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-800/40 text-center">
        <Link
          href="/companies"
          className="text-xs text-slate-400 hover:text-sky-400 transition inline-flex items-center gap-1"
        >
          <span>Looking for a company address? Browse all 38 pre-addressed recipients in our company directory</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
