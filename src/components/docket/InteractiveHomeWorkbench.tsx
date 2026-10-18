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
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Building2,
  Scale,
  Sparkles,
  FileCheck,
  PenTool,
  Check,
  Building,
  Info,
} from 'lucide-react';

export interface InteractiveHomeWorkbenchProps {
  initialSlug?: string;
}

interface QuickChip {
  label: string;
  slug: string;
  recipientId?: string;
}

const QUICK_SELECT_CHIPS: QuickChip[] = [
  { label: 'Security Deposit (50-State)', slug: 'security-deposit-return-demand-letter' },
  { label: 'Equifax', slug: 'fcra-credit-bureau-written-dispute-letter', recipientId: 'cra_eqf' },
  { label: 'Experian', slug: 'fcra-credit-bureau-written-dispute-letter', recipientId: 'cra_exp' },
  { label: 'TransUnion', slug: 'fcra-credit-bureau-written-dispute-letter', recipientId: 'cra_tu' },
  { label: 'Portfolio Recovery', slug: 'fdcpa-30-day-debt-validation-letter', recipientId: 'col_pra' },
  { label: 'ADT Security', slug: 'written-contract-and-policy-cancellation-letter', recipientId: 'srv_adt' },
  { label: 'Comcast', slug: 'written-contract-and-policy-cancellation-letter', recipientId: 'srv_cmc' },
  { label: 'Withings', slug: 'pre-arbitration-notice-of-dispute-and-refund-request', recipientId: 'leg_wth' },
  { label: 'Sonos', slug: 'pre-arbitration-notice-of-dispute-and-refund-request', recipientId: 'leg_sns' },
  { label: 'Samsung', slug: '30-day-mandatory-arbitration-opt-out-notice', recipientId: 'leg_sam' },
];

const DEFAULT_RECIPIENT_IDS_BY_SLUG: Record<string, string> = {
  'fcra-credit-bureau-written-dispute-letter': 'cra_eqf',
  'fdcpa-30-day-debt-validation-letter': 'col_pra',
  'written-contract-and-policy-cancellation-letter': 'srv_adt',
  'pre-arbitration-notice-of-dispute-and-refund-request': 'leg_wth',
  '30-day-mandatory-arbitration-opt-out-notice': 'leg_rku',
  'statutory-health-and-biometric-data-deletion-demand': 'leg_wth',
};

const CARTRIDGE_CATEGORIES = [
  { id: 'all', label: 'All Cartridges (9)' },
  { id: 'tenant', label: 'Housing & Tenant (3)' },
  { id: 'credit_debt', label: 'Credit & Debt (2)' },
  { id: 'cancellation', label: 'Cancellations (1)' },
  { id: 'consumer_rights', label: 'Tech & Privacy (3)' },
] as const;

type CartridgeCategoryFilter = (typeof CARTRIDGE_CATEGORIES)[number]['id'];

interface QuickInputField {
  key: string;
  label: string;
  placeholder: string;
  isAmberRequired?: boolean;
}

function getQuickInputFields(notice: NoticeTemplateDefinition): QuickInputField[] {
  switch (notice.slug) {
    case 'security-deposit-return-demand-letter':
      return [
        {
          key: 'depositAmount',
          label: 'Deposit Amount',
          placeholder: '$2,450.00',
        },
        {
          key: 'vacatedPremisesAddress',
          label: 'Vacated Property Address',
          placeholder: 'e.g. 1420 Ocean Ave, Apt 4B, Santa Monica, CA',
          isAmberRequired: true,
        },
        {
          key: 'moveOutDate',
          label: 'Move-Out Date',
          placeholder: 'e.g. September 30, 2026',
          isAmberRequired: true,
        },
      ];

    case 'tenant-notice-of-intent-to-vacate':
      return [
        {
          key: 'leasedPremisesAddress',
          label: 'Leased Property Address',
          placeholder: 'e.g. 742 Evergreen Terrace, Springfield',
          isAmberRequired: true,
        },
        {
          key: 'moveOutDate',
          label: 'Vacate Date',
          placeholder: 'e.g. November 30, 2026',
          isAmberRequired: true,
        },
        {
          key: 'leaseNoticePeriod',
          label: 'Notice Period',
          placeholder: '30 days',
        },
      ];

    case 'tenant-repair-and-maintenance-notice':
      return [
        {
          key: 'leasedPremisesAddress',
          label: 'Leased Premises Address',
          placeholder: 'e.g. 1044 Market Street, Apt 5',
          isAmberRequired: true,
        },
        {
          key: 'defectDescription',
          label: 'Defect / Repair Needed',
          placeholder: 'e.g. Water heater leaking into living area',
          isAmberRequired: true,
        },
      ];

    case 'fcra-credit-bureau-written-dispute-letter':
      return [
        {
          key: 'furnisherName',
          label: 'Furnisher / Creditor Name',
          placeholder: 'e.g. Chase Card Services / Synchrony',
          isAmberRequired: true,
        },
        {
          key: 'partialAccountNumber',
          label: 'Account Reference (Last 4)',
          placeholder: 'e.g. Ending in ...4829',
          isAmberRequired: true,
        },
        {
          key: 'factualExplanation',
          label: 'Dispute Summary',
          placeholder: 'e.g. Account was settled in full on March 15',
        },
      ];

    case 'fdcpa-30-day-debt-validation-letter':
      return [
        {
          key: 'collectorReferenceNumber',
          label: 'Collector Reference / File #',
          placeholder: 'e.g. File #PRA-98214',
          isAmberRequired: true,
        },
        {
          key: 'allegedBalance',
          label: 'Alleged Balance Amount',
          placeholder: 'e.g. $1,420.50',
        },
        {
          key: 'initialContactDate',
          label: 'Initial Written Notice Date',
          placeholder: 'e.g. October 5, 2026',
          isAmberRequired: true,
        },
      ];

    case 'written-contract-and-policy-cancellation-letter':
      return [
        {
          key: 'accountOrPolicyNumber',
          label: 'Account / Policy Number',
          placeholder: 'e.g. Account #ADT-8839201',
          isAmberRequired: true,
        },
        {
          key: 'servicePropertyAddress',
          label: 'Service Property Address',
          placeholder: 'e.g. 410 Broadway, Suite 200, Santa Monica, CA',
          isAmberRequired: true,
        },
      ];

    case 'pre-arbitration-notice-of-dispute-and-refund-request':
      return [
        {
          key: 'accountOrSerialIdentifier',
          label: 'Device Serial / Account ID',
          placeholder: 'e.g. Serial #SN-994827104',
          isAmberRequired: true,
        },
        {
          key: 'factualSummary',
          label: 'Defect / Breach Summary',
          placeholder: 'e.g. Optical sensor glass failed within 12 months',
          isAmberRequired: true,
        },
        {
          key: 'requestedResolutionAmount',
          label: 'Requested Refund Amount',
          placeholder: 'e.g. $499.95',
        },
      ];

    case '30-day-mandatory-arbitration-opt-out-notice':
      return [
        {
          key: 'accountIdentifier',
          label: 'Account Email / Device ID',
          placeholder: 'e.g. user@example.com or Device Serial',
          isAmberRequired: true,
        },
        {
          key: 'productOrPlatformName',
          label: 'Platform / Product Name',
          placeholder: 'e.g. Roku Streaming Stick & Smart TV OS',
        },
      ];

    case 'statutory-health-and-biometric-data-deletion-demand':
      return [
        {
          key: 'accountEmailOrId',
          label: 'Registered Account Email',
          placeholder: 'e.g. user@example.com',
          isAmberRequired: true,
        },
        {
          key: 'deviceOrAppCategory',
          label: 'Device / Telemetry Scope',
          placeholder: 'e.g. Connected Health Metrics & Biometric Telemetry',
        },
      ];

    default:
      return [];
  }
}

function getDefaultValuesForNotice(
  slug: string,
  recipient?: VerifiedRecipientEntry | null
): Record<string, string> {
  const baseSender = {
    senderFullName: 'Marcus Vance',
    senderAddressLine1: '410 Broadway, Suite 200',
    senderCity: 'Santa Monica',
    senderState: 'CA',
    senderZip: '90401',
  };

  let values: Record<string, string> = { ...baseSender };

  switch (slug) {
    case 'security-deposit-return-demand-letter':
      values = {
        ...values,
        recipientFormalName: 'Pacific Coast Property Management LLC',
        recipientAddressLine1: '100 Wilshire Blvd, Suite 1200',
        recipientCity: 'Santa Monica',
        recipientState: 'CA',
        recipientZip: '90401',
        propertyState: 'CA',
        depositAmount: '$2,450.00',
        amountReceivedToDate: '$0.00',
        balanceRequested: '$2,450.00',
        responseDays: '10 business days',
        vacatedPremisesAddress: '',
        moveOutDate: '',
      };
      break;

    case 'tenant-notice-of-intent-to-vacate':
      values = {
        ...values,
        recipientFormalName: 'Pacific Coast Property Management LLC',
        recipientAddressLine1: '100 Wilshire Blvd, Suite 1200',
        recipientCity: 'Santa Monica',
        recipientState: 'CA',
        recipientZip: '90401',
        leaseNoticePeriod: '30 days',
        forwardingAddress: '410 Broadway, Suite 200, Santa Monica, CA 90401',
        leasedPremisesAddress: '',
        moveOutDate: '',
      };
      break;

    case 'tenant-repair-and-maintenance-notice':
      values = {
        ...values,
        recipientFormalName: 'Pacific Coast Property Management LLC',
        recipientAddressLine1: '100 Wilshire Blvd, Suite 1200',
        recipientCity: 'Santa Monica',
        recipientState: 'CA',
        recipientZip: '90401',
        issueCategory: 'plumbing',
        accessAuthorization: 'Tenant provides permission to enter with 24 hours written notice',
        dateFirstObserved: 'October 1, 2026',
        leasedPremisesAddress: '',
        defectDescription: '',
      };
      break;

    case 'fcra-credit-bureau-written-dispute-letter':
      values = {
        ...values,
        bureauEntityId: recipient?.id || 'cra_eqf',
        senderDob: '1984-06-15',
        ssnLast4: '4819',
        disputeReason: 'inaccurate_status',
        furnisherName: '',
        partialAccountNumber: '',
        factualExplanation:
          'This account was paid in full and should not reflect delinquent or charged-off status.',
      };
      break;

    case 'fdcpa-30-day-debt-validation-letter':
      values = {
        ...values,
        allegedOriginalCreditor: 'Citibank, N.A.',
        allegedBalance: '$1,420.50',
        communicationPreference:
          'Written USPS postal correspondence only; cease all telephone contact',
        collectorReferenceNumber: '',
        initialContactDate: '',
      };
      break;

    case 'written-contract-and-policy-cancellation-letter':
      values = {
        ...values,
        serviceTypeLabel: 'Residential Home Security Monitoring',
        effectiveCancellationDate: 'Immediately upon statutory receipt',
        accountOrPolicyNumber: '',
        servicePropertyAddress: '',
      };
      break;

    case 'pre-arbitration-notice-of-dispute-and-refund-request':
      values = {
        ...values,
        productOrServiceName: 'ScanWatch Horizon',
        purchaseDate: 'October 12, 2025',
        disputeTriggerCategory: 'hardware_failure',
        requestedResolutionAmount: '$499.95',
        accountOrSerialIdentifier: '',
        factualSummary: '',
      };
      break;

    case '30-day-mandatory-arbitration-opt-out-notice':
      values = {
        ...values,
        productOrPlatformName: 'Roku Streaming Stick & Smart TV OS',
        termsEffectiveOrPurchaseDate: 'Within 30 days of updated Terms of Service',
        accountIdentifier: '',
      };
      break;

    case 'statutory-health-and-biometric-data-deletion-demand':
      values = {
        ...values,
        deviceOrAppCategory: 'Connected Health Metrics & Biometric Telemetry',
        applicablePrivacyFramework: 'CCPA / CPRA & State Comprehensive Privacy Laws',
        accountEmailOrId: '',
      };
      break;

    default:
      break;
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

  // 1. Notice selection state
  const [activeSlug, setActiveSlug] = useState<string>(() => {
    const found = getNoticeBySlug(initialSlug);
    return found ? found.slug : 'security-deposit-return-demand-letter';
  });

  const activeNotice: NoticeTemplateDefinition = useMemo(() => {
    return getNoticeBySlug(activeSlug) || ALL_NOTICE_CARTRIDGES[1];
  }, [activeSlug]);

  // 2. Verified recipient state
  const [selectedRecipient, setSelectedRecipient] = useState<VerifiedRecipientEntry | null>(() => {
    const defaultRecipientId = DEFAULT_RECIPIENT_IDS_BY_SLUG[initialSlug];
    if (defaultRecipientId) {
      return VERIFIED_RECIPIENTS.find((r) => r.id === defaultRecipientId) || null;
    }
    return null;
  });

  // 3. User form values state (pre-seeded with realistic specimen data)
  const [userValues, setUserValues] = useState<Record<string, string>>(() => {
    const defaultRecipientId = DEFAULT_RECIPIENT_IDS_BY_SLUG[initialSlug];
    const rec = defaultRecipientId
      ? VERIFIED_RECIPIENTS.find((r) => r.id === defaultRecipientId) || null
      : null;
    return getDefaultValuesForNotice(initialSlug, rec);
  });

  // 4. Dispatch tier state
  const [selectedTier, setSelectedTier] = useState<MailTierId>(() => {
    return activeNotice.recommendedTier || 'certified';
  });

  // 5. Active focused field key & electronic signature preview toggle
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [isSignatureAdoptedPreview, setIsSignatureAdoptedPreview] = useState<boolean>(false);

  // 6. Omnibox search & category filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<CartridgeCategoryFilter>('all');

  // Input element refs for smooth focus scrolling
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Invariant 1: Hard NAICS 713940 Fitness Blocker check
  const isRestrictedFitness = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return false;
    return isFitnessEntity(searchQuery.trim());
  }, [searchQuery]);

  // Cartridge switching helper
  const selectCartridge = useCallback(
    (slug: string, explicitRecipientId?: string) => {
      const notice = getNoticeBySlug(slug);
      if (!notice) return;

      setActiveSlug(notice.slug);
      const targetRecipientId = explicitRecipientId || DEFAULT_RECIPIENT_IDS_BY_SLUG[notice.slug];
      const recipient = targetRecipientId
        ? VERIFIED_RECIPIENTS.find((r) => r.id === targetRecipientId) || null
        : null;

      setSelectedRecipient(recipient);
      setUserValues(getDefaultValuesForNotice(notice.slug, recipient));
      setSelectedTier(notice.recommendedTier || 'certified');
      setActiveFieldKey(null);
    },
    []
  );

  // Cross-Component Event Listener: docketstamp:select-notice
  useEffect(() => {
    const handleSelectNoticeEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ slug?: string; recipientId?: string }>;
      if (customEvent.detail) {
        const { slug, recipientId } = customEvent.detail;
        if (slug) {
          selectCartridge(slug, recipientId);
        } else if (recipientId) {
          const foundRecipient = VERIFIED_RECIPIENTS.find((r) => r.id === recipientId);
          if (foundRecipient) {
            const targetSlug = getSlugForRecipient(foundRecipient);
            selectCartridge(targetSlug, recipientId);
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
  }, [selectCartridge]);

  // Handle individual field edits
  const handleValueChange = (key: string, value: string) => {
    setUserValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle verified recipient dropdown selection
  const handleRecipientChange = (recipientId: string) => {
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

  // Omnibox search results
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
    selectCartridge(targetSlug, rec.id);
    setSearchQuery('');
  };

  // Filtered notice cartridges by category filter tab
  const filteredNotices = useMemo(() => {
    if (categoryFilter === 'all') return ALL_NOTICE_CARTRIDGES;
    return ALL_NOTICE_CARTRIDGES.filter((n) => n.category === categoryFilter);
  }, [categoryFilter]);

  // Verified recipients compatible with active notice
  const compatibleRecipients = useMemo(() => {
    return getRecipientsForNotice(activeNotice);
  }, [activeNotice]);

  // 50-State list sorted alphabetically
  const stateStatutesList = useMemo(() => {
    return Object.values(STATE_STATUTES).sort((a, b) => a.stateName.localeCompare(b.stateName));
  }, []);

  // Currently resolved state statute (for Cartridge #02)
  const currentStatute: StateStatuteEntry = useMemo(() => {
    const code = (userValues.propertyState || 'CA').toUpperCase();
    return STATE_STATUTES[code] || STATE_STATUTES['CA'];
  }, [userValues.propertyState]);

  // Unfilled required fields counter
  const unfilledCount = useMemo(() => {
    return activeNotice.fields.filter((field) => {
      const val = userValues[field.key];
      return !val || val.trim().length === 0;
    }).length;
  }, [activeNotice, userValues]);

  // Build hydration URL with current state
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

  // Handle token click on paper sheet
  const handleTokenClick = useCallback(
    (fieldKey: string) => {
      setActiveFieldKey(fieldKey);
      const targetEl = inputRefs.current[fieldKey];
      if (targetEl) {
        targetEl.focus();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        router.push(buildHydrationUrl(fieldKey));
      }
    },
    [buildHydrationUrl, router]
  );

  // Submit to workspace
  const handleOpenWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildHydrationUrl());
  };

  // Pricing metadata
  const tierPrices: Record<MailTierId, string> = {
    first_class: '$12.95',
    certified: '$19.95',
    certified_return_receipt: '$27.95',
  };

  // Interpolated document for <LivePaperSheet />
  const interpolatedDoc = useMemo(() => {
    const stateSuffix = (
      userValues.propertyState ||
      userValues.recipientState ||
      'CA'
    ).toUpperCase();
    const docketId = `DS-2026-88419-${stateSuffix}`;

    const senderAddress = {
      name: userValues.senderFullName || 'Marcus Vance',
      address_line1: userValues.senderAddressLine1 || '410 Broadway, Suite 200',
      address_city: userValues.senderCity || 'Santa Monica',
      address_state: userValues.senderState || 'CA',
      address_zip: userValues.senderZip || '90401',
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
          name: userValues.recipientFormalName || 'Pacific Coast Property Management LLC',
          address_line1: userValues.recipientAddressLine1 || '100 Wilshire Blvd, Suite 1200',
          address_city: userValues.recipientCity || 'Santa Monica',
          address_state: userValues.recipientState || 'CA',
          address_zip: userValues.recipientZip || '90401',
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

  const quickFields = useMemo(() => {
    return getQuickInputFields(activeNotice);
  }, [activeNotice]);

  return (
    <section
      id="workbench"
      className="relative w-full bg-[#0F172A] text-slate-100 py-8 lg:py-12 border-b border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ========================================================= */}
          {/* LEFT COLUMN: Conversion Funnel & Live Controls (lg:col-span-5) */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Eyebrow & Headline */}
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-sky-950/80 text-sky-400 border border-sky-800/80 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span>OFFICIAL DOCUMENT &amp; USPS CERTIFIED MAIL® REGISTRY</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight text-balance leading-tight">
                Execute Statutory Legal Notices in 60 Seconds.
              </h1>
              <p className="text-pretty text-xs sm:text-sm text-slate-300 leading-relaxed">
                Pick a verified corporate recipient or statutory template below. Watch your state
                citations, USPS CASS™ routing, and variables snap onto the 8.5&quot; × 11&quot;
                instrument in real time.
              </p>
            </div>

            {/* 2. Instant Recipient & Situation Omnibox */}
            <div className="space-y-2.5">
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 38 corporate legal depts (Equifax, ADT, Withings, Tesla) or notice type..."
                    className="w-full pl-10 pr-12 py-2.5 bg-slate-950/90 border border-slate-700/80 rounded-xl text-xs sm:text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 text-xs font-mono text-slate-400 hover:text-white transition"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Invariant 1: NAICS 713940 Restricted Fitness Entity Compliance Card */}
                {isRestrictedFitness && (
                  <div className="mt-2.5 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/60 text-amber-200 text-xs font-mono space-y-1 shadow-lg">
                    <div className="flex items-center gap-2 font-bold text-amber-400">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>NAICS 713940 Compliance Exclusion</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-300/90 font-sans">
                      NAICS 713940 Exclusion: Physical gyms, health clubs, and fitness studio
                      memberships are not supported on DocketStamp. Consumer electronics &amp;
                      hardware OEMs (Withings, Garmin, Sonos, LG, Apple) are fully supported.
                    </p>
                  </div>
                )}

                {/* Omnibox Search Results Dropdown */}
                {searchQuery.trim().length > 0 && !isRestrictedFitness && (
                  <div className="mt-2 p-2 rounded-xl bg-slate-950/95 border border-slate-700 shadow-2xl max-h-72 overflow-y-auto space-y-2 font-mono text-xs z-20">
                    {searchResults.recipients.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                          Verified Corporate Legal Recipients
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
                                    CASS™
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[260px]">
                                  {rec.formalRecipientLine}
                                </div>
                              </button>
                              <Link
                                href={`/notices/${getSlugForRecipient(rec)}?recipientId=${rec.id}&tier=${selectedTier}`}
                                className="px-2 py-1 text-[10px] rounded bg-sky-600/30 hover:bg-sky-600 text-sky-200 hover:text-white transition shrink-0 ml-2"
                              >
                                Draft &amp; Dispatch &rarr;
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.notices.length > 0 && (
                      <div className="border-t border-slate-800 pt-1.5">
                        <div className="px-2 py-1 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                          Notice Cartridges
                        </div>
                        <div className="space-y-1">
                          {searchResults.notices.map((n) => (
                            <button
                              key={n.slug}
                              type="button"
                              onClick={() => {
                                selectCartridge(n.slug);
                                setSearchQuery('');
                              }}
                              className="w-full p-2 rounded-lg hover:bg-slate-800 transition text-left flex items-center justify-between group"
                            >
                              <div>
                                <div className="font-semibold text-white group-hover:text-sky-300">
                                  {n.title}
                                </div>
                                <div className="text-[10px] text-slate-400 line-clamp-1 font-sans">
                                  {n.shortDescription}
                                </div>
                              </div>
                              <span className="text-[10px] text-sky-400 group-hover:translate-x-0.5 transition-transform">
                                Load &rarr;
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.recipients.length === 0 &&
                      searchResults.notices.length === 0 && (
                        <div className="p-3 text-center text-slate-400 text-xs">
                          No matches found for &quot;{searchQuery}&quot;. Try Equifax, ADT, Withings,
                          or Security Deposit.
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Quick Select Preset Chips */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Quick-Select Presets:</span>
                  <span className="text-[10px] text-slate-500">1-Click Routing</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SELECT_CHIPS.map((chip) => {
                    const isChipActive =
                      activeNotice.slug === chip.slug &&
                      (!chip.recipientId || selectedRecipient?.id === chip.recipientId);
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => selectCartridge(chip.slug, chip.recipientId)}
                        className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                          isChipActive
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold shadow-sm shadow-sky-500/20'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <span>{chip.label}</span>
                        {isChipActive && <Check className="w-3 h-3 text-sky-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Interactive Cartridge Switcher & Live Micro-Editor */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
              {/* Cartridge Selection Header & Category Filter Tabs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="cartridge-selector"
                    className="text-xs font-mono text-slate-300 uppercase tracking-wider font-semibold"
                  >
                    Select Notice Cartridge (9 Ready):
                  </label>
                  <span className="text-[11px] font-mono text-sky-400 font-medium">
                    {activeNotice.usesStateStatuteLookup
                      ? '50-State Statutory Engine'
                      : 'Federal / Corporate Matrix'}
                  </span>
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap gap-1 pb-1">
                  {CARTRIDGE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded transition cursor-pointer ${
                        categoryFilter === cat.id
                          ? 'bg-slate-800 text-sky-300 font-semibold border border-slate-700'
                          : 'text-slate-400 hover:text-slate-200 bg-slate-950/40 border border-transparent'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Cartridge Dropdown Selector */}
                <select
                  id="cartridge-selector"
                  value={activeNotice.slug}
                  onChange={(e) => selectCartridge(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950/90 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 transition cursor-pointer"
                >
                  {filteredNotices.map((n) => (
                    <option key={n.slug} value={n.slug}>
                      {n.title} {n.usesStateStatuteLookup ? '• (50-State Law)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Interactive Inputs Box */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                {/* A. 50-State Selector if usesStateStatuteLookup */}
                {activeNotice.usesStateStatuteLookup && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <label
                      htmlFor="state-statute-select"
                      className="text-xs font-mono text-slate-300 flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-200">
                        Governing State Jurisdiction:
                      </span>
                      <span className="text-[11px] text-sky-400">50 States + DC</span>
                    </label>
                    <select
                      id="state-statute-select"
                      value={userValues.propertyState || 'CA'}
                      onChange={(e) => handleValueChange('propertyState', e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 transition cursor-pointer"
                    >
                      {stateStatutesList.map((st) => (
                        <option key={st.stateCode} value={st.stateCode}>
                          {st.stateName} ({st.stateCode}) — Deadline: {st.returnDeadlineLabel}
                        </option>
                      ))}
                    </select>
                    {/* Live statutory citation badge */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-sky-950/80 border border-sky-800 text-sky-300 font-semibold">
                        {currentStatute.statuteCitation}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {currentStatute.returnDeadlineLabel}
                      </span>
                    </div>
                  </div>
                )}

                {/* B. Verified Recipient Dropdown if applicable */}
                {compatibleRecipients.length > 0 && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <label
                      htmlFor="verified-recipient-select"
                      className="text-xs font-mono text-slate-300 flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-200">
                        Verified Corporate Recipient:
                      </span>
                      <span className="text-[11px] text-emerald-400">CASS™ Address Engine</span>
                    </label>
                    <select
                      id="verified-recipient-select"
                      value={selectedRecipient?.id || ''}
                      onChange={(e) => handleRecipientChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500 transition cursor-pointer"
                    >
                      {compatibleRecipients.map((rec) => (
                        <option key={rec.id} value={rec.id}>
                          {rec.brandName} — {rec.city}, {rec.state}
                        </option>
                      ))}
                    </select>

                    {/* Live CASS Verified address badge */}
                    {selectedRecipient && (
                      <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/60 rounded px-2.5 py-1 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="truncate">
                          CASS™ VERIFIED: {selectedRecipient.addressLine1}, {selectedRecipient.city}
                          , {selectedRecipient.state} {selectedRecipient.zip}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* C. Quick Variable Inputs (Includes Glowing Amber Unfilled Tags) */}
                <div className="space-y-2.5 pt-1">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Live Instrument Parameters:</span>
                    <span className="text-[10px] text-amber-400 font-bold">
                      Amber Tags on Sheet Update Live
                    </span>
                  </div>

                  {quickFields.map((field) => {
                    const isFilled =
                      typeof userValues[field.key] === 'string' &&
                      userValues[field.key].trim().length > 0;
                    const isFocused = activeFieldKey === field.key;

                    return (
                      <div key={field.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor={`workbench-input-${field.key}`}
                            className="text-xs font-mono text-slate-300 flex items-center gap-1.5"
                          >
                            <span>{field.label}</span>
                            {field.isAmberRequired && !isFilled && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#FEF3C7] border border-[#D97706] text-[#92400E] uppercase animate-pulse">
                                Required Tag
                              </span>
                            )}
                          </label>
                          {isFilled && (
                            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Filled
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
                          className={`w-full px-3 py-2 text-xs font-mono bg-slate-950/80 rounded-lg border transition text-white placeholder-slate-500 focus:outline-none ${
                            isFocused
                              ? 'border-sky-500 ring-1 ring-sky-500'
                              : field.isAmberRequired && !isFilled
                              ? 'border-amber-500/60 hover:border-amber-400'
                              : 'border-slate-700/80 hover:border-slate-600'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Inline 3-Tier USPS Dispatch Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 uppercase tracking-wider font-semibold">
                  USPS Dispatch Mail Tier:
                </span>
                <span className="text-[11px] text-slate-400">Updates Docket Stamp Live</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['first_class', 'certified', 'certified_return_receipt'] as MailTierId[]).map(
                  (tierId) => {
                    const tier = DOCKET_PRICING_TIERS[tierId];
                    const isSelected = selectedTier === tierId;
                    const isCourtStandard = tierId === 'certified';
                    const isMaxProof = tierId === 'certified_return_receipt';

                    return (
                      <button
                        key={tierId}
                        type="button"
                        onClick={() => setSelectedTier(tierId)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between relative ${
                          isSelected
                            ? 'bg-slate-800/95 border-sky-400 ring-1 ring-sky-400 shadow-md shadow-sky-500/15'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                        }`}
                      >
                        {isCourtStandard && (
                          <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-400 text-slate-950 uppercase shadow-sm">
                            Court Standard
                          </span>
                        )}
                        {isMaxProof && (
                          <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-400 text-slate-950 uppercase shadow-sm">
                            Max Proof
                          </span>
                        )}
                        <div>
                          <div className="font-mono text-xs font-bold text-white flex items-center justify-between">
                            <span>
                              {tierId === 'first_class'
                                ? 'First-Class'
                                : tierId === 'certified'
                                ? 'Certified Mail®'
                                : 'Certified + Return'}
                            </span>
                            <span
                              className={`text-xs ${
                                isSelected ? 'text-sky-300' : 'text-slate-400'
                              }`}
                            >
                              {tier.formattedPrice}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5 line-clamp-1">
                            {tierId === 'first_class'
                              ? 'Standard tracking'
                              : tierId === 'certified'
                              ? 'Chain of custody proof'
                              : 'Signed green card PDF'}
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* 5. Primary Conversion CTA Button */}
            <form
              {...({
                toolname: 'stage_homepage_notice',
                tooldescription:
                  'Launch pre-populated statutory notice workspace on DocketStamp',
              } as any)}
              onSubmit={handleOpenWorkspace}
              className="pt-1"
            >
              <button
                type="submit"
                className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-sky-500 via-sky-400 to-emerald-400 hover:from-sky-400 hover:to-emerald-300 p-0.5 font-sans font-bold text-slate-950 shadow-xl shadow-sky-500/20 active:scale-[0.99] transition duration-200 cursor-pointer"
              >
                <div className="px-5 py-3.5 rounded-[10px] bg-slate-950/20 group-hover:bg-transparent flex flex-col items-center justify-center transition">
                  <div className="flex items-center gap-2 text-sm sm:text-base text-slate-950 font-bold tracking-tight">
                    <span>Open Full Workspace &amp; Stamp Notice</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                  <div className="text-[11px] font-mono text-slate-900/80 font-medium mt-0.5">
                    {tierPrices[selectedTier]} all-inclusive USPS dispatch &bull;{' '}
                    {unfilledCount === 0
                      ? 'All fields ready'
                      : `${unfilledCount} required field${
                          unfilledCount === 1 ? '' : 's'
                        } remaining`}
                  </div>
                </div>
              </button>
            </form>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Live Interactive 8.5" x 11" Paper Sheet (lg:col-span-7) */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 space-y-3">
            {/* Top Preview Control & Status Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 px-4 py-3 rounded-xl backdrop-blur-md shadow-lg">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>LIVE WYSIWYG INSTRUMENT PREVIEW</span>
                </div>
                <span className="text-slate-600 text-xs hidden sm:inline">&bull;</span>
                <span className="text-xs font-mono text-amber-400 font-medium hidden sm:inline">
                  CLICK ANY AMBER TAG TO EDIT
                </span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsSignatureAdoptedPreview(!isSignatureAdoptedPreview)}
                  className={`px-2.5 py-1 text-xs font-mono rounded border transition flex items-center gap-1.5 cursor-pointer ${
                    isSignatureAdoptedPreview
                      ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 font-semibold'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="Toggle electronic signature and official clerk stamp preview"
                >
                  <PenTool className="w-3 h-3" />
                  <span>
                    {isSignatureAdoptedPreview ? '/s/ Signed & Stamped' : 'Preview /s/ Signature'}
                  </span>
                </button>

                <Link
                  href={buildHydrationUrl()}
                  className="px-3 py-1 text-xs font-mono font-medium rounded bg-sky-600 hover:bg-sky-500 text-white transition flex items-center gap-1 shadow-sm"
                >
                  <span>Full Screen Editor</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Secondary Docket ID & CASS Verification Status Strip */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">DOCKET ID:</span>
                <span className="font-bold text-slate-200">{interpolatedDoc.docketId}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">ROUTING:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {activeNotice.usesStateStatuteLookup
                    ? `${currentStatute.stateCode} CASS™ VERIFIED`
                    : selectedRecipient
                    ? `${selectedRecipient.state} CASS™ VERIFIED`
                    : 'USPS CASS™ VERIFIED'}
                </span>
              </div>
            </div>

            {/* Live Paper Sheet Canvas Container */}
            <div className="w-full flex justify-center overflow-x-auto p-2 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800 shadow-2xl backdrop-blur-sm">
              <div className="w-full max-w-[850px] transform-gpu transition-transform origin-top">
                <LivePaperSheet
                  doc={interpolatedDoc}
                  onTokenClick={handleTokenClick}
                  activeFieldKey={activeFieldKey}
                  isSignatureAdopted={isSignatureAdoptedPreview}
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
