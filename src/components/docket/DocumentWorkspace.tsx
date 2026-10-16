'use client';

/**
 * DocumentWorkspace: DocuSign-Style Interactive Document Preparation Workspace
 *
 * Implements Section 3 of docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md & Section 4 of DOCKETSTAMP_AGENTIC_EXPANSION.md:
 * - Dark Slate Workspace (#0F172A) framing elevated 8.5 x 11 live paper sheet
 * - Sticky Top Execution Bar with live field completion counter and Next Required Field action
 * - Clickable DocuSign-style inline Amber Tags on paper sheet that focus guided drawer inputs
 * - Live real-time interpolation of user parameters, statutory citations, and institutional recipients
 * - Electronic signature and Clerk's Docket Stamp adoption
 * - Mobile responsive drawer toggle and keyboard ergonomics
 * - Agentic hydration via URL parameters (?field.*, ?recipientId, ?tier) and server-staged drafts (?stage=)
 * - Chrome 149+ WebMCP client-side tool integration (fill_docket_fields)
 * - Institutional AgentStagedBanner alert
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  NoticeTemplateDefinition,
  MailTierId,
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
  const [docketId] = useState(() => generateDocketId());
  const [userValues, setUserValues] = useState<Record<string, string>>(() => ({
    ...initialValues,
    docketId,
  }));
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [isSignatureAdopted, setIsSignatureAdopted] = useState(false);
  const [selectedTier, setSelectedTier] = useState<MailTierId>(notice.recommendedTier);
  const [mobileView, setMobileView] = useState<'document' | 'drawer'>('drawer');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const hasAutoAdvancedRef = useRef(false);

  // Hook 1: Agent Hydration (URL parameters + Server-staged draft)
  const hydration = useAgentHydration({
    notice,
    initialValues,
    currentValues: userValues,
    isSignatureAdopted,
  });

  // Hook 2: Chrome 149+ WebMCP in-browser agent tool integration
  useWebMcpTools({
    notice,
    onUpdateValues: (fields) => {
      setUserValues((prev) => ({
        ...prev,
        ...fields,
      }));
    },
    onSelectTier: (tier) => setSelectedTier(tier),
  });

  // Synchronize hydrated values when ready
  useEffect(() => {
    if (Object.keys(hydration.hydratedValues).length > 0) {
      setUserValues((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(hydration.hydratedValues)) {
          // If empty, unset, or still a placeholder, populate with hydrated value
          if (!next[k] || next[k].startsWith('[')) {
            next[k] = v;
          }
        }
        return next;
      });
    }
  }, [hydration.hydratedValues]);

  // Synchronize hydrated tier if provided by query param, stage, or verified recipient
  useEffect(() => {
    if (hydration.hydratedTier) {
      setSelectedTier(hydration.hydratedTier);
    }
  }, [hydration.hydratedTier]);

  // Automatically advance drawer stepper upon hydration completion
  useEffect(() => {
    if (!hydration.isLoadingStage && hydration.isStaged && !hasAutoAdvancedRef.current) {
      hasAutoAdvancedRef.current = true;
      if (hydration.shouldJumpToSignature) {
        // All fields are filled; focus signature adoption step
        setActiveFieldKey('senderFullName');
      } else if (hydration.firstUnfilledKey) {
        setActiveFieldKey(hydration.firstUnfilledKey);
      }
    }
  }, [
    hydration.isLoadingStage,
    hydration.isStaged,
    hydration.shouldJumpToSignature,
    hydration.firstUnfilledKey,
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

  // Compute field completion count
  const { completedCount, totalCount, nextEmptyKey } = useMemo(() => {
    const requiredKeys = notice.fields.map((f) => f.key);
    let count = 0;
    let nextEmpty: string | null = null;

    for (const key of requiredKeys) {
      const val = userValues[key];
      if (typeof val === 'string' && val.trim().length > 0 && !val.startsWith('[')) {
        count++;
      } else if (!nextEmpty) {
        nextEmpty = key;
      }
    }

    return {
      completedCount: count,
      totalCount: requiredKeys.length,
      nextEmptyKey: nextEmpty,
    };
  }, [notice.fields, userValues]);

  const handleFieldValueChange = (key: string, value: string) => {
    setUserValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleNextRequiredField = () => {
    if (nextEmptyKey) {
      setActiveFieldKey(nextEmptyKey);
      setMobileView('drawer');
    } else if (!isSignatureAdopted) {
      setActiveFieldKey('senderFullName');
      setMobileView('drawer');
    } else {
      setIsCheckoutOpen(true);
    }
  };

  const handleAdoptSignature = (signerName: string) => {
    setIsSignatureAdopted(true);
    setUserValues((prev) => ({
      ...prev,
      senderFullName: signerName,
    }));
  };

  const handleTokenClick = (fieldKey: string) => {
    setActiveFieldKey(fieldKey);
    setMobileView('drawer');
  };

  const handleJumpToNextAction = () => {
    if (hydration.shouldJumpToSignature) {
      setActiveFieldKey('senderFullName');
      setMobileView('drawer');
    } else if (hydration.firstUnfilledKey) {
      setActiveFieldKey(hydration.firstUnfilledKey);
      setMobileView('drawer');
    } else {
      handleNextRequiredField();
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Sticky Execution Bar */}
      <StickyExecutionBar
        completedFieldsCount={completedCount}
        totalFieldsCount={totalCount}
        isSignatureAdopted={isSignatureAdopted}
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
                  preStagedFieldCount={completedCount}
                  remainingActionCount={totalCount - completedCount + (isSignatureAdopted ? 0 : 1)}
                  isReadyForSignature={hydration.shouldJumpToSignature}
                  isLoadingStage={hydration.isLoadingStage}
                  onJumpToNextAction={handleJumpToNextAction}
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
                1-Page USPS Lob Print Geometry Enforced
              </span>
            </div>

            {/* Live Paper Sheet Preview */}
            <LivePaperSheet
              doc={interpolatedDoc}
              onTokenClick={handleTokenClick}
              activeFieldKey={activeFieldKey}
              isSignatureAdopted={isSignatureAdopted}
              selectedTier={selectedTier}
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
            onAdoptSignature={handleAdoptSignature}
            onNextRequiredField={handleNextRequiredField}
            onCompleteDrawer={() => setIsCheckoutOpen(true)}
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
      />
    </div>
  );
};
