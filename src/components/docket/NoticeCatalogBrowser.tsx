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
  ExternalLink,
} from 'lucide-react';
import { NoticeTemplateDefinition, VerifiedRecipientEntry } from '@/src/lib/docket/types';
import { ALL_NOTICE_CARTRIDGES, DOCKET_PRICING_TIERS } from '@/src/lib/docket/notices';
import { VERIFIED_RECIPIENTS } from '@/src/lib/docket/data/verified-recipients';

interface NoticeCatalogBrowserProps {
  notices?: NoticeTemplateDefinition[];
  recipients?: VerifiedRecipientEntry[];
}

type CategoryFilter = 'all' | 'tenant' | 'credit_debt' | 'cancellation' | 'consumer_rights';

const CATEGORY_TABS: { id: CategoryFilter; label: string; count: number }[] = [
  { id: 'all', label: 'All (9)', count: 9 },
  { id: 'tenant', label: 'Tenant & Housing', count: 3 },
  { id: 'credit_debt', label: 'Credit & Debt', count: 2 },
  { id: 'cancellation', label: 'Contract & Policy Cancellation', count: 1 },
  { id: 'consumer_rights', label: 'Consumer Tech & Privacy', count: 3 },
];

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  tenant: 'Tenant & Housing',
  credit_debt: 'Credit & Debt',
  cancellation: 'Contract & Policy Cancellation',
  consumer_rights: 'Consumer Tech & Privacy',
};

const FEATURED_BRANDS = [
  'Equifax',
  'Experian',
  'TransUnion',
  'ADT',
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
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [activeBrandFilter, setActiveBrandFilter] = useState<string | null>(null);

  // Filter notices by category
  const filteredNotices = useMemo(() => {
    if (selectedCategory === 'all') return notices;
    return notices.filter((n) => n.category === selectedCategory);
  }, [notices, selectedCategory]);

  // Filter recipients by search query and featured brand chips
  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
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
        r.city.toLowerCase().includes(q) ||
        r.state.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [recipients, recipientQuery, activeBrandFilter]);

  // Helper to resolve the best cartridge slug for a verified recipient
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

  return (
    <div className="space-y-12">
      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {CATEGORY_TABS.map((tab) => {
          const isActive = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition flex items-center gap-2 ${
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

      {/* Notice Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNotices.map((notice) => {
          const tierMeta = DOCKET_PRICING_TIERS[notice.recommendedTier];
          return (
            <Link
              key={notice.id}
              href={`/notices/${notice.slug}`}
              className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 hover:border-sky-500/60 hover:bg-slate-800/90 transition flex flex-col justify-between space-y-4 shadow-lg group text-left"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-sky-950 text-sky-400 border border-sky-800/80">
                    {CATEGORY_DISPLAY_NAMES[notice.category] || notice.category}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {notice.fields.length} Required Fields
                  </span>
                </div>
                <h3 className="font-serif text-lg font-bold text-white group-hover:text-sky-300 transition">
                  {notice.title}
                </h3>
                <p className="font-sans text-xs text-slate-400 leading-relaxed line-clamp-3">
                  {notice.shortDescription}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between">
                <div className="text-[11px] font-mono">
                  <span className="text-slate-400">USPS: </span>
                  <span className="text-white font-semibold">
                    {tierMeta?.name || notice.recommendedTier.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="text-sky-400 font-bold ml-1.5">
                    ({tierMeta?.formattedPrice || '$19.95'})
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 group-hover:text-sky-300 font-sans">
                  <span>Prepare</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pre-Verified Institutional Recipient Directory Preview */}
      <div className="mt-16 pt-12 border-t border-slate-800 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-xs font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>USPS CASS™ STANDARDIZED &amp; DPV CONFIRMED</span>
          </div>
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-white">
            Pre-Verified Corporate Legal &amp; Dispute Routing Directory
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
            DocketStamp maintains <strong>38 pre-verified institutional legal and dispute addresses</strong> with verified USPS CASS delivery point barcodes. Instant autocomplete for bureaus, debt purchasers, insurers, and tech OEMs.
          </p>
        </div>

        {/* Featured Brand Quick Jump Chips */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-3xl mx-auto pt-2">
          <span className="text-[11px] font-mono text-slate-400 mr-1.5">Popular:</span>
          {FEATURED_BRANDS.map((brand) => {
            const isChipActive = activeBrandFilter === brand;
            return (
              <button
                key={brand}
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
                    ? 'bg-sky-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                }`}
              >
                {brand}
              </button>
            );
          })}
          {activeBrandFilter && (
            <button
              onClick={() => setActiveBrandFilter(null)}
              className="text-[11px] font-mono text-amber-400 hover:underline ml-2"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Search Input for Recipients */}
        <div className="max-w-xl mx-auto">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={recipientQuery}
              onChange={(e) => {
                setRecipientQuery(e.target.value);
                setActiveBrandFilter(null);
              }}
              placeholder="Search 38 corporate recipients (e.g. Equifax, ADT, Withings, Tesla)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
          </div>
        </div>

        {/* Recipient Results Preview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[380px] overflow-y-auto pr-1">
          {filteredRecipients.slice(0, 9).map((recipient) => (
            <div
              key={recipient.id}
              className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3 text-left"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-sky-400" />
                    <span>{recipient.brandName}</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80">
                    CASS™
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium">
                  {recipient.formalRecipientLine}
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  {recipient.addressLine1}, {recipient.city}, {recipient.state} {recipient.zip}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  {recipient.category.replace('_', ' ')}
                </span>
                <Link
                  href={`/notices/${getNoticeSlugForRecipient(recipient)}?recipientId=${recipient.id}`}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
                >
                  <span>Select &amp; Draft</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filteredRecipients.length > 9 && (
          <p className="text-center text-[11px] font-mono text-slate-400">
            Showing 9 of {filteredRecipients.length} matching institutional recipients. Search to refine results.
          </p>
        )}
      </div>
    </div>
  );
}
