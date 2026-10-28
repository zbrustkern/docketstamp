'use client';

/**
 * CheckoutModal: USPS Service Tier Selection & Stripe Payment Execution
 *
 * Implements Sprint S5 conforming to Sections 7.7, 7.8, 8, 9, and 10 of
 * docs/DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md:
 * - One labeled USPS mailing-service selector (role="radiogroup")
 * - 3-tier pricing model from DOCKET_PRICING_TIERS ($12.95 First-Class, $19.95 Certified, $27.95 Certified + Return Receipt)
 * - Service options without delivery-time or legal-proof guarantees
 * - Action button copy distinguishes payment from later mailing-provider events
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
  MapPin,
} from 'lucide-react';
import { MailTierId, InterpolatedDocument } from '@/lib/docket/types';
import { DOCKET_PRICING_TIERS } from '@/lib/docket/notices';
import { CHOOSER_METADATA_BY_SLUG } from '@/lib/docket/chooser-routing';
import {
  UPL_COMPLIANCE_DISCLOSURE,
  UPL_COMPLIANCE_FOOTER_TEXT,
} from '@/lib/docket/guardrails';
import { generateDocketId } from '@/lib/docket/renderer/interpolate';
import { assessPhysicalFit, physicalFitCustomerMessage } from '@/lib/docket/renderer/physical-fit';
import { PHYSICAL_LAYOUT } from '@/lib/docket/renderer/physical-layout';
import { useAuth } from '@/context/AuthContext';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { trackFunnelEvent, getSessionId } from '@/lib/telemetry';
import { EntrySource } from '@/lib/types';
import { emitBusinessEvent } from '@/lib/admin-console/measurement/client';
import { hasExplicitMarketingConsent } from '@/lib/admin-console/measurement/privacy';
import { checkoutErrorMessage, isTemplateAvailabilityError } from '@/lib/docket/checkout-errors';
import type { AddressVerificationEvidence } from '@/lib/docket/address-verification-client';
import type { WorkspaceWorkflowStep } from '@/lib/docket/workflow-history';
import {
  checkoutFingerprintDigest,
  clearCheckoutRequest,
  clearActiveCheckoutAttempt,
  getCheckoutSessionStorage,
  getOrCreateCheckoutCapability,
  getOrCreateCheckoutRequest,
  loadActiveCheckoutAttempt,
  isActiveCheckoutAttemptUnresolved,
  saveActiveCheckoutAttempt,
  type ActiveCheckoutAttemptRecovery,
} from '@/lib/docket/checkout-recovery';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAvailabilityRefresh?: () => void;
  doc: InterpolatedDocument;
  selectedTier: MailTierId;
  onSelectTier: (tier: MailTierId) => void;
  userValues: Record<string, string>;
  isSignatureAdopted?: boolean;
  isAffirmed?: boolean;
  entrySource?: EntrySource | string;
  draftRevision?: number;
  draftId: string;
  addressVerificationEvidence: Partial<Record<'sender' | 'recipient', AddressVerificationEvidence>>;
  onAddressEvidenceInvalid?: () => void;
  onWorkflowStepChange?: (step: WorkspaceWorkflowStep) => void;
  onCheckoutComplete?: () => void;
  workflowStep?: WorkspaceWorkflowStep;
  onUpdateAddressEvidence?: (evidence: Partial<Record<'sender' | 'recipient', AddressVerificationEvidence>>) => void;
  onApplyFieldValues?: (updates: Record<string, string>) => void;
  onFocusField?: (fieldKey: string) => void;
}

export interface LockedAttempt {
  orderId: string;
  clientSecret: string;
  viewToken: string;
  docketId: string;
  amountCents: number;
  tier: MailTierId;
  fingerprint: string;
  attemptId?: string;
  draftId?: string;
  draftRevision?: number;
  reviewPayload?: string;
  quoteVersion?: string;
  pricingVersion?: string;
  snapshotHash?: string;
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
  sigAdopted: boolean,
  affirmed: boolean
): string {
  return JSON.stringify({
    tier,
    email: customerEmail.trim().toLowerCase(),
    values,
    sigAdopted,
    affirmed,
  });
}

function getCheckoutCapability(draftId: string): string {
  return getOrCreateCheckoutCapability(getCheckoutSessionStorage(), draftId);
}

function FrozenDocumentReview({ html, docketId }: { html: string; docketId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const pageWidth = PHYSICAL_LAYOUT.page.cssWidth;
  const pageHeight = PHYSICAL_LAYOUT.page.cssHeight;
  const scale = Math.min(1, availableWidth > 0 ? availableWidth / pageWidth : 1);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => setAvailableWidth(viewport.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateExpandedState = () => setIsExpanded(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', updateExpandedState);
    return () => document.removeEventListener('fullscreenchange', updateExpandedState);
  }, []);

  const toggleExpandedReview = async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement === container) await document.exitFullscreen();
      else await container.requestFullscreen();
    } catch {
      // The scaled inline preview remains readable if fullscreen is unavailable.
    }
  };

  return (
    <div ref={containerRef} className="space-y-2 rounded bg-slate-950 p-2 fullscreen:bg-slate-950 fullscreen:p-5">
      <div className="flex justify-end">
        <button type="button" onClick={() => void toggleExpandedReview()} aria-pressed={isExpanded}
          className="rounded border border-slate-600 px-2.5 py-1.5 text-xs text-slate-100 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
          {isExpanded ? 'Close full-size review' : 'Open larger review'}
        </button>
      </div>
      <div ref={viewportRef} className="relative mx-auto w-full overflow-hidden rounded border border-slate-600 bg-white"
        style={{ maxWidth: `${pageWidth}px`, height: `${pageHeight * scale}px` }}>
        <iframe title={`Exact frozen letter snapshot for docket ${docketId}`} sandbox="" srcDoc={html}
          referrerPolicy="no-referrer" className="absolute left-0 top-0 border-0 bg-white"
          style={{ width: `${pageWidth}px`, height: `${pageHeight}px`, transform: `scale(${scale})`, transformOrigin: 'top left' }} />
      </div>
    </div>
  );
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose: closeModal,
  onAvailabilityRefresh,
  doc,
  selectedTier,
  onSelectTier,
  userValues,
  isSignatureAdopted = false,
  isAffirmed = false,
  entrySource = 'home_chooser',
  draftRevision = 0,
  draftId,
  addressVerificationEvidence,
  onAddressEvidenceInvalid,
  onCheckoutComplete,
  onWorkflowStepChange,
  workflowStep,
  onUpdateAddressEvidence,
  onApplyFieldValues,
  onFocusField,
}) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'delivery' | 'review' | 'payment' | 'confirmation'>('delivery');
  const [isSuperseding, setIsSuperseding] = useState(false);
  const [supersededAttemptIds] = useState(() => new Set<string>());
  const [activeAttemptRecovery, setActiveAttemptRecovery] = useState<ActiveCheckoutAttemptRecovery | null>(() =>
    loadActiveCheckoutAttempt(getCheckoutSessionStorage(), draftId));
  const [snapshotConfirmed, setSnapshotConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedAttempt, setLockedAttempt] = useState<LockedAttempt | null>(null);
  const [isVerifyingAddresses, setIsVerifyingAddresses] = useState(false);
  const [addressReviewSuggestion, setAddressReviewSuggestion] = useState<{
    role: 'sender' | 'recipient';
    original: { name: string; addressLine1: string; addressLine2?: string; city: string; state: string; zip: string };
    suggested: Record<string, string>;
    evidence?: AddressVerificationEvidence;
  } | null>(null);
  const [addressVerificationIssue, setAddressVerificationIssue] = useState<{
    role: 'sender' | 'recipient';
    message: string;
    addressText: string;
    fieldToFocus: string;
  } | null>(null);
  const availabilityDeniedRef = useRef(false);
  const onClose = () => {
    closeModal();
    if (availabilityDeniedRef.current) {
      availabilityDeniedRef.current = false;
      onAvailabilityRefresh?.();
    }
  };

  // Focus return tracking
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  // Track docket IDs that have already been locked to ensure fresh attempts generate a fresh ID
  const lockedDocketIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setActiveAttemptRecovery(loadActiveCheckoutAttempt(getCheckoutSessionStorage(), draftId));
  }, [draftId]);

  useEffect(() => {
    if (!isOpen) return;
    if (workflowStep === 'delivery') setStep('delivery');
    if (workflowStep === 'payment' && lockedAttempt && snapshotConfirmed) setStep('payment');
    if (workflowStep === 'review' && lockedAttempt?.reviewPayload) setStep('review');
  }, [workflowStep, isOpen, lockedAttempt, snapshotConfirmed]);

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
    return computeFingerprint(selectedTier, email, userValues, isSignatureAdopted, isAffirmed);
  }, [selectedTier, email, userValues, isSignatureAdopted, isAffirmed]);
  const [currentRequestIdentityDigest, setCurrentRequestIdentityDigest] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setCurrentRequestIdentityDigest(null);
    void checkoutFingerprintDigest(`${draftId}:${draftRevision}:${currentFingerprint}`).then((digest) => {
      if (active) setCurrentRequestIdentityDigest(digest);
    });
    return () => { active = false; };
  }, [draftId, draftRevision, currentFingerprint]);
  const currentFingerprintRef = useRef(currentFingerprint);
  currentFingerprintRef.current = currentFingerprint;
  const draftRevisionRef = useRef(draftRevision);
  draftRevisionRef.current = draftRevision;

  const supersedingIdsRef = useRef<Set<string>>(new Set());
  const supersedeAttempt = async (attempt: LockedAttempt | ActiveCheckoutAttemptRecovery) => {
    if (!attempt.attemptId) return false;
    const attemptIdentityDigest = 'identityDigest' in attempt ? attempt.identityDigest : undefined;
    if (supersededAttemptIds.has(attempt.attemptId)) {
      const storage = getCheckoutSessionStorage();
      clearActiveCheckoutAttempt(storage, attempt.draftId || draftId, attempt.attemptId);
      if (attemptIdentityDigest) clearCheckoutRequest(storage, attempt.draftId || draftId, attemptIdentityDigest);
      setActiveAttemptRecovery(null);
      return true;
    }
    if (supersedingIdsRef.current.has(attempt.attemptId)) return false;
    supersedingIdsRef.current.add(attempt.attemptId);
    setIsSuperseding(true);
    setStep('delivery');
    onWorkflowStepChange?.('delivery');
      const attemptDraftId = attempt.draftId || draftId;
      const capability = getCheckoutCapability(attemptDraftId);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user) { try { headers.Authorization = `Bearer ${await user.getIdToken()}`; } catch { /* Guest capability remains scoped. */ } }
      const response = await fetch(`/api/docket/attempts/${encodeURIComponent(attempt.attemptId)}/supersede`, {
        method: 'POST', headers,
        body: JSON.stringify({ checkoutCapability: capability, draftId: attemptDraftId, draftRevision: Math.max(draftRevisionRef.current, attempt.draftRevision || 0) }),
      });
      const resolution = await response.json();
      if (!response.ok || resolution.replacementAllowed !== true) throw new Error('Supersession is unresolved.');
      supersededAttemptIds.add(attempt.attemptId);
      const storage = getCheckoutSessionStorage();
      clearActiveCheckoutAttempt(storage, attemptDraftId, attempt.attemptId);
      if (attemptIdentityDigest) clearCheckoutRequest(storage, attemptDraftId, attemptIdentityDigest);
      setActiveAttemptRecovery(null);
      setLockedAttempt(null);
      setSnapshotConfirmed(false);
      setStep('delivery');
      onWorkflowStepChange?.('delivery');
      return true;
    } catch {
      const recovery: ActiveCheckoutAttemptRecovery = {
        attemptId: attempt.attemptId,
        draftId: attempt.draftId || draftId,
        draftRevision: attempt.draftRevision ?? draftRevisionRef.current,
        ...(attempt.docketId ? { docketId: attempt.docketId } : {}),
        ...(attemptIdentityDigest ? { identityDigest: attemptIdentityDigest } : {}),
      };
      saveActiveCheckoutAttempt(getCheckoutSessionStorage(), recovery);
      setActiveAttemptRecovery(recovery);
      if ('orderId' in attempt && attempt.orderId && attempt.clientSecret) setLockedAttempt(attempt);
      setStep('delivery');
      setErrorMessage('The previous payment attempt is still being resolved. Retry the status check before starting another payment.');
      return false;
    } finally {
      supersedingIdsRef.current.delete(attempt.attemptId);
      setIsSuperseding(false);
    }
  };

  // Safe lock invalidation: If lockedAttempt exists but fingerprint changed, invalidate it
  useEffect(() => {
    if (lockedAttempt && lockedAttempt.fingerprint !== currentFingerprint) {
      void supersedeAttempt(lockedAttempt);
    }
  }, [currentFingerprint, lockedAttempt, step]);

  // Handle open / close lifecycle, focus return, and Escape key
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      setErrorMessage(null);
      // If we previously locked an attempt that is now stale, reset to delivery step
      if (lockedAttempt && lockedAttempt.fingerprint !== currentFingerprint) {
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
  const physicalFit = assessPhysicalFit(doc);
  const unresolvedStaleLockedAttempt = Boolean(lockedAttempt?.attemptId && lockedAttempt.fingerprint !== currentFingerprint);
  const unresolvedRecoveredAttempt = isActiveCheckoutAttemptUnresolved({
    recovery: activeAttemptRecovery,
    currentDraftId: draftId,
    currentIdentityDigest: currentRequestIdentityDigest,
    lockedAttemptId: lockedAttempt?.attemptId,
    lockedAttemptMatchesCurrent: lockedAttempt?.fingerprint === currentFingerprint,
  });
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
  const getMailingAddress = (role: 'sender' | 'recipient', values: Record<string, string> = userValues) => {
    if (role === 'sender') {
      return {
        name: values.senderFullName || '',
        addressLine1: values.senderAddressLine1 || '',
        addressLine2: values.senderAddressLine2 || '',
        city: values.senderCity || '',
        state: values.senderState || '',
        zip: values.senderZip || '',
      };
    }
    return {
      name:
        values.recipientFormalName ||
        values.serviceProviderName ||
        values.collectionAgencyName ||
        values.creditorName ||
        values.disputedAccountName ||
        values.recipientName ||
        'RECIPIENT',
      addressLine1: values.recipientAddressLine1 || '',
      addressLine2: values.recipientAddressLine2 || '',
      city: values.recipientCity || '',
      state: values.recipientState || '',
      zip: values.recipientZip || '',
    };
  };

  const verifyAddressInline = async (
    role: 'sender' | 'recipient',
    rev: number,
    values: Record<string, string> = userValues
  ) => {
    const address = getMailingAddress(role, values);
    try {
      const response = await fetch('/api/docket/verify-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          role,
          draftId,
          draftRevision: rev,
          recipientName: role === 'recipient' ? address.name : undefined,
        }),
      });
      const result = await response.json();
      return { ok: response.ok, status: response.status, result, address };
    } catch {
      return { ok: false, status: 500, result: null, address };
    }
  };

  const executeLockAndIntent = async (
    evidenceMap: Partial<Record<'sender' | 'recipient', AddressVerificationEvidence>>,
    cleanEmail: string,
    overrideRevision?: number,
    overrideValues?: Record<string, string>
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    const activeValues = overrideValues || userValues;
    const originatingFingerprint = overrideValues
      ? computeFingerprint(selectedTier, cleanEmail, activeValues, isSignatureAdopted, isAffirmed)
      : currentFingerprint;
    const originatingRevision = overrideRevision ?? draftRevision;
    let identityDigest = '';

    let publicErrorCode: unknown = 'CHECKOUT_UNAVAILABLE';
    try {
      identityDigest = await checkoutFingerprintDigest(`${draftId}:${originatingRevision}:${originatingFingerprint}`);
      const storage = getCheckoutSessionStorage();
      let defaultDocketId = doc.docketId;
      if (lockedDocketIdsRef.current.has(defaultDocketId)) defaultDocketId = generateDocketId();
      const requestIdentity = getOrCreateCheckoutRequest(storage, {
        draftId,
        draftRevision: originatingRevision,
        identityDigest,
        docketId: defaultDocketId,
      });
      if (activeAttemptRecovery && activeAttemptRecovery.draftId === draftId &&
          activeAttemptRecovery.identityDigest !== identityDigest) {
        const resolved = await supersedeAttempt(activeAttemptRecovery);
        if (resolved) {
          clearCheckoutRequest(storage, draftId, identityDigest);
          setErrorMessage('The previous checkout was safely resolved. Review the delivery details and continue again.');
        }
        return;
      }
      if (!physicalFit.fits) {
        setErrorMessage(physicalFitCustomerMessage(physicalFit.failure));
        setIsLoading(false);
        return;
      }
      const attemptDocketId = requestIdentity.docketId;

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
          userValues: activeValues,
          draftId,
          draftRevision: originatingRevision,
          checkoutCapability: getCheckoutCapability(draftId),
          idempotencyKey: requestIdentity.idempotencyKey,
          verificationEvidence: { sender: evidenceMap.sender, recipient: evidenceMap.recipient },
          tier: selectedTier,
          customerEmail: cleanEmail,
          docketId: attemptDocketId,
          userId: user?.uid,
          telemetrySessionId: getSessionId(),
          experienceVersion: 'home_v2',
          entrySource,
          marketingConsent: hasExplicitMarketingConsent(),
          signatureAdoption: {
            adopted: isSignatureAdopted,
            affirmed: isAffirmed,
            signerName: activeValues.senderFullName || '',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 'ADDRESS_NORMALIZATION_REVIEW_REQUIRED' && data.suggestedAddress) {
          const role = (data.role as 'sender' | 'recipient') || 'recipient';
          const original = getMailingAddress(role, activeValues);
          setAddressReviewSuggestion({
            role,
            original,
            suggested: {
              [role === 'sender' ? 'senderAddressLine1' : 'recipientAddressLine1']: data.suggestedAddress.addressLine1,
              [role === 'sender' ? 'senderAddressLine2' : 'recipientAddressLine2']: data.suggestedAddress.addressLine2 || '',
              [role === 'sender' ? 'senderCity' : 'recipientCity']: data.suggestedAddress.city,
              [role === 'sender' ? 'senderState' : 'recipientState']: data.suggestedAddress.state,
              [role === 'sender' ? 'senderZip' : 'recipientZip']: data.suggestedAddress.zip,
            },
          });
          setStep('delivery');
          onWorkflowStepChange?.('delivery');
          setIsLoading(false);
          return;
        }

        if (data?.code === 'ADDRESS_VERIFICATION_FAILED') {
          const role = (data.role as 'sender' | 'recipient') || 'recipient';
          const address = getMailingAddress(role, activeValues);
          const addressText = [address.addressLine1, address.addressLine2, `${address.city}, ${address.state} ${address.zip}`].filter(Boolean).join(' · ');
          setAddressVerificationIssue({
            role,
            message: data.error || data.detail || `USPS could not confirm delivery to this ${role} address.`,
            addressText,
            fieldToFocus: role === 'sender' ? 'senderAddressLine1' : 'recipientAddressLine1',
          });
          setStep('delivery');
          onWorkflowStepChange?.('delivery');
          setIsLoading(false);
          return;
        }

        if (['ADDRESS_VERIFICATION_REQUIRED', 'ADDRESS_VERIFICATION_STALE'].includes(data?.code)) {
          onAddressEvidenceInvalid?.();
          setErrorMessage('Verifying fresh address evidence with USPS. Please try continuing again.');
          setStep('delivery');
          onWorkflowStepChange?.('delivery');
          setIsLoading(false);
          return;
        }

        if (data?.code === 'CHECKOUT_ATTEMPT_BUSY' && data.attemptId) {
          const recovery = {
            attemptId: String(data.attemptId), draftId, draftRevision: originatingRevision,
            docketId: requestIdentity.docketId, identityDigest,
          };
          saveActiveCheckoutAttempt(storage, recovery);
          setActiveAttemptRecovery(recovery);
          setErrorMessage('Checkout is still initializing. Retry this same checkout to recover the original attempt.');
          return;
        }
        if (data?.code === 'CHECKOUT_ATTEMPT_ACTIVE' && data.attemptId) {
          const recovery = {
            attemptId: String(data.attemptId), draftId, draftRevision: Number(data.draftRevision ?? originatingRevision),
            ...(typeof data.docketId === 'string' ? { docketId: data.docketId } : {}),
          };
          saveActiveCheckoutAttempt(storage, recovery);
          setActiveAttemptRecovery(recovery);
          await supersedeAttempt(recovery);
          clearCheckoutRequest(storage, draftId, identityDigest);
          return;
        }
        availabilityDeniedRef.current = isTemplateAvailabilityError(data?.code);
        publicErrorCode = res.status === 400 && !availabilityDeniedRef.current ? 'CHECKOUT_VALIDATION' : data?.code;
        throw new Error('Checkout initialization failed.');
      }

      if (originatingRevision !== draftRevisionRef.current || originatingFingerprint !== currentFingerprintRef.current) {
        if (data.attemptId) {
          const staleAttempt = { ...data, fingerprint: originatingFingerprint } as LockedAttempt;
          setLockedAttempt(staleAttempt);
          await supersedeAttempt(staleAttempt);
        }
        setErrorMessage('Your draft changed while checkout was being prepared. Review the latest version before continuing.');
        return;
      }

      // Record this docket ID as locked
      lockedDocketIdsRef.current.add(data.docketId || attemptDocketId);
      const activeRecovery = {
        attemptId: String(data.attemptId), draftId: data.draftId || draftId,
        draftRevision: Number(data.draftRevision ?? originatingRevision),
        docketId: data.docketId || attemptDocketId, identityDigest,
      };
      saveActiveCheckoutAttempt(storage, activeRecovery);
      setActiveAttemptRecovery(activeRecovery);

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
        fingerprint: originatingFingerprint,
        attemptId: data.attemptId, draftId: data.draftId || draftId, draftRevision: data.draftRevision ?? originatingRevision,
        reviewPayload: data.reviewPayload, quoteVersion: data.quoteVersion, pricingVersion: data.pricingVersion, snapshotHash: data.snapshotHash,
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
      setSnapshotConfirmed(false);
      setStep(freshAttempt.reviewPayload ? 'review' : 'payment');
      onWorkflowStepChange?.(freshAttempt.reviewPayload ? 'review' : 'payment');
    } catch (err: any) {
      console.error('[Checkout Error]', err);
      setErrorMessage(checkoutErrorMessage(publicErrorCode, 'CHECKOUT_UNAVAILABLE'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isVerifyingAddresses || isSuperseding) return;
    if (lockedAttempt && lockedAttempt.fingerprint !== currentFingerprint) {
      await supersedeAttempt(lockedAttempt);
      return;
    }
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address for order information.');
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
      setStep(lockedAttempt.reviewPayload ? 'review' : 'payment');
      onWorkflowStepChange?.(lockedAttempt.reviewPayload ? 'review' : 'payment');
      return;
    }

    setErrorMessage(null);
    setAddressVerificationIssue(null);
    setAddressReviewSuggestion(null);

    // Auto-verify addresses if missing or stale for current draftRevision
    const effectiveEvidence: Partial<Record<'sender' | 'recipient', AddressVerificationEvidence>> = {
      ...addressVerificationEvidence,
    };
    const isSenderStaleOrMissing =
      !effectiveEvidence.sender || effectiveEvidence.sender.payload.draftRevision !== draftRevision;
    const isRecipientStaleOrMissing =
      !effectiveEvidence.recipient || effectiveEvidence.recipient.payload.draftRevision !== draftRevision;

    if (isSenderStaleOrMissing || isRecipientStaleOrMissing) {
      setIsVerifyingAddresses(true);
      const rolesToVerify: Array<'sender' | 'recipient'> = [];
      if (isSenderStaleOrMissing) rolesToVerify.push('sender');
      if (isRecipientStaleOrMissing) rolesToVerify.push('recipient');

      const updatedEvidence: Partial<Record<'sender' | 'recipient', AddressVerificationEvidence>> = {};

      for (const role of rolesToVerify) {
        const { ok, status, result, address } = await verifyAddressInline(role, draftRevision);
        if (!ok || !result?.valid || !result?.evidence) {
          setIsVerifyingAddresses(false);
          const message =
            status === 429
              ? 'Address checking is temporarily rate limited. Please try again in a few moments.'
              : status >= 500
              ? 'Address checking is temporarily unavailable. Please retry before checkout.'
              : result?.code === 'ADDRESS_UNDELIVERABLE'
              ? `USPS could not confirm delivery to this ${role === 'sender' ? 'sender' : 'recipient'} address. Check the street, unit, city, state, and ZIP.`
              : result?.error || `This ${role === 'sender' ? 'sender' : 'recipient'} address could not be verified by USPS.`;
          const addressText = [address.addressLine1, address.addressLine2, `${address.city}, ${address.state} ${address.zip}`].filter(Boolean).join(' · ');
          setAddressVerificationIssue({
            role,
            message,
            addressText,
            fieldToFocus: role === 'sender' ? 'senderAddressLine1' : 'recipientAddressLine1',
          });
          return;
        }

        const normalized = result.standardizedAddress;
        const suggested = {
          [role === 'sender' ? 'senderAddressLine1' : 'recipientAddressLine1']: normalized.primary_line || address.addressLine1,
          [role === 'sender' ? 'senderAddressLine2' : 'recipientAddressLine2']: normalized.secondary_line || '',
          [role === 'sender' ? 'senderCity' : 'recipientCity']: normalized.city || address.city,
          [role === 'sender' ? 'senderState' : 'recipientState']: normalized.state || address.state,
          [role === 'sender' ? 'senderZip' : 'recipientZip']: normalized.zip_code_plus_4 ? `${normalized.zip_code}-${normalized.zip_code_plus_4}` : normalized.zip_code || address.zip,
        };
        const isChanged = Object.entries(suggested).some(
          ([key, value]) => (userValues[key] || '').trim().toUpperCase() !== value.trim().toUpperCase()
        );

        if (isChanged) {
          setIsVerifyingAddresses(false);
          setAddressReviewSuggestion({
            role,
            original: address,
            suggested,
            evidence: result.evidence,
          });
          return;
        }

        updatedEvidence[role] = result.evidence;
        effectiveEvidence[role] = result.evidence;
      }

      setIsVerifyingAddresses(false);
      onUpdateAddressEvidence?.(updatedEvidence);
    }

    await executeLockAndIntent(effectiveEvidence, cleanEmail);
  };

  const handleApplyAddressSuggestion = async (suggestion: {
    role: 'sender' | 'recipient';
    original: { name: string; addressLine1: string; addressLine2?: string; city: string; state: string; zip: string };
    suggested: Record<string, string>;
    evidence?: AddressVerificationEvidence;
  }) => {
    setIsVerifyingAddresses(true);
    setAddressReviewSuggestion(null);
    onApplyFieldValues?.(suggestion.suggested);

    const mergedValues = {
      ...userValues,
      ...suggestion.suggested,
    };
    const nextRev = draftRevisionRef.current + 1;
    const cleanEmail = email.trim();

    const { ok, status, result, address } = await verifyAddressInline(suggestion.role, nextRev, mergedValues);
    setIsVerifyingAddresses(false);

    if (!ok || !result?.valid || !result?.evidence) {
      const message =
        status === 429
          ? 'Address checking is temporarily rate limited. Please try again later.'
          : result?.error || 'Could not verify standardized address with USPS. Please check the address details.';
      setAddressVerificationIssue({
        role: suggestion.role,
        message,
        addressText: [address.addressLine1, address.addressLine2, `${address.city}, ${address.state} ${address.zip}`].filter(Boolean).join(' · '),
        fieldToFocus: suggestion.role === 'sender' ? 'senderAddressLine1' : 'recipientAddressLine1',
      });
      return;
    }

    const updatedMap = {
      ...addressVerificationEvidence,
      [suggestion.role]: result.evidence,
    };
    onUpdateAddressEvidence?.({ [suggestion.role]: result.evidence });
    await executeLockAndIntent(updatedMap, cleanEmail, nextRev, mergedValues);
  };

  const handleKeepOriginalAddress = async (suggestion: {
    role: 'sender' | 'recipient';
    original: { name: string; addressLine1: string; addressLine2?: string; city: string; state: string; zip: string };
    suggested: Record<string, string>;
    evidence?: AddressVerificationEvidence;
  }) => {
    setAddressReviewSuggestion(null);
    const cleanEmail = email.trim();
    if (suggestion.evidence) {
      const updatedMap = {
        ...addressVerificationEvidence,
        [suggestion.role]: suggestion.evidence,
      };
      onUpdateAddressEvidence?.({ [suggestion.role]: suggestion.evidence });
      await executeLockAndIntent(updatedMap, cleanEmail, draftRevisionRef.current);
    }
  };

  const handleConfirmSnapshot = () => {
    if (!lockedAttempt?.reviewPayload || lockedAttempt.fingerprint !== currentFingerprint || isSuperseding) return;
    setSnapshotConfirmed(true);
    setStep('payment');
    onWorkflowStepChange?.('payment');
  };

  // Step 2 payment success callback
  const handlePaymentSuccess = () => {
    onCheckoutComplete?.();
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
                ORDER REFERENCE: {lockedAttempt?.docketId || doc.docketId}
              </div>
              <h2 id="checkout-modal-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Choose a USPS mailing service
              </h2>
              <p id="checkout-modal-desc" className="text-xs text-slate-400 mt-0.5 leading-snug">
                Select the mailing service for this order. Delivery time, tracking, and available postal records depend on USPS and provider updates.
              </p>
            </div>

            {/* Delivery Tiers (role="radiogroup") */}
            <div
              role="radiogroup"
              aria-label="Choose USPS mailing service"
              className="space-y-2"
            >
              {(Object.keys(DOCKET_PRICING_TIERS) as MailTierId[]).map((tierId) => {
                const meta = DOCKET_PRICING_TIERS[tierId];
                const isSelected = selectedTier === tierId;

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
                        ? 'USPS First-Class Mail; tracking information may be limited.'
                        : tierId === 'certified'
                        ? 'USPS Certified Mail; tracking and postal records appear when available.'
                        : 'USPS Certified Mail with an Electronic Return Receipt request; any returned record appears when available.'}
                    </p>
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
                Where should we send your order email?
              </label>
              <input
                id="checkout-email"
                aria-invalid={errorMessage ? (!email.trim() || !email.includes('@') || !email.includes('.')) : undefined}
                aria-describedby={errorMessage ? "checkout-delivery-error" : undefined}
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
                We use this email for order information and any status message sent by the provider.
              </span>
            </div>

            {/* Error Message with role="alert" */}
            {!physicalFit.fits && (
              <div role="alert" className="p-2.5 bg-amber-950/70 border border-amber-700 rounded-lg text-xs text-amber-100">
                {physicalFitCustomerMessage(physicalFit.failure)}
              </div>
            )}
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

            {/* Inline Address Verification Delivery Issue */}
            {addressVerificationIssue && (
              <div
                role="alert"
                className="p-3 bg-rose-950/85 border border-rose-700 rounded-lg text-xs text-rose-200 space-y-2"
              >
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>USPS Delivery Issue ({addressVerificationIssue.role === 'sender' ? 'Sender' : 'Recipient'} Address)</span>
                </div>
                <p className="leading-snug text-rose-200">{addressVerificationIssue.message}</p>
                <div className="font-mono text-[11px] p-2 bg-slate-900/90 rounded border border-rose-900/50 text-slate-300">
                  {addressVerificationIssue.addressText}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const field = addressVerificationIssue.fieldToFocus;
                      setAddressVerificationIssue(null);
                      if (onFocusField) {
                        onFocusField(field);
                      } else {
                        onClose();
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-900/60 hover:bg-rose-900 text-white font-medium text-xs transition"
                  >
                    Edit {addressVerificationIssue.role === 'sender' ? 'Sender' : 'Recipient'} Address
                  </button>
                </div>
              </div>
            )}

            {/* Inline USPS Address Standardization Suggestion */}
            {addressReviewSuggestion && (
              <div
                role="region"
                aria-label="USPS Address Suggestion"
                className="p-3 bg-sky-950/90 border border-sky-600/70 rounded-lg text-xs text-sky-100 space-y-2.5"
              >
                <div className="flex items-center gap-2 font-bold text-sky-300">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>USPS Address Standardization Suggested ({addressReviewSuggestion.role === 'sender' ? 'Sender' : 'Recipient'})</span>
                </div>
                <p className="text-slate-300 text-[11.5px] leading-relaxed">
                  USPS confirmed deliverability and recommended standardized postal formatting. Choose an option to continue:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-slate-900/90 rounded border border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-mono block text-[10px] uppercase">As Entered:</span>
                    <span className="text-slate-300 font-medium">
                      {[
                        addressReviewSuggestion.original.addressLine1,
                        addressReviewSuggestion.original.addressLine2,
                        `${addressReviewSuggestion.original.city}, ${addressReviewSuggestion.original.state} ${addressReviewSuggestion.original.zip}`
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-400 font-mono block text-[10px] uppercase">USPS Standardized:</span>
                    <span className="text-white font-medium">
                      {[
                        addressReviewSuggestion.suggested[addressReviewSuggestion.role === 'sender' ? 'senderAddressLine1' : 'recipientAddressLine1'],
                        addressReviewSuggestion.suggested[addressReviewSuggestion.role === 'sender' ? 'senderAddressLine2' : 'recipientAddressLine2'],
                        `${addressReviewSuggestion.suggested[addressReviewSuggestion.role === 'sender' ? 'senderCity' : 'recipientCity']}, ${addressReviewSuggestion.suggested[addressReviewSuggestion.role === 'sender' ? 'senderState' : 'recipientState']} ${addressReviewSuggestion.suggested[addressReviewSuggestion.role === 'sender' ? 'senderZip' : 'recipientZip']}`
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => void handleApplyAddressSuggestion(addressReviewSuggestion)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition shadow-sm"
                  >
                    Apply USPS Standardized Address
                  </button>
                  {addressReviewSuggestion.evidence && (
                    <button
                      type="button"
                      onClick={() => void handleKeepOriginalAddress(addressReviewSuggestion)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition border border-slate-700"
                    >
                      Keep Entered Address
                    </button>
                  )}
                </div>
              </div>
            )}
            {lockedAttempt?.attemptId && lockedAttempt.fingerprint !== currentFingerprint && (
              <button type="button" onClick={() => { supersedingIdsRef.current.delete(lockedAttempt.attemptId!); void supersedeAttempt(lockedAttempt); }} disabled={isSuperseding} className="rounded border border-amber-700 px-3 py-2 text-xs text-amber-100 disabled:opacity-50">
                {isSuperseding ? 'Resolving prior payment…' : 'Retry prior payment status check'}
              </button>
            )}
            {activeAttemptRecovery && (!lockedAttempt || lockedAttempt.attemptId !== activeAttemptRecovery.attemptId) && (
              <button type="button" onClick={() => { supersedingIdsRef.current.delete(activeAttemptRecovery.attemptId); void supersedeAttempt(activeAttemptRecovery); }} disabled={isSuperseding} className="rounded border border-amber-700 px-3 py-2 text-xs text-amber-100 disabled:opacity-50">
                {isSuperseding ? 'Resolving prior payment…' : 'Retry prior payment status check'}
              </button>
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
                <span className="text-slate-400">Mailing Service:</span>
                <span className="text-right text-slate-200 font-medium">
                  {currentTierMeta.name}
                </span>
              </div>
              <div className="border-t border-slate-800/80 pt-1 flex justify-between items-center text-sm">
                <span className="font-bold text-white">Total:</span>
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
                disabled={isLoading || isVerifyingAddresses || isSuperseding || unresolvedStaleLockedAttempt || unresolvedRecoveredAttempt || !physicalFit.fits}
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider font-mono transition shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isVerifyingAddresses ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking USPS delivery…</span>
                  </>
                ) : isLoading ? (
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

        {step === 'review' && lockedAttempt && (
          <section className="space-y-3" aria-labelledby="frozen-review-title">
            <div><p className="text-[10px] font-mono text-sky-400">FROZEN ORDER REVIEW · {lockedAttempt.docketId}</p>
              <h2 id="frozen-review-title" className="text-lg font-bold">Review the exact letter that will be mailed</h2>
              <p className="text-xs text-slate-300">This is the immutable document saved before payment. Payment stays unavailable until you confirm this snapshot.</p></div>
            {lockedAttempt.reviewPayload ? <FrozenDocumentReview html={lockedAttempt.reviewPayload} docketId={lockedAttempt.docketId} /> : <p role="alert" className="text-sm text-amber-200">The server did not return the frozen document for review. Return to delivery and retry.</p>}
            <div className="rounded border border-slate-700 bg-slate-800 p-3 text-xs text-slate-200">{UPL_COMPLIANCE_DISCLOSURE}<p className="mt-2">{UPL_COMPLIANCE_FOOTER_TEXT(lockedAttempt.docketId)}</p></div>
            <div className="flex justify-between gap-3"><button type="button" onClick={() => { setStep('delivery'); onWorkflowStepChange?.('delivery'); }} className="rounded border border-slate-600 px-3 py-2 text-sm">Back to delivery</button>
              <button type="button" onClick={handleConfirmSnapshot} disabled={!lockedAttempt.reviewPayload || isSuperseding} className="rounded bg-sky-700 px-4 py-2 text-sm font-bold disabled:opacity-50">I reviewed this exact letter · Continue to payment</button></div>
          </section>
        )}

        {/* STEP 2: Payment Confirmation & Submission */}
        {step === 'payment' && lockedAttempt && snapshotConfirmed && (
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
                Order recorded
              </h2>
              <p id="checkout-modal-desc" className="text-xs text-slate-400 mt-1 leading-relaxed">
                Payment confirmation is recorded for order <strong className="font-mono text-white">{lockedAttempt.docketId}</strong>. See the order record for processing and postal updates when available. Payment confirmation does not establish USPS acceptance or delivery.
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
                    The locked document includes a SHA-256 integrity digest and a dated record of typed-name adoption. This records the prepared content; it does not assess legal validity. Post-payment rendering uses the saved snapshot.
                  </div>
                </div>
              </div>

              {/* Status 2: Fulfillment status */}
              <div className="p-3.5 bg-slate-950/70 border border-sky-500/30 rounded-lg flex items-start gap-3">
                <Clock className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-sky-300 font-mono">
                    2. Order processing
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    Check the order record for current processing status. Payment confirmation does not establish postal-provider submission.
                  </div>
                </div>
              </div>

              {/* Status 3: Postal tracking status */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg flex items-start gap-3">
                <Truck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-300 font-mono">
                    3. Provider updates and records
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    {selectedTier === 'certified_return_receipt'
                      ? 'Tracking and Electronic Return Receipt records are shown if the postal provider supplies them.'
                      : selectedTier === 'certified'
                      ? 'Tracking and acceptance records are shown if the postal provider supplies them.'
                      : 'Available First-Class Mail status information may be limited.'}
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
                <span>View order status</span>
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
            <span>Pay {currentTierMeta.formattedPrice} and submit order</span>
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
            <span>Pay {currentTierMeta.formattedPrice} and submit order</span>
          )}
        </button>
      </div>
    </form>
  );
};
