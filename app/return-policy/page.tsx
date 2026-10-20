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
              Orders are submitted to a postal fulfillment provider after checkout. Cancellation options depend on processing status. If an order is cancelled before postal processing, or a printing or transmission defect is confirmed, the available remedy is handled under the terms below.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">1</span>
              Custom Legal Notice &amp; Postal Dispatch Services
            </h2>
            <p>
              Notices are prepared from sender-provided information. After checkout, orders may be submitted for USPS First-Class, USPS Certified Mail®, or USPS Certified Mail® with an Electronic Return Receipt request.
            </p>
            <p>
              Provider and USPS status information is shown when it is received. Whether a mailing or postal record meets a legal service requirement depends on the applicable law and circumstances.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">2</span>
              Cancellations Before Postal Dispatch
            </h2>
            <p>
              If you identify an error in your document variables or need to request cancellation, contact <a href="mailto:support@docketstamp.com" className="text-sky-400 underline font-medium">support@docketstamp.com</a> as soon as possible with your Docket ID (e.g., <code>DS-2026-XXXXX</code>). We will review the recorded order and provider status and confirm whether cancellation is still possible. If cancelled before postal processing, we will issue the refund described in this policy.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">3</span>
              Delivery Failures &amp; Undeliverable Addresses
            </h2>
            <p>
              Address standardization or verification may be available from the postal provider, but it does not guarantee delivery or legal sufficiency. If a return status is reported, it will be shown when available. Whether any mailing record is legally sufficient proof of service depends on the applicable law and circumstances; consult a qualified lawyer. Re-dispatch to an updated address can be requested at cost.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 text-xs font-mono flex items-center justify-center font-bold">4</span>
              UPL &amp; Legal Advice Disclaimer
            </h2>
            <p className="text-xs text-slate-400 italic">
              DocketStamp provides self-help document preparation and postal mailing services. It is not a law firm and does not provide legal advice, legal opinions, or legal representation. Refund claims based on legal outcomes or court decisions cannot be accepted.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
