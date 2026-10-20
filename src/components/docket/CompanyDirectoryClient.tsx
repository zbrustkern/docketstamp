'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  Building2,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  Shield,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { VERIFIED_RECIPIENTS } from '@/lib/docket/data/verified-recipients';
import {
  COMPANY_DIRECTORY_CATEGORIES,
  CompanyDirectoryCategoryId,
  resolveRecipientCompatibility,
  buildChooserWorkspaceUrl,
  HARDWARE_OEM_PURPOSE_OPTIONS,
  FITNESS_BLOCKER_NOTICE,
} from '@/lib/docket/chooser-routing';
import { isFitnessEntity, STATUTORY_COMPLIANCE_DISCLOSURE } from '@/lib/docket/guardrails';
import { VerifiedRecipientEntry } from '@/lib/docket/types';

export function CompanyDirectoryClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<CompanyDirectoryCategoryId>('all');

  // Check fitness blocker on search query
  const isFitnessBlocked = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return false;
    return isFitnessEntity(trimmed);
  }, [searchQuery]);

  // Filter recipients
  const filteredRecipients = useMemo(() => {
    if (isFitnessBlocked) return [];

    let list = VERIFIED_RECIPIENTS;

    // Filter by category
    if (selectedCategory !== 'all') {
      list = list.filter((r) => r.category === selectedCategory);
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        if (r.brandName.toLowerCase().includes(q)) return true;
        if (r.formalRecipientLine.toLowerCase().includes(q)) return true;
        if (r.city.toLowerCase().includes(q)) return true;
        if (r.state.toLowerCase().includes(q)) return true;
        if (r.zip.toLowerCase().includes(q)) return true;
        if (r.category.toLowerCase().replace('_', ' ').includes(q)) return true;
        return false;
      });
    }

    return list;
  }, [searchQuery, selectedCategory, isFitnessBlocked]);

  const handleReset = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Header / Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition"
          >
            <ChevronLeft className="w-4 h-4 text-sky-400" />
            <span>Back to DocketStamp</span>
          </Link>
          <div className="text-xs text-slate-400">
            Recipient Directory
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        {/* Title & Introduction */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-950/70 border border-sky-800 text-sky-400 mb-3">
            <Building2 className="w-3.5 h-3.5" />
            <span>Institutional Recipient Directory</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-serif font-bold text-white tracking-tight">
            Corporate and Institutional Mailing Contacts
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed">
            Browse a directory of organizations and their listed mailing addresses.
            Confirm the recipient and address before use; directory entries are not
            USPS verification or confirmation that a notice meets a legal procedure.
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="mt-8 space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-xl">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by company name, category, or city..."
              aria-label="Search corporate recipients"
              className="w-full bg-slate-900 text-slate-100 placeholder-slate-400 text-sm pl-10 pr-9 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded cursor-pointer"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-1" role="tablist" aria-label="Recipient categories">
            {COMPANY_DIRECTORY_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-sky-600 border-sky-500 text-white font-semibold'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? 'bg-sky-700 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* NAICS 713940 Fitness Blocker Alert */}
        {isFitnessBlocked && (
          <div
            role="alert"
            className="mt-8 p-5 bg-red-950/40 border border-red-700/60 rounded-xl text-red-200 max-w-2xl"
            data-testid="fitness-blocker-directory"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white text-sm">
                  Fitness Entity Category Excluded
                </p>
                <p className="text-xs sm:text-sm text-red-200 mt-1 leading-relaxed">
                  {FITNESS_BLOCKER_NOTICE}
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset search and view supported companies
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Zero Results State */}
        {!isFitnessBlocked && filteredRecipients.length === 0 && (
          <div className="mt-10 p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl max-w-xl mx-auto">
            <Building2 className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-white">
              No corporate recipients found
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              No pre-addressed corporate legal recipients matched “{searchQuery}”.
              Any custom corporate or recipient address can be entered manually
              on the letter preparation workspace.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset filters and view all 38 recipients
            </button>
          </div>
        )}

        {/* Recipients Grid */}
        {!isFitnessBlocked && filteredRecipients.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRecipients.map((recipient) => {
              const compat = resolveRecipientCompatibility(recipient);
              const isHardware = recipient.category === 'tech_hardware_legal';

              return (
                <div
                  key={recipient.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition shadow-sm"
                  data-testid={`company-card-${recipient.id}`}
                >
                  <div>
                    {/* Header: Brand + Honest Badge */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h2 className="text-lg font-bold text-white">
                          {recipient.brandName}
                        </h2>
                        <p className="text-xs font-medium text-slate-400">
                          {recipient.formalRecipientLine}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full shrink-0">
                        Pre-addressed corporate recipient
                      </span>
                    </div>

                    {/* Postal Address Block */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 my-3 text-xs text-slate-300 font-mono">
                      <div>{recipient.addressLine1}</div>
                      {recipient.addressLine2 && <div>{recipient.addressLine2}</div>}
                      <div>
                        {recipient.city}, {recipient.state} {recipient.zip}
                      </div>
                    </div>

                    {recipient.requiredIdentifiersHint && (
                      <p className="text-[11px] text-slate-400 mt-1 mb-3">
                        <span className="font-semibold text-slate-400">
                          Required on notice:{' '}
                        </span>
                        {recipient.requiredIdentifiersHint}
                      </p>
                    )}
                  </div>

                  {/* Action Section */}
                  <div className="pt-3 border-t border-slate-800/80 mt-2">
                    {/* Ambiguous Tech Hardware OEM (Sonos, Withings, etc.) */}
                    {isHardware ? (
                      <div>
                        <div className="text-xs font-semibold text-amber-300 mb-2">
                          Choose a letter for {recipient.brandName}:
                        </div>
                        <div className="space-y-1.5">
                          {HARDWARE_OEM_PURPOSE_OPTIONS.map((purpose) => {
                            const url = buildChooserWorkspaceUrl(
                              purpose.slug,
                              recipient.id
                            );
                            return (
                              <Link
                                key={purpose.slug}
                                href={url}
                                className="w-full inline-flex items-center justify-between text-xs font-medium text-slate-200 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/60 px-3 py-2 rounded-lg transition group"
                              >
                                <span>{purpose.label}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-sky-400 group-hover:translate-x-0.5 transition" />
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* Single Purpose Companies (Credit Bureaus, Debt Collectors, Cancellations) */
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {recipient.category === 'credit_bureau'
                            ? 'Credit file dispute'
                            : recipient.category === 'debt_collector'
                            ? 'Debt information request'
                            : 'Service cancellation request'}
                        </span>
                        <Link
                          href={buildChooserWorkspaceUrl(
                            compat.suggestedSlug || 'service-cancellation-request',
                            recipient.id
                          )}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm"
                        >
                          <span>Prepare letter</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Mandatory Statutory & UPL Compliance Disclosure Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/90 py-8 px-4 sm:px-6 mt-12">
        <div className="max-w-6xl mx-auto text-center space-y-3">
          <p className="text-xs text-slate-400 max-w-4xl mx-auto leading-relaxed">
            {STATUTORY_COMPLIANCE_DISCLOSURE}
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
            <Link href="/" className="hover:text-slate-200 transition">
              Home
            </Link>
            <span>•</span>
            <Link href="/companies" className="hover:text-slate-200 transition font-medium text-slate-300">
              Corporate Directory
            </Link>
            <span>•</span>
            <a href="/terms" className="hover:text-slate-200 transition">
              Terms of Service
            </a>
            <span>•</span>
            <a href="/privacy" className="hover:text-slate-200 transition">
              Privacy Policy
            </a>
          </div>
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} DocketStamp. USPS mailing and document preparation utility.
          </p>
        </div>
      </footer>
    </div>
  );
}
