import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Stamp, CheckCircle2, ArrowRight, Terminal, Lock, FileCheck2 } from 'lucide-react';
import { STATUTORY_COMPLIANCE_DISCLOSURE } from '@/src/lib/docket/guardrails';
import { HeaderDocketLookup } from '@/src/components/docket/HeaderDocketLookup';
import { InteractiveHomeWorkbench } from '@/src/components/docket/InteractiveHomeWorkbench';
import { NoticeCatalogBrowser } from '@/src/components/docket/NoticeCatalogBrowser';

export const metadata = {
  title: 'DocketStamp | Official Document & Certified Mail Dispatch Registry',
  description:
    'Formal legal notice preparation and physical USPS First-Class & Certified Mail dispatch registry. State-specific statutory notices drafted and dispatched in 60 seconds.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* 1. Sticky Institutional Header (h-16) */}
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
              <span className="hidden sm:inline-block ml-2.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-400 border border-slate-700">
                USPS CASS™ Registry
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-mono text-slate-400">
            <a href="#workbench" className="hover:text-sky-400 transition">Live Workbench</a>
            <a href="#notice-catalog" className="hover:text-sky-400 transition">All 9 Notices</a>
            <a href="#verified-directory" className="hover:text-sky-400 transition">38 Corporate Legal Depts</a>
          </nav>

          <div className="flex items-center gap-3">
            <HeaderDocketLookup />
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono transition"
            >
              Operator
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Viewport 1 (Above the Fold): Live Split Workbench */}
      <main id="workbench" className="relative scroll-mt-16">
        <InteractiveHomeWorkbench />
      </main>

      {/* 3. Compact Institutional Proof & Pricing Strip */}
      <section className="border-y border-slate-800 bg-slate-950 py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-mono font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tier 1: Standard First-Class</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">IMb barcode tracking &bull; CASS verification &bull; Archive PDF</p>
            </div>
            <span className="font-mono text-base font-bold text-white shrink-0">$12.95</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-sky-500/70 flex items-center justify-between gap-3 shadow-md shadow-sky-950/40">
            <div className="space-y-0.5">
              <div className="font-mono font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Tier 2: USPS Certified Mail®</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-sky-500 text-slate-950 uppercase font-black">Court Standard</span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans">Official green banner &bull; USPS tracking number &bull; Proof of mailing</p>
            </div>
            <span className="font-mono text-base font-bold text-sky-400 shrink-0">$19.95</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-mono font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tier 3: Certified + Return Receipt</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300 uppercase font-semibold">Max Proof</span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">Electronic Return Receipt (ERR) &bull; Carrier recipient signature PDF</p>
            </div>
            <span className="font-mono text-base font-bold text-white shrink-0">$27.95</span>
          </div>
        </div>
      </section>

      {/* 4. Viewport 2 (Below the Fold): #notice-catalog with NoticeCatalogBrowser */}
      <section id="notice-catalog" className="py-12 px-4 sm:px-6 max-w-7xl mx-auto space-y-8 flex-1 scroll-mt-20">
        <div className="text-center space-y-2 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/60 border border-sky-800/80 text-sky-400 text-xs font-mono font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>ALL 9 DETERMINISTIC STATUTORY CARTRIDGES &amp; 38 VERIFIED RECIPIENTS</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
            Authoritative Form Letter Registry &amp; CASS Legal Directory
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed text-pretty">
            Statutory self-help form letters with 50-state citations and pre-verified corporate legal intake routing.
            Complete highlighted variables in ~60s and dispatch via physical USPS Certified Mail.
          </p>
        </div>

        <NoticeCatalogBrowser />
      </section>

      {/* 5. Compact Agentic / WebMCP & API Discovery Bar */}
      <section className="border-y border-slate-800 bg-slate-950/90 py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-3 text-slate-300">
            <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sky-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <span className="text-white font-bold">Phase 2 Agentic Staging:</span>{' '}
              <span className="text-slate-400">&ldquo;Agents Stage, Humans Sign &amp; Pay&rdquo; &bull; Supported via</span>{' '}
              <code className="text-sky-300">POST /api/docket/stage</code>,{' '}
              <code className="text-sky-300">POST /api/mcp</code>,{' '}
              <span className="text-slate-400">&amp; Chrome 149+ WebMCP</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/llms.txt" className="hover:text-white transition underline underline-offset-4 flex items-center gap-1">
              <span>llms.txt</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="/.well-known/openapi.json" className="hover:text-white transition underline underline-offset-4 flex items-center gap-1">
              <span>OpenAPI Spec</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Footer & Mandatory Statutory UPL Compliance Disclosure */}
      <footer className="border-t border-slate-800 bg-slate-950 py-10 px-4 sm:px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-sky-600 flex items-center justify-center text-white font-mono font-bold text-[10px]">DS</div>
                <span className="font-mono font-bold text-slate-200 tracking-wider">
                  DOCKETSTAMP<span className="text-sky-400">™</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Official Document &amp; Certified Mail Dispatch Registry &bull; Western Amalgamated</p>
            </div>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-mono">
              <Link href="/privacy" className="hover:text-slate-200 transition">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-slate-200 transition">Terms of Service</Link>
              <Link href="/disclaimer" className="hover:text-slate-200 transition">UPL &amp; Legal Disclaimer</Link>
              <Link href="/return-policy" className="hover:text-slate-200 transition">Refund &amp; Dispatch Policy</Link>
              <Link href="/admin" className="hover:text-slate-200 transition">Operator Portal</Link>
              <Link href="/docket/DS-2026-88419-X" className="text-sky-400 hover:text-sky-300 transition">Sample Docket</Link>
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-900 text-[10px] leading-relaxed text-slate-400 font-sans max-w-5xl">
            <p><strong>STATUTORY SELF-HELP COMPLIANCE DISCLOSURE:</strong> {STATUTORY_COMPLIANCE_DISCLOSURE}</p>
          </div>

          <div className="text-[10px] font-mono text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>&copy; 2026 Western Amalgamated. All rights reserved. DocketStamp™ is an automated self-help dispatch utility.</span>
            <span>USPS CASS™ Certified Delivery Point Verification</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
