import React from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, MailCheck, ShieldCheck } from 'lucide-react';
import { STATUTORY_COMPLIANCE_DISCLOSURE } from '@/src/lib/docket/guardrails';
import { HeaderDocketLookup } from '@/src/components/docket/HeaderDocketLookup';
import { InteractiveHomeWorkbench } from '@/src/components/docket/InteractiveHomeWorkbench';
import { NoticeCatalogBrowser } from '@/src/components/docket/NoticeCatalogBrowser';

export const metadata = {
  title: 'DocketStamp | Send Formal Legal Notices via USPS Certified Mail® in 60 Seconds',
  description:
    'Fill in the blanks on state-specific legal notices for security deposits, credit disputes, debt collectors, and contract cancellations. Printed and mailed via official USPS Certified Mail®.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* 1. Sticky Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-mono font-bold text-sm shadow-md shadow-sky-900/40">
              DS
            </div>
            <div>
              <span className="font-mono text-sm font-bold tracking-wider text-white">
                DOCKETSTAMP<span className="text-sky-400">™</span>
              </span>
              <span className="hidden sm:inline-block ml-2.5 px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-slate-800 text-slate-300 border border-slate-700">
                USPS Certified Mail® Service
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-sans font-medium text-slate-300">
            <a href="#workbench" className="hover:text-sky-400 transition">
              Build Your Letter
            </a>
            <a href="#how-it-works" className="hover:text-sky-400 transition">
              How It Works &amp; Pricing
            </a>
            <a href="#notice-catalog" className="hover:text-sky-400 transition">
              All 9 Legal Notices
            </a>
            <a href="#verified-directory" className="hover:text-sky-400 transition">
              38 Pre-Addressed Companies
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <HeaderDocketLookup />
          </div>
        </div>
      </header>

      {/* 2. Above the Fold: Live Interactive Letter Builder & Preview */}
      <main>
        <InteractiveHomeWorkbench />
      </main>

      {/* 3. How It Works & Transparent USPS Pricing Strip */}
      <section
        id="how-it-works"
        className="border-b border-slate-800 bg-slate-950 py-10 px-4 sm:px-6 scroll-mt-16"
      >
        <div className="max-w-7xl mx-auto space-y-8">
          {/* 3 Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h2 className="font-sans text-sm font-bold text-white">
                  1. Fill in the Blanks in 60 Seconds
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your state&apos;s security deposit laws, federal credit &amp; debt statutes, and
                  corporate legal addresses are already built into the template.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                <MailCheck className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h2 className="font-sans text-sm font-bold text-white">
                  2. We Print, Stamp &amp; Mail via Official USPS
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No printer, envelopes, or Post Office lines. We print your signed letter on crisp
                  8.5&quot; &times; 11&quot; paper and induct it directly into the U.S. Mail stream.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h2 className="font-sans text-sm font-bold text-white">
                  3. Get Instant PDF Proof &amp; USPS Tracking
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Download your timestamped PDF copy immediately, track every USPS scan online, and
                  keep court-ready proof that your notice was delivered.
                </p>
              </div>
            </div>
          </div>

          {/* 3 Flat-Rate USPS Options */}
          <div className="pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="font-sans font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>USPS First-Class Mail</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Physical printing, envelope, postage, barcode tracking &amp; PDF copy
                </p>
              </div>
              <span className="font-mono text-base font-bold text-white shrink-0">$12.95</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-sky-500/70 flex items-center justify-between gap-3 shadow-md shadow-sky-950/40">
              <div className="space-y-1">
                <div className="font-sans font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-400" />
                  <span>USPS Certified Mail®</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-400 text-slate-950 font-bold">
                    Most Popular
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Official USPS Certified green banner, tracking number &amp; mailing proof
                </p>
              </div>
              <span className="font-mono text-base font-bold text-sky-400 shrink-0">$19.95</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="font-sans font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Certified Mail® + Return Receipt</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Includes official Electronic Return Receipt with recipient signature PDF
                </p>
              </div>
              <span className="font-mono text-base font-bold text-white shrink-0">$27.95</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. All 9 Legal Notices & 38 Pre-Addressed Companies */}
      <section
        id="notice-catalog"
        className="py-12 px-4 sm:px-6 max-w-7xl mx-auto space-y-8 flex-1 scroll-mt-16"
      >
        <div className="text-center space-y-2 max-w-3xl mx-auto">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
            What Do You Need to Send?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-pretty">
            Choose any legal notice below to start filling in the blanks, or preview it in the live
            editor above.
          </p>
        </div>

        <NoticeCatalogBrowser />
      </section>

      {/* 5. Footer & Mandatory Statutory UPL Compliance Disclosure */}
      <footer className="border-t border-slate-800 bg-slate-950 py-10 px-4 sm:px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-sky-600 flex items-center justify-center text-white font-mono font-bold text-[10px]">
                  DS
                </div>
                <span className="font-mono font-bold text-slate-200 tracking-wider">
                  DOCKETSTAMP<span className="text-sky-400">™</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Automated Legal Notice Preparation &amp; USPS Certified Mail® Dispatch Service
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-sans">
              <Link href="/privacy" className="hover:text-slate-200 transition">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-slate-200 transition">
                Terms of Service
              </Link>
              <Link href="/disclaimer" className="hover:text-slate-200 transition">
                Legal Disclaimer
              </Link>
              <Link href="/return-policy" className="hover:text-slate-200 transition">
                Refund Policy
              </Link>
              <Link
                href="/docket/DS-2026-88419-X"
                className="text-sky-400 hover:text-sky-300 transition"
              >
                Sample Tracking Record
              </Link>
              <Link href="/llms.txt" className="text-slate-500 hover:text-slate-300 transition">
                API / LLMs
              </Link>
              <Link href="/admin" className="text-slate-500 hover:text-slate-300 transition">
                Admin
              </Link>
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-900 text-[11px] leading-relaxed text-slate-400 font-sans max-w-5xl">
            <p>
              <strong>SELF-HELP COMPLIANCE DISCLOSURE:</strong> {STATUTORY_COMPLIANCE_DISCLOSURE}
            </p>
          </div>

          <div className="text-[11px] font-sans text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>&copy; 2026 Western Amalgamated. All rights reserved.</span>
            <span>Printed &amp; Dispatched via U.S. Postal Service®</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
