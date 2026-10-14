import React from "react";
import Link from "next/link";
import { ArrowLeft, Lock, Shield, Eye, Database } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — DocketStamp",
  description:
    "Privacy policy describing consumer data privacy, zero-trust order privacy, cryptographic token safeguards, and data disclosures for DocketStamp (Western Amalgamated).",
};

export default function PrivacyPolicyPage() {
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
            <Lock className="w-6 h-6" />
          </div>
          <span className="text-[11px] uppercase font-bold tracking-widest text-sky-400 font-mono block mb-2">
            Data Privacy &amp; Cryptographic Protection
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Privacy Policy
          </h1>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            Effective Date: October 14, 2026 • Operated by <strong>Western Amalgamated</strong>, provider of <strong>DocketStamp</strong>.
          </p>
        </div>

        {/* Policy Body */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-300 bg-slate-800/60 p-6 sm:p-10 rounded-2xl border border-slate-700 shadow-xl">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">1</span>
              Operational Identity &amp; Scope
            </h2>
            <p>
              This Privacy Policy explains how <strong>Western Amalgamated</strong>, operating the website located at <strong>docketstamp.com</strong> (&ldquo;DocketStamp&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), collects, processes, and safeguards personal information when you use our document preparation and USPS postal dispatch platform.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">2</span>
              Zero-Trust Document Privacy &amp; PII Redaction
            </h2>
            <p>
              DocketStamp implements zero-trust access controls for all prepared instruments and order records. Public tracking URLs (<code>/order/[id]</code>) are shielded by unguessable 128-bit cryptographic tokens (<code>viewToken</code>).
            </p>
            <p>
              Any attempt to access an order without the associated <code>viewToken</code> strictly redacts all Personally Identifiable Information (PII): sender and recipient streets are masked to <code>••••••••</code>, ZIP codes to <code>•••••</code>, and all substantive document prose is hidden behind authentication or challenge verification.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">3</span>
              Fulfillment Data Disclosures (Lob Programmatic Postal API)
            </h2>
            <p>
              To execute physical printing and dispatch via the United States Postal Service, sender addresses, recipient addresses, and rendered document text are transmitted securely to our postal partner (Lob, Inc., San Francisco, CA) via encrypted REST API calls. Lob processes mailpieces in SOC 2 Type II certified printing facilities and tenders them directly to USPS sorting facilities.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">4</span>
              Payment Processing Security (Stripe)
            </h2>
            <p>
              Payment data (credit card numbers, Apple Pay, Google Pay credentials) is collected directly by Stripe Elements and processed on Stripe&apos;s PCI-DSS Level 1 compliant servers. DocketStamp servers never receive, process, or store raw credit card numbers or security codes.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
