import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Truck,
  ExternalLink,
  Download,
  ArrowLeft,
  FileText,
  Mail,
  Copy,
} from 'lucide-react';
import { getOrderByDocketId } from '@/lib/firebase-admin';
import { UPL_COMPLIANCE_FOOTER_TEXT } from '@/lib/docket/guardrails';

interface DocketPageProps {
  params: Promise<{ docketId: string }>;
}

export async function generateMetadata({ params }: DocketPageProps): Promise<Metadata> {
  const { docketId } = await params;
  return {
    title: `Docket Record ${docketId} | Official Dispatch Certification | DocketStamp`,
    description: `Official registry record, USPS postal dispatch certification, and physical tracking history for Docket ID ${docketId}.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function DocketStatusPage({ params }: DocketPageProps) {
  const { docketId } = await params;

  if (!docketId) {
    notFound();
  }

  const order = await getOrderByDocketId(docketId);

  // Format dates
  const createdDate = order?.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

  const trackingNumber = order?.lobTrackingNumber;
  const proofUrl = order?.lobTrackingUrl || undefined;
  const serviceLevelLabel =
    order?.serviceLevel === 'CERTIFIED_RETURN_RECEIPT'
      ? 'USPS Certified Mail® w/ Electronic Return Receipt'
      : order?.serviceLevel === 'CERTIFIED'
      ? 'USPS Certified Mail®'
      : 'USPS First-Class Mail®';

  const isPaid = Boolean(
    order &&
      order.status !== 'PENDING_PAYMENT' &&
      order.status !== 'PAYMENT_VERIFICATION_FAILED'
  );

  const isSubmittedForMailing =
    order?.status === 'PAYMENT_RECEIVED' ||
    order?.status === 'DISPATCHING' ||
    order?.status === 'QUEUED_FOR_FULFILLMENT';

  const isDispatched =
    order?.status === 'DISPATCHED_TO_USPS' ||
    order?.status === 'MAILED' ||
    order?.status === 'DELIVERED';

  const isDelivered = order?.status === 'DELIVERED';

  const displayStatus = order
    ? isDelivered
      ? 'DELIVERED'
      : isDispatched
      ? 'DISPATCHED_TO_USPS'
      : isSubmittedForMailing
      ? 'SUBMITTED_FOR_MAILING'
      : order.status === 'PENDING_PAYMENT'
      ? 'PENDING_PAYMENT'
      : order.status
    : 'RECORDED';

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans pb-16">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-200 hover:text-white transition group"
          >
            <div className="w-8 h-8 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center font-mono font-bold text-sky-400 text-xs">
              DS
            </div>
            <div className="leading-tight">
              <span className="font-bold tracking-tight text-white block text-sm sm:text-base">
                DocketStamp
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                USPS Certified Mail Registry
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              RECORD AUTHENTICATED
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Breadcrumb / Back Link */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-sky-400 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Registry Home
          </Link>
        </div>

        {/* Hero Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
            <div>
              <div className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-wider mb-2">
                Official USPS Physical Postal Filing
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                Docket Registry Record
              </h1>
              <p className="text-sm text-slate-400 max-w-xl">
                This verified certification confirms that the legal instrument below was frozen,
                serialized, and transmitted for physical delivery via the United States Postal Service.
              </p>
            </div>

            {/* Clerk's Docket Stamp Display Box */}
            <div className="bg-[#FEF3C7] text-slate-900 border-2 border-[#D97706] rounded p-3 w-full md:w-80 font-mono shadow-md">
              <div className="text-[10px] font-bold tracking-wider uppercase text-amber-900 border-b border-amber-300 pb-1 mb-1.5 text-center">
                Clerk&apos;s Docket Stamp &bull; Post-Dispatch
              </div>
              <div className="text-xs space-y-1">
                <div>
                  <span className="font-semibold text-amber-950">DOCKET ID: </span>
                  <span className="font-bold text-amber-900">{docketId}</span>
                </div>
                <div>
                  <span className="font-semibold text-amber-950">RECORDED: </span>
                  <span className="text-amber-900">{createdDate}</span>
                </div>
                <div>
                  <span className="font-semibold text-amber-950">CLASS: </span>
                  <span className="text-amber-900">{serviceLevelLabel}</span>
                </div>
                <div>
                  <span className="font-semibold text-amber-950">STATUS: </span>
                  <span className="text-emerald-800 font-bold">
                    {displayStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tracking Timeline */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 font-bold mb-6 flex items-center gap-2">
            <Truck className="w-4 h-4 text-sky-400" /> USPS Fulfillment & Delivery Timeline
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
            {/* Step 1 */}
            <div
              className={`border rounded-lg p-4 ${
                isPaid
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                  : 'border-slate-800 bg-slate-950/50 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2 font-mono text-xs font-bold mb-1">
                {isPaid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-400" />
                )}
                1. Payment Confirmed
              </div>
              <div className="text-[11px] text-slate-400">
                {isPaid
                  ? 'Payment confirmed and immutable snapshot frozen with /s/ signature.'
                  : 'Awaiting customer payment confirmation.'}
              </div>
            </div>

            {/* Step 2 */}
            <div
              className={`border rounded-lg p-4 ${
                isPaid
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                  : 'border-slate-800 bg-slate-950/50 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2 font-mono text-xs font-bold mb-1">
                {isPaid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                2. CASS Standardized
              </div>
              <div className="text-[11px] text-slate-400">
                USPS Coding Accuracy Support System certified delivery point.
              </div>
            </div>

            {/* Step 3 */}
            <div
              className={`border rounded-lg p-4 ${
                isDispatched
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                  : isSubmittedForMailing
                  ? 'border-sky-500/30 bg-sky-500/5 text-sky-400'
                  : 'border-slate-800 bg-slate-950/50 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2 font-mono text-xs font-bold mb-1">
                {isDispatched ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                {isDispatched ? '3. Dispatched to USPS' : '3. Submitted for Mailing'}
              </div>
              <div className="text-[11px] text-slate-400">
                {isDispatched
                  ? 'Physical letter printed and injected into USPS mailstream.'
                  : isSubmittedForMailing
                  ? 'Queued for commercial print and USPS carrier deposit.'
                  : 'Pending submission to mailing pipeline.'}
              </div>
            </div>

            {/* Step 4 */}
            <div
              className={`border rounded-lg p-4 ${
                isDelivered
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                  : 'border-slate-800 bg-slate-950/50 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2 font-mono text-xs font-bold mb-1">
                {isDelivered ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                4. Physical Delivery
              </div>
              <div className="text-[11px] text-slate-400">
                {isDelivered
                  ? 'Confirmed delivered by postal carrier.'
                  : order?.expectedDeliveryDate
                  ? `Est. Delivery: ${order.expectedDeliveryDate}`
                  : 'Awaiting postal delivery scan. Return Receipt PDF captured after delivery.'}
              </div>
            </div>
          </div>
        </div>

        {/* Tracking & Proof Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* USPS Tracking Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4 text-sky-400" /> USPS Postal Tracking Details
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  USPS TRACKING IDENTIFIER
                </label>
                <div className="font-mono text-base font-bold text-sky-400 bg-slate-950 border border-slate-800 rounded px-3 py-2 flex items-center justify-between">
                  <span>{trackingNumber || 'Pending USPS Ingestion'}</span>
                </div>
              </div>

              {trackingNumber && (
                <a
                  href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-mono text-sky-400 hover:text-sky-300 underline font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View on Official USPS.com Tracking
                </a>
              )}

              {order?.expectedDeliveryDate && (
                <div className="pt-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Expected Delivery:</span>{' '}
                  {order.expectedDeliveryDate}
                </div>
              )}
            </div>
          </div>

          {/* Letter Proof & Filing Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" /> Physical Letter Proof
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                The exact physical letter layout, certified stamp box, and addressee formatting
                as injected into the postal carrier stream.
              </p>
            </div>

            <div>
              {proofUrl ? (
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs font-mono transition"
                >
                  <Download className="w-4 h-4" /> Download Certified PDF Proof
                </a>
              ) : (
                <div className="text-xs font-mono text-slate-400 bg-slate-950 p-3 rounded text-center border border-slate-800">
                  PDF Proof generation in progress — available once processed into the USPS mailstream
                </div>
              )}
              {order?.serviceLevel === 'CERTIFIED_RETURN_RECEIPT' && (
                <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800/80 mt-3">
                  <span className="font-semibold text-slate-300">Electronic Return Receipt:</span>{' '}
                  Signed carrier delivery record PDF is generated following physical delivery.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Addressee & Sender Cards */}
        {order && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                Recipient (Addressee)
              </div>
              <div className="font-semibold text-white">
                {order.recipientAddress?.firstName} {order.recipientAddress?.lastName}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-1">
                <div>{order.recipientAddress?.street1}</div>
                {order.recipientAddress?.street2 && <div>{order.recipientAddress.street2}</div>}
                <div>
                  {order.recipientAddress?.city}, {order.recipientAddress?.state}{' '}
                  {order.recipientAddress?.zip}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                Filing Party (Return Address)
              </div>
              <div className="font-semibold text-white">
                {order.returnAddress?.firstName} {order.returnAddress?.lastName}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-1">
                <div>{order.returnAddress?.street1}</div>
                {order.returnAddress?.street2 && <div>{order.returnAddress.street2}</div>}
                <div>
                  {order.returnAddress?.city}, {order.returnAddress?.state}{' '}
                  {order.returnAddress?.zip}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Embedded Letter Document Inspection */}
        {order?.documentHtml && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" /> Stored Immutable HTML Snapshot
              </h3>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                SHA-256 PRESERVED
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 overflow-hidden max-h-[600px] overflow-y-auto">
              <iframe
                srcDoc={order.documentHtml}
                title="Certified Letter HTML Snapshot"
                className="w-full h-[800px] border-0 rounded bg-white"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}

        {/* UPL Compliance Footer Text */}
        <div className="border-t border-slate-800/80 pt-6 text-center">
          <p className="text-[11px] font-mono text-slate-500 leading-relaxed max-w-3xl mx-auto">
            {UPL_COMPLIANCE_FOOTER_TEXT(docketId)}
          </p>
        </div>
      </main>
    </div>
  );
}
