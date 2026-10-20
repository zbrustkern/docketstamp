import React from "react";
import Link from "next/link";
import { ArrowLeft, Scale, ShieldCheck, AlertTriangle, FileText, Send, Ban } from "lucide-react";
import { STATUTORY_COMPLIANCE_DISCLOSURE } from "@/src/lib/docket/guardrails";

export const metadata = {
  title: "UPL & Legal Disclaimer — DocketStamp",
  description:
    "Statutory self-help disclosure, unauthorized practice of law (UPL) safe harbor, postal irreversibility, and deterministic template disclaimers for DocketStamp.",
};

export default function DisclaimerPage() {
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
            Regulatory &amp; Statutory Compliance Notice
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            UPL &amp; Legal Disclaimer
          </h1>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            Effective Date: October 16, 2026 • Published by <strong>Western Amalgamated</strong>, operator of <strong>DocketStamp</strong>.
          </p>
        </div>

        {/* Mandatory Statutory Self-Help Callout */}
        <div className="mb-8 p-5 bg-amber-950/40 border border-amber-600/60 rounded-xl text-amber-200 text-xs leading-relaxed space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300 uppercase tracking-wider text-[11px] font-mono">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Statutory Self-Help &amp; Unauthorized Practice of Law (UPL) Safe Harbor
          </div>
          <p className="italic">
            {STATUTORY_COMPLIANCE_DISCLOSURE}
          </p>
        </div>

        {/* Legal Prose & Disclosures */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-300 bg-slate-800/60 p-6 sm:p-10 rounded-2xl border border-slate-700 shadow-xl">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-700 text-sky-400 text-xs font-mono flex items-center justify-center font-bold">1</span>
              Self-Help Document Preparation &amp; USPS Dispatch Utility Status
            </h2>
            <p>
              DocketStamp (operated by Western Amalgamated) is an automated software utility designed exclusively for self-represented individuals and organizational administrators to generate administrative form letters and dispatch them via the United States Postal Service (&ldquo;USPS&rdquo;).
            </p>
            <p>
              DocketStamp is <strong>not a law firm</strong>, does not operate as a legal services organization, and is not a substitute for the advice, representation, or counsel of an attorney licensed to practice in your jurisdiction. Staff and software automated systems do not provide legal evaluations, recommendations, or procedural strategies.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-700 text-sky-400 text-xs font-mono flex items-center justify-center font-bold">2</span>
              No Attorney-Client Relationship or Legal Advice
            </h2>
            <p>
              Use of the DocketStamp website, software interfaces, documentation, customer communications, or automated postal dispatch services does not create an attorney-client relationship between you and Western Amalgamated, DocketStamp, or any of our employees, affiliates, or contractors.
            </p>
            <p>
              Communications with DocketStamp are covered by our <Link href="/privacy" className="text-sky-400 underline hover:text-sky-300">Privacy Policy</Link>, but are <strong>not protected by attorney-client privilege or the attorney work-product doctrine</strong>. If you require legal advice, formal representation in a judicial or arbitration proceeding, or legal analysis of your specific situation, you must consult a licensed attorney.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-700 text-sky-400 text-xs font-mono flex items-center justify-center font-bold">3</span>
              Deterministic User-Supplied Factual Parameters
            </h2>
            <p>
              Prepared documents combine facts supplied by the user and, when selected, recipient directory details with fixed wording from the chosen template. A template may include legal references supplied by DocketStamp; DocketStamp does not determine whether those references apply to a user's facts or situation.
            </p>
            <p>
              DocketStamp does not conduct open-ended AI generation of legal claims, nor does it recommend factual allegations, negotiate settlements, or verify the substantive legal veracity of your statements. Senders bear sole and exclusive responsibility for the truthfulness, completeness, accuracy, and legal consequence of all factual statements, signature adoptions, and notice claims transmitted through the platform.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-700 text-sky-400 text-xs font-mono flex items-center justify-center font-bold">4</span>
              Irreversibility of Physical USPS Mail Induction
            </h2>
            <p>
              After checkout, DocketStamp attempts to submit the order to a postal fulfillment provider. Check the order record for its processing status; a payment confirmation does not establish provider submission or USPS acceptance.
            </p>
            <p>
              A payment confirmation does not establish that USPS accepted a mailpiece. Once production or postal processing has begun, changes or cancellation may no longer be possible. Review the prepared notice and order details before checkout, and use the order page for recorded status updates.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-700 text-rose-400 text-xs font-mono flex items-center justify-center font-bold">5</span>
              Hard NAICS 713940 Conflict-of-Interest Exclusion
            </h2>
            <p>
              DocketStamp strictly enforces an automated conflict-of-interest blocker prohibiting the preparation, address verification, or postal dispatch of any instrument relating to fitness facilities, gyms, athletic clubs, health studios, or fitness membership billing agreements categorized under <strong>NAICS 713940</strong>.
            </p>
            <p>
              Automated guardrails proactively reject any notice, recipient name, address, or transaction matching prohibited fitness entities. Consumers and businesses seeking to resolve fitness membership disputes must utilize alternative administrative channels.
            </p>
          </section>

          {/* Institutional Contact Footnote */}
          <div className="pt-6 border-t border-slate-700/80 text-xs text-slate-400 space-y-1">
            <p className="font-mono text-slate-300 font-semibold">WESTERN AMALGAMATED &bull; DOCKET REGISTRY COMPLIANCE</p>
            <p>Business and compliance correspondence: <span className="font-mono text-slate-200">legal@docketstamp.com</span></p>
          </div>
        </div>
      </main>
    </div>
  );
}
