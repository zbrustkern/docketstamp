import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  FileText,
  MailCheck,
  ShieldCheck,
  Building2,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import {
  STATUTORY_COMPLIANCE_DISCLOSURE,
  UPL_COMPLIANCE_FOOTER_TEXT,
} from '@/src/lib/docket/guardrails';
import { DOCKET_PRICING_TIERS } from '@/src/lib/docket/notices';
import { HeaderDocketLookup } from '@/src/components/docket/HeaderDocketLookup';
import { HeaderUserNav } from '@/src/components/docket/HeaderUserNav';
import { InteractiveHomeWorkbench } from '@/src/components/docket/InteractiveHomeWorkbench';

export const metadata = {
  title: 'DocketStamp | Prepare and Mail Formal Letters via USPS',
  description:
    'Prepare and review a formal letter, then send it using an available USPS mailing service. DocketStamp is not a law firm and does not provide legal advice.',
};

export default function HomePage() {
  const pricingTiers = [
    {
      id: 'first_class',
      name: 'USPS First-Class Mail',
      price: DOCKET_PRICING_TIERS.first_class.formattedPrice,
      tag: 'Standard Mail',
      description:
        'Choose USPS First-Class Mail for your order. USPS tracking or status information may be limited.',
      features: [
        'Prepared notice copy available in your order',
        'Order status shown as recorded',
        'Postal updates shown when provided',
      ],
      isRecommended: false,
    },
    {
      id: 'certified',
      name: 'USPS Certified Mail®',
      price: DOCKET_PRICING_TIERS.certified.formattedPrice,
      tag: 'Certified Mail option',
      description:
        'Choose USPS Certified Mail. Tracking and postal status details appear when available from the provider.',
      features: [
        'USPS Certified Mail service requested for the order',
        'Tracking information when provided',
        'Acceptance or delivery events shown when received',
      ],
      isRecommended: true,
    },
    {
      id: 'certified_return_receipt',
      name: 'Certified Mail® + Return Receipt',
      price: DOCKET_PRICING_TIERS.certified_return_receipt.formattedPrice,
      tag: 'Return Receipt option',
      description:
        'Choose Certified Mail with an Electronic Return Receipt request. A receipt record appears if USPS provides one.',
      features: [
        'Everything in USPS Certified Mail®',
        'Electronic Return Receipt requested',
        'Receipt and tracking records when provided',
      ],
      isRecommended: false,
    },
  ];

  const faqs = [
    {
      question: 'What is included in the price?',
      answer:
        'The displayed price is for the selected preparation and mailing service. Your order record shows available document and postal information; provider status and receipt records depend on what the postal provider returns.',
    },
    {
      question: 'How does USPS Certified Mail® differ from First-Class Mail?',
      answer:
        'The options use different USPS services. Tracking, acceptance, delivery, and return-receipt information are shown only when supplied by the provider. DocketStamp does not determine whether a mailing record satisfies a legal proof-of-service requirement.',
    },
    {
      question: 'Do I need an account to send a letter?',
      answer:
        'No. You can prepare a notice and check out as a guest. The order page shows the order details and any postal records available for that order.',
    },
    {
      question: 'How do pre-addressed corporate recipients work?',
      answer:
        'The directory provides recipient names and address information for listed organizations. Verify the recipient and address for your situation before placing an order. You can also enter a recipient manually.',
    },
    {
      question: 'Is DocketStamp a law firm?',
      answer:
        'No. DocketStamp provides self-help document preparation and mailing services. It is not a law firm and does not provide legal advice or representation. Templates may not fit every situation or current legal requirement; consider consulting a qualified lawyer about your circumstances.',
    },
    {
      question: 'Can I review my letter before paying?',
      answer:
        'Yes. Review the prepared notice and the order details before checkout. After payment, the order page reports the processing and postal status recorded for that order.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-amber-100 selection:text-amber-900 overflow-x-hidden">
      {/* 1. Sticky Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4">
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-mono font-bold text-xs sm:text-sm shadow-md shadow-sky-900/40">
              DS
            </div>
            <div>
              <span className="font-mono text-xs sm:text-sm font-bold tracking-wider text-white">
                DOCKETSTAMP<span className="text-sky-400">™</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-sans font-medium bg-slate-800 text-slate-300 border border-slate-700">
              Notice preparation and mailing
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-sans font-medium text-slate-300">
            <a href="#how-it-works" className="hover:text-sky-400 transition">
              How It Works
            </a>
            <a href="#pricing" className="hover:text-sky-400 transition">
              Pricing
            </a>
            <a href="#faq" className="hover:text-sky-400 transition">
              FAQ
            </a>
            <Link href="/companies" className="hover:text-sky-400 transition">
              Company Directory
            </Link>
          </nav>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <HeaderDocketLookup />
            <HeaderUserNav />
          </div>
        </div>
      </header>

      {/* 2. Hero Section: Focused Chooser & Shared-Renderer Paper Preview */}
      <main>
        <InteractiveHomeWorkbench />
      </main>

      {/* 3. Three-Step Process Strip */}
      <section
        id="how-it-works"
        className="border-y border-slate-800 bg-slate-950 py-10 sm:py-12 px-4 sm:px-6 scroll-mt-16"
      >
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-1.5 max-w-2xl mx-auto">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
              How DocketStamp Works
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Prepare a notice, review the order, and choose a mailing service.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-sans text-sm font-bold text-white">
                  1. Choose your letter
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pick from supported notice templates or browse recipient address information.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400 shrink-0">
                <MailCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-sans text-sm font-bold text-white">
                  2. Add your details and review
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter your facts and review the prepared notice before checkout.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-sans text-sm font-bold text-white">
                  3. Choose a mailing option
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Choose an available USPS service. Your order page shows provider updates when received.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Transparent Informational USPS Pricing Section */}
      <section
        id="pricing"
        className="py-12 sm:py-16 px-4 sm:px-6 max-w-7xl mx-auto space-y-8 scroll-mt-16"
      >
        <div className="text-center space-y-1.5 max-w-2xl mx-auto">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Transparent USPS Pricing
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Review the service and price shown at checkout. Postal records vary by service and provider updates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pricingTiers.map((tier) => (
            <div
              key={tier.id}
              className={`p-6 rounded-2xl flex flex-col justify-between transition ${
                tier.isRecommended
                  ? 'bg-slate-900 border-2 border-sky-500/80 shadow-xl shadow-sky-950/40 relative'
                  : 'bg-slate-900/70 border border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      tier.isRecommended
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {tier.tag}
                  </span>
                </div>

                <h3 className="font-sans text-lg font-bold text-white">
                  {tier.name}
                </h3>
                <div className="mt-2 mb-3 flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-bold text-white">
                    {tier.price}
                  </span>
                  <span className="text-xs text-slate-400">/ mailing</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-5">
                  {tier.description}
                </p>

                <div className="border-t border-slate-800 pt-4 space-y-2.5">
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                    What&apos;s Included:
                  </span>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {tier.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
                <a
                  href="#workbench"
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition ${
                    tier.isRecommended
                      ? 'bg-sky-600 hover:bg-sky-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
                  }`}
                >
                  <span>Select in workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 max-w-xl mx-auto">
          Mailing options and prices are shown for review before checkout. Available provider records depend on the selected service.
        </p>
      </section>

      {/* 5. Company Directory Callout & Hash Anchor Aliases */}
      <section
        id="verified-directory"
        className="border-y border-slate-800 bg-slate-950/70 py-8 px-4 sm:px-6 scroll-mt-16"
      >
        <div id="notice-catalog" className="scroll-mt-16" />
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="space-y-1 text-center sm:text-left">
            <div className="font-sans font-bold text-white text-sm flex items-center justify-center sm:justify-start gap-2">
              <Building2 className="w-4 h-4 text-sky-400" />
              <span>Looking for a specific organization?</span>
            </div>
            <p className="text-xs text-slate-400">
              The directory lists recipient names and mailing addresses for selected organizations. Verify the address before use.
            </p>
          </div>
          <Link
            href="/companies"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 hover:border-slate-600 transition shrink-0"
          >
            <span>Browse the directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* 6. Verified FAQ Section */}
      <section
        id="faq"
        className="py-12 sm:py-16 px-4 sm:px-6 max-w-4xl mx-auto space-y-8 scroll-mt-16 w-full"
      >
        <div className="text-center space-y-1.5">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Information about notice preparation and available USPS mailing options.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2"
            >
              <h3 className="font-sans text-sm sm:text-base font-bold text-white flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>{faq.question}</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 pl-6 leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Footer & Mandatory Statutory UPL Compliance Disclosure */}
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
                Self-help notice preparation and mailing options
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-sans">
              <Link href="/companies" className="hover:text-slate-200 transition">
                Company Directory
              </Link>
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
              <Link href="/account" className="hover:text-slate-200 transition">
                My Account
              </Link>
              <Link href="/llms.txt" className="text-slate-500 hover:text-slate-300 transition">
                API / LLMs
              </Link>
              <Link href="/admin" className="text-slate-500 hover:text-slate-300 transition">
                Admin
              </Link>
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-900 text-[11px] leading-relaxed text-slate-400 font-sans max-w-5xl space-y-2">
            <p>
              <strong>SELF-HELP DISCLOSURE:</strong> {STATUTORY_COMPLIANCE_DISCLOSURE}
            </p>
            <p className="font-mono text-[10px] text-slate-500">
              {UPL_COMPLIANCE_FOOTER_TEXT('DS-2026-DEMO')}
            </p>
          </div>

          <div className="text-[11px] font-sans text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>&copy; 2026 Western Amalgamated. All rights reserved.</span>
            <span>Postal status is shown when available from the provider.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
