'use client';

/**
 * DocumentWorkspace: DocuSign-Style Interactive Document Preparation Workspace
 *
 * Implements Section 3 of docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md, Section 4 of DOCKETSTAMP_AGENTIC_EXPANSION.md,
 * and Sprint S4 of docs/DOCKETSTAMP_HOME_REDESIGN_SPRINTS.md:
 * - 3-stage customer progression: 1. Letter details -> 2. Review and sign -> 3. Delivery and payment
 * - Real validation, honest progress counts, and first-invalid-field focus
 * - Session-scoped draft recovery with strict URL prefill precedence
 * - User-edit protection: late hydration never overwrites user edits
 * - Revision-tied signature invalidation and address re-verification invalidation
 * - Preview token clicks focus drawer inputs and open mobile drawer
 * - Verbatim statutory affirmations and UPL disclosures
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  NoticeTemplateDefinition,
  MailTierId,
  AddressVerificationStatus,
} from '@/lib/docket/types';
import { getNoticeBySlug } from '@/lib/docket/notices';
import { interpolateNotice, generateDocketId } from '@/lib/docket/renderer/interpolate';
import { assessPhysicalFit } from '@/lib/docket/renderer/physical-fit';
import { LivePaperSheet } from './LivePaperSheet';
import { GuidedFieldDrawer } from './GuidedFieldDrawer';
import { lookupPostalCodeLocally } from './postal-code-lookup-client';
import { StickyExecutionBar } from './StickyExecutionBar';
import { CheckoutModal } from './CheckoutModal';
import { AgentStagedBanner } from './AgentStagedBanner';
import { useAgentHydration } from '@/hooks/useAgentHydration';
import { useWebMcpTools } from '@/hooks/useWebMcpTools';
import {
  validateNoticeDraft,
  saveNoticeDraft,
  clearNoticeDraft,
  resolveInitialWorkspaceDraft,
  getOrCreateDraftIdentity,
  isDraftStorageScopeCurrent,
} from '@/lib/docket/draft-recovery';
import { trackFunnelEvent } from '@/lib/telemetry';
import { EntrySource } from '@/lib/types';
import { useTemplateAvailability } from '@/src/hooks/useTemplateAvailability';
import { evaluateTemplateAvailability } from '@/src/lib/docket/template-policy';
import { TemplateLocationFields } from './TemplateLocationFields';
import { emitBusinessEvent } from '@/lib/admin-console/measurement/client';
import { useAuth } from '@/context/AuthContext';
import { resolveHistoryNavigation, safeWorkflowUrl, writeWorkflowHistory, workflowStepFromHistoryState, type WorkspaceWorkflowStep } from '@/lib/docket/workflow-history';
import { isAddressEvidenceCurrent, isCurrentAddressVerificationResponse, type AddressVerificationEvidence, type VerifiedAddressRole } from '@/lib/docket/address-verification-client';
import { addressVerificationStatusLabel } from '@/lib/docket/address-verification-status';

export interface DocumentWorkspaceProps {
  notice?: NoticeTemplateDefinition;
  slug?: string;
  initialValues?: Record<string, string>;
}

export const DocumentWorkspace: React.FC<DocumentWorkspaceProps> = ({
  notice: propNotice,
  slug,
  initialValues = {},
}) => {
  const notice = propNotice || (slug ? getNoticeBySlug(slug) : undefined);

  if (!notice) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Notice Cartridge Not Found</h1>
          <p className="text-slate-400">The requested statutory notice template could not be loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#0F172A] text-slate-400 flex items-center justify-center font-mono text-sm">
          Loading Docket Workspace...
        </div>
      }
    >
      <DocumentWorkspaceInner notice={notice} initialValues={initialValues} />
    </React.Suspense>
  );
};

const DocumentWorkspaceInner: React.FC<{
  notice: NoticeTemplateDefinition;
  initialValues?: Record<string, string>;
}> = ({ notice, initialValues = {} }) => {
  const searchParams = useSearchParams();
  const availabilityState = useTemplateAvailability();
  const { user } = useAuth();
  const accountContext = user?.uid || null;

  // 1. Resolve initial draft values with strict URL prefill precedence
  const initialResolved = useMemo(
    () => resolveInitialWorkspaceDraft({ notice, initialValues, searchParams, accountContext }),
    [notice, initialValues, searchParams, accountContext]
  );

  const [docketId, setDocketId] = useState(() => initialResolved.userValues.docketId || generateDocketId());
  const [userValues, setUserValues] = useState<Record<string, string>>(() => ({
    ...initialResolved.userValues,
    docketId,
  }));
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [isSignatureAdopted, setIsSignatureAdopted] = useState(false);
  const [isAffirmed, setIsAffirmed] = useState(false);
  const [signatureInvalidatedByEdit, setSignatureInvalidatedByEdit] = useState(false);
  const [selectedTier, setSelectedTier] = useState<MailTierId>(initialResolved.selectedTier);
  const [verificationStatus, setVerificationStatus] = useState<AddressVerificationStatus>('unverified');
  const [workflowStep, setWorkflowStep] = useState<WorkspaceWorkflowStep>('details');
  const [draftIdentity, setDraftIdentity] = useState(() => getOrCreateDraftIdentity(notice.slug, accountContext));
  const [draftAccountContext, setDraftAccountContext] = useState<string | null>(accountContext);
  const [addressEvidence, setAddressEvidence] = useState<Partial<Record<VerifiedAddressRole, AddressVerificationEvidence>>>({});
  const [addressReview, setAddressReview] = useState<Partial<Record<VerifiedAddressRole, { status: 'idle' | 'checking' | 'verified' | 'suggestion' | 'error'; message?: string; suggested?: Record<string, string>; evidence?: AddressVerificationEvidence }>>>({});
  const verificationRequestIdsRef = useRef<Record<string, number>>({});
  const historyReadinessRef = useRef({ checkoutReady: false, paymentReady: false });
  const [mobileView, setMobileView] = useState<'document' | 'drawer'>('drawer');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const hasAutoAdvancedRef = useRef(false);
  const documentPreviewRef = useRef<HTMLElement | null>(null);

  // Track keys edited by user to ensure hydration NEVER overwrites user edits
  const userEditedKeysRef = useRef<Set<string>>(new Set());
  const draftRevisionRef = useRef<number>(draftIdentity.draftRevision);
  const [draftRevision, setDraftRevision] = useState(draftRevisionRef.current);

  // Authentication may resolve after the workspace mounts. Switch the recovery
  // scope atomically so a guest draft is never persisted under an account key.
  useEffect(() => {
    if (isDraftStorageScopeCurrent(draftAccountContext, accountContext)) return;
    const safeParams = typeof window === 'undefined'
      ? searchParams
      : new URL(safeWorkflowUrl(window.location.href), window.location.origin).searchParams;
    const scopedDraft = resolveInitialWorkspaceDraft({ notice, initialValues, searchParams: safeParams, accountContext });
    const identity = getOrCreateDraftIdentity(notice.slug, accountContext);
    const scopedDocketId = scopedDraft.userValues.docketId || generateDocketId();
    const blockedHydrationKeys = [
      ...notice.fields.map((field) => field.key),
      'senderFullName', 'senderAddressLine1', 'senderAddressLine2', 'senderCity', 'senderState', 'senderZip',
      'recipientFormalName', 'recipientAddressLine1', 'recipientAddressLine2', 'recipientCity', 'recipientState', 'recipientZip',
      'propertyState', 'consumerResidenceState', 'docketId', 'bureauEntityId', 'tier',
    ];
    userEditedKeysRef.current = new Set(blockedHydrationKeys);
    verificationRequestIdsRef.current.sender = (verificationRequestIdsRef.current.sender || 0) + 1;
    verificationRequestIdsRef.current.recipient = (verificationRequestIdsRef.current.recipient || 0) + 1;
    setUserValues({ ...scopedDraft.userValues, docketId: scopedDocketId });
    setDocketId(scopedDocketId);
    setSelectedTier(scopedDraft.selectedTier);
    setDraftIdentity(identity);
    draftRevisionRef.current = identity.draftRevision;
    setDraftRevision(identity.draftRevision);
    setIsSignatureAdopted(false);
    setIsAffirmed(false);
    setSignatureInvalidatedByEdit(false);
    setVerificationStatus('unverified');
    setAddressEvidence({});
    setAddressReview({});
    historyReadinessRef.current = { checkoutReady: false, paymentReady: false };
    setIsCheckoutOpen(false);
    setWorkflowStep('details');
    setMobileView('drawer');
    setDraftAccountContext(accountContext);
    writeWorkflowHistory('details', true);
  }, [accountContext, draftAccountContext, initialValues, notice, searchParams]);

  const transitionWorkflowStep = (step: WorkspaceWorkflowStep, replace = false) => {
    if (!replace && step === workflowStep) return;
    setWorkflowStep(step);
    writeWorkflowHistory(step, replace);
  };

  useEffect(() => {
    const requested = searchParams?.get('workflow');
    const safeInitial = requested === 'review' ? 'review' : 'details';
    setWorkflowStep(safeInitial);
    if (safeInitial === 'review') setMobileView('document');
    writeWorkflowHistory(safeInitial, true);
    const onPopState = (event: PopStateEvent) => {
      const requested = workflowStepFromHistoryState(event.state) || (new URL(window.location.href).searchParams.get('workflow') === 'review' ? 'review' : 'details');
      const step = resolveHistoryNavigation(requested, historyReadinessRef.current);
      setWorkflowStep(step);
      setMobileView(step === 'review' ? 'document' : 'drawer');
      if (step === 'payment' || step === 'delivery') setIsCheckoutOpen(true);
      else setIsCheckoutOpen(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const mailingAddress = (role: VerifiedAddressRole) => role === 'sender'
    ? { name: userValues.senderFullName || '', addressLine1: userValues.senderAddressLine1 || '', addressLine2: userValues.senderAddressLine2 || '', city: userValues.senderCity || '', state: userValues.senderState || '', zip: userValues.senderZip || '' }
    : { name: userValues.recipientFormalName || '', addressLine1: userValues.recipientAddressLine1 || '', addressLine2: userValues.recipientAddressLine2 || '', city: userValues.recipientCity || '', state: userValues.recipientState || '', zip: userValues.recipientZip || '' };

  const verifyMailingAddress = async (role: VerifiedAddressRole) => {
    const requestId = (verificationRequestIdsRef.current[role] || 0) + 1;
    verificationRequestIdsRef.current[role] = requestId;
    const revision = draftRevisionRef.current;
    const address = mailingAddress(role);
    setAddressReview((current) => ({ ...current, [role]: { status: 'checking' } }));
    try {
      const response = await fetch('/api/docket/verify-address', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, role, draftId: draftIdentity.draftId, draftRevision: revision }),
      });
      const result = await response.json();
      if (!isCurrentAddressVerificationResponse({ requestId, currentRequestId: verificationRequestIdsRef.current[role], responseRevision: revision, currentRevision: draftRevisionRef.current })) return;
      if (!response.ok || !result.valid || !result.evidence) {
        const message = response.status === 429 ? 'Address checking is temporarily rate limited. Please try again later.'
          : response.status >= 500 ? 'Address checking is temporarily unavailable. Your entry is saved; retry before checkout.'
          : result.code === 'ADDRESS_UNDELIVERABLE' ? 'USPS could not confirm delivery to this address. Check the street, unit, city, state, and ZIP.'
          : result.error || 'This address could not be verified.';
        setAddressReview((current) => ({ ...current, [role]: { status: 'error', message } }));
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
      const changed = Object.entries(suggested).some(([key, value]) => (userValues[key] || '').trim().toUpperCase() !== value.trim().toUpperCase());
      setAddressReview((current) => ({ ...current, [role]: {
        status: changed ? 'suggestion' : 'verified',
        message: result.providerMode === 'staging_mock_cass' ? 'Staging CASS simulation result. Confirm this address to continue.' : 'USPS CASS result. Confirm this address to continue.',
        suggested, evidence: result.evidence,
      } }));
    } catch {
      if (isCurrentAddressVerificationResponse({ requestId, currentRequestId: verificationRequestIdsRef.current[role], responseRevision: revision, currentRevision: draftRevisionRef.current })) {
        setAddressReview((current) => ({ ...current, [role]: { status: 'error', message: 'Address checking is temporarily unavailable. Your entry is saved; retry before checkout.' } }));
      }
    }
  };

  const acceptAddressReview = (role: VerifiedAddressRole) => {
    const review = addressReview[role];
    if (!review?.evidence || !review.suggested) return;
    if (review.status === 'suggestion') {
      for (const [key, value] of Object.entries(review.suggested)) handleFieldValueChange(key, value);
      setAddressReview((current) => ({ ...current, [role]: { status: 'checking', message: 'Address updated. Binding verification evidence…' } }));
      setTimeout(() => {
        void verifyMailingAddress(role);
      }, 60);
      return;
    }
    setAddressEvidence((current) => ({ ...current, [role]: review.evidence }));
    setVerificationStatus(review.evidence.payload.providerMode === 'live_cass' ? 'confirmed' : 'simulated');
    setAddressReview((current) => ({ ...current, [role]: { ...review, status: 'verified', message: 'Address confirmed by you. Verification evidence is current.' } }));
  };

  // URL ?focus= parameter detection
  useEffect(() => {
    const focusParam = searchParams?.get('focus');
    if (focusParam) {
      setActiveFieldKey(focusParam);
      setMobileView('drawer');
    }
  }, [searchParams]);

  // Hook 1: Agent Hydration (URL parameters + Server-staged draft)
  const hydration = useAgentHydration({
    notice,
    initialValues,
    currentValues: userValues,
    isSignatureAdopted,
    userEditedKeys: userEditedKeysRef.current,
  });

  // Safe entrySource computation (§11)
  const entrySource: EntrySource = useMemo(() => {
    const srcParam = searchParams?.get('source');
    if (srcParam === 'home_chooser') return 'home_chooser';
    if (srcParam === 'companies_directory') return 'companies_directory';

    if (typeof document !== 'undefined') {
      const ref = (document.referrer || '').toLowerCase();
      if (ref.includes('/companies')) return 'companies_directory';
      if (ref.endsWith('/') || ref.includes('docketstamp.com/?') || ref.includes('localhost:3000/?')) {
        return 'home_chooser';
      }
    }

    if (hydration.isStaged) {
      return 'staged_draft';
    }

    const hasPrefill =
      Boolean(searchParams?.get('recipientId')) ||
      Array.from(searchParams?.keys() || []).some((k) => k.startsWith('field.'));
    if (hasPrefill) {
      return 'recipient_prefill';
    }

    return 'direct_notice';
  }, [searchParams, hydration.isStaged]);

  // Funnel Event: editor_start on workspace mount
  useEffect(() => {
    emitBusinessEvent({
      eventName: 'workspace_viewed',
      noticeId: notice.slug,
      tier: selectedTier,
      entrySurface: entrySource,
      logicalKey: `workspace:${notice.slug}`,
    });
    trackFunnelEvent({
      eventName: 'editor_start',
      step: 3,
      noticeSlug: notice.slug,
      recipientId: initialResolved.selectedRecipientId || undefined,
      tier: selectedTier,
      entrySource,
      experienceVersion: 'home_v2',
    });
  }, [notice.slug, initialResolved.selectedRecipientId, selectedTier, entrySource]);

  // Hook 2: Chrome 149+ WebMCP in-browser agent tool integration
  useWebMcpTools({
    notice,
    currentValues: userValues,
    onUpdateValues: (fields) => {
      draftRevisionRef.current += 1; setDraftRevision(draftRevisionRef.current);
      setIsSignatureAdopted(false); setIsAffirmed(false); setAddressEvidence({}); setAddressReview({});
      setUserValues((prev) => {
        for (const k of Object.keys(fields)) {
          userEditedKeysRef.current.add(k);
        }
        return {
          ...prev,
          ...fields,
        };
      });
    },
    onSelectTier: (tier) => { userEditedKeysRef.current.add('tier'); historyReadinessRef.current.paymentReady = false; if (tier !== selectedTier) { draftRevisionRef.current += 1; historyReadinessRef.current.paymentReady = false; setDraftRevision(draftRevisionRef.current); setIsSignatureAdopted(false); setIsAffirmed(false); setAddressEvidence({}); setAddressReview({}); } setSelectedTier(tier); },
  });

  // Synchronize hydrated values when ready without overwriting subsequent user edits
  useEffect(() => {
    if (Object.keys(hydration.hydratedValues).length > 0) {
      const hasNewValues = Object.entries(hydration.hydratedValues).some(([key, value]) =>
        !userEditedKeysRef.current.has(key) &&
        (!userValues[key] || userValues[key].startsWith('[') || hydration.explicitKeys?.includes(key)) &&
        userValues[key] !== value
      );
      if (hasNewValues) {
        draftRevisionRef.current += 1;
        historyReadinessRef.current.paymentReady = false;
        setDraftRevision(draftRevisionRef.current);
        setIsSignatureAdopted(false);
        setIsAffirmed(false);
        setAddressEvidence({});
        setAddressReview({});
      }
      setUserValues((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [k, v] of Object.entries(hydration.hydratedValues)) {
          if (userEditedKeysRef.current.has(k)) continue;
          if (!next[k] || next[k].startsWith('[') || hydration.explicitKeys?.includes(k)) {
            if (next[k] !== v) { next[k] = v; changed = true; }
          }
        }
        return changed ? next : prev;
      });
    }
  }, [hydration.hydratedValues, hydration.explicitKeys]);

  // Synchronize hydrated tier if provided by query param, stage, or verified recipient
  useEffect(() => {
    if (hydration.hydratedTier && !hydration.explicitKeys?.includes('tier') && !userEditedKeysRef.current.has('tier')) {
      if (hydration.hydratedTier !== selectedTier) {
        draftRevisionRef.current += 1; historyReadinessRef.current.paymentReady = false; setDraftRevision(draftRevisionRef.current);
        setIsSignatureAdopted(false); setIsAffirmed(false); setAddressEvidence({}); setAddressReview({});
      }
      setSelectedTier(hydration.hydratedTier);
    }
  }, [hydration.hydratedTier, hydration.explicitKeys]);

  // Deterministic real validation
  const validation = useMemo(() => {
    return validateNoticeDraft(notice, userValues);
  }, [notice, userValues]);

  useEffect(() => {
    if (!validation.isValid) return;
    emitBusinessEvent({
      eventName: 'details_ready',
      noticeId: notice.slug,
      tier: selectedTier,
      entrySurface: entrySource,
      draftRevision: draftRevisionRef.current,
      logicalKey: `details:${notice.slug}:r${draftRevisionRef.current}`,
    });
  }, [validation.isValid, userValues, notice.slug, selectedTier, entrySource]);

  // Session-scoped draft persistence (tab-scoped, no permanent sensitive data in localStorage)
  useEffect(() => {
    if (!isDraftStorageScopeCurrent(draftAccountContext, accountContext)) return;
    saveNoticeDraft(notice.slug, {
      userValues,
      selectedRecipientId: userValues.bureauEntityId || hydration.explicitRecipientId,
      selectedTier,
      docketId,
      draftId: draftIdentity.draftId,
      draftRevision,
    }, accountContext);
  }, [notice.slug, userValues, selectedTier, docketId, hydration.explicitRecipientId, draftIdentity.draftId, draftRevision, accountContext, draftAccountContext]);

  // Automatically advance drawer stepper upon hydration completion
  useEffect(() => {
    if (!hydration.isLoadingStage && hydration.isStaged && !hasAutoAdvancedRef.current) {
      hasAutoAdvancedRef.current = true;
      if (validation.isValid && !isSignatureAdopted) {
        // All fields are filled; focus signature adoption step
        setActiveFieldKey('signature');
      } else if (validation.firstInvalidFieldKey) {
        setActiveFieldKey(validation.firstInvalidFieldKey);
      }
    }
  }, [
    hydration.isLoadingStage,
    hydration.isStaged,
    validation.isValid,
    validation.firstInvalidFieldKey,
    isSignatureAdopted,
  ]);

  // Real-time pure deterministic interpolation
  const interpolatedDoc = useMemo(() => {
    const currentProviderModes = (['sender', 'recipient'] as const).map((role) => {
      const evidence = addressEvidence[role];
      return isAddressEvidenceCurrent({ evidence, draftId: draftIdentity.draftId, draftRevision })
        ? evidence?.payload.providerMode
        : undefined;
    });
    return interpolateNotice({
      notice,
      userValues,
      docketId,
      serviceLevel: selectedTier,
      cassStatus: addressVerificationStatusLabel(currentProviderModes),
    });
  }, [notice, userValues, docketId, selectedTier, addressEvidence, draftIdentity.draftId, draftRevision]);
  const physicalFit = useMemo(() => assessPhysicalFit(interpolatedDoc), [interpolatedDoc]);
  historyReadinessRef.current = {
    checkoutReady: validation.isValid && physicalFit.fits && isSignatureAdopted && isAddressEvidenceCurrent({ evidence: addressEvidence.sender, draftId: draftIdentity.draftId, draftRevision: draftRevisionRef.current }) && isAddressEvidenceCurrent({ evidence: addressEvidence.recipient, draftId: draftIdentity.draftId, draftRevision: draftRevisionRef.current }),
    paymentReady: historyReadinessRef.current.paymentReady,
  };

  const handleFieldValueChange = (key: string, value: string) => {
    draftRevisionRef.current += 1;
    historyReadinessRef.current.paymentReady = false;
    setDraftRevision(draftRevisionRef.current);
    userEditedKeysRef.current.add(key);
    setUserValues((prev) => ({
      ...prev,
      [key]: value,
    }));

    // Invalidate signature on any content edit
    if (isSignatureAdopted) {
      setIsSignatureAdopted(false);
      setSignatureInvalidatedByEdit(true);
    }
    setIsAffirmed(false);

    // Evidence is bound to this complete draft revision, so any material edit makes it stale.
    setVerificationStatus('unverified');
    setAddressEvidence({});
    setAddressReview({});

    const addressKeys = [
      'senderFullName',
      'senderAddressLine1',
      'senderAddressLine2',
      'senderCity',
      'senderState',
      'senderZip',
      'recipientFormalName',
      'recipientAddressLine1',
      'recipientAddressLine2',
      'recipientCity',
      'recipientState',
      'recipientZip',
      'leasedPremisesAddress',
      'vacatedPremisesAddress',
      'rentalPropertyAddress',
      'servicePropertyAddress',
      'forwardingAddress',
      'propertyState',
    ];
    if (addressKeys.includes(key)) {
      setVerificationStatus('unverified');
    }
  };

  const handleTierChange = (tier: MailTierId) => {
    if (tier === selectedTier) return;
    draftRevisionRef.current += 1;
    setDraftRevision(draftRevisionRef.current);
    setIsSignatureAdopted(false);
    setIsAffirmed(false);
    setAddressEvidence({});
    setAddressReview({});
    userEditedKeysRef.current.add('tier');
    historyReadinessRef.current.paymentReady = false;
    setSelectedTier(tier);
  };

  const handleNextRequiredField = () => {
    if (!validation.isValid) {
      if (validation.firstInvalidFieldKey) {
        setActiveFieldKey(validation.firstInvalidFieldKey);
        setMobileView('drawer');
      }
    } else if (!isSignatureAdopted) {
      setActiveFieldKey('signature');
      setMobileView('drawer');
      const sigEl = document.getElementById('signature-adoption-control');
      if (sigEl) {
        sigEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const sigInput = document.querySelector('[data-testid="signature-input"]') as HTMLInputElement;
      if (sigInput) {
        sigInput.focus();
      }
    } else {
      transitionWorkflowStep('delivery');
      setIsCheckoutOpen(true);
    }
  };

  // A completed signature is not consent to start checkout. The explicit review
  // action must reveal the final letter first, especially on mobile where the
  // paper sheet is otherwise hidden by the input drawer.
  const handleReviewLetter = () => {
    transitionWorkflowStep('review');
    setMobileView('document');
    requestAnimationFrame(() => {
      documentPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleAdoptSignature = (signerName: string) => {
    emitBusinessEvent({
      eventName: 'signature_adopted',
      noticeId: notice.slug,
      tier: selectedTier,
      entrySurface: entrySource,
      draftRevision: draftRevisionRef.current,
      logicalKey: `signature:${notice.slug}:r${draftRevisionRef.current}`,
    });
    if ((userValues.senderFullName || '') !== signerName) {
      draftRevisionRef.current += 1;
      setDraftRevision(draftRevisionRef.current);
      setAddressEvidence({});
      setAddressReview({});
    }
    setIsSignatureAdopted(true);
    setIsAffirmed(true);
    setSignatureInvalidatedByEdit(false);
    setUserValues((prev) => ({ ...prev, senderFullName: signerName }));
  };

  const handleAffirmationChange = (affirmed: boolean) => {
    setIsAffirmed(affirmed);
    if (!affirmed) {
      setIsSignatureAdopted(false);
    }
  };

  // Funnel Event: editor_complete when all required fields are valid and signature is adopted
  useEffect(() => {
    if (validation.isValid && isSignatureAdopted) {
      trackFunnelEvent({
        eventName: 'editor_complete',
        step: 4,
        noticeSlug: notice.slug,
        draftRevision: draftRevisionRef.current,
        tier: selectedTier,
        entrySource,
        experienceVersion: 'home_v2',
      });
    }
  }, [validation.isValid, isSignatureAdopted, notice.slug, selectedTier, entrySource]);

  const handleTokenClick = (fieldKey: string) => {
    let targetKey = fieldKey;
    if (fieldKey === 'senderFullAddress') {
      targetKey = 'senderAddressLine1';
    } else if (fieldKey === 'recipientFullAddress') {
      targetKey = 'recipientAddressLine1';
    }
    setActiveFieldKey(targetKey);
    setMobileView('drawer');
  };

  const handleJumpToNextAction = () => {
    if (validation.isValid && !isSignatureAdopted) {
      setActiveFieldKey('signature');
      setMobileView('drawer');
    } else if (validation.firstInvalidFieldKey) {
      setActiveFieldKey(validation.firstInvalidFieldKey);
      setMobileView('drawer');
    } else {
      handleNextRequiredField();
    }
  };

  const handleResetDraft = () => {
    clearNoticeDraft(notice.slug, accountContext);
    const freshIdentity = getOrCreateDraftIdentity(notice.slug, accountContext);
    setDraftIdentity(freshIdentity);
    draftRevisionRef.current = freshIdentity.draftRevision;
    setDraftRevision(freshIdentity.draftRevision);
    userEditedKeysRef.current.clear();
    setIsSignatureAdopted(false);
    setIsAffirmed(false);
    setSignatureInvalidatedByEdit(false);
    setVerificationStatus('unverified');
    const freshResolved = resolveInitialWorkspaceDraft({ notice, initialValues, searchParams, accountContext });
    const freshDocketId = generateDocketId();
    setUserValues({
      ...freshResolved.userValues,
      docketId: freshDocketId,
    });
    setSelectedTier(freshResolved.selectedTier);
    setActiveFieldKey(notice.fields[0]?.key || null);
  };

  const availability = availabilityState.data?.templates.find(entry => entry.slug === notice.slug);
  const availabilityDecision = availability ? evaluateTemplateAvailability(availability, userValues) : null;
  if (availabilityState.loading || availabilityState.error || !availabilityDecision?.allowed) {
    const locationAvailability = availability ? {
      ...availability,
      requiresResidence: availability.requiresResidence || !!availabilityDecision?.requiredFields.includes('consumerResidenceState'),
      requiresProperty: availability.requiresProperty || !!availabilityDecision?.requiredFields.includes('propertyState'),
    } : null;
    const needsLocation = locationAvailability?.available && (locationAvailability.requiresResidence || locationAvailability.requiresProperty);
    return <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-lg space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-6">
        <a href="/" className="text-sm text-sky-400">← Choose a letter</a>
        <h1 className="text-2xl font-serif font-bold">{notice.title}</h1>
        {availabilityState.loading ? <p role="status">Checking availability…</p> : availabilityState.error ? <>
          <p role="alert">{availabilityState.error}</p><button type="button" onClick={availabilityState.refresh} className="rounded-lg bg-sky-700 px-4 py-2 text-white">Try again</button>
        </> : <>
          <h2 className="text-lg font-semibold">{needsLocation ? 'Check availability for your location' : 'This letter is currently unavailable'}</h2>
          {needsLocation && <TemplateLocationFields availability={locationAvailability} values={userValues} onChange={handleFieldValueChange} />}
          <p role="status" className="text-sm text-slate-300">{availabilityDecision?.message || 'Please choose another available letter.'}</p>
        </>}
      </div>
    </main>;
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Sticky Execution Bar */}
      <StickyExecutionBar
        completedFieldsCount={validation.completedCount}
        totalFieldsCount={validation.totalCount}
        isSignatureAdopted={isSignatureAdopted}
        isValid={validation.isValid}
        onNextRequiredField={handleNextRequiredField}
        onProceedToCheckout={() => { transitionWorkflowStep('delivery'); setIsCheckoutOpen(true); }}
        mobileView={mobileView}
        onToggleMobileView={() =>
          setMobileView((prev) => (prev === 'document' ? 'drawer' : 'document'))
        }
        docketId={docketId}
      />

      <section aria-label="Mailing address verification" className="mx-auto w-full max-w-5xl px-4 pt-3">
        <div className="grid gap-3 rounded-lg border border-slate-700 bg-slate-900/80 p-3 md:grid-cols-2">
          {(['sender', 'recipient'] as const).map((role) => {
            const review = addressReview[role];
            const address = mailingAddress(role);
            return <div key={role} className="space-y-2 rounded border border-slate-800 p-3">
              <div><h2 className="text-sm font-semibold">{role === 'sender' ? 'Sender mailing address' : 'Recipient destination'}</h2>
                <p className="text-xs text-slate-400">{[address.addressLine1, address.addressLine2, `${address.city}${address.city ? ', ' : ''}${address.state} ${address.zip}`].filter(Boolean).join(' · ') || 'Complete this address in the details drawer.'}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void verifyMailingAddress(role)} disabled={!validation.isValid || review?.status === 'checking'} className="rounded bg-sky-800 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{review?.status === 'checking' ? 'Checking…' : 'Check address with USPS CASS'}</button>
                {review?.evidence && <button type="button" onClick={() => acceptAddressReview(role)} className="rounded bg-emerald-800 px-3 py-1.5 text-xs font-semibold">{review.status === 'suggestion' ? 'Use suggested address' : 'Confirm this address'}</button>}
              </div>
              {review?.status === 'suggestion' && <p role="status" className="text-xs text-amber-200">USPS suggests: {review.suggested?.[role === 'sender' ? 'senderAddressLine1' : 'recipientAddressLine1']}, {review.suggested?.[role === 'sender' ? 'senderCity' : 'recipientCity']}, {review.suggested?.[role === 'sender' ? 'senderState' : 'recipientState']} {review.suggested?.[role === 'sender' ? 'senderZip' : 'recipientZip']}. Review and accept it before using.</p>}
              {review?.message && <p role={review.status === 'error' ? 'alert' : 'status'} className="text-xs text-slate-300">{review.message}</p>}
              {addressEvidence[role] && <p className="text-[11px] text-emerald-300">Address evidence current · {addressEvidence[role]?.payload.providerMode === 'staging_mock_cass' ? 'staging CASS simulation' : addressEvidence[role]?.payload.providerMode === 'local_mock' ? 'local verification simulation' : 'USPS CASS'} · {addressEvidence[role]?.payload.verifiedAt}</p>}
            </div>;
          })}
        </div>
      </section>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left/Center Canvas: Elevated 8.5x11 Live Paper Sheet */}
        <main
          ref={documentPreviewRef}
          className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 flex justify-center items-start bg-[#0F172A] ${
            mobileView === 'drawer' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="w-full max-w-[850px] transition-all duration-200">
            {/* Pre-Staged Agent Banner */}
            {hydration.isStaged && (
              <div className="mb-4">
                <AgentStagedBanner
                  isStaged={hydration.isStaged}
                  stageId={hydration.stageId}
                  stagedSource={hydration.stagedSource}
                  preStagedFieldCount={validation.completedCount}
                  remainingActionCount={validation.missingOrInvalidFields.length + (isSignatureAdopted ? 0 : 1)}
                  isReadyForSignature={validation.isValid && !isSignatureAdopted}
                  isLoadingStage={hydration.isLoadingStage}
                  stageError={hydration.stageError}
                  onJumpToNextAction={handleJumpToNextAction}
                  onRetryStageLoad={hydration.retryStageLoad}
                  onStartFresh={hydration.startFresh}
                />
              </div>
            )}

            {/* Desktop Helper Banner */}
            <div className="mb-4 flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-900/80 px-4 py-2.5 rounded border border-slate-800">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Click any amber tag on paper to focus corresponding input
              </span>
              <span className="hidden lg:inline text-slate-500">
                8.5 × 11 notice preview
              </span>
            </div>

            {/* Live Paper Sheet Preview */}
            <LivePaperSheet
              doc={interpolatedDoc}
              onTokenClick={handleTokenClick}
              activeFieldKey={activeFieldKey}
              isSignatureAdopted={isSignatureAdopted}
              selectedTier={selectedTier}
              verificationStatus={verificationStatus}
            />
          </div>
        </main>

        {/* Right Sidebar: Guided Field Drawer */}
        <aside
          className={`w-full md:w-[460px] md:min-w-[420px] h-[calc(100vh-57px)] md:sticky md:top-[57px] flex-shrink-0 ${
            mobileView === 'document' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <GuidedFieldDrawer
            notice={notice}
            userValues={userValues}
            onChange={handleFieldValueChange}
            activeFieldKey={activeFieldKey}
            onFieldFocus={(key) => setActiveFieldKey(key)}
            isSignatureAdopted={isSignatureAdopted}
            isAffirmed={isAffirmed}
            onAffirmationChange={handleAffirmationChange}
            signatureInvalidatedByEdit={signatureInvalidatedByEdit}
            validation={validation}
            onAdoptSignature={handleAdoptSignature}
            onNextRequiredField={handleNextRequiredField}
            onReviewLetter={handleReviewLetter}
            onCompleteDrawer={() => { transitionWorkflowStep('delivery'); setIsCheckoutOpen(true); }}
            onResetDraft={handleResetDraft}
            postalCodeLookup={lookupPostalCodeLocally}
          />
        </aside>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => { setIsCheckoutOpen(false); transitionWorkflowStep('review'); }}
        onWorkflowStepChange={(step) => { if (step === 'payment') historyReadinessRef.current.paymentReady = true; transitionWorkflowStep(step); }}
        workflowStep={workflowStep}
        draftId={draftIdentity.draftId}
        addressVerificationEvidence={addressEvidence}
        onAvailabilityRefresh={availabilityState.refresh}
        doc={interpolatedDoc}
        selectedTier={selectedTier}
        onSelectTier={handleTierChange}
        userValues={userValues}
        isSignatureAdopted={isSignatureAdopted}
        isAffirmed={isAffirmed}
        entrySource={entrySource}
        draftRevision={draftRevision}
        onUpdateAddressEvidence={(updated) => setAddressEvidence((prev) => ({ ...prev, ...updated }))}
        onApplyFieldValues={(updates) => {
          for (const key of Object.keys(updates)) userEditedKeysRef.current.add(key);
          setUserValues((prev) => ({ ...prev, ...updates }));
        }}
        onFocusField={(fieldKey) => {
          setIsCheckoutOpen(false);
          transitionWorkflowStep('details');
          setActiveFieldKey(fieldKey);
          setMobileView('drawer');
        }}
      />
    </div>
  );
};
