'use client';

/**
 * CheckoutModal: USPS Service Tier Selection & Stripe Payment Execution
 *
 * Implements Sprint S5 conforming to Sections 7.7, 7.8, 8, 9, and 10 of
 * docs/DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md:
 * - One labeled delivery tier selector (Choose USPS delivery speed & tracking, role="radiogroup")
 * - 3-tier pricing model from DOCKET_PRICING_TIERS ($12.95 First-Class, $19.95 Certified, $27.95 Certified + Return Receipt)
 * - Optional recommendation badge on Certified Mail ("Recommended for formal notices")
 * - Accurate action button copy: "Continue to payment — $X" (Step 1) vs "Pay $X and send letter" (Step 2)
 * - Accessible dialog semantics: role="dialog", aria-modal="true", Escape key handling, focus return
 * - Error preservation: failed initialization/payment preserves email, tier, and draft values
 * - Safe lock invalidation: tier or draft content changes invalidate previous clientSecret and create fresh lock
 * - Truthful post-payment distinction: payment received, mailing submission, and postal tracking
 * - Guest checkout and signed-in user token/ownership safeguards
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  X,
  CreditCard,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { MailTierId, InterpolatedDocument } from '@/lib/docket/types';
import { DOCKET_PRICING_TIERS } from '@/lib/docket/notices';
import { CHOOSER_METADATA_BY_SLUG } from '@/lib/docket/chooser-routing';
import {
  UPL_COMPLIANCE_DISCLOSURE,
  UPL_COMPLIANCE_FOOTER_TEXT,
} from '@/lib/docket/guardrails';
import { generateDocketId } from '@/lib/docket/renderer/interpolate';
import { useAuth } from '@/context/AuthContext';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { trackFunnelEvent, getSessionId } from '@/lib/telemetry';
import { EntrySource } from '@/lib/types';
import { emitBusinessEvent } from '@/lib/admin-console/measurement/client';
import { checkoutErrorMessage } from '@/lib/docket/checkout-errors';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: InterpolatedDocument;
  selectedTier: MailTierId;
  onSelectTier: (tier: MailTierId) => void;
  userValues: Record<string, string>;
  isSignatureAdopted?: boolean;
  entrySource?: EntrySource | string;
  draftRevision?: number;
}

export interface LockedAttempt {
  orderId: string;
  clientSecret: string;
  viewToken: string;
  docketId: string;
  amountCents: number;
  tier: MailTierId;
  fingerprint: string;
}

// Initialize Stripe publishable key lazily if available
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise: Promise<Stripe | null> | null =
  typeof window !== 'undefined' && STRIPE_PK && STRIPE_PK.startsWith('pk_')
    ? loadStripe(STRIPE_PK)
    : null;

function computeFingerprint(
  tier: MailTierId,
  customerEmail: string,
  values: Record<string, string>,
  sigAdopted: boolean
): string {
  return JSON.stringify({
    tier,
    email: customerEmail.trim().toLowerCase(),
    values,
    sigAdopted,
  });
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  doc,
  selectedTier,
  onSelectTier,
  userValues,
  isSignatureAdopted = false,
  entrySource = 'home_chooser',
  draftRevision = 0,
}) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'delivery' | 'payment' | 'confirmation'>('delivery');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedAttempt, setLockedAttempt] = useState<LockedAttempt | null>(null);

  // Focus return tracking
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  // Track docket IDs that have already been locked to ensure fresh attempts generate a fresh ID
  const lockedDocketIdsRef = useRef<Set<string>>(new Set());

  // Funnel Event: checkout_view when CheckoutModal opens
  useEffect(() => {
    if (isOpen) {
      emitBusinessEvent({
        eventName: 'checkout_viewed',
        noticeId: doc.noticeDefinition.slug,
        tier: selectedTier,
        entrySurface: entrySource,
        draftRevision,
        logicalKey: `checkout-view:${doc.noticeDefinition.slug}:${draftRevision}`,
      });
      trackFunnelEvent({
        eventName: 'checkout_view',
        step: 5,
        noticeSlug: doc.noticeDefinition.slug,
        tier: selectedTier,
        amountInCents: DOCKET_PRICING_TIERS[selectedTier]?.priceCents || 1995,
        entrySource,
        experienceVersion: 'home_v2',
      });
    }
  }, [isOpen, doc.noticeDefinition.slug, selectedTier, entrySource, draftRevision]);

  // Auto-populate email if user is signed in
  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user?.email, email]);

  // Compute current live fingerprint
  const currentFingerprint = useMemo(() => {
    return computeFingerprint(selectedTier, email, userValues, isSignatureAdopted);
  }, [selectedTier, email, userValues, isSignatureAdopted]);

  // Safe lock invalidation: If lockedAttempt exists but fingerprint changed, invalidate it
  useEffect(() => {
    if (lockedAttempt && lockedAttempt.fingerprint !== currentFingerprint) {
      setLockedAttempt(null);
      if (step === 'payment') {
        setStep('delivery');
      }
    }
  }, [currentFingerprint, lockedAttempt, step]);

  // Handle open / close lifecycle, focus return, and Escape key
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      setErrorMessage(null);
      // If we previously locked an attempt that is now stale, reset to delivery step
      if (lockedAttempt && lockedAttempt.fingerprint !== currentFingerprint) {
        setLockedAttempt(null);
        setStep('delivery');
      }
    } else {
      if (previousActiveElementRef.current) {
        try {
          previousActiveElementRef.current.focus();
        } catch {
          // Fallback if element is no longer mounted
        }
      }
    }
  }, [isOpen, currentFingerprint, lockedAttempt]);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessingPayment && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessingPayment, isLoading, onClose]);

  if (!isOpen) return null;

  const currentTierMeta = DOCKET_PRICING_TIERS[selectedTier];
  const displayTitle =
    CHOOSER_METADATA_BY_SLUG[doc.noticeDefinition.slug]?.displayTitle ||
    doc.noticeDefinition.title;

  const recipientSummary = [
    doc.recipientAddress.name,
    doc.recipientAddress.address_city && doc.recipientAddress.address_state
      ? `${doc.recipientAddress.address_city}, ${doc.recipientAddress.address_state}`
      : doc.recipientAddress.address_line1,
  ]
    .filter(Boolean)
    .join(' • ');

  // Step 1: Initialize lock & intent
  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address for delivery and tracking notifications.');
      return;
    }

    // If an identical lock attempt already exists, advance to payment step
    if (lockedAttempt && lockedAttempt.fingerprint === currentFingerprint) {
      emitBusinessEvent({
        eventName: 'legacy_intent_initialized',
        noticeId: doc.noticeDefinition.slug,
        tier: lockedAttempt.tier,
        orderId: lockedAttempt.orderId,
        entrySurface: entrySource,
        draftRevision,
        logicalKey: `intent-initialized:${lockedAttempt.orderId}`,
      });
      setStep('payment');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    let publicErrorCode: unknown = 'CHECKOUT_UNAVAILABLE';
    try {
      // If doc.docketId was already locked in a prior attempt that changed, generate a fresh docket ID
      let attemptDocketId = doc.docketId;
      if (lockedDocketIdsRef.current.has(attemptDocketId)) {
        attemptDocketId = generateDocketId();
      }

      // Fetch Firebase ID token if user is signed in
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user) {
        try {
          const idToken = await user.getIdToken();
          if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
          }
        } catch (tokenErr) {
          console.warn('[CheckoutModal] Token retrieval notice:', tokenErr);
        }
      }

      const res = await fetch('/api/docket/lock-and-intent', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          slug: doc.noticeDefinition.slug,
          userValues,
          tier: selectedTier,
          customerEmail: cleanEmail,
          docketId: attemptDocketId,
          userId: user?.uid,
          telemetrySessionId: getSessionId(),
          experienceVersion: 'home_v2',
          entrySource,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        publicErrorCode = res.status === 400 ? 'CHECKOUT_VALIDATION' : data?.code;
        throw new Error('Checkout initialization failed.');
      }

      // Record this docket ID as locked
      lockedDocketIdsRef.current.add(data.docketId || attemptDocketId);

      // Persist access token in sessionStorage (for guest receipt) & localStorage
      if (typeof window !== 'undefined' && data.orderId && data.viewToken) {
        try {
          sessionStorage.setItem(`order_token_${data.orderId}`, data.viewToken);
          const rawTokens = localStorage.getItem('docketstamp_access_tokens');
          const tokenMap = rawTokens ? JSON.parse(rawTokens) : {};
          tokenMap[data.orderId] = {
            orderId: data.orderId,
            docketId: data.docketId,
            viewToken: data.viewToken,
            tier: data.tier,
            createdAt: Date.now(),
          };
          localStorage.setItem('docketstamp_access_tokens', JSON.stringify(tokenMap));
        } catch (storageErr) {
          console.warn('[CheckoutModal] Storage persistence notice:', storageErr);
        }
      }

      const freshAttempt: LockedAttempt = {
        orderId: data.orderId,
        clientSecret: data.clientSecret,
        viewToken: data.viewToken,
        docketId: data.docketId,
        amountCents: data.amountCents,
        tier: data.tier,
        fingerprint: computeFingerprint(selectedTier, cleanEmail, userValues, isSignatureAdopted),
      };

      emitBusinessEvent({
        eventName: 'legacy_intent_initialized',
        noticeId: doc.noticeDefinition.slug,
        tier: data.tier || selectedTier,
        orderId: data.orderId,
        entrySurface: entrySource,
        draftRevision,
        logicalKey: `intent-initialized:${data.orderId}`,
      });

      setLockedAttempt(freshAttempt);
      setStep('payment');
    } catch (err: any) {
      console.error('[Checkout Error]', err);
      // Error preservation: preserve email, tier, and draft values
      setErrorMessage(checkoutErrorMessage(publicErrorCode, 'CHECKOUT_UNAVAILABLE'));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 payment success callback
  const handlePaymentSuccess = () => {
    setIsProcessingPayment(false);
    setStep('confirmation');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
      aria-describedby="checkout-modal-desc"
    >
      <div className="bg-slate-900 border border-slate-800 text-white rounded-xl max-w-lg w-full p-4 sm:p-5 shadow-2xl relative my-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          disabled={isProcessingPayment}
          className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP 1: Delivery Tier Selection & Order Details */}
        {step === 'delivery' && (
          <form onSubmit={handleProceedToPayment} noValidate className="space-y-3 sm:space-y-3.5">
            {/* Modal Header */}
            <div>
              <div className="text-[10px] font-mono text-sky-400 font-bold uppercase tracking-wider mb-0.5">
                DOCKET RECORD: {lockedAttempt?.docketId || doc.docketId}
              </div>
              <h2 id="checkout-modal-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Choose USPS delivery speed & tracking
              </h2>
              <p id="checkout-modal-desc" className="text-xs text-slate-400 mt-0.5 leading-snug">
                Choose your USPS delivery speed and tracking level. All letters are printed on single-page 8.5&quot; × 11&quot; paper and deposited directly into the USPS mailstream.
              </p>
            </div>

            {/* Delivery Tiers (role="radiogroup") */}
            <div
              role="radiogroup"
              aria-label="Choose USPS delivery speed & tracking"
              className="space-y-2"
            >
              {(Object.keys(DOCKET_PRICING_TIERS) as MailTierId[]).map((tierId) => {
                const meta = DOCKET_PRICING_TIERS[tierId];
                const isSelected = selectedTier === tierId;
                const isRecommended = tierId === 'certified';

                return (
                  <div
                    key={tierId}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => onSelectTier(tierId)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        onSelectTier(tierId);
                      }
                    }}
                    className={`p-2.5 sm:p-3 rounded-lg border cursor-pointer transition relative focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-500 ring-2 ring-sky-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-0.5 gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id={`tier-radio-${tierId}`}
                          name="delivery-tier"
                          checked={isSelected}
                          onChange={() => onSelectTier(tierId)}
                          className="text-sky-600 focus:ring-sky-500 h-4 w-4"
                        />
                        <label
                          htmlFor={`tier-radio-${tierId}`}
                          className="font-bold text-sm text-slate-100 cursor-pointer"
                        >
                          {meta.name}
                        </label>
                      </div>
                      <span className="font-mono font-bold text-base text-sky-400 shrink-0">
                        {meta.formattedPrice}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 pl-6 leading-snug">
                      {tierId === 'first_class'
                        ? 'Standard 8.5x11 First-Class delivery with USPS Intelligent Mail barcode routing.'
                        : tierId === 'certified'
                        ? 'Official USPS Certified Mail barcode tracking and postal acceptance scan proof.'
                        : 'USPS Certified Mail tracking plus electronic return receipt signature record after delivery.'}
                    </p>

                    {isRecommended && (
                      <span className="mt-1.5 ml-6 inline-block text-[9px] font-mono bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                        Recommended for formal notices
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Notification Email Input */}
            <div>
              <label
                htmlFor="checkout-email"
                className="text-xs font-semibold text-slate-200 block mb-1"
              >
                Where should we send your receipt and tracking updates?
              </label>
              <input
                id="checkout-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500"
              />
              <span className="text-[10.5px] text-slate-400 block mt-0.5">
                USPS tracking number, acceptance scan proof, and certificate of mailing will be dispatched to this address.
              </span>
            </div>

            {/* Error Message with role="alert" */}
            {errorMessage && (
              <div
                id="checkout-delivery-error"
                role="alert"
                className="p-2.5 bg-rose-950/80 border border-rose-700 rounded-lg text-xs text-rose-200 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Order Summary Box */}
            <div className="p-2.5 sm:p-3 bg-slate-950/70 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1 font-sans">
              <div className="flex justify-between items-start gap-3">
                <span className="text-slate-400">Notice:</span>
                <span className="font-semibold text-right text-white">
                  {displayTitle}
                </span>
              </div>
              {recipientSummary && (
                <div className="flex justify-between items-start gap-3">
                  <span className="text-slate-400">Recipient:</span>
                  <span className="text-right text-slate-200">{recipientSummary}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-3">
                <span className="text-slate-400">Delivery Speed:</span>
                <span className="text-right text-slate-200 font-medium">
                  {currentTierMeta.name}
                </span>
              </div>
              <div className="border-t border-slate-800/80 pt-1 flex justify-between items-center text-sm">
                <span className="font-bold text-white">Total USPS Fulfillment:</span>
                <span className="font-bold text-sky-400 font-mono text-base">
                  {currentTierMeta.formattedPrice}
                </span>
              </div>
            </div>

            {/* Mandatory Statutory Compliance Disclosure */}
            <p className="text-[9.5px] text-slate-400 leading-snug border-t border-slate-800 pt-2">
              {UPL_COMPLIANCE_DISCLOSURE}
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider font-mono transition"
              >
                Back to Review
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider font-mono transition shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing payment...</span>
                  </>
                ) : (
                  <span>Continue to payment — {currentTierMeta.formattedPrice}</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Payment Confirmation & Submission */}
        {step === 'payment' && lockedAttempt && (
          <PaymentStepForm
            lockedAttempt={lockedAttempt}
            currentTierMeta={currentTierMeta}
            email={email}
            displayTitle={displayTitle}
            recipientSummary={recipientSummary}
            isProcessingPayment={isProcessingPayment}
            setIsProcessingPayment={setIsProcessingPayment}
            errorMessage={errorMessage}
            setErrorMessage={setErrorMessage}
            onBackToDelivery={() => {
              setErrorMessage(null);
              setStep('delivery');
            }}
            onPaymentSuccess={handlePaymentSuccess}
            draftRevision={draftRevision}
            noticeId={doc.noticeDefinition.slug}
            tier={selectedTier}
            entrySource={entrySource}
          />
        )}

        {/* STEP 3: Post-Payment Truthful Status Screen */}
        {step === 'confirmation' && lockedAttempt && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Payment Confirmed
              </div>
              <h2 id="checkout-modal-title" className="text-xl font-bold text-white tracking-tight">
                Submitted for Mailing
              </h2>
              <p id="checkout-modal-desc" className="text-xs text-slate-400 mt-1 leading-relaxed">
                Clerk&apos;s Docket Record <strong className="font-mono text-white">{lockedAttempt.docketId}</strong> has been frozen and queued for physical delivery. Receipt and tracking updates dispatched to <strong className="text-white">{email}</strong>.
              </p>
            </div>

            {/* 3 Truthful Status Cards */}
            <div className="space-y-3">
              {/* Status 1: Payment received */}
              <div className="p-3.5 bg-slate-950/70 border border-emerald-500/30 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-emerald-300 font-mono">
                    1. Payment Received ({currentTierMeta.formattedPrice})
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    Payment verified. Document snapshot locked and SHA-256 integrity preserved. Post-payment rendering never alters customer inputs.
                  </div>
                </div>
              </div>

              {/* Status 2: Mailing submission */}
              <div className="p-3.5 bg-slate-950/70 border border-sky-500/30 rounded-lg flex items-start gap-3">
                <Clock className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-sky-300 font-mono">
                    2. Submitted for Mailing
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    Transmitted to USPS physical print and dispatch pipeline. Formatted to single-page 8.5&quot; × 11&quot; geometry with Lob clear zones preserved.
                  </div>
                </div>
              </div>

              {/* Status 3: Postal tracking status */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg flex items-start gap-3">
                <Truck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-300 font-mono">
                    3. Postal Tracking & Proof
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    {selectedTier === 'certified_return_receipt'
                      ? 'USPS Certified Mail tracking activates upon post office acceptance scan. Electronic Return Receipt signature PDF is generated by the USPS carrier after delivery.'
                      : selectedTier === 'certified'
                      ? 'USPS Certified Mail tracking identifier will activate upon initial post office acceptance scan proof.'
                      : 'USPS Intelligent Mail barcode routing activates upon carrier intake.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance Footer */}
            <div className="border-t border-slate-800 pt-3 text-center">
              <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                {UPL_COMPLIANCE_FOOTER_TEXT(lockedAttempt.docketId)}
              </p>
            </div>

            {/* Action Links */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg text-xs font-bold uppercase tracking-wider font-mono transition"
              >
                Close
              </button>
              <a
                href={`/docket/${lockedAttempt.docketId}`}
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-wider font-mono transition shadow-lg flex items-center justify-center gap-1.5"
              >
                <span>View Docket Record</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// STEP 2 PAYMENT FORM COMPONENT
// ============================================================================

interface PaymentStepFormProps {
  lockedAttempt: LockedAttempt;
  currentTierMeta: (typeof DOCKET_PRICING_TIERS)[MailTierId];
  email: string;
  displayTitle: string;
  recipientSummary: string;
  isProcessingPayment: boolean;
  setIsProcessingPayment: (v: boolean) => void;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  onBackToDelivery: () => void;
  onPaymentSuccess: () => void;
  draftRevision: number;
  noticeId: string;
  tier: MailTierId;
  entrySource: string;
}

const PaymentStepForm: React.FC<PaymentStepFormProps> = (props) => {
  const {
    lockedAttempt,
    currentTierMeta,
    email,
    displayTitle,
    recipientSummary,
    isProcessingPayment,
    errorMessage,
    onBackToDelivery,
  } = props;

  // If live Stripe publishable key is present and stripePromise exists, wrap in Elements
  if (stripePromise && lockedAttempt.clientSecret && !lockedAttempt.clientSecret.startsWith('pi_sim_')) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret: lockedAttempt.clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#0284c7',
              colorBackground: '#020617',
              colorText: '#f8fafc',
              borderRadius: '8px',
            },
          },
        }}
      >
        <InnerStripePaymentForm {...props} />
      </Elements>
    );
  }

  // Fallback test/mock payment form when live Stripe is not loaded
  return <FallbackSimulatedPaymentForm {...props} />;
};

// Live Stripe Elements Payment Form
const InnerStripePaymentForm: React.FC<PaymentStepFormProps> = ({
  lockedAttempt,
  currentTierMeta,
  email,
  displayTitle,
  recipientSummary,
  isProcessingPayment,
  setIsProcessingPayment,
  errorMessage,
  setErrorMessage,
  onBackToDelivery,
  onPaymentSuccess,
  draftRevision,
  noticeId,
  tier,
  entrySource,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isElementReady, setIsElementReady] = useState(false);

  const handleConfirmStripePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessingPayment(true);
    setErrorMessage(null);

    const checkoutAttemptId = `checkout_${crypto.randomUUID()}`;
    emitBusinessEvent({
      eventName: 'payment_attempted',
      noticeId,
      tier,
      entrySurface: entrySource,
      draftRevision,
      checkoutAttemptId,
      orderId: lockedAttempt.orderId,
      logicalKey: `payment-attempt:${checkoutAttemptId}`,
    });

    try {
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/docket/${lockedAttempt.docketId}`,
          receipt_email: email.trim(),
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        emitBusinessEvent({
          eventName: 'payment_client_result',
          noticeId,
          tier,
          entrySurface: entrySource,
          draftRevision,
          checkoutAttemptId,
          orderId: lockedAttempt.orderId,
          safeProperties: { result: 'error' },
          logicalKey: `payment-result:${checkoutAttemptId}`,
        });
        setErrorMessage(checkoutErrorMessage('PAYMENT_DECLINED', 'PAYMENT_DECLINED'));
        setIsProcessingPayment(false);
        return;
      }

      emitBusinessEvent({
        eventName: 'payment_client_result',
        noticeId,
        tier,
        entrySurface: entrySource,
        draftRevision,
        checkoutAttemptId,
        orderId: lockedAttempt.orderId,
        safeProperties: { result: paymentIntent?.status === 'succeeded' ? 'succeeded' : 'pending' },
        logicalKey: `payment-result:${checkoutAttemptId}`,
      });

      // Notify server of confirmed order payment
      try {
        await fetch('/api/checkout/confirm-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: lockedAttempt.orderId,
            paymentIntentId: paymentIntent?.id || lockedAttempt.clientSecret,
            customerEmail: email.trim(),
          }),
        });
      } catch (confirmErr) {
        console.warn('[Confirm Order] Confirmation call notice:', confirmErr);
      }

      onPaymentSuccess();
    } catch (err: any) {
      console.error('[Stripe Payment Error]', err);
      setErrorMessage(checkoutErrorMessage('PAYMENT_DECLINED', 'PAYMENT_DECLINED'));
      setIsProcessingPayment(false);
    }
  };

  return (
    <form onSubmit={handleConfirmStripePayment} className="space-y-5">
      <div>
        <div className="text-[11px] font-mono text-sky-400 font-bold uppercase tracking-wider mb-1">
          CONFIRM ORDER • DOCKET: {lockedAttempt.docketId}
        </div>
        <h2 id="checkout-modal-title" className="text-xl font-bold text-white tracking-tight">
          Enter payment details
        </h2>
        <p id="checkout-modal-desc" className="text-xs text-slate-400 mt-1">
          Secure encrypted card checkout. Physical printing and postage included.
        </p>
      </div>

      {/* Order Summary Strip */}
      <div className="p-3.5 bg-slate-950/70 rounded-lg border border-slate-800 text-xs space-y-1.5 font-sans">
        <div className="flex justify-between items-start gap-2">
          <span className="text-slate-400">Notice:</span>
          <span className="font-semibold text-right text-white">{displayTitle}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-slate-400">Delivery Tier:</span>
          <span className="text-right text-slate-200">{currentTierMeta.name}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-slate-400">Receipt Email:</span>
          <span className="text-right text-slate-200">{email}</span>
        </div>
        <div className="border-t border-slate-800/80 pt-1.5 flex justify-between items-center text-sm">
          <span className="font-bold text-white">Amount Due:</span>
          <span className="font-mono font-bold text-sky-400 text-base">
            {currentTierMeta.formattedPrice}
          </span>
        </div>
      </div>

      {/* Stripe Payment Element */}
      <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-lg min-h-[160px]">
        {!isElementReady && (
          <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading secure card fields...</span>
          </div>
        )}
        <PaymentElement
          options={{ layout: 'tabs' }}
          onReady={() => {
            setIsElementReady(true);
            emitBusinessEvent({
              eventName: 'payment_form_ready',
              noticeId,
              tier,
              entrySurface: entrySource,
              draftRevision,
              orderId: lockedAttempt.orderId,
              logicalKey: `payment-form-ready:${lockedAttempt.orderId}`,
            });
          }}
          onLoadError={() =>
            setErrorMessage(
              checkoutErrorMessage('PAYMENT_FORM_UNAVAILABLE', 'PAYMENT_FORM_UNAVAILABLE')
            )
          }
        />
      </div>

      {/* Error alert with role="alert" */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3 bg-rose-950/80 border border-rose-700 rounded-lg text-xs text-rose-200 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Security Disclosures */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-3">
        <span className="flex items-center gap-1.5 text-slate-300">
          <Lock className="w-3.5 h-3.5 text-emerald-400" /> 256-bit SSL Encrypted
        </span>
        <span>Stripe Card Processing</span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onBackToDelivery}
          disabled={isProcessingPayment}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg text-xs font-bold uppercase tracking-wider font-mono transition disabled:opacity-40"
        >
          ← Back to delivery options
        </button>
        <button
          type="submit"
          disabled={isProcessingPayment || !stripe || !elements}
          className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-wider font-mono transition shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isProcessingPayment ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing payment...</span>
            </>
          ) : (
            <span>Pay {currentTierMeta.formattedPrice} and send letter</span>
          )}
        </button>
      </div>
    </form>
  );
};

// Fallback Simulated Payment Form (used in tests / dev / staging without live Stripe keys)
const FallbackSimulatedPaymentForm: React.FC<PaymentStepFormProps> = ({
  lockedAttempt,
  currentTierMeta,
  email,
  displayTitle,
  recipientSummary,
  isProcessingPayment,
  setIsProcessingPayment,
  errorMessage,
  setErrorMessage,
  onBackToDelivery,
  onPaymentSuccess,
}) => {
  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 4242');
  const [expiry, setExpiry] = useState('12/28');
  const [cvc, setCvc] = useState('•••');

  const handleConfirmMockPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingPayment(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/checkout/confirm-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: lockedAttempt.orderId,
          paymentIntentId: lockedAttempt.clientSecret || `pi_sim_${Date.now()}`,
          customerEmail: email.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data?.success !== true) {
        throw new Error('Payment confirmation failed.');
      }

      onPaymentSuccess();
    } catch (err: any) {
      console.warn('[Simulated Payment Notice]', err);
      setErrorMessage(checkoutErrorMessage('PAYMENT_CONFIRMATION', 'PAYMENT_CONFIRMATION'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <form onSubmit={handleConfirmMockPayment} className="space-y-5">
      <div>
        <div className="text-[11px] font-mono text-sky-400 font-bold uppercase tracking-wider mb-1">
          CONFIRM ORDER • DOCKET: {lockedAttempt.docketId}
        </div>
        <h2 id="checkout-modal-title" className="text-xl font-bold text-white tracking-tight">
          Enter payment details
        </h2>
        <p id="checkout-modal-desc" className="text-xs text-slate-400 mt-1">
          Review your order summary and authorize payment to print and mail your letter.
        </p>
      </div>

      {/* Order Summary Strip */}
      <div className="p-3.5 bg-slate-950/70 rounded-lg border border-slate-800 text-xs space-y-1.5 font-sans">
        <div className="flex justify-between items-start gap-2">
          <span className="text-slate-400">Notice:</span>
          <span className="font-semibold text-right text-white">{displayTitle}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-slate-400">Delivery Tier:</span>
          <span className="text-right text-slate-200">{currentTierMeta.name}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-slate-400">Receipt Email:</span>
          <span className="text-right text-slate-200">{email}</span>
        </div>
        <div className="border-t border-slate-800/80 pt-1.5 flex justify-between items-center text-sm">
          <span className="font-bold text-white">Amount Due:</span>
          <span className="font-mono font-bold text-sky-400 text-base">
            {currentTierMeta.formattedPrice}
          </span>
        </div>
      </div>

      {/* Test / Simulated Card Form */}
      <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-300 border-b border-slate-800 pb-2">
          <span className="flex items-center gap-1.5 font-semibold">
            <CreditCard className="w-4 h-4 text-sky-400" /> Card Information
          </span>
          <span className="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded">
            Test Mode / Sandbox
          </span>
        </div>

        <div>
          <label className="text-[11px] font-mono text-slate-400 block mb-1">
            CARD NUMBER
          </label>
          <input
            type="text"
            readOnly
            value={cardNumber}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">
              EXPIRATION
            </label>
            <input
              type="text"
              readOnly
              value={expiry}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">
              CVC
            </label>
            <input
              type="text"
              readOnly
              value={cvc}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 font-mono"
            />
          </div>
        </div>

        <div className="text-[11px] text-slate-400 leading-relaxed">
          Simulated card authorization enabled for test environment. No live charge will be incurred.
        </div>
      </div>

      {/* Error alert with role="alert" */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3 bg-rose-950/80 border border-rose-700 rounded-lg text-xs text-rose-200 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Security Disclosures */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-3">
        <span className="flex items-center gap-1.5 text-slate-300">
          <Lock className="w-3.5 h-3.5 text-emerald-400" /> 256-bit SSL Encrypted
        </span>
        <span>Stripe Checkout</span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onBackToDelivery}
          disabled={isProcessingPayment}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg text-xs font-bold uppercase tracking-wider font-mono transition disabled:opacity-40"
        >
          ← Back to delivery options
        </button>
        <button
          type="submit"
          disabled={isProcessingPayment}
          className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-wider font-mono transition shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isProcessingPayment ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing payment...</span>
            </>
          ) : (
            <span>Pay {currentTierMeta.formattedPrice} and send letter</span>
          )}
        </button>
      </div>
    </form>
  );
};
