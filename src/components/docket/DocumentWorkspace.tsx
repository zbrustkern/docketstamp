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
import { LivePaperSheet } from './LivePaperSheet';
import { GuidedFieldDrawer } from './GuidedFieldDrawer';
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
} from '@/lib/docket/draft-recovery';
import { trackFunnelEvent } from '@/lib/telemetry';
import { EntrySource } from '@/lib/types';

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

  // 1. Resolve initial draft values with strict URL prefill precedence
  const initialResolved = useMemo(
    () => resolveInitialWorkspaceDraft({ notice, initialValues, searchParams }),
    [notice, initialValues, searchParams]
  );

  const [docketId] = useState(() => initialResolved.userValues.docketId || generateDocketId());
  const [userValues, setUserValues] = useState<Record<string, string>>(() => ({
    ...initialResolved.userValues,
    docketId,
  }));
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [isSignatureAdopted, setIsSignatureAdopted] = useState(false);
  const [signatureInvalidatedByEdit, setSignatureInvalidatedByEdit] = useState(false);
  const [selectedTier, setSelectedTier] = useState<MailTierId>(initialResolved.selectedTier);
  const [verificationStatus, setVerificationStatus] = useState<AddressVerificationStatus>('unverified');
  const [mobileView, setMobileView] = useState<'document' | 'drawer'>('drawer');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const hasAutoAdvancedRef = useRef(false);

  // Track keys edited by user to ensure hydration NEVER overwrites user edits
  const userEditedKeysRef = useRef<Set<string>>(new Set());
  const draftRevisionRef = useRef<number>(1);

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
    onUpdateValues: (fields) => {
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
    onSelectTier: (tier) => setSelectedTier(tier),
  });

  // Synchronize hydrated values when ready without overwriting subsequent user edits
  useEffect(() => {
    if (Object.keys(hydration.hydratedValues).length > 0) {
      setUserValues((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [k, v] of Object.entries(hydration.hydratedValues)) {
          // Rule: Hydration NEVER overwrites keys that the user manually edited
          if (userEditedKeysRef.current.has(k)) {
            continue;
          }
          // If empty, unset, placeholder, or explicitly passed via URL
          if (!next[k] || next[k].startsWith('[') || hydration.explicitKeys?.includes(k)) {
            if (next[k] !== v) {
              next[k] = v;
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    }
  }, [hydration.hydratedValues, hydration.explicitKeys]);

  // Synchronize hydrated tier if provided by query param, stage, or verified recipient
  useEffect(() => {
    if (hydration.hydratedTier && !hydration.explicitKeys?.includes('tier')) {
      setSelectedTier(hydration.hydratedTier);
    }
  }, [hydration.hydratedTier, hydration.explicitKeys]);

  // Deterministic real validation
  const validation = useMemo(() => {
    return validateNoticeDraft(notice, userValues);
  }, [notice, userValues]);

  // Session-scoped draft persistence (tab-scoped, no permanent sensitive data in localStorage)
  useEffect(() => {
    saveNoticeDraft(notice.slug, {
      userValues,
      selectedRecipientId: userValues.bureauEntityId || hydration.explicitRecipientId,
      selectedTier,
      docketId,
    });
  }, [notice.slug, userValues, selectedTier, docketId, hydration.explicitRecipientId]);

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
    return interpolateNotice({
      notice,
      userValues,
      docketId,
      serviceLevel: selectedTier,
    });
  }, [notice, userValues, docketId, selectedTier]);

  const handleFieldValueChange = (key: string, value: string) => {
    draftRevisionRef.current += 1;
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

    // Invalidate address verification upon editing any address or entity field
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
      setIsCheckoutOpen(true);
    }
  };

  const handleAdoptSignature = (signerName: string) => {
    setIsSignatureAdopted(true);
    setSignatureInvalidatedByEdit(false);
    setUserValues((prev) => ({
      ...prev,
      senderFullName: signerName,
    }));
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
    clearNoticeDraft(notice.slug);
    userEditedKeysRef.current.clear();
    setIsSignatureAdopted(false);
    setSignatureInvalidatedByEdit(false);
    setVerificationStatus('unverified');
    const freshResolved = resolveInitialWorkspaceDraft({ notice, initialValues, searchParams });
    const freshDocketId = generateDocketId();
    setUserValues({
      ...freshResolved.userValues,
      docketId: freshDocketId,
    });
    setSelectedTier(freshResolved.selectedTier);
    setActiveFieldKey(notice.fields[0]?.key || null);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Sticky Execution Bar */}
      <StickyExecutionBar
        completedFieldsCount={validation.completedCount}
        totalFieldsCount={validation.totalCount}
        isSignatureAdopted={isSignatureAdopted}
        isValid={validation.isValid}
        onNextRequiredField={handleNextRequiredField}
        onProceedToCheckout={() => setIsCheckoutOpen(true)}
        mobileView={mobileView}
        onToggleMobileView={() =>
          setMobileView((prev) => (prev === 'document' ? 'drawer' : 'document'))
        }
        docketId={docketId}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left/Center Canvas: Elevated 8.5x11 Live Paper Sheet */}
        <main
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
                Standard single-page letter format
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
            signatureInvalidatedByEdit={signatureInvalidatedByEdit}
            validation={validation}
            onAdoptSignature={handleAdoptSignature}
            onNextRequiredField={handleNextRequiredField}
            onCompleteDrawer={() => setIsCheckoutOpen(true)}
            onResetDraft={handleResetDraft}
          />
        </aside>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        doc={interpolatedDoc}
        selectedTier={selectedTier}
        onSelectTier={(tier) => setSelectedTier(tier)}
        userValues={userValues}
        isSignatureAdopted={isSignatureAdopted}
        entrySource={entrySource}
      />
    </div>
  );
};
