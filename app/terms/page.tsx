import React from "react";
import Link from "next/link";
import { ArrowLeft, Scale, Shield, AlertTriangle } from "lucide-react";
import { STATUTORY_COMPLIANCE_DISCLOSURE } from "@/src/lib/docket/guardrails";

export const metadata = {
  title: "Terms of Service & UPL Notice — DocketStamp",
  description:
    "Terms of service, statutory self-help positioning, unauthorized practice of law disclosures, and postal delivery notices for DocketStamp (Western Amalgamated).",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-amber-100 selection:text-amber-900 pb-20">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-4 h-4 text-sky-400" />
            <span>Return to Docket Registry</span>
          </Link>
          <span className="font-mono text-xs font-bold tracking-wider text-slate-300">
            DOCKETSTAMP<span className="text-sky-400">.COM</span>
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">
        {/* Title Header */}
        <div className="text-center mb-10 pb-8 border-b border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-sky-400 mx-auto mb-4 flex items-center justify-center border border-slate-700 shadow-md">
            <Scale className="w-6 h-6" />
          </div>
          <span className="text-[11px] uppercase font-bold tracking-widest text-sky-400 font-mono block mb-2">
            Legal &amp; Operating Agreement
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Terms of Service &amp; Conditions
          </h1>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            Effective Date: October 14, 2026 • Operated by <strong>Western Amalgamated</strong>, provider of <strong>DocketStamp</strong>.
          </p>
        </div>

        {/* Mandatory UPL Disclosure Callout Box */}
        <div className="mb-8 p-5 bg-amber-950/40 border border-amber-600/60 rounded-xl text-amber-200 text-xs leading-relaxed space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300 uppercase tracking-wider text-[11px] font-mono">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Statutory Self-Help &amp; UPL Safe Harbor Disclosure
          </div>
          <p className="italic">
            {STATUTORY_COMPLIANCE_DISCLOSURE}
          </p>
        </div>

        {/* Legal Prose */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-300 bg-slate-800/60 p-6 sm:p-10 rounded-2xl border border-slate-700 shadow-xl">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">1</span>
              Self-Help Document Preparation &amp; Postal Dispatch Utility
            </h2>
            <p>
              DocketStamp is a software-driven document preparation and programmatic physical postal transmission utility operated by <strong>Western Amalgamated</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;).
            </p>
            <p>
              DocketStamp provides fixed correspondence templates for users to complete with factual statements, dates, and amounts. The templates do not determine which law applies or establish that a sender is legally entitled to a requested outcome. DocketStamp does not review answers for legal sufficiency, draw legal conclusions, or provide legal strategies.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">2</span>
              Strict Conflict-of-Interest Exclusion
            </h2>
            <p>
              DocketStamp expressly excludes and prohibits templates, recipient addresses, or dispatches concerning fitness clubs, gyms, athletic studios, or health centers categorized under <strong>NAICS 713940</strong>. Users agree not to utilize DocketStamp to draft or dispatch notices to any such entities.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">3</span>
              Mailing Services and Provider Records
            </h2>
            <p>
              Orders are submitted to a postal fulfillment provider after checkout. Processing, USPS acceptance, transit, and tracking depend on provider and USPS events; an order confirmation does not itself establish USPS acceptance or delivery.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-400">
              <li><strong>Tier 1 (First-Class):</strong> Tracking information may be limited; order status is shown when provided.</li>
              <li><strong>Tier 2 (Certified Mail®):</strong> Tracking and postal status records are shown when provided by the provider or USPS.</li>
              <li><strong>Tier 3 (Certified Mail® + Return Receipt):</strong> An Electronic Return Receipt is requested; a record is shown if supplied.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">4</span>
              Typed Signature and User-Provided Information
            </h2>
            <p>
              When a user adopts a typed signature, DocketStamp records that choice and places the typed signature line (<code>/s/ [Full Name]</code>) on the prepared notice. The user is responsible for reviewing the document and the factual information they supplied. The typed signature line is not a court filing or a sworn statement.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
