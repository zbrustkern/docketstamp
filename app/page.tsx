import React from "react";
import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  Truck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Stamp,
  Lock,
  Search,
  ExternalLink,
  Scale,
  Building,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { getAllNoticeTemplates, STATUTORY_COMPLIANCE_DISCLOSURE } from "@/lib/notices/registry";

export const metadata = {
  title: "DocketStamp | Official Document & Certified Mail Dispatch Registry",
  description:
    "Formal legal notice preparation and physical USPS First-Class & Certified Mail dispatch registry. State-specific statutory notices drafted and dispatched in 60 seconds.",
};

export default function HomePage() {
  const notices = getAllNoticeTemplates();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* 1. Header / Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-mono font-bold text-sm shadow-md shadow-sky-900/30">
              DS
            </div>
            <div>
              <span className="font-mono text-sm font-bold tracking-wider text-white">
                DOCKETSTAMP<span className="text-sky-400">™</span>
              </span>
              <span className="hidden sm:inline-block ml-3 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-400 border border-slate-700">
                USPS Registry
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="hidden md:inline-block text-slate-400">
              SYSTEM STATUS: <span className="text-emerald-400 font-bold">ONLINE (CASS VERIFIED)</span>
            </span>
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Operator Registry
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="py-16 md:py-20 px-4 sm:px-6 max-w-6xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/60 border border-sky-800/80 text-sky-400 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span>OFFICIAL DOCUMENT &amp; CERTIFIED MAIL DISPATCH REGISTRY</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Execute Formal Legal Notices in 60 Seconds. Dispatched via USPS Certified Mail.
        </h1>
        <p className="font-sans text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          State-referenced, statutory Mad-Libs notices for tenants, consumers, and policyholders.
          Complete highlighted fields directly on the instrument, adopt your formal signature, and
          immediately dispatch via USPS First-Class or Certified Mail with Electronic Return Receipt.
        </p>

        {/* Quick Highlights Grid */}
        <div className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto text-left">
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-1">
            <span className="text-[10px] font-mono uppercase text-sky-400 block font-bold">50-State Statutory Engine</span>
            <p className="text-xs text-slate-300 font-medium">Automatic state code &amp; penalty citation lookup</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-1">
            <span className="text-[10px] font-mono uppercase text-sky-400 block font-bold">DocuSign-Style Execution</span>
            <p className="text-xs text-slate-300 font-medium">Tab through highlighted variables in real time</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-1">
            <span className="text-[10px] font-mono uppercase text-sky-400 block font-bold">CASS Certified Dispatch</span>
            <p className="text-xs text-slate-300 font-medium">Standardized delivery point &amp; barcode tracking</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-1">
            <span className="text-[10px] font-mono uppercase text-sky-400 block font-bold">Court-Ready Proof</span>
            <p className="text-xs text-slate-300 font-medium">Certificate of mailing &amp; carrier signature PDF</p>
          </div>
        </div>
      </section>

      {/* 3. Live DocuSign-Style Interactive Instrument Preview */}
      <section className="py-12 px-4 sm:px-6 bg-slate-950 border-y border-slate-800">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-sky-400 block font-semibold">
                EXECUTION WORKSPACE &bull; LIVE SPECIMEN
              </span>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
                Statutory Security Deposit Return Demand
              </h2>
            </div>
            {/* Sticky Execution Status Mock */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-slate-300">STATUS: DRAFTING DOCKET</span>
              <span className="text-slate-500">|</span>
              <span className="text-amber-400 font-bold">4 of 5 Variables Complete</span>
            </div>
          </div>

          {/* Elevated 8.5" x 11" Document Sheet */}
          <div className="docket-sheet p-8 sm:p-12 font-serif text-slate-900 shadow-2xl relative rounded-sm">
            {/* Top-Right Clerk's Docket Stamp Block */}
            <div className="absolute top-6 right-6 sm:top-10 sm:right-10 docket-stamp-box max-w-[280px]">
              <div className="font-bold text-[10px] text-slate-900 border-b border-slate-900/30 pb-1 mb-1">
                DOCKETSTAMP™ OFFICIAL DISPATCH REGISTRY
              </div>
              <div className="text-[9px] text-slate-700 space-y-0.5">
                <div>DOCKET ID: <span className="font-bold text-slate-900">DS-2026-88419-X</span></div>
                <div>RECORDED: 2026-10-14 14:50:18 UTC</div>
                <div>SERVICE: USPS CERTIFIED MAIL® + ERR</div>
                <div>STATUS: CASS STANDARDIZED &amp; VERIFIED</div>
                <div>JURISDICTION: CALIFORNIA (CIV. CODE § 1950.5)</div>
              </div>
            </div>

            {/* Document Header */}
            <div className="mb-8 pt-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                DEMAND FOR IMMEDIATE REMITTANCE &bull; VIA USPS CERTIFIED MAIL
              </div>
              <h3 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-slate-950 uppercase max-w-[420px]">
                Formal Demand for Return of Residential Security Deposit
              </h3>
              <p className="font-mono text-[11px] text-slate-600 mt-1">
                Governing Authority: California Civil Code § 1950.5(g)
              </p>
            </div>

            {/* Senders & Recipients Block */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans mb-8 border-y border-slate-200 py-4">
              <div>
                <span className="font-mono text-[10px] uppercase text-slate-400 font-bold block mb-1">Filing Tenant:</span>
                <p className="font-semibold text-slate-900">Marcus Vance</p>
                <p className="text-slate-600">Former Resident of 1420 Ocean Ave, Apt 4B</p>
                <p className="text-slate-600">Santa Monica, CA 90401</p>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase text-slate-400 font-bold block mb-1">Landlord / Management Entity:</span>
                <p className="font-semibold text-slate-900">Pacific Coast Property Management LLC</p>
                <p className="text-slate-600">100 Wilshire Blvd, Suite 1200</p>
                <p className="text-slate-600">Santa Monica, CA 90401</p>
              </div>
            </div>

            {/* Letter Body Prose with Inline DocuSign Tags */}
            <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-800">
              <p>
                This letter constitutes formal statutory demand pursuant to <strong>Cal. Civ. Code § 1950.5(g)</strong> for the immediate and full return of the residential security deposit in the amount of{" "}
                <span className="font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 text-slate-900">
                  $2,450.00
                </span>{" "}
                held in connection with the lease of the premises located at 1420 Ocean Ave, Apt 4B, Santa Monica, CA 90401.
              </p>
              <p>
                The undersigned surrendered keys and vacated the premises on <strong>September 15, 2026</strong>. In accordance with California statutory requirements, a landlord has strictly twenty-one (21) calendar days to provide a full refund or an itemized deduction statement accompanied by paid receipts.
              </p>
              <p>
                As of today&apos;s date, twenty-nine (29) days have elapsed without receipt of funds or itemized accounting. The premises were surrendered in clean, undamaged condition, ordinary wear and tear excepted.
              </p>

              {/* Active Unfilled Variable Tag Example */}
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
                <span className="text-[10px] font-mono uppercase text-amber-800 font-bold block">
                  Interactive Tag &bull; Click to Execute:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-700">Forwarding Remittance Address:</span>
                  <span className="docusign-tag docusign-tag-active">
                    [ REQUIRED: FORWARDING REMITTANCE ADDRESS ]
                  </span>
                </div>
              </div>

              {/* Statutory Admonition */}
              <div className="p-3 bg-slate-100 border-l-4 border-slate-900 font-mono text-[11px] text-slate-900 space-y-1">
                <div className="font-bold">STATUTORY BAD-FAITH PENALTY NOTICE:</div>
                <p>
                  Pursuant to Cal. Civ. Code § 1950.5(l), bad-faith retention of security deposit funds subjects the landlord to statutory damages of up to twice the amount wrongfully withheld, in addition to actual damages and reasonable attorney fees.
                </p>
              </div>
            </div>

            {/* Execution / Adoption Block */}
            <div className="mt-8 pt-6 border-t border-slate-200 text-xs font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase text-slate-400 font-bold mb-1">Execution Ceremony:</p>
                  <p className="font-serif italic text-slate-900 text-sm">/s/ Marcus Vance</p>
                  <p className="font-mono text-[10px] text-slate-500">Executed via DocketStamp™ Secure Registry &bull; Verified Timestamp</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-sans text-xs font-bold transition shadow-sm">
                    Adopt Signature &amp; Stamp Notice &rarr;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Initial 6-Notice Catalog */}
      <section className="py-16 px-4 sm:px-6 max-w-6xl mx-auto space-y-8 flex-1">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-sky-400 font-bold block">
            AUTHORITATIVE FORM LETTER REGISTRY
          </span>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white">
            Available Deterministic Statutory Notices
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Choose a verified notice template. Complete all factual fields in 60 seconds with instant
            CASS address validation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 transition flex flex-col justify-between space-y-4 shadow-lg group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-sky-950 text-sky-400 border border-sky-800/80">
                    {notice.badge}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {notice.fields.length} Required Fields
                  </span>
                </div>
                <h3 className="font-serif text-lg font-bold text-white group-hover:text-sky-300 transition">
                  {notice.title}
                </h3>
                <p className="font-mono text-[11px] text-slate-400 leading-relaxed">
                  {notice.governingCitation}
                </p>
                <div className="text-[11px] font-sans text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="font-bold text-slate-400 font-mono block text-[10px] uppercase mb-0.5">Statutory Window:</span>
                  {notice.statutoryWindow}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">
                  USPS: <span className="text-white font-semibold">{notice.recommendedServiceLevel.replace(/_/g, " ")}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 font-sans cursor-pointer">
                  <span>Prepare Docket</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. 3-Tier Pricing & Unit Economics */}
      <section className="py-16 px-4 sm:px-6 bg-slate-950 border-t border-slate-800">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-sky-400 font-bold block">
              TRANSPARENT 3-TIER PRICING
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white">
              USPS Postal Dispatch Options
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
              Flat, all-inclusive pricing including CASS address standardization, high-definition printing, envelope, and physical USPS postage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tier 1 */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-xs font-mono uppercase text-slate-400 font-bold block">TIER 1 &bull; STANDARD</span>
                <h3 className="font-serif text-xl font-bold text-white">First-Class Dispatch</h3>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-bold text-white">$12.95</span>
                  <span className="text-xs text-slate-400">flat rate</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-2.5 font-sans pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>USPS First-Class Mail induction</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Intelligent Mail Barcode (IMb) tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>CASS address verification stamp</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Digital audit PDF copy</span>
                  </li>
                </ul>
              </div>
              <button className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold font-sans transition">
                Select First-Class ($12.95)
              </button>
            </div>

            {/* Tier 2 (Featured) */}
            <div className="p-6 rounded-2xl bg-slate-900 border-2 border-sky-500 relative flex flex-col justify-between space-y-6 shadow-xl shadow-sky-950/40">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-sky-500 text-slate-950 font-mono text-[10px] font-bold uppercase tracking-wider">
                RECOMMENDED &bull; COURT STANDARD
              </div>
              <div className="space-y-4">
                <span className="text-xs font-mono uppercase text-sky-400 font-bold block">TIER 2 &bull; OFFICIAL NOTICE</span>
                <h3 className="font-serif text-xl font-bold text-white">USPS Certified Mail®</h3>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-bold text-white">$19.95</span>
                  <span className="text-xs text-slate-400">flat rate</span>
                </div>
                <ul className="text-xs text-slate-200 space-y-2.5 font-sans pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                    <span><strong>Official USPS Certified Mail® green banner</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                    <span>Official USPS Certified tracking number</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                    <span>Proof of physical tender &amp; postmark</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                    <span>Delivery confirmation certificate</span>
                  </li>
                </ul>
              </div>
              <button className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold font-sans transition shadow-md shadow-sky-900/50">
                Select Certified Mail ($19.95)
              </button>
            </div>

            {/* Tier 3 */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-xs font-mono uppercase text-slate-400 font-bold block">TIER 3 &bull; MAXIMUM PROOF</span>
                <h3 className="font-serif text-xl font-bold text-white">Certified + Return Receipt</h3>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-bold text-white">$27.95</span>
                  <span className="text-xs text-slate-400">flat rate</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-2.5 font-sans pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Everything in USPS Certified Mail®</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>Electronic Return Receipt (ERR)</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Carrier recipient signature capture PDF</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Highest court-admissible proof of delivery</span>
                  </li>
                </ul>
              </div>
              <button className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold font-sans transition">
                Select Certified + ERR ($27.95)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer & Statutory UPL Compliance Notice */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="font-mono font-bold text-slate-300 tracking-wider">
                DOCKETSTAMP<span className="text-sky-400">™</span>
              </span>
              <p className="text-[11px] text-slate-500">
                Official Document &amp; Certified Mail Dispatch Registry &bull; Western Amalgamated
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-[11px] font-mono">
              <Link href="/privacy" className="hover:text-slate-300 transition">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-slate-300 transition">Terms of Service</Link>
              <Link href="/return-policy" className="hover:text-slate-300 transition">Refund &amp; Dispatch Policy</Link>
              <Link href="/admin" className="hover:text-slate-300 transition">Operator Portal</Link>
            </div>
          </div>

          {/* Mandatory 8pt Compliance Notice */}
          <div className="pt-6 border-t border-slate-900 text-[10px] leading-relaxed text-slate-400 font-sans max-w-4xl">
            <p>
              <strong>STATUTORY SELF-HELP COMPLIANCE DISCLOSURE:</strong> {STATUTORY_COMPLIANCE_DISCLOSURE}
            </p>
          </div>

          <div className="text-[10px] font-mono text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>&copy; 2026 Western Amalgamated. All rights reserved. DocketStamp™ is a proprietary dispatch registry.</span>
            <span>USPS CASS™ Certified Address Standardization</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
