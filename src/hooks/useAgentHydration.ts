'use client';

/**
 * useAgentHydration Hook
 *
 * Implements Section 4.1 & 4.2 of docs/DOCKETSTAMP_AGENTIC_EXPANSION.md:
 * - Reads URL parameters using next/navigation (useSearchParams) with fallback to window.location.search
 * - Supports two hydration sources:
 *   a. Server-staged draft (?stage=DS-STAGE-XXXXXX) via GET /api/docket/stage/[stageId]
 *   b. Direct URL query params (?recipientId=..., ?tier=..., ?field.<key>=..., ?<fieldKey>=...)
 * - Combines server-staged values and direct query param overrides deterministically
 * - Computes missing required fields, first unfilled field, and signature-readiness
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  NoticeTemplateDefinition,
  MailTierId,
  PostalAddress,
  DocketAddress,
} from '@/lib/docket/types';
import { getVerifiedRecipientById } from '@/lib/docket/data/verified-recipients';
import { resolveHydratedStageId, sanitizeWorkflowLocation } from '@/lib/docket/workflow-history';
import { getStateStatute } from '@/lib/docket/data/state-statutes';
import { getGuidedFieldsInVisualOrder } from '@/components/docket/address-intake';

export interface UseAgentHydrationOptions {
  notice: NoticeTemplateDefinition;
  initialValues?: Record<string, string>;
  currentValues?: Record<string, string>;
  isSignatureAdopted?: boolean;
  userEditedKeys?: Set<string>;
}

export interface UseAgentHydrationResult {
  isStaged: boolean;
  stagedSource: 'stage' | 'url_params' | null;
  stageId: string | null;
  hydratedValues: Record<string, string>;
  hydratedTier: MailTierId | null;
  explicitKeys: string[];
  explicitRecipientId: string | null;
  missingRequiredKeys: string[];
  firstUnfilledKey: string | null;
  shouldJumpToSignature: boolean;
  isLoadingStage: boolean;
  stageError: string | null;
  retryStageLoad: () => void;
  startFresh: () => void;
}

const VALID_TIERS: Set<MailTierId> = new Set([
  'first_class',
  'certified',
  'certified_return_receipt',
]);

function isValidTier(val: unknown): val is MailTierId {
  return typeof val === 'string' && VALID_TIERS.has(val as MailTierId);
}

function isValueFilled(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return false;
  return true;
}

function extractAddressFields(
  addr: Partial<PostalAddress | DocketAddress> | Record<string, any> | undefined | null
): Record<string, string> {
  if (!addr || typeof addr !== 'object') return {};
  const a = addr as Record<string, any>;
  const res: Record<string, string> = {};

  const name = a.name || a.senderFullName || a.recipientFormalName || a.formalRecipientLine || a.company;
  if (name && typeof name === 'string') res.name = name;

  const line1 = a.addressLine1 || a.address_line1 || a.street;
  if (line1 && typeof line1 === 'string') res.addressLine1 = line1;

  const line2 = a.addressLine2 || a.address_line2;
  if (line2 && typeof line2 === 'string') res.addressLine2 = line2;

  const city = a.city || a.address_city;
  if (city && typeof city === 'string') res.city = city;

  const state = a.state || a.address_state;
  if (state && typeof state === 'string') res.state = state;

  const zip = a.zip || a.address_zip || a.postalCode;
  if (zip && typeof zip === 'string') res.zip = zip;

  return res;
}

export function useAgentHydration({
  notice,
  initialValues = {},
  currentValues = {},
  isSignatureAdopted = false,
  userEditedKeys,
}: UseAgentHydrationOptions): UseAgentHydrationResult {
  const nextSearchParams = useSearchParams();

  const [isLoadingStage, setIsLoadingStage] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [isStageDismissed, setIsStageDismissed] = useState(false);
  const [fetchCount, setFetchCount] = useState(0);
  const [serverStageData, setServerStageData] = useState<{
    stageId: string;
    fieldValues: Record<string, string>;
    tier: MailTierId | null;
  } | null>(null);
  const [retainedStageId, setRetainedStageId] = useState<string | null>(null);

  const fetchedStageIdRef = useRef<string | null>(null);

  // Helper to safely get all query entries from searchParams or window fallback
  const queryMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();

    // 1. Next.js searchParams (if available)
    if (nextSearchParams) {
      nextSearchParams.forEach((value, key) => {
        map.set(key, value);
      });
    }

    // 2. Safe browser fallback if searchParams was empty but window.location has query
    if (map.size === 0 && typeof window !== 'undefined' && window.location.search) {
      try {
        const raw = window.location.search.replace(/^\?/, '');
        const usp = new URLSearchParams(raw);
        usp.forEach((value, key) => {
          map.set(key, value);
        });
      } catch {
        // Safe fallback
      }
    }

    return map;
  }, [nextSearchParams]);

  // Stage ID detection (nullified if user chose to start fresh)
  const activeStageId = useMemo<string | null>(() => {
    return resolveHydratedStageId(queryMap.get('stage') || queryMap.get('stageId') || null, retainedStageId, isStageDismissed);
  }, [isStageDismissed, queryMap, retainedStageId]);

  const retryStageLoad = useCallback(() => {
    fetchedStageIdRef.current = null;
    setStageError(null);
    setFetchCount((c) => c + 1);
  }, []);

  const startFresh = useCallback(() => {
    setIsStageDismissed(true);
    setRetainedStageId(null);
    setStageError(null);
    setServerStageData(null);
    sanitizeWorkflowLocation();
  }, []);

  // Direct URL query param values extraction
  const urlParamExtraction = useMemo(() => {
    const values: Record<string, string> = {};
    const explicitKeys: string[] = [];
    let explicitRecipientId: string | null = null;
    let tier: MailTierId | null = null;
    let hasDirectParams = false;

    // 1. Recipient ID lookup (?recipientId=leg_wth)
    const recipientId = queryMap.get('recipientId') || queryMap.get('recipient');
    if (recipientId) {
      hasDirectParams = true;
      explicitRecipientId = recipientId;
      explicitKeys.push('recipientId');
      const rec = getVerifiedRecipientById(recipientId);
      if (rec) {
        values.recipientFormalName = rec.formalRecipientLine || rec.brandName;
        values.recipientAddressLine1 = rec.addressLine1;
        values.recipientCity = rec.city;
        values.recipientState = rec.state;
        values.recipientZip = rec.zip;
        explicitKeys.push(
          'recipientFormalName',
          'recipientAddressLine1',
          'recipientCity',
          'recipientState',
          'recipientZip'
        );
        if (notice.slug.includes('credit-bureau') || rec.category === 'credit_bureau') {
          values.bureauEntityId = rec.id;
          explicitKeys.push('bureauEntityId');
        }
        if (rec.recommendedTier && isValidTier(rec.recommendedTier)) {
          tier = rec.recommendedTier;
        }
      }
    }

    // 2. Mail tier (?tier=certified_return_receipt)
    const rawTier = queryMap.get('tier') || queryMap.get('serviceLevel');
    if (rawTier && isValidTier(rawTier)) {
      tier = rawTier;
      hasDirectParams = true;
      explicitKeys.push('tier');
    }

    // 3. Field parameters (?field.<key>=<val> or direct notice field keys)
    const noticeFieldKeys = new Set(notice.fields.map((f) => f.key));

    // Common standard fields to check directly
    const commonFieldKeys = new Set([
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
      'propertyState',
      'consumerResidenceState',
      'statuteCitation',
      'statuteDeadline',
      'docketId',
    ]);

    queryMap.forEach((val, key) => {
      if (!val) return;

      // a. Dot notation (?field.productOrServiceName=...)
      if (key.startsWith('field.')) {
        const fieldKey = key.slice(6);
        if (fieldKey) {
          values[fieldKey] = val;
          hasDirectParams = true;
          explicitKeys.push(fieldKey);
        }
      } else if (noticeFieldKeys.has(key) || commonFieldKeys.has(key)) {
        // b. Direct key match (?productOrServiceName=...)
        values[key] = val;
        hasDirectParams = true;
        explicitKeys.push(key);
      }
    });

    // Auto-resolve state statute if propertyState was passed
    if (values.propertyState && notice.usesStateStatuteLookup) {
      const statute = getStateStatute(values.propertyState);
      if (statute) {
        if (!values.statuteCitation) values.statuteCitation = statute.statuteCitation;
        if (!values.statuteDeadline) values.statuteDeadline = statute.returnDeadlineLabel;
      }
    }

    return { values, tier, hasDirectParams, explicitKeys, explicitRecipientId };
  }, [queryMap, notice]);

  // Fetch server-staged draft when activeStageId is present
  useEffect(() => {
    if (!activeStageId) {
      setServerStageData(null);
      setIsLoadingStage(false);
      setStageError(null);
      return;
    }

    // Avoid duplicate fetching if already fetched and no error
    const fetchKey = `${activeStageId}:${currentValues.consumerResidenceState || ''}:${currentValues.propertyState || ''}`;
    if (fetchedStageIdRef.current === fetchKey && !stageError) {
      return;
    }

    let isMounted = true;
    fetchedStageIdRef.current = fetchKey;
    setRetainedStageId(activeStageId);
    setIsLoadingStage(true);
    setStageError(null);

    async function fetchStagedDraft() {
      try {
        const nexus = new URLSearchParams();
        for (const key of ['consumerResidenceState', 'propertyState']) {
          if (currentValues[key]) nexus.set(key, currentValues[key]);
        }
        const res = await fetch(`/api/docket/stage/${encodeURIComponent(activeStageId!)}${nexus.size ? `?${nexus}` : ''}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Draft staging returned status ${res.status}`);
        }
        const data = await res.json();
        if (!isMounted) return;

        // Support both direct structure and wrapped draft/payload structures
        const payload = data.draft || data.payload || data.data || data;
        const fieldValues: Record<string, string> = {
          ...(payload.fieldValues || {}),
        };

        // Recipient resolution
        const stageRecipientId = payload.recipientId || data.recipientId;
        if (stageRecipientId) {
          const rec = getVerifiedRecipientById(stageRecipientId);
          if (rec) {
            fieldValues.recipientFormalName = rec.formalRecipientLine || rec.brandName;
            fieldValues.recipientAddressLine1 = rec.addressLine1;
            fieldValues.recipientCity = rec.city;
            fieldValues.recipientState = rec.state;
            fieldValues.recipientZip = rec.zip;
            if (notice.slug.includes('credit-bureau') || rec.category === 'credit_bureau') {
              fieldValues.bureauEntityId = rec.id;
            }
          }
        }

        // Custom recipient address
        const customRec = extractAddressFields(payload.customRecipient || data.customRecipient);
        if (customRec.name && !fieldValues.recipientFormalName) fieldValues.recipientFormalName = customRec.name;
        if (customRec.addressLine1 && !fieldValues.recipientAddressLine1) fieldValues.recipientAddressLine1 = customRec.addressLine1;
        if (customRec.city && !fieldValues.recipientCity) fieldValues.recipientCity = customRec.city;
        if (customRec.state && !fieldValues.recipientState) fieldValues.recipientState = customRec.state;
        if (customRec.zip && !fieldValues.recipientZip) fieldValues.recipientZip = customRec.zip;

        // Sender address
        const sender = extractAddressFields(payload.sender || data.sender);
        if (sender.name && !fieldValues.senderFullName) fieldValues.senderFullName = sender.name;
        if (sender.addressLine1 && !fieldValues.senderAddressLine1) fieldValues.senderAddressLine1 = sender.addressLine1;
        if (sender.city && !fieldValues.senderCity) fieldValues.senderCity = sender.city;
        if (sender.state && !fieldValues.senderState) fieldValues.senderState = sender.state;
        if (sender.zip && !fieldValues.senderZip) fieldValues.senderZip = sender.zip;

        // Tier resolution
        let stageTier: MailTierId | null = null;
        const rawTier = payload.recommendedTier || payload.tier || data.recommendedTier || data.tier;
        if (rawTier && isValidTier(rawTier)) {
          stageTier = rawTier;
        }

        // Auto-resolve statute if propertyState was set
        if (fieldValues.propertyState && notice.usesStateStatuteLookup) {
          const statute = getStateStatute(fieldValues.propertyState);
          if (statute) {
            if (!fieldValues.statuteCitation) fieldValues.statuteCitation = statute.statuteCitation;
            if (!fieldValues.statuteDeadline) fieldValues.statuteDeadline = statute.returnDeadlineLabel;
          }
        }

        setServerStageData({
          stageId: activeStageId!,
          fieldValues,
          tier: stageTier,
        });
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('[useAgentHydration] Could not load saved draft:', err);
        setStageError(err.message || 'Failed to load saved draft');
      } finally {
        if (isMounted) {
          setIsLoadingStage(false);
        }
      }
    }

    fetchStagedDraft();

    return () => {
      isMounted = false;
    };
  }, [activeStageId, notice, fetchCount, currentValues.consumerResidenceState, currentValues.propertyState]);

  // Combine hydration layers:
  // Initial -> Server Stage -> Direct URL Query Params (Query params take top priority)
  const hydratedValues = useMemo<Record<string, string>>(() => {
    return {
      ...(serverStageData ? serverStageData.fieldValues : {}),
      ...urlParamExtraction.values,
    };
  }, [serverStageData, urlParamExtraction.values]);

  const hydratedTier = useMemo<MailTierId | null>(() => {
    return urlParamExtraction.tier || (serverStageData ? serverStageData.tier : null);
  }, [urlParamExtraction.tier, serverStageData]);

  // Staged Source computation
  const stagedSource = useMemo<'stage' | 'url_params' | null>(() => {
    if (activeStageId && (serverStageData || isLoadingStage || stageError)) {
      return 'stage';
    }
    if (urlParamExtraction.hasDirectParams || Object.keys(urlParamExtraction.values).length > 0) {
      return 'url_params';
    }
    return null;
  }, [activeStageId, serverStageData, isLoadingStage, stageError, urlParamExtraction]);

  const isStaged = stagedSource !== null;

  // Compute Missing Required Keys, First Unfilled Key & Signature Readiness
  const { missingRequiredKeys, firstUnfilledKey, shouldJumpToSignature } = useMemo(() => {
    const effectiveValues = {
      ...initialValues,
      ...hydratedValues,
      ...currentValues,
    };

    if (userEditedKeys && userEditedKeys.size > 0) {
      userEditedKeys.forEach((key) => {
        if (currentValues[key] !== undefined) {
          effectiveValues[key] = currentValues[key];
        }
      });
    }

    const missingKeys: string[] = [];
    let firstEmpty: string | null = null;

    for (const field of getGuidedFieldsInVisualOrder(notice)) {
      const val = effectiveValues[field.key];
      if (!isValueFilled(val)) {
        missingKeys.push(field.key);
        if (!firstEmpty) {
          firstEmpty = field.key;
        }
      }
    }

    const allNoticeFieldsFilled = missingKeys.length === 0;
    const jumpToSig = allNoticeFieldsFilled && !isSignatureAdopted;

    return {
      missingRequiredKeys: missingKeys,
      firstUnfilledKey: firstEmpty,
      shouldJumpToSignature: jumpToSig,
    };
  }, [notice.fields, initialValues, hydratedValues, currentValues, isSignatureAdopted, userEditedKeys]);

  return {
    isStaged,
    stagedSource,
    stageId: activeStageId,
    hydratedValues,
    hydratedTier,
    explicitKeys: urlParamExtraction.explicitKeys,
    explicitRecipientId: urlParamExtraction.explicitRecipientId,
    missingRequiredKeys,
    firstUnfilledKey,
    shouldJumpToSignature,
    isLoadingStage,
    stageError,
    retryStageLoad,
    startFresh,
  };
}
