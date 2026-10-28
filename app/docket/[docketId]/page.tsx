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
  ArrowLeft,
  FileText,
  Mail,
  Copy,
} from 'lucide-react';
import { getOrderByDocketId } from '@/lib/firebase-admin';
import { UPL_COMPLIANCE_FOOTER_TEXT } from '@/lib/docket/guardrails';
import { privatePageMetadata } from '@/src/lib/docket/share-metadata';

interface DocketPageProps {
  params: Promise<{ docketId: string }>;
}

export async function generateMetadata({ params }: DocketPageProps): Promise<Metadata> {
  await params;
  return privatePageMetadata(
    'Order Record',
    'View order information and any postal status information available for reference.',
  );
}

export default async function DocketStatusPage({ params }: DocketPageProps) {
  const { docketId } = await params;

  if (!docketId) {
    notFound();
  }

  const order = await getOrderByDocketId(docketId);

  if (!order) {
    notFound();
  }

  // Format dates
  const createdDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : 'Not available';

  const trackingNumber = order?.lobTrackingNumber;
  const trackingUrl =
    (trackingNumber
      ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`
      : order.lobTrackingUrl) || undefined;
  const serviceLevelLabel =
    order.serviceLevel === 'CERTIFIED_RETURN_RECEIPT'
      ? 'USPS Certified Mail® w/ Electronic Return Receipt'
      : order.serviceLevel === 'CERTIFIED'
      ? 'USPS Certified Mail®'
      : 'USPS First-Class Mail®';

  const isPaid = [
    'PAYMENT_RECEIVED', 'DISPATCHING', 'PROCESSING_HANDWRYTTEN',
    'PROCESSING_DISPATCH', 'QUEUED_FOR_FULFILLMENT', 'DISPATCHED_TO_USPS',
    'MAILED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED_TO_SENDER',
  ].includes(order.status);

  const isSubmittedForMailing =
    order.status === 'PAYMENT_RECEIVED' ||
    order.status === 'DISPATCHING' ||
    order.status === 'PROCESSING_DISPATCH' ||
    order.status === 'PROCESSING_HANDWRYTTEN' ||
    order.status === 'QUEUED_FOR_FULFILLMENT';

  const isDispatched =
    order.status === 'DISPATCHED_TO_USPS' ||
    order.status === 'MAILED' ||
    order.status === 'IN_TRANSIT' ||
    order.status === 'DELIVERED' ||
    order.status === 'RETURNED_TO_SENDER';

  const isDelivered = order.status === 'DELIVERED';

  const displayStatus = isDelivered
    ? 'Delivery status recorded'
    : order.status === 'RETURNED_TO_SENDER'
    ? 'Return status recorded'
    : order.status === 'IN_TRANSIT'
    ? 'In-transit status recorded'
    : order.status === 'MAILED'
    ? 'Mailed status recorded'
    : order.status === 'DISPATCHED_TO_USPS'
    ? 'Dispatch status recorded'
    : isSubmittedForMailing
    ? 'Mailing request processing'
    : order.status === 'PENDING_PAYMENT'
    ? 'Payment pending'
    : order.status === 'PAYMENT_VERIFICATION_FAILED'
    ? 'Payment verification failed'
    : order.status === 'FAILED'
    ? 'Processing failed'
    : 'Order status unavailable';

  const hasAddresses = Boolean(order.recipientAddress && order.returnAddress);

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
                Order status record
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              STATUS FROM STORED ORDER DATA
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
            <ArrowLeft className="w-3.5 h-3.5" /> Return to DocketStamp
          </Link>
        </div>

        {/* Hero Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
            <div>
              <div className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-wider mb-2">
                DocketStamp order and postal status record
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                Order Record
              </h1>
              <p className="text-sm text-slate-400 max-w-xl">
                This page summarizes the stored order and any postal status information received from the provider. It is not a USPS certificate or proof that a legal service requirement was met.
              </p>
            </div>

            {/* DocketStamp order record summary */}
            <div className="bg-[#FEF3C7] text-slate-900 border-2 border-[#D97706] rounded p-3 w-full md:w-80 font-mono shadow-md">
              <div className="text-[10px] font-bold tracking-wider uppercase text-amber-900 border-b border-amber-300 pb-1 mb-1.5 text-center">
                DocketStamp Order Record
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
                  <span className="font-semibold text-amber-950">SERVICE: </span>
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
            <Truck className="w-4 h-4 text-sky-400" /> Order and postal status history
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
                2. Addresses recorded
              </div>
              <div className="text-[11px] text-slate-400">
                {hasAddresses
                  ? 'Recipient and sender mailing addresses are recorded on this order. This does not mean USPS verified them.'
                  : 'One or more mailing addresses are unavailable in this record.'}
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
                {isDispatched ? '3. Postal status recorded' : '3. Mailing processing'}
              </div>
              <div className="text-[11px] text-slate-400">
                {isDispatched
                  ? 'A dispatch or later postal status is recorded for this order.'
                  : isSubmittedForMailing
                  ? 'The order is queued or being processed. This does not establish USPS acceptance.'
                  : 'No mailing-processing status is recorded.'}
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
                4. Delivery status
              </div>
              <div className="text-[11px] text-slate-400">
                {isDelivered
                  ? 'A delivery status is recorded for this order.'
                  : order?.expectedDeliveryDate
                  ? `Estimated USPS delivery: ${order.expectedDeliveryDate}`
                  : 'No delivery status or estimate is currently recorded.'}
              </div>
            </div>
          </div>
        </div>

        {/* Tracking and document availability */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* USPS Tracking & Delivery */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4 text-sky-400" /> USPS Tracking & Delivery
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  USPS Tracking Number
                </label>
                <div className="font-mono text-base font-bold text-sky-400 bg-slate-950 border border-slate-800 rounded px-3 py-2 flex items-center justify-between">
                  <span>{trackingNumber || 'Not available'}</span>
                </div>
              </div>

              {trackingUrl && (
                <div>
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-mono text-sky-400 hover:text-sky-300 underline font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Track on USPS.com
                  </a>
                  <p className="text-[11px] text-slate-400 mt-2">
                    USPS tracking updates typically appear within 24–48 hours once inducted at the postal sorting facility.
                  </p>
                </div>
              )}

              {order?.expectedDeliveryDate && (
                <div className="pt-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Estimated USPS delivery:</span>{' '}
                  {order.expectedDeliveryDate}
                </div>
              )}
            </div>
          </div>

          {/* Prepared document and tracking availability */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" /> Prepared notice
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                This page displays order and postal status information. It does not provide a carrier certificate or determine whether legal service requirements were met.
              </p>
            </div>

            <div>
              <div className="text-xs font-mono text-slate-400 bg-slate-950 p-3 rounded text-center border border-slate-800">
                The prepared notice is available from the order workflow when provided. No carrier proof document is available on this page.
              </div>
              {order?.serviceLevel === 'CERTIFIED_RETURN_RECEIPT' && (
                <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800/80 mt-3">
                  <span className="font-semibold text-slate-300">Electronic Return Receipt:</span>{' '}
                  This service was selected for the order. Any record supplied by USPS will appear when available.
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
                Sender (Return Address)
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
                title="Prepared Notice HTML Snapshot"
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
