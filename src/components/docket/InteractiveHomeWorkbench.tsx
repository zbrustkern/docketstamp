'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ALL_NOTICE_CARTRIDGES,
  DOCKET_PRICING_TIERS,
  getNoticeBySlug,
} from '@/src/lib/docket/notices';
import { STATE_STATUTES } from '@/src/lib/docket/data/state-statutes';
import { VERIFIED_RECIPIENTS } from '@/src/lib/docket/data/verified-recipients';
import { interpolateNotice } from '@/src/lib/docket/renderer/interpolate';
import { isFitnessEntity } from '@/src/lib/docket/guardrails';
import { LivePaperSheet } from '@/src/components/docket/LivePaperSheet';
import {
  MailTierId,
  VerifiedRecipientEntry,
  NoticeTemplateDefinition,
  StateStatuteEntry,
} from '@/src/lib/docket/types';
import {
  Search,
  AlertTriangle,
  ArrowRight,
  Check,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Building2,
} from 'lucide-react';

export interface InteractiveHomeWorkbenchProps {
  initialSlug?: string;
}

interface QuickChip {
  label: string;
  slug: string;
  recipientId?: string;
}

const POPULAR_SCENARIO_CHIPS: QuickChip[] = [
  { label: 'Get Security Deposit Back', slug: 'security-deposit-return-demand-letter' },
  { label: '30-Day Move-Out Notice', slug: 'tenant-notice-of-intent-to-vacate' },
  { label: 'Equifax Dispute', slug: 'fcra-credit-bureau-written-dispute-letter', recipientId: 'cra_eqf' },
  { label: 'Experian Dispute', slug: 'fcra-credit-bureau-written-dispute-letter', recipientId: 'cra_exp' },
  { label: 'TransUnion Dispute', slug: 'fcra-credit-bureau-written-dispute-letter', recipientId: 'cra_tru' },
  { label: 'Stop Debt Collector', slug: 'fdcpa-30-day-debt-validation-letter', recipientId: 'col_pra' },
  { label: 'Cancel ADT Security', slug: 'written-contract-and-policy-cancellation-letter', recipientId: 'srv_adt' },
  { label: 'Cancel Comcast / Xfinity', slug: 'written-contract-and-policy-cancellation-letter', recipientId: 'tel_cmcst' },
  { label: 'Withings / Sonos Refund', slug: 'pre-arbitration-notice-of-dispute-and-refund-request', recipientId: 'leg_wth' },
];

const DEFAULT_RECIPIENT_IDS_BY_SLUG: Record<string, string> = {
  'fcra-credit-bureau-written-dispute-letter': 'cra_eqf',
  'fdcpa-30-day-debt-validation-letter': 'col_pra',
  'written-contract-and-policy-cancellation-letter': 'srv_adt',
  'pre-arbitration-notice-of-dispute-and-refund-request': 'leg_wth',
  '30-day-mandatory-arbitration-opt-out-notice': 'leg_rku',
  'statutory-health-and-biometric-data-deletion-demand': 'leg_wth',
};

const NOTICE_CATEGORIES = [
  { id: 'all', label: 'All Notices (9)' },
  { id: 'tenant', label: 'Landlord & Tenant' },
  { id: 'credit_debt', label: 'Credit & Debt' },
  { id: 'cancellation', label: 'Cancel a Contract' },
  { id: 'consumer_rights', label: 'Refunds & Privacy' },
] as const;

type NoticeCategoryFilter = (typeof NOTICE_CATEGORIES)[number]['id'];

interface EditableFieldItem {
  key: string;
  label: string;
  placeholder: string;
}

function getCoreEditableFields(
  notice: NoticeTemplateDefinition,
  hasVerifiedRecipientDropdown: boolean
): EditableFieldItem[] {
  const base: EditableFieldItem[] = [
    {
      key: 'senderFullName',
      label: 'Your Full Name',
      placeholder: 'Type your full name (e.g. Jordan Taylor)...',
    },
  ];

  if (!hasVerifiedRecipientDropdown) {
    base.push({
      key: 'recipientFormalName',
      label: 'Landlord or Management Company Name',
      placeholder: 'e.g. Oakridge Property Management LLC',
    });
  }

  switch (notice.slug) {
    case 'security-deposit-return-demand-letter':
      return [
        ...base,
        {
          key: 'depositAmount',
          label: 'Security Deposit Amount',
          placeholder: 'e.g. $2,450.00',
        },
        {
          key: 'vacatedPremisesAddress',
          label: 'Apartment / Property Address',
          placeholder: 'e.g. 1420 Ocean Ave, Apt 4B, Santa Monica, CA',
        },
        {
          key: 'moveOutDate',
          label: 'Date You Moved Out',
          placeholder: 'e.g. September 30, 2026',
        },
      ];

    case 'tenant-notice-of-intent-to-vacate':
      return [
        ...base,
        {
          key: 'leasedPremisesAddress',
          label: 'Your Apartment / Rental Address',
          placeholder: 'e.g. 512 Elm St, Apt 2B, Chicago, IL',
        },
        {
          key: 'moveOutDate',
          label: 'Planned Move-Out Date',
          placeholder: 'e.g. November 30, 2026',
        },
        {
          key: 'forwardingAddress',
          label: 'New Forwarding Address (for Deposit Check)',
          placeholder: 'e.g. 800 Lake Shore Dr, Apt 9A, Chicago, IL',
        },
      ];

    case 'tenant-repair-and-maintenance-notice':
      return [
        ...base,
        {
          key: 'leasedPremisesAddress',
          label: 'Your Apartment / Rental Address',
          placeholder: 'e.g. 1044 Market St, Apt 5, San Francisco, CA',
        },
        {
          key: 'defectDescription',
          label: 'What Needs to Be Repaired?',
          placeholder: 'e.g. Heating unit has been broken since October 10',
        },
      ];

    case 'fcra-credit-bureau-written-dispute-letter':
      return [
        ...base,
        {
          key: 'furnisherName',
          label: 'Creditor or Account Name on Credit Report',
          placeholder: 'e.g. Chase Card Services / Synchrony Bank',
        },
        {
          key: 'partialAccountNumber',
          label: 'Account Number (Last 4 Digits)',
          placeholder: 'e.g. XXXX-4829',
        },
        {
          key: 'factualExplanation',
          label: 'Why Is This Account Inaccurate?',
          placeholder: 'e.g. Account was paid in full on March 15, 2026',
        },
      ];

    case 'fdcpa-30-day-debt-validation-letter':
      return [
        ...base,
        {
          key: 'collectorReferenceNumber',
          label: 'Collection Letter Account / Reference #',
          placeholder: 'e.g. File #PRA-98214',
        },
        {
          key: 'allegedOriginalCreditor',
          label: 'Original Creditor Name',
          placeholder: 'e.g. Citibank, N.A. / Capital One',
        },
        {
          key: 'allegedBalance',
          label: 'Amount They Claim You Owe',
          placeholder: 'e.g. $1,420.50',
        },
      ];

    case 'written-contract-and-policy-cancellation-letter':
      return [
        ...base,
        {
          key: 'accountOrPolicyNumber',
          label: 'Account or Policy Number to Cancel',
          placeholder: 'e.g. Account #ADT-8839201',
        },
        {
          key: 'servicePropertyAddress',
          label: 'Service Address on Account',
          placeholder: 'e.g. 410 Broadway, Santa Monica, CA 90401',
        },
        {
          key: 'effectiveCancellationDate',
          label: 'Effective Cancellation Date',
          placeholder: 'e.g. Immediately / October 31, 2026',
        },
      ];

    case 'pre-arbitration-notice-of-dispute-and-refund-request':
      return [
        ...base,
        {
          key: 'productOrServiceName',
          label: 'Product or Device Name',
          placeholder: 'e.g. Withings Body Scan / Sonos Speaker',
        },
        {
          key: 'requestedResolutionAmount',
          label: 'Refund Amount Requested',
          placeholder: 'e.g. $399.95',
        },
        {
          key: 'factualSummary',
          label: 'What Feature Was Removed or Broken?',
          placeholder: 'e.g. Advertised features were placed behind a monthly paywall after purchase',
        },
      ];

    case '30-day-mandatory-arbitration-opt-out-notice':
      return [
        ...base,
        {
          key: 'productOrPlatformName',
          label: 'Product, App, or Service Name',
          placeholder: 'e.g. Roku Smart TV / Samsung Account',
        },
        {
          key: 'accountIdentifier',
          label: 'Account Email or Device Serial Number',
          placeholder: 'e.g. alex@example.com or Serial #SN-99482',
        },
      ];

    case 'statutory-health-and-biometric-data-deletion-demand':
      return [
        ...base,
        {
          key: 'accountEmailOrId',
          label: 'Account Email Address to Erase',
          placeholder: 'e.g. alex@example.com',
        },
      ];

    default:
      return base;
  }
}

/**
 * Clean starting state: leaves personal names, dates, and addresses EMPTY
 * so they appear as unmistakable Amber [ FILL IN ] tags on the letter preview.
 */
function getInitialBlankValues(
  slug: string,
  recipient?: VerifiedRecipientEntry | null
): Record<string, string> {
  const values: Record<string, string> = {};

  if (slug === 'security-deposit-return-demand-letter') {
    values.propertyState = 'CA';
    values.amountReceivedToDate = '$0.00';
    values.responseDays = '10 business days';
  } else if (slug === 'tenant-notice-of-intent-to-vacate') {
    values.leaseNoticePeriod = '30-Day';
  } else if (slug === 'tenant-repair-and-maintenance-notice') {
    values.issueCategory = 'Heating / HVAC Failure';
    values.accessAuthorization = 'Tenant grants maintenance entry with 24-hour advance notice';
  } else if (slug === 'fcra-credit-bureau-written-dispute-letter') {
    values.bureauEntityId = recipient?.id || 'cra_eqf';
    values.disputeReason = 'Account was paid/settled in full but reflects open balance';
  } else if (slug === 'fdcpa-30-day-debt-validation-letter') {
    values.communicationPreference =
      'All future communications regarding this matter must be conducted strictly in writing by U.S. Mail';
  } else if (slug === 'written-contract-and-policy-cancellation-letter') {
    values.serviceTypeLabel = 'Home Security & Monitoring Agreement';
  } else if (slug === 'pre-arbitration-notice-of-dispute-and-refund-request') {
    values.disputeTriggerCategory = 'Post-Purchase Removal or Paywalling of Advertised Feature';
  } else if (slug === 'statutory-health-and-biometric-data-deletion-demand') {
    values.deviceOrAppCategory = 'Connected Health & Biometric Sensor Device';
    values.applicablePrivacyFramework =
      'Applicable State Consumer Data & Biometric Privacy Statutes (including CCPA/CPRA, MHMDA, TDPSA, and BIPA)';
  }

  if (recipient) {
    values.recipientFormalName =
      recipient.formalRecipientLine || recipient.name || recipient.brandName;
    values.recipientAddressLine1 = recipient.addressLine1;
    values.recipientCity = recipient.city;
    values.recipientState = recipient.state;
    values.recipientZip = recipient.zip;
    if (recipient.addressLine2) {
      values.recipientAddressLine2 = recipient.addressLine2;
    }
  }

  return values;
}

/**
 * Optional 1-click sample data for visitors who want to see a filled example.
 */
function getSampleExampleValues(
  slug: string,
  recipient?: VerifiedRecipientEntry | null
): Record<string, string> {
  const base = getInitialBlankValues(slug, recipient);
  const sample: Record<string, string> = {
    ...base,
    senderFullName: 'Jordan Taylor',
    senderAddressLine1: '410 Broadway, Apt 4B',
    senderCity: 'Santa Monica',
    senderState: 'CA',
    senderZip: '90401',
  };

  if (!recipient) {
    sample.recipientFormalName = 'Oakridge Property Management LLC';
    sample.recipientAddressLine1 = '100 Wilshire Blvd, Suite 1200';
    sample.recipientCity = 'Santa Monica';
    sample.recipientState = 'CA';
    sample.recipientZip = '90401';
  }

  switch (slug) {
    case 'security-deposit-return-demand-letter':
      return {
        ...sample,
        depositAmount: '$2,450.00',
        balanceRequested: '$2,450.00',
        vacatedPremisesAddress: '1420 Ocean Ave, Apt 4B, Santa Monica, CA 90401',
        moveOutDate: 'September 30, 2026',
      };
    case 'tenant-notice-of-intent-to-vacate':
      return {
        ...sample,
        leasedPremisesAddress: '1420 Ocean Ave, Apt 4B, Santa Monica, CA 90401',
        moveOutDate: 'November 30, 2026',
        forwardingAddress: '410 Broadway, Apt 4B, Santa Monica, CA 90401',
      };
    case 'tenant-repair-and-maintenance-notice':
      return {
        ...sample,
        leasedPremisesAddress: '1420 Ocean Ave, Apt 4B, Santa Monica, CA 90401',
        dateFirstObserved: 'October 10, 2026',
        defectDescription: 'Central heating system is non-functional with indoor temperatures dropping below 58°F.',
      };
    case 'fcra-credit-bureau-written-dispute-letter':
      return {
        ...sample,
        senderDob: '06/15/1988',
        ssnLast4: '4829',
        furnisherName: 'Synchrony Bank / Retail Card',
        partialAccountNumber: 'XXXX-4829',
        factualExplanation: 'This account was paid and settled in full on March 15, 2026, with $0 balance remaining.',
      };
    case 'fdcpa-30-day-debt-validation-letter':
      return {
        ...sample,
        collectorReferenceNumber: 'PRA-994821',
        allegedOriginalCreditor: 'Citibank, N.A.',
        allegedBalance: '$1,420.50',
        initialContactDate: 'October 5, 2026',
      };
    case 'written-contract-and-policy-cancellation-letter':
      return {
        ...sample,
        accountOrPolicyNumber: 'ADT-8839201',
        servicePropertyAddress: '410 Broadway, Apt 4B, Santa Monica, CA 90401',
        effectiveCancellationDate: 'October 31, 2026',
      };
    case 'pre-arbitration-notice-of-dispute-and-refund-request':
      return {
        ...sample,
        productOrServiceName: `${recipient?.brandName || 'Withings'} Connected Smart Scale`,
        accountOrSerialIdentifier: 'SN-994827104',
        purchaseDate: 'November 15, 2025',
        requestedResolutionAmount: '$399.95',
        factualSummary: 'Core health metrics advertised as included at purchase were locked behind a recurring subscription paywall.',
      };
    case '30-day-mandatory-arbitration-opt-out-notice':
      return {
        ...sample,
        productOrPlatformName: `${recipient?.brandName || 'Roku'} Smart TV & Streaming Account`,
        accountIdentifier: 'jordan.taylor@example.com',
        termsEffectiveOrPurchaseDate: 'October 10, 2026',
      };
    case 'statutory-health-and-biometric-data-deletion-demand':
      return {
        ...sample,
        accountEmailOrId: 'jordan.taylor@example.com',
      };
    default:
      return sample;
  }
}

function getSlugForRecipient(rec: VerifiedRecipientEntry): string {
  switch (rec.category) {
    case 'credit_bureau':
      return 'fcra-credit-bureau-written-dispute-letter';
    case 'debt_collector':
      return 'fdcpa-30-day-debt-validation-letter';
    case 'home_service':
    case 'telecom_insurance':
      return 'written-contract-and-policy-cancellation-letter';
    case 'tech_hardware_legal':
      return 'pre-arbitration-notice-of-dispute-and-refund-request';
    default:
      return 'written-contract-and-policy-cancellation-letter';
  }
}

function getRecipientsForNotice(notice: NoticeTemplateDefinition): VerifiedRecipientEntry[] {
  switch (notice.slug) {
    case 'fcra-credit-bureau-written-dispute-letter':
      return VERIFIED_RECIPIENTS.filter((r) => r.category === 'credit_bureau');
    case 'fdcpa-30-day-debt-validation-letter':
      return VERIFIED_RECIPIENTS.filter((r) => r.category === 'debt_collector');
    case 'written-contract-and-policy-cancellation-letter':
      return VERIFIED_RECIPIENTS.filter(
        (r) => r.category === 'home_service' || r.category === 'telecom_insurance'
      );
    case 'pre-arbitration-notice-of-dispute-and-refund-request':
    case '30-day-mandatory-arbitration-opt-out-notice':
    case 'statutory-health-and-biometric-data-deletion-demand':
      return VERIFIED_RECIPIENTS.filter((r) => r.category === 'tech_hardware_legal');
    default:
      return [];
  }
}

export function InteractiveHomeWorkbench({
  initialSlug = 'security-deposit-return-demand-letter',
}: InteractiveHomeWorkbenchProps = {}) {
  const router = useRouter();

  const [activeSlug, setActiveSlug] = useState<string>(() => {
    const found = getNoticeBySlug(initialSlug);
    return found ? found.slug : 'security-deposit-return-demand-letter';
  });

  const activeNotice: NoticeTemplateDefinition = useMemo(() => {
    return getNoticeBySlug(activeSlug) || ALL_NOTICE_CARTRIDGES[1];
  }, [activeSlug]);

  const [selectedRecipient, setSelectedRecipient] = useState<VerifiedRecipientEntry | null>(() => {
    const defaultRecipientId = DEFAULT_RECIPIENT_IDS_BY_SLUG[initialSlug];
    if (defaultRecipientId) {
      return VERIFIED_RECIPIENTS.find((r) => r.id === defaultRecipientId) || null;
    }
    return null;
  });

  const [userValues, setUserValues] = useState<Record<string, string>>(() => {
    const defaultRecipientId = DEFAULT_RECIPIENT_IDS_BY_SLUG[initialSlug];
    const rec = defaultRecipientId
      ? VERIFIED_RECIPIENTS.find((r) => r.id === defaultRecipientId) || null
      : null;
    return getInitialBlankValues(initialSlug, rec);
  });

  const [selectedTier, setSelectedTier] = useState<MailTierId>(() => {
    return activeNotice.recommendedTier || 'certified';
  });

  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [isSampleFilled, setIsSampleFilled] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<NoticeCategoryFilter>('all');

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Invariant 1: Hard NAICS 713940 Fitness Blocker check
  const isRestrictedFitness = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return false;
    return isFitnessEntity(searchQuery.trim());
  }, [searchQuery]);

  const selectNoticeTemplate = useCallback(
    (slug: string, explicitRecipientId?: string) => {
      const notice = getNoticeBySlug(slug);
      if (!notice) return;

      setActiveSlug(notice.slug);
      const targetRecipientId = explicitRecipientId || DEFAULT_RECIPIENT_IDS_BY_SLUG[notice.slug];
      const recipient = targetRecipientId
        ? VERIFIED_RECIPIENTS.find((r) => r.id === targetRecipientId) || null
        : null;

      setSelectedRecipient(recipient);
      setUserValues(getInitialBlankValues(notice.slug, recipient));
      setSelectedTier(notice.recommendedTier || 'certified');
      setActiveFieldKey(null);
      setIsSampleFilled(false);
    },
    []
  );

  // Listen for selection events from the catalog below the fold
  useEffect(() => {
    const handleSelectNoticeEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ slug?: string; recipientId?: string }>;
      if (customEvent.detail) {
        const { slug, recipientId } = customEvent.detail;
        if (slug) {
          selectNoticeTemplate(slug, recipientId);
        } else if (recipientId) {
          const foundRecipient = VERIFIED_RECIPIENTS.find((r) => r.id === recipientId);
          if (foundRecipient) {
            const targetSlug = getSlugForRecipient(foundRecipient);
            selectNoticeTemplate(targetSlug, recipientId);
          }
        }
        const el = document.getElementById('workbench');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('docketstamp:select-notice', handleSelectNoticeEvent);
    return () => {
      window.removeEventListener('docketstamp:select-notice', handleSelectNoticeEvent);
    };
  }, [selectNoticeTemplate]);

  const handleValueChange = (key: string, value: string) => {
    setUserValues((prev) => {
      const next = { ...prev, [key]: value };
      // Keep balanceRequested synced with depositAmount on homepage unless user overrides
      if (key === 'depositAmount' && activeNotice.slug === 'security-deposit-return-demand-letter') {
        next.balanceRequested = value;
      }
      return next;
    });
  };

  const handleToggleSample = () => {
    if (isSampleFilled) {
      setUserValues(getInitialBlankValues(activeNotice.slug, selectedRecipient));
      setIsSampleFilled(false);
    } else {
      setUserValues(getSampleExampleValues(activeNotice.slug, selectedRecipient));
      setIsSampleFilled(true);
    }
  };

  const handleRecipientChange = (recipientId: string) => {
    if (!recipientId) {
      setSelectedRecipient(null);
      setUserValues((prev) => ({
        ...prev,
        recipientFormalName: '',
        recipientAddressLine1: '',
        recipientCity: '',
        recipientState: '',
        recipientZip: '',
      }));
      return;
    }
    const recipient = VERIFIED_RECIPIENTS.find((r) => r.id === recipientId) || null;
    setSelectedRecipient(recipient);
    if (recipient) {
      setUserValues((prev) => ({
        ...prev,
        recipientFormalName:
          recipient.formalRecipientLine || recipient.name || recipient.brandName,
        recipientAddressLine1: recipient.addressLine1,
        recipientAddressLine2: recipient.addressLine2 || '',
        recipientCity: recipient.city,
        recipientState: recipient.state,
        recipientZip: recipient.zip,
        bureauEntityId: recipient.id,
      }));
    }
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || isRestrictedFitness) return { recipients: [], notices: [] };

    const matchingRecipients = VERIFIED_RECIPIENTS.filter(
      (r) =>
        r.brandName.toLowerCase().includes(q) ||
        r.formalRecipientLine.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
    ).slice(0, 5);

    const matchingNotices = ALL_NOTICE_CARTRIDGES.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.shortDescription.toLowerCase().includes(q) ||
        n.slug.toLowerCase().includes(q)
    ).slice(0, 4);

    return { recipients: matchingRecipients, notices: matchingNotices };
  }, [searchQuery, isRestrictedFitness]);

  const handleSelectRecipientMatch = (rec: VerifiedRecipientEntry) => {
    const targetSlug = getSlugForRecipient(rec);
    selectNoticeTemplate(targetSlug, rec.id);
    setSearchQuery('');
  };

  const filteredNotices = useMemo(() => {
    if (categoryFilter === 'all') return ALL_NOTICE_CARTRIDGES;
    return ALL_NOTICE_CARTRIDGES.filter((n) => n.category === categoryFilter);
  }, [categoryFilter]);

  const compatibleRecipients = useMemo(() => {
    return getRecipientsForNotice(activeNotice);
  }, [activeNotice]);

  const stateStatutesList = useMemo(() => {
    return Object.values(STATE_STATUTES).sort((a, b) => a.stateName.localeCompare(b.stateName));
  }, []);

  const currentStatute: StateStatuteEntry = useMemo(() => {
    const code = (userValues.propertyState || 'CA').toUpperCase();
    return STATE_STATUTES[code] || STATE_STATUTES['CA'];
  }, [userValues.propertyState]);

  const editableFields = useMemo(() => {
    const baseFields = getCoreEditableFields(activeNotice, compatibleRecipients.length > 0);
    // If user clicked a field on the letter that isn't in the default short list, surface it dynamically!
    if (
      activeFieldKey &&
      !baseFields.some((f) => f.key === activeFieldKey) &&
      activeFieldKey !== 'propertyState'
    ) {
      const noticeField = activeNotice.fields.find((f) => f.key === activeFieldKey);
      if (noticeField) {
        return [
          ...baseFields,
          {
            key: noticeField.key,
            label: noticeField.label,
            placeholder: noticeField.placeholder || `Enter ${noticeField.label.toLowerCase()}...`,
          },
        ];
      }
    }
    return baseFields;
  }, [activeNotice, compatibleRecipients.length, activeFieldKey]);

  const buildHydrationUrl = useCallback(
    (focusField?: string) => {
      const searchParams = new URLSearchParams();
      searchParams.set('tier', selectedTier);
      if (selectedRecipient?.id) {
        searchParams.set('recipientId', selectedRecipient.id);
      }
      for (const [key, val] of Object.entries(userValues)) {
        if (val && typeof val === 'string' && val.trim().length > 0) {
          searchParams.set(`field.${key}`, val.trim());
        }
      }
      if (focusField) {
        searchParams.set('focus', focusField);
      }
      return `/notices/${activeNotice.slug}?${searchParams.toString()}`;
    },
    [selectedTier, selectedRecipient, userValues, activeNotice.slug]
  );

  // When a user clicks ANY highlighted tag or name on the letter preview:
  // Focus the matching input box in the left column (creating it if needed)
  const handleTokenClick = useCallback((fieldKey: string) => {
    const mappedKey =
      fieldKey === 'senderFullAddress'
        ? 'senderFullName'
        : fieldKey === 'recipientFullAddress'
        ? 'recipientFormalName'
        : fieldKey;

    setActiveFieldKey(mappedKey);
    setTimeout(() => {
      const targetEl = inputRefs.current[mappedKey];
      if (targetEl) {
        targetEl.focus();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 30);
  }, []);

  const handleOpenWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildHydrationUrl());
  };

  const tierPrices: Record<MailTierId, string> = {
    first_class: '$12.95',
    certified: '$19.95',
    certified_return_receipt: '$27.95',
  };

  // Real-time document interpolation — no fake hardcoded names when userValues are blank!
  const interpolatedDoc = useMemo(() => {
    const stateSuffix = (
      userValues.propertyState ||
      selectedRecipient?.state ||
      userValues.recipientState ||
      'US'
    ).toUpperCase();
    const docketId = `DS-2026-88419-${stateSuffix}`;

    const senderAddress = {
      name: userValues.senderFullName || '',
      address_line1: userValues.senderAddressLine1 || '',
      address_city: userValues.senderCity || '',
      address_state: userValues.senderState || '',
      address_zip: userValues.senderZip || '',
      address_country: 'US',
    };

    const recipientAddress = selectedRecipient
      ? {
          name:
            selectedRecipient.formalRecipientLine ||
            selectedRecipient.name ||
            selectedRecipient.brandName,
          company: selectedRecipient.brandName,
          address_line1: selectedRecipient.addressLine1,
          address_line2: selectedRecipient.addressLine2,
          address_city: selectedRecipient.city,
          address_state: selectedRecipient.state,
          address_zip: selectedRecipient.zip,
          address_country: 'US',
        }
      : {
          name: userValues.recipientFormalName || '',
          address_line1: userValues.recipientAddressLine1 || '',
          address_city: userValues.recipientCity || '',
          address_state: userValues.recipientState || '',
          address_zip: userValues.recipientZip || '',
          address_country: 'US',
        };

    return interpolateNotice({
      notice: activeNotice,
      userValues,
      docketId,
      serviceLevel: selectedTier,
      senderAddress,
      recipientAddress,
    });
  }, [activeNotice, userValues, selectedRecipient, selectedTier]);

  return (
    <section
      id="workbench"
      className="relative w-full bg-[#0F172A] text-slate-100 py-8 lg:py-10 border-b border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ========================================================= */}
          {/* LEFT COLUMN: Step-by-Step Interactive Builder (5 Cols)    */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Customer Value Proposition Headline */}
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-sans font-semibold bg-sky-950/90 text-sky-300 border border-sky-800/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Printed &amp; Mailed via Official USPS Certified Mail®</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl lg:text-[34px] font-bold text-white tracking-tight text-balance leading-[1.18]">
                Send Formal Legal Notices They Can&apos;t Ignore.
              </h1>
              <p className="text-pretty text-xs sm:text-sm text-slate-300 leading-relaxed">
                Landlords, credit bureaus, and corporations routinely ignore emails and phone calls.
                Fill in the blanks below—we cite the law, print your letter, and mail it via
                tracked USPS Certified Mail® in 60 seconds without a trip to the Post Office.
              </p>
            </div>

            {/* 2. Company & Situation Search Bar + Popular Chips */}
            <div className="space-y-2">
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 38 companies (Equifax, ADT, Comcast, Withings) or topic..."
                    className="w-full pl-10 pr-14 py-2.5 bg-slate-950/90 border border-slate-700 rounded-xl text-xs sm:text-sm font-sans text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 text-xs font-sans text-slate-400 hover:text-white transition"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Invariant 1: NAICS 713940 Restricted Fitness Entity Alert */}
                {isRestrictedFitness && (
                  <div className="mt-2.5 p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/70 text-amber-200 text-xs space-y-1 shadow-lg">
                    <div className="flex items-center gap-2 font-bold text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Gym &amp; Fitness Club Memberships Not Supported</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-200/90 font-sans">
                      DocketStamp does not process cancellations for gyms, health clubs, or fitness
                      studios (NAICS 713940). Connected consumer electronics and smart hardware
                      brands (Withings, Garmin, Sonos, LG, Samsung, Apple) are fully supported.
                    </p>
                  </div>
                )}

                {/* Search Results Dropdown */}
                {searchQuery.trim().length > 0 && !isRestrictedFitness && (
                  <div className="mt-2 p-2 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl max-h-72 overflow-y-auto space-y-2 text-xs z-20">
                    {searchResults.recipients.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[11px] text-slate-400 font-semibold">
                          Pre-Addressed Company Legal Departments
                        </div>
                        <div className="space-y-1">
                          {searchResults.recipients.map((rec) => (
                            <div
                              key={rec.id}
                              className="p-2 rounded-lg hover:bg-slate-800 transition flex items-center justify-between group"
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectRecipientMatch(rec)}
                                className="text-left flex-1"
                              >
                                <div className="font-semibold text-white group-hover:text-sky-300 flex items-center gap-1.5">
                                  <span>{rec.brandName}</span>
                                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/60">
                                    ✓ Official Legal Dept
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 truncate max-w-[260px]">
                                  {rec.formalRecipientLine} ({rec.city}, {rec.state})
                                </div>
                              </button>
                              <Link
                                href={`/notices/${getSlugForRecipient(rec)}?recipientId=${rec.id}&tier=${selectedTier}`}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white transition shrink-0 ml-2"
                              >
                                Start &rarr;
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.notices.length > 0 && (
                      <div className="border-t border-slate-800 pt-1.5">
                        <div className="px-2 py-1 text-[11px] text-slate-400 font-semibold">
                          Matching Legal Notices
                        </div>
                        <div className="space-y-1">
                          {searchResults.notices.map((n) => (
                            <button
                              key={n.slug}
                              type="button"
                              onClick={() => {
                                selectNoticeTemplate(n.slug);
                                setSearchQuery('');
                              }}
                              className="w-full p-2 rounded-lg hover:bg-slate-800 transition text-left flex items-center justify-between group"
                            >
                              <div>
                                <div className="font-semibold text-white group-hover:text-sky-300">
                                  {n.title}
                                </div>
                                <div className="text-[11px] text-slate-400 line-clamp-1">
                                  {n.shortDescription}
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-sky-400 shrink-0 ml-2">
                                Select &rarr;
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.recipients.length === 0 &&
                      searchResults.notices.length === 0 && (
                        <div className="p-3 text-center text-slate-400 text-xs">
                          No matches for &quot;{searchQuery}&quot;. You can enter any custom landlord
                          or company address below.
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Popular 1-Click Scenario Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-sans text-slate-400 font-medium mr-1">
                  Popular:
                </span>
                {POPULAR_SCENARIO_CHIPS.map((chip) => {
                  const isChipActive =
                    activeNotice.slug === chip.slug &&
                    (!chip.recipientId || selectedRecipient?.id === chip.recipientId);
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => selectNoticeTemplate(chip.slug, chip.recipientId)}
                      className={`px-2.5 py-1 text-xs font-sans rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                        isChipActive
                          ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold shadow-sm'
                          : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Step 1 & Step 2 Card: Choose Notice + Fill In Your Blanks */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
              {/* STEP 1: Choose What You Need to Send */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="notice-template-selector"
                    className="text-xs font-sans font-bold uppercase tracking-wider text-sky-400"
                  >
                    Step 1 &bull; Choose Your Notice
                  </label>
                  <span className="text-[11px] font-sans text-slate-400">
                    {activeNotice.usesStateStatuteLookup
                      ? 'Includes 50-State Law Citations'
                      : 'Includes Federal & Contract Citations'}
                  </span>
                </div>

                {/* Category Filter Pills */}
                <div className="flex flex-wrap gap-1">
                  {NOTICE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 text-[11px] font-sans rounded-md transition cursor-pointer ${
                        categoryFilter === cat.id
                          ? 'bg-slate-800 text-white font-semibold border border-slate-600'
                          : 'text-slate-400 hover:text-slate-200 bg-slate-950/50 border border-transparent'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <select
                  id="notice-template-selector"
                  value={activeNotice.slug}
                  onChange={(e) => selectNoticeTemplate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs sm:text-sm font-sans font-semibold bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-500 transition cursor-pointer"
                >
                  {filteredNotices.map((n) => (
                    <option key={n.slug} value={n.slug}>
                      {n.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* STEP 2: Fill In the Highlighted Blanks */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-sans font-bold uppercase tracking-wider text-amber-400 block">
                      Step 2 &bull; Fill In Your Details
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Type below or click any highlighted box on the letter to edit
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleSample}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-sans font-medium text-slate-200 hover:text-white transition flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {isSampleFilled ? (
                      <>
                        <RotateCcw className="w-3 h-3 text-amber-400" />
                        <span>Clear Sample</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-sky-400" />
                        <span>See Filled Example</span>
                      </>
                    )}
                  </button>
                </div>

                {/* A. 50-State Selector (When Notice Uses State Law) */}
                {activeNotice.usesStateStatuteLookup && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <label
                      htmlFor="state-statute-select"
                      className="text-xs font-sans font-semibold text-slate-200 flex items-center justify-between"
                    >
                      <span>Which State Is the Rental Property In?</span>
                      <span className="text-[11px] text-emerald-400 font-medium">
                        Auto-Cites State Law
                      </span>
                    </label>
                    <select
                      id="state-statute-select"
                      value={userValues.propertyState || 'CA'}
                      onChange={(e) => handleValueChange('propertyState', e.target.value)}
                      className="w-full px-3 py-2 text-xs font-sans font-medium bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 transition cursor-pointer"
                    >
                      {stateStatutesList.map((st) => (
                        <option key={st.stateCode} value={st.stateCode}>
                          {st.stateName} — Statutory Deadline: {st.returnDeadlineLabel} (
                          {st.statuteCitation})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* B. Pre-Addressed Company Legal Department Selector (or Custom Company) */}
                {compatibleRecipients.length > 0 && (
                  <div className="space-y-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <label
                      htmlFor="verified-recipient-select"
                      className="text-xs font-sans font-semibold text-slate-200 flex items-center justify-between"
                    >
                      <span>Who Are You Sending This To?</span>
                      <span className="text-[11px] text-emerald-400 font-medium">
                        Official Legal Dept Pre-Addressed
                      </span>
                    </label>
                    <select
                      id="verified-recipient-select"
                      value={selectedRecipient?.id || ''}
                      onChange={(e) => handleRecipientChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-sans font-medium bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 transition cursor-pointer"
                    >
                      {compatibleRecipients.map((rec) => (
                        <option key={rec.id} value={rec.id}>
                          {rec.brandName} — {rec.formalRecipientLine}
                        </option>
                      ))}
                      {activeNotice.slug !== 'fcra-credit-bureau-written-dispute-letter' && (
                        <option value="">+ Enter a Different Company Name...</option>
                      )}
                    </select>

                    {selectedRecipient ? (
                      <div className="text-[11px] font-sans text-emerald-300 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/50 rounded-lg px-2.5 py-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">
                          Pre-addressed to: <strong>{selectedRecipient.addressLine1}</strong>,{' '}
                          {selectedRecipient.city}, {selectedRecipient.state}{' '}
                          {selectedRecipient.zip}
                        </span>
                      </div>
                    ) : (
                      <input
                        id="workbench-input-recipientFormalName"
                        ref={(el) => {
                          inputRefs.current['recipientFormalName'] = el;
                        }}
                        type="text"
                        value={userValues.recipientFormalName || ''}
                        onChange={(e) => handleValueChange('recipientFormalName', e.target.value)}
                        onFocus={() => setActiveFieldKey('recipientFormalName')}
                        onBlur={() => setActiveFieldKey(null)}
                        placeholder="Type company or recipient name..."
                        className="w-full px-3 py-2 text-xs font-sans bg-slate-900 rounded-lg border border-amber-500/60 text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
                      />
                    )}
                  </div>
                )}

                {/* C. Editable Blank Inputs (Your Name + Recipient + Notice Blanks) */}
                <div className="space-y-2.5">
                  {editableFields.map((field) => {
                    const isFilled =
                      typeof userValues[field.key] === 'string' &&
                      userValues[field.key].trim().length > 0;
                    const isFocused = activeFieldKey === field.key;

                    return (
                      <div key={field.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor={`workbench-input-${field.key}`}
                            className="text-xs font-sans font-medium text-slate-200 flex items-center gap-1.5"
                          >
                            <span>{field.label}</span>
                          </label>
                          {isFilled ? (
                            <span className="text-[11px] font-sans text-emerald-400 flex items-center gap-1 font-medium">
                              <Check className="w-3 h-3" />
                              Added to letter
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-sans font-bold bg-[#FEF3C7] text-[#92400E]">
                              Highlighted on letter
                            </span>
                          )}
                        </div>
                        <input
                          id={`workbench-input-${field.key}`}
                          ref={(el) => {
                            inputRefs.current[field.key] = el;
                          }}
                          type="text"
                          value={userValues[field.key] || ''}
                          onChange={(e) => handleValueChange(field.key, e.target.value)}
                          onFocus={() => setActiveFieldKey(field.key)}
                          onBlur={() => setActiveFieldKey(null)}
                          placeholder={field.placeholder}
                          className={`w-full px-3 py-2 text-xs sm:text-sm font-sans bg-slate-950/90 rounded-lg border transition text-white placeholder-slate-500 focus:outline-none ${
                            isFocused
                              ? 'border-sky-400 ring-2 ring-sky-500/40'
                              : !isFilled
                              ? 'border-amber-500/60 hover:border-amber-400'
                              : 'border-slate-700 hover:border-slate-600'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Step 3: Choose USPS Mail Option */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-sans">
                <span className="text-slate-200 font-bold uppercase tracking-wider">
                  Step 3 &bull; Choose USPS Delivery &amp; Proof
                </span>
                <span className="text-[11px] text-slate-400">
                  Includes printing, envelope &amp; USPS postage
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['first_class', 'certified', 'certified_return_receipt'] as MailTierId[]).map(
                  (tierId) => {
                    const tier = DOCKET_PRICING_TIERS[tierId];
                    const isSelected = selectedTier === tierId;
                    const isPopular = tierId === 'certified';
                    const isBestProof = tierId === 'certified_return_receipt';

                    return (
                      <button
                        key={tierId}
                        type="button"
                        onClick={() => setSelectedTier(tierId)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between relative ${
                          isSelected
                            ? 'bg-slate-800 border-sky-400 ring-1 ring-sky-400 shadow-md'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                        }`}
                      >
                        {isPopular && (
                          <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded text-[9px] font-sans font-bold bg-sky-400 text-slate-950 uppercase">
                            Most Popular
                          </span>
                        )}
                        {isBestProof && (
                          <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded text-[9px] font-sans font-bold bg-emerald-400 text-slate-950 uppercase">
                            Court Proof
                          </span>
                        )}
                        <div>
                          <div className="font-sans text-xs font-bold text-white flex items-center justify-between">
                            <span>
                              {tierId === 'first_class'
                                ? 'First-Class'
                                : tierId === 'certified'
                                ? 'Certified Mail®'
                                : 'Certified + Signature'}
                            </span>
                            <span
                              className={`font-mono text-xs font-bold ${
                                isSelected ? 'text-sky-300' : 'text-slate-300'
                              }`}
                            >
                              {tier.formattedPrice}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5 line-clamp-1">
                            {tierId === 'first_class'
                              ? 'Standard tracked delivery'
                              : tierId === 'certified'
                              ? 'Official USPS proof of mailing'
                              : 'Includes signed receipt PDF'}
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* 5. Primary Conversion Button */}
            <form
              {...({
                toolname: 'stage_homepage_notice',
                tooldescription:
                  'Launch pre-populated statutory notice workspace on DocketStamp',
              } as any)}
              onSubmit={handleOpenWorkspace}
            >
              <button
                type="submit"
                className="w-full group rounded-xl bg-sky-500 hover:bg-sky-400 px-5 py-3.5 font-sans font-bold text-slate-950 shadow-xl shadow-sky-500/20 active:scale-[0.99] transition cursor-pointer flex flex-col items-center justify-center"
              >
                <div className="flex items-center gap-2 text-sm sm:text-base font-bold">
                  <span>Continue to Finalize &amp; Mail Letter ({tierPrices[selectedTier]})</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
                <div className="text-[11px] text-slate-900/80 font-medium mt-0.5">
                  Review your full letter, add your return address, and sign on the next screen
                </div>
              </button>
            </form>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Live Interactive Letter Preview (7 Cols)    */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 space-y-3">
            {/* Simple, Self-Evident Header Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-xl">
              <div className="flex flex-wrap items-center gap-2 text-xs font-sans">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-bold text-white">Your Live Letter Preview</span>
                <span className="text-slate-500 hidden sm:inline">&bull;</span>
                <span className="text-amber-300 font-medium">
                  Click any highlighted box on the page to edit it
                </span>
              </div>

              <Link
                href={buildHydrationUrl()}
                className="px-3 py-1.5 text-xs font-sans font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition flex items-center gap-1 shrink-0"
              >
                <span>Finish &amp; Mail Letter</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Live Paper Sheet Container */}
            <div className="w-full flex justify-center overflow-x-auto p-2 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800 shadow-2xl">
              <div className="w-full max-w-[850px]">
                <LivePaperSheet
                  doc={interpolatedDoc}
                  onTokenClick={handleTokenClick}
                  activeFieldKey={activeFieldKey}
                  isSignatureAdopted={isSampleFilled}
                  selectedTier={selectedTier}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
