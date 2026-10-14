import React from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, ShieldCheck, Mail, AlertCircle } from "lucide-react";

export const metadata = {
  title: "Refund & Cancellation Policy — DocketStamp",
  description:
    "Refund, cancellation, and postal dispatch policies for legal notices and certified mailings from DocketStamp (Western Amalgamated).",
};

export default function ReturnPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-amber-100 selection:text-amber-900 pb-20">
      {/* Top Navigation Header */}
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

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">
        {/* Title Header */}
        <div className="text-center mb-10 pb-8 border-b border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-sky-400 mx-auto mb-4 flex items-center justify-center border border-slate-700 shadow-md">
            <RotateCcw className="w-6 h-6" />
          </div>
          <span className="text-[11px] uppercase font-bold tracking-widest text-sky-400 font-mono block mb-2">
            Dispatch Registry Policy
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            Effective Date: October 14, 2026 • Operated by <strong>Western Amalgamated</strong>, provider of <strong>DocketStamp</strong>.
          </p>
        </div>

        {/* Policy Body */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-300 bg-slate-800/60 p-6 sm:p-10 rounded-2xl border border-slate-700 shadow-xl">
          {/* Quick Summary Pill Box */}
          <div className="p-4 bg-sky-950/40 rounded-xl border border-sky-800/60 text-xs text-sky-200 space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-sky-300 text-sm">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Service Guarantee &amp; Physical Mail Policy:
            </p>
            <p className="leading-relaxed">
              Because DocketStamp prints individualized legal notices and tenders them directly into the physical United States Postal Service mail stream with live barcodes, <strong>cancellations cannot be processed once physical printing and postal induction have occurred.</strong> However, if an order is cancelled prior to postal processing, or if a verified printing or transmission defect occurs, <strong>we provide a 100% full refund or free immediate redispatch.</strong>
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">1</span>
              Custom Legal Notice &amp; Postal Dispatch Services
            </h2>
            <p>
              Notices prepared through DocketStamp are generated deterministically based on sender-provided factual parameters and are printed on demand for immediate physical transmission via USPS First-Class, USPS Certified Mail®, or USPS Certified Mail® with Electronic Return Receipt.
            </p>
            <p>
              Because postage, tracking barcodes, and physical envelopes are permanently affixed upon induction into the postal stream, physical returns are not accepted.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">2</span>
              Cancellations Before Postal Dispatch
            </h2>
            <p>
              If you identify an error in your document variables or need to cancel before physical processing has commenced, contact us immediately at <a href="mailto:support@docketstamp.com" className="text-sky-400 underline font-medium">support@docketstamp.com</a> with your Docket ID (e.g., <code>DS-2026-XXXXX</code>). If postal induction has not yet taken place, we will immediately cancel the dispatch and issue a 100% refund to your original payment method.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">3</span>
              Delivery Failures &amp; Undeliverable Addresses
            </h2>
            <p>
              DocketStamp verifies recipient addresses against USPS Coding Accuracy Support System (CASS) standards prior to dispatch. If a mailpiece is returned as undeliverable due to an outdated recipient address or refusal by the addressee, the official USPS return scan and physical postmark serve as legal proof of attempted service. Re-dispatch to an updated address can be requested at cost.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">4</span>
              UPL &amp; Legal Advice Disclaimer
            </h2>
            <p className="text-xs text-slate-400 italic">
              DocketStamp is an automated document preparation and USPS postal dispatch platform, not a law firm, and does not provide legal advice, legal opinions, or legal representation. Refund claims based on legal outcomes or court decisions cannot be accepted.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
