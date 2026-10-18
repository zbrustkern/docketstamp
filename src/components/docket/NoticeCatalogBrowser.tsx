'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building,
  CheckCircle2,
  Search,
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

const NOTICE_CATEGORY_TABS: { id: NoticeCategoryFilter; label: string }[] = [
  { id: 'all', label: 'All Notices (9)' },
  { id: 'tenant', label: 'Landlord & Tenant (3)' },
  { id: 'credit_debt', label: 'Credit & Debt (2)' },
  { id: 'cancellation', label: 'Cancel a Contract (1)' },
  { id: 'consumer_rights', label: 'Refunds & Privacy (3)' },
];

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  tenant: 'Landlord & Tenant',
  credit_debt: 'Credit & Debt',
  cancellation: 'Cancel a Contract',
  consumer_rights: 'Refunds & Privacy',
};

const RECIPIENT_CATEGORY_SECTIONS: {
  id: VerifiedRecipientEntry['category'];
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'credit_bureau',
    title: 'Credit Reporting Bureaus',
    subtitle: 'Dispute inaccurate accounts, late payments, or identity errors (FCRA § 611).',
  },
  {
    id: 'debt_collector',
    title: 'Debt Collectors & Collection Agencies',
    subtitle: 'Demand written verification of a debt and stop collection calls (FDCPA § 1692g).',
  },
  {
    id: 'home_service',
    title: 'Home Security, Pest Control & Home Warranties',
    subtitle: 'Cancel recurring monitoring or service contracts in writing and stop auto-billing.',
  },
  {
    id: 'telecom_insurance',
    title: 'Cable, Internet, Satellite & Auto Insurance',
    subtitle: 'Cancel service agreements or insurance policies with official proof of notice.',
  },
  {
    id: 'tech_hardware_legal',
    title: 'Electronics, Smart Home & Connected Devices',
    subtitle: 'Demand refunds for removed features, opt out of forced arbitration, or erase personal data.',
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
  const [selectedNoticeCategory, setSelectedNoticeCategory] = useState<NoticeCategoryFilter>('all');
  const [noticeQuery, setNoticeQuery] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [activeBrandFilter, setActiveBrandFilter] = useState<string | null>(null);

  const handlePreviewNotice = (slug: string, recipientId?: string) => {
    if (typeof window !== 'undefined') {
      const detail: { slug: string; recipientId?: string } = { slug };
      if (recipientId) detail.recipientId = recipientId;
      window.dispatchEvent(new CustomEvent('docketstamp:select-notice', { detail }));
      document.getElementById('workbench')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
        n.slug.toLowerCase().includes(q)
      );
    });
  }, [notices, selectedNoticeCategory, noticeQuery]);

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
        r.state.toLowerCase().includes(q)
      );
    });
  }, [recipients, activeBrandFilter, recipientQuery]);

  return (
    <div className="space-y-16">
      {/* =========================================================================
          PART A: ALL 9 LEGAL NOTICE TEMPLATES
         ========================================================================= */}
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center gap-1.5 w-full lg:w-auto">
            {NOTICE_CATEGORY_TABS.map((tab) => {
              const isActive = selectedNoticeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedNoticeCategory(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-sans font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/60'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={noticeQuery}
              onChange={(e) => setNoticeQuery(e.target.value)}
              placeholder="Search notices..."
              className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-sans text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
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

            return (
              <div
                key={notice.id}
                className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 hover:border-sky-500/60 hover:bg-slate-800/90 transition flex flex-col justify-between space-y-4 shadow-lg group text-left"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-sky-950 text-sky-300 border border-sky-800/80">
                      {CATEGORY_DISPLAY_NAMES[notice.category] || notice.category}
                    </span>
                    {notice.usesStateStatuteLookup ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-sans font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                        Includes All 50 States&apos; Laws
                      </span>
                    ) : (
                      <span className="text-[11px] font-sans text-slate-400">
                        Ready in ~60 seconds
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-serif text-lg font-bold text-white text-balance group-hover:text-sky-300 transition leading-snug">
                      {notice.title}
                    </h3>
                    <p className="mt-1.5 font-sans text-xs text-slate-300 text-pretty leading-relaxed">
                      {notice.shortDescription}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-700/60">
                    <span className="text-[11px] font-sans text-slate-400 font-medium block mb-1.5">
                      What you&apos;ll fill in:
                    </span>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {notice.fields.slice(0, 3).map((field) => (
                        <span
                          key={field.key}
                          className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-slate-900/90 text-slate-200 border border-slate-700"
                        >
                          {field.label}
                        </span>
                      ))}
                      {notice.fields.length > 3 && (
                        <span className="text-[11px] font-sans text-slate-400">
                          +{notice.fields.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3.5 border-t border-slate-700/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handlePreviewNotice(notice.slug)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-sans font-semibold border border-slate-700 transition cursor-pointer"
                  >
                    Preview Above &uarr;
                  </button>
                  <Link
                    href={`/notices/${notice.slug}`}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-sans font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    <span>Start Notice ({tierMeta?.formattedPrice || '$19.95'})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          PART B: PRE-ADDRESSED COMPANY LEGAL DIRECTORY (ALL 38 COMPANIES)
         ========================================================================= */}
      <div id="verified-directory" className="pt-12 border-t border-slate-800 space-y-8 scroll-mt-20">
        <div className="text-center space-y-2.5 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-sans font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>38 Pre-Addressed Corporate Legal &amp; Dispute Departments</span>
          </div>
          <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white text-balance">
            Sending to a Major Company? We Already Have Their Legal Address.
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-pretty">
            Companies often bury their official dispute and cancellation mailing addresses in fine
            print so customers give up. Click any company below to start a notice already addressed
            to their official legal or cancellations department.
          </p>
        </div>

        {/* Popular Brand Filter Chips */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-4xl mx-auto">
          <span className="text-xs font-sans text-slate-400 mr-1 font-medium">Popular companies:</span>
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
                className={`px-2.5 py-1 rounded-lg text-xs font-sans font-medium transition cursor-pointer ${
                  isChipActive
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
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
              className="text-xs font-sans text-amber-400 hover:underline ml-2 cursor-pointer"
            >
              Show All 38 Companies
            </button>
          )}
        </div>

        {/* Search Input */}
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
              placeholder="Search companies (e.g. Equifax, ADT, Comcast, State Farm, Withings, Tesla)..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm font-sans text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
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

        {/* Categorized Company Cards */}
        <div className="space-y-10">
          {RECIPIENT_CATEGORY_SECTIONS.map((section) => {
            const sectionRecipients = filteredRecipients.filter((r) => r.category === section.id);

            if (sectionRecipients.length === 0) return null;

            return (
              <div key={section.id} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div>
                    <h4 className="font-serif text-lg font-bold text-white">{section.title}</h4>
                    <p className="text-xs text-slate-400 font-sans">{section.subtitle}</p>
                  </div>
                  <span className="text-xs font-sans text-slate-400 shrink-0">
                    {sectionRecipients.length}{' '}
                    {sectionRecipients.length === 1 ? 'company' : 'companies'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sectionRecipients.map((recipient) => {
                    const noticeSlug = getNoticeSlugForRecipient(recipient);

                    return (
                      <div
                        key={recipient.id}
                        className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3 text-left"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-white flex items-center gap-1.5 truncate">
                              <Building className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span className="truncate">{recipient.brandName}</span>
                            </span>
                            <span className="text-[10px] font-sans font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80 shrink-0">
                              ✓ Verified Address
                            </span>
                          </div>

                          <p className="text-xs text-slate-200 font-medium truncate">
                            {recipient.formalRecipientLine}
                          </p>
                          <p className="text-[11px] font-sans text-slate-400 truncate">
                            {recipient.addressLine1}, {recipient.city}, {recipient.state}{' '}
                            {recipient.zip}
                          </p>
                        </div>

                        <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handlePreviewNotice(noticeSlug, recipient.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-sans font-medium border border-slate-700 transition cursor-pointer"
                          >
                            Preview Above &uarr;
                          </button>
                          <Link
                            href={`/notices/${noticeSlug}?recipientId=${recipient.id}`}
                            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold font-sans transition inline-flex items-center gap-1"
                          >
                            <span>Start Notice</span>
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
        </div>
      </div>
    </div>
  );
}
