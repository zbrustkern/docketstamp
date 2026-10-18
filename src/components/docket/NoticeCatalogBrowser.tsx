'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building,
  CheckCircle2,
  FileText,
  Search,
  ShieldCheck,
  Tag,
  Scale,
  Sparkles,
  MapPin,
  ChevronRight,
  Clock,
  Layers,
  X,
} from 'lucide-react';
import { NoticeTemplateDefinition, VerifiedRecipientEntry } from '@/src/lib/docket/types';
import { ALL_NOTICE_CARTRIDGES, DOCKET_PRICING_TIERS } from '@/src/lib/docket/notices';
import { VERIFIED_RECIPIENTS } from '@/src/lib/docket/data/verified-recipients';

interface NoticeCatalogBrowserProps {
  notices?: NoticeTemplateDefinition[];
  recipients?: VerifiedRecipientEntry[];
}

type NoticeCategoryFilter = 'all' | 'tenant' | 'credit_debt' | 'cancellation' | 'consumer_rights';

const NOTICE_CATEGORY_TABS: { id: NoticeCategoryFilter; label: string; count: number }[] = [
  { id: 'all', label: 'All (9)', count: 9 },
  { id: 'tenant', label: 'Tenant & Housing (3)', count: 3 },
  { id: 'credit_debt', label: 'Credit & Debt (2)', count: 2 },
  { id: 'cancellation', label: 'Contract & Policy Cancellation (1)', count: 1 },
  { id: 'consumer_rights', label: 'Consumer Tech & Privacy (3)', count: 3 },
];

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  tenant: 'Tenant & Housing',
  credit_debt: 'Credit & Debt',
  cancellation: 'Contract & Policy Cancellation',
  consumer_rights: 'Consumer Tech & Privacy',
};

const NOTICE_NUMBER_MAP: Record<string, string> = {
  'intent-to-vacate-notice': '#01',
  'security-deposit-return-demand-letter': '#02',
  'tenant-repair-and-maintenance-demand': '#03',
  'fcra-credit-bureau-written-dispute-letter': '#04',
  'fdcpa-30-day-debt-validation-letter': '#05',
  'written-contract-and-policy-cancellation-letter': '#06',
  'pre-arbitration-notice-of-dispute-and-refund-request': '#07',
  'arbitration-opt-out-election-notice': '#08',
  'biometric-and-personal-data-erasure-demand': '#09',
};

type RecipientCategoryFilter =
  | 'all'
  | 'credit_bureau'
  | 'debt_collector'
  | 'home_service'
  | 'telecom_insurance'
  | 'tech_hardware_legal';

const RECIPIENT_CATEGORY_SECTIONS: {
  id: VerifiedRecipientEntry['category'];
  title: string;
  badge: string;
  description: string;
}[] = [
  {
    id: 'credit_bureau',
    title: 'Credit Reporting Bureaus (FCRA § 611)',
    badge: 'FCRA 15 U.S.C. § 1681i',
    description: 'Statutory 30-day reinvestigation demands to national credit bureaus for inaccurate tradelines and file errors.',
  },
  {
    id: 'debt_collector',
    title: 'Debt Collectors & Debt Buyers (FDCPA § 1692g)',
    badge: 'FDCPA 15 U.S.C. § 1692g',
    description: 'Mandatory 30-day debt validation demands requiring chain of assignment and verification of alleged balances.',
  },
  {
    id: 'home_service',
    title: 'Home Security, Pest & Home Warranty Cancellations',
    badge: 'Statutory Cancellation',
    description: 'Irrevocable written cancellation notices, contract terminations, and automatic renewal revocations.',
  },
  {
    id: 'telecom_insurance',
    title: 'Telecom, Satellite & Insurance Policy Cancellations',
    badge: 'Policy Surrender',
    description: 'Formal policy cancellation demands, equipment returns, and revocation of recurring payment authorizations.',
  },
  {
    id: 'tech_hardware_legal',
    title: 'Consumer Tech & Hardware Legal / General Counsel (Pre-Arbitration, Opt-Out & Privacy)',
    badge: 'FAA & CCPA Compliant',
    description: 'Formal pre-arbitration dispute demands, arbitration opt-out notices, and CCPA biometric data erasure demands.',
  },
];

const FEATURED_BRANDS = [
  'Equifax',
  'Experian',
  'TransUnion',
  'Portfolio Recovery',
  'ADT',
  'Vivint',
  'Comcast',
  'Withings',
  'Samsung',
  'LG',
  'Sonos',
  'Tesla',
];

export function NoticeCatalogBrowser({
  notices = ALL_NOTICE_CARTRIDGES,
  recipients = VERIFIED_RECIPIENTS,
}: NoticeCatalogBrowserProps = {}) {
  // Notice Filter State
  const [selectedNoticeCategory, setSelectedNoticeCategory] = useState<NoticeCategoryFilter>('all');
  const [noticeQuery, setNoticeQuery] = useState('');

  // Recipient Directory Filter State
  const [selectedRecipientCategory, setSelectedRecipientCategory] = useState<RecipientCategoryFilter>('all');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [activeBrandFilter, setActiveBrandFilter] = useState<string | null>(null);

  // Helper to dispatch notice selection event to InteractiveHomeWorkbench and scroll up
  const handlePreviewNotice = (slug: string, recipientId?: string) => {
    if (typeof window !== 'undefined') {
      const detail: { slug: string; recipientId?: string } = { slug };
      if (recipientId) detail.recipientId = recipientId;
      window.dispatchEvent(new CustomEvent('docketstamp:select-notice', { detail }));
      document.getElementById('workbench')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Helper to resolve the best notice cartridge slug for a verified recipient
  const getNoticeSlugForRecipient = (r: VerifiedRecipientEntry): string => {
    if (r.category === 'credit_bureau') {
      return 'fcra-credit-bureau-written-dispute-letter';
    }
    if (r.category === 'debt_collector') {
      return 'fdcpa-30-day-debt-validation-letter';
    }
    if (r.category === 'tech_hardware_legal') {
      return 'pre-arbitration-notice-of-dispute-and-refund-request';
    }
    return 'written-contract-and-policy-cancellation-letter';
  };

  // Filter notices
  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      if (selectedNoticeCategory !== 'all' && n.category !== selectedNoticeCategory) {
        return false;
      }
      if (!noticeQuery.trim()) return true;
      const q = noticeQuery.trim().toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.shortDescription.toLowerCase().includes(q) ||
        n.slug.toLowerCase().includes(q) ||
        n.fields.some(
          (f) =>
            f.docusignTagLabel.toLowerCase().includes(q) ||
            f.label.toLowerCase().includes(q)
        )
      );
    });
  }, [notices, selectedNoticeCategory, noticeQuery]);

  // Filter recipients
  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
      if (selectedRecipientCategory !== 'all' && r.category !== selectedRecipientCategory) {
        return false;
      }
      if (activeBrandFilter) {
        if (!r.brandName.toLowerCase().includes(activeBrandFilter.toLowerCase())) {
          return false;
        }
      }
      if (!recipientQuery.trim()) return true;
      const q = recipientQuery.trim().toLowerCase();
      return (
        r.brandName.toLowerCase().includes(q) ||
        r.formalRecipientLine.toLowerCase().includes(q) ||
        r.addressLine1.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.state.toLowerCase().includes(q) ||
        r.zip.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [recipients, selectedRecipientCategory, activeBrandFilter, recipientQuery]);

  return (
    <div className="space-y-16">
      {/* =========================================================================
          PART A: COMPLETE 9-INSTRUMENT STATUTORY MATRIX
         ========================================================================= */}
      <div className="space-y-6">
        {/* Controls: Category Filter Tabs & Fast Search Input */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 w-full lg:w-auto">
            {NOTICE_CATEGORY_TABS.map((tab) => {
              const isActive = selectedNoticeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedNoticeCategory(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Notice Fast Keyword Filter */}
          <div className="relative w-full lg:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={noticeQuery}
              onChange={(e) => setNoticeQuery(e.target.value)}
              placeholder="Filter 9 cartridges..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
            {noticeQuery && (
              <button
                type="button"
                onClick={() => setNoticeQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Notice Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotices.map((notice) => {
            const tierMeta = DOCKET_PRICING_TIERS[notice.recommendedTier];
            const noticeNum = NOTICE_NUMBER_MAP[notice.slug] || '#01';

            return (
              <div
                key={notice.id}
                className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 hover:border-sky-500/60 hover:bg-slate-800/90 transition flex flex-col justify-between space-y-4 shadow-lg group text-left"
              >
                <div className="space-y-3.5">
                  {/* Top Row: Category Badge + Notice Number + Field Count + State Statute Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-sky-950 text-sky-400 border border-sky-800/80">
                        {CATEGORY_DISPLAY_NAMES[notice.category] || notice.category}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {noticeNum}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400">
                        {notice.fields.length} Fields &bull; ~60s
                      </span>
                      {notice.usesStateStatuteLookup && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                          50-State + DC Auto-Citation
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-serif text-lg font-bold text-white text-balance group-hover:text-sky-300 transition leading-snug">
                      {notice.title}
                    </h3>
                    <p className="mt-1.5 font-sans text-xs text-slate-300 text-pretty leading-relaxed line-clamp-3">
                      {notice.shortDescription}
                    </p>
                  </div>

                  {/* Sample Variable Pills Preview */}
                  <div className="pt-2 border-t border-slate-700/60">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                      Highlighted Template Variables:
                    </span>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {notice.fields.slice(0, 3).map((field) => (
                        <span
                          key={field.key}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/25"
                        >
                          [ {field.docusignTagLabel} ]
                        </span>
                      ))}
                      {notice.fields.length > 3 && (
                        <span className="text-[10px] font-mono text-slate-500">
                          +{notice.fields.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Conversion Footer */}
                <div className="pt-3.5 border-t border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[11px] font-mono">
                    <span className="text-slate-400">Recommended: </span>
                    <span className="text-white font-semibold">
                      {tierMeta?.name || 'USPS Certified Mail®'}
                    </span>
                    <span className="text-sky-400 font-bold ml-1.5">
                      ({tierMeta?.formattedPrice || '$19.95'})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePreviewNotice(notice.slug)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono font-semibold border border-slate-700 transition"
                      title="Load in Interactive Workbench above"
                    >
                      Preview ↑
                    </button>
                    <Link
                      href={`/notices/${notice.slug}`}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-sans font-bold transition flex items-center gap-1 shadow-sm"
                    >
                      <span>Draft &amp; Stamp</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredNotices.length === 0 && (
          <div className="py-12 text-center space-y-2 bg-slate-900/60 rounded-2xl border border-slate-800">
            <p className="text-xs font-mono text-slate-400">No notices match your filter.</p>
            <button
              onClick={() => {
                setSelectedNoticeCategory('all');
                setNoticeQuery('');
              }}
              className="text-xs font-mono text-sky-400 hover:underline"
            >
              Reset notice filter
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          PART B: ALL 38 CASS-VERIFIED CORPORATE LEGAL & DISPUTE ROUTING DIRECTORY
         ========================================================================= */}
      <div id="verified-directory" className="pt-12 border-t border-slate-800 space-y-8 scroll-mt-20">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-xs font-mono font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>USPS CASS™ STANDARDIZED &amp; DPV CONFIRMED &bull; ALL 38 RECIPIENTS</span>
          </div>
          <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white">
            1-Click Pre-Verified Corporate Legal &amp; Dispute Routing Directory
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-pretty">
            DocketStamp maintains <strong>38 pre-verified corporate legal, dispute, and cancellation addresses</strong> with
            verified USPS CASS delivery point barcodes. Instant 1-click routing for credit bureaus, debt purchasers, insurers,
            home services, and consumer tech OEMs.
          </p>
        </div>

        {/* Popular Brand Quick Jump Chips */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-4xl mx-auto pt-1">
          <span className="text-[11px] font-mono text-slate-400 mr-1.5 font-bold">Quick Jump:</span>
          {FEATURED_BRANDS.map((brand) => {
            const isChipActive = activeBrandFilter === brand;
            return (
              <button
                key={brand}
                type="button"
                onClick={() => {
                  if (isChipActive) {
                    setActiveBrandFilter(null);
                  } else {
                    setActiveBrandFilter(brand);
                    setRecipientQuery('');
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition ${
                  isChipActive
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                }`}
              >
                {brand}
              </button>
            );
          })}
          {activeBrandFilter && (
            <button
              type="button"
              onClick={() => setActiveBrandFilter(null)}
              className="text-[11px] font-mono text-amber-400 hover:underline ml-2"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Directory Controls: Search Bar */}
        <div className="max-w-xl mx-auto">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={recipientQuery}
              onChange={(e) => {
                setRecipientQuery(e.target.value);
                setActiveBrandFilter(null);
              }}
              placeholder="Search all 38 verified legal departments (e.g. Equifax, ADT, Withings, Tesla)..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition shadow-inner"
            />
            {recipientQuery && (
              <button
                type="button"
                onClick={() => setRecipientQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Grouped Category Sections displaying ALL 38 Recipients */}
        <div className="space-y-10">
          {RECIPIENT_CATEGORY_SECTIONS.map((section) => {
            const sectionRecipients = filteredRecipients.filter((r) => r.category === section.id);

            if (sectionRecipients.length === 0) return null;

            return (
              <div key={section.id} className="space-y-4">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif text-lg font-bold text-white">
                        {section.title}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-sky-400 border border-slate-700">
                        {section.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-sans">
                      {section.description}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400 shrink-0">
                    {sectionRecipients.length} {sectionRecipients.length === 1 ? 'Recipient' : 'Recipients'}
                  </span>
                </div>

                {/* Recipient Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sectionRecipients.map((recipient) => {
                    const noticeSlug = getNoticeSlugForRecipient(recipient);

                    return (
                      <div
                        key={recipient.id}
                        className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3.5 text-left shadow-sm"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-white flex items-center gap-1.5 truncate">
                              <Building className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span className="truncate">{recipient.brandName}</span>
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80 shrink-0 font-bold">
                              CASS™
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <p className="text-xs text-slate-200 font-medium truncate">
                              {recipient.formalRecipientLine}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400 truncate">
                              {recipient.addressLine1} &bull; {recipient.city}, {recipient.state} {recipient.zip}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handlePreviewNotice(noticeSlug, recipient.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono font-medium border border-slate-700 transition"
                            title="Preview in live workbench"
                          >
                            Preview ↑
                          </button>
                          <Link
                            href={`/notices/${noticeSlug}?recipientId=${recipient.id}`}
                            className="px-3 py-1.5 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-xs font-semibold font-sans transition inline-flex items-center gap-1 shadow-sm"
                          >
                            <span>Draft Notice</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredRecipients.length === 0 && (
            <div className="py-12 text-center space-y-2 bg-slate-900/60 rounded-2xl border border-slate-800">
              <p className="text-xs font-mono text-slate-400">
                No corporate recipients match &ldquo;{recipientQuery || activeBrandFilter}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRecipientQuery('');
                  setActiveBrandFilter(null);
                  setSelectedRecipientCategory('all');
                }}
                className="text-xs font-mono text-sky-400 hover:underline"
              >
                Reset directory filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
