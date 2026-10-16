/**
 * Lob Programmatic Postal Dispatch API Client
 *
 * Implements USPS CASS Address Verification (/v1/us_verifications)
 * and USPS Physical Letter Dispatch (/v1/letters) supporting:
 * - Tier 1: first_class -> extra_service: undefined (USPS First-Class Mail $12.95)
 * - Tier 2: certified -> extra_service: 'certified' (USPS Certified Mail® $19.95)
 * - Tier 3: certified_return_receipt -> extra_service: 'certified_return_receipt' ($27.95)
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md (§1 Invariant 6, §2, §4, §9)
 * - ARCHITECTURE.md (§3.2, §5)
 */

import { resolvePaymentMode } from '@/lib/payment-mode';
import { MailTierId, PostalAddress } from '@/lib/docket/types';

export type UspsServiceLevel =
  | 'first_class'
  | 'certified'
  | 'certified_return_receipt'
  | 'FIRST_CLASS'
  | 'CERTIFIED'
  | 'CERTIFIED_RETURN_RECEIPT';

export interface LobAddressInput {
  name: string;
  company?: string;
  address_line1?: string;
  address_line2?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address_country?: string;
  // PostalAddress format compatibility
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface LobAddressVerificationResult {
  valid: boolean;
  deliverability:
    | 'deliverable'
    | 'deliverable_unnecessary_unit'
    | 'deliverable_incorrect_unit'
    | 'deliverable_missing_unit'
    | 'undeliverable';
  standardizedAddress?: {
    recipient: string;
    primary_line: string;
    secondary_line?: string;
    urbanization?: string;
    last_line: string;
    city: string;
    state: string;
    zip_code: string;
    zip_code_plus_4?: string;
    carrier_route?: string;
    delivery_point_barcode?: string;
  };
  dpv_confirmation?: string;
  error?: string;
}

export interface LobLetterDispatchParams {
  orderId: string;
  docketId: string;
  description: string;
  to: LobAddressInput;
  from: LobAddressInput;
  file: string; // HTML string, raw text template, or public PDF URL
  serviceLevel?: UspsServiceLevel;
  tier?: MailTierId;
  color?: boolean;
  doubleSided?: boolean;
  metadata?: Record<string, string>;
}

export interface LobLetterResult {
  success: boolean;
  letterId?: string;
  trackingNumber?: string;
  url?: string;
  carrier?: string;
  expectedDeliveryDate?: string;
  priceCents?: number;
  error?: string;
  isTest?: boolean;
  rawResponse?: Record<string, unknown>;
}

export function getLobApiKey(): string {
  return (
    process.env.LOB_API_KEY ||
    process.env['lob-api-key'] ||
    process.env.DOCKET_STAMP_SUPPLIER_API_KEY ||
    ''
  );
}

export function getLobVerificationApiKey(): string {
  return (
    process.env.LOB_ADDRESS_VERIFICATION_KEY ||
    process.env['lob-address-verification-key'] ||
    getLobApiKey()
  );
}

export function getLobDispatchApiKey(): string {
  return (
    process.env.LOB_DISPATCH_API_KEY ||
    process.env['lob-dispatch-api-key'] ||
    getLobApiKey()
  );
}

function getLobAuthHeader(key: string): string {
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

/**
 * Normalizes input address from either PostalAddress or LobAddressInput
 */
function normalizeAddressInput(address: LobAddressInput | PostalAddress): {
  name: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
} {
  const name = address.name || ('company' in address ? address.company : '') || '';
  const company = address.company;
  const line1 = ('address_line1' in address ? address.address_line1 : address.addressLine1) || '';
  const line2 = ('address_line2' in address ? address.address_line2 : address.addressLine2) || '';
  const city = ('address_city' in address ? address.address_city : address.city) || '';
  const state = ('address_state' in address ? address.address_state : address.state) || '';
  const zip = ('address_zip' in address ? address.address_zip : address.zip) || '';

  return { name, company, line1, line2, city, state, zip };
}

/**
 * Verifies and standardizes a US destination address via USPS CASS (/v1/us_verifications).
 * Uses LOB_ADDRESS_VERIFICATION_KEY.
 * When LOB_ENV=staging_mock_cass or running in test/mock mode without keys, returns a deterministic CASS mock.
 */
export async function verifyUsAddress(
  address: LobAddressInput | PostalAddress
): Promise<LobAddressVerificationResult> {
  const norm = normalizeAddressInput(address);
  const apiKey = getLobVerificationApiKey();
  let paymentMode = 'local_mock';
  try {
    paymentMode = resolvePaymentMode();
  } catch {
    paymentMode = 'local_mock';
  }
  const isStagingMock = process.env.LOB_ENV === 'staging_mock_cass';

  // Staging mock or local test mode fallback
  if (isStagingMock || !apiKey || paymentMode === 'local_mock') {
    const cleanZip = norm.zip.trim().slice(0, 5) || '10001';
    const plus4 = norm.zip.length > 5 ? norm.zip.slice(-4) : '1001';
    return {
      valid: true,
      deliverability: 'deliverable',
      standardizedAddress: {
        recipient: norm.name || norm.company || 'RECEIVING PARTY',
        primary_line: (norm.line1 || '123 MAIN ST').toUpperCase(),
        secondary_line: norm.line2 ? norm.line2.toUpperCase() : undefined,
        last_line: `${norm.city.toUpperCase()} ${norm.state.toUpperCase()} ${cleanZip}-${plus4}`,
        city: (norm.city || 'SPRINGFIELD').toUpperCase(),
        state: (norm.state || 'IL').toUpperCase(),
        zip_code: cleanZip,
        zip_code_plus_4: plus4,
        carrier_route: 'C001',
        delivery_point_barcode: '99',
      },
      dpv_confirmation: 'Y',
    };
  }

  try {
    const res = await fetch('https://api.lob.com/v1/us_verifications', {
      method: 'POST',
      headers: {
        Authorization: getLobAuthHeader(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: norm.name,
        primary_line: norm.line1,
        secondary_line: norm.line2 || '',
        city: norm.city,
        state: norm.state,
        zip_code: norm.zip,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        valid: false,
        deliverability: 'undeliverable',
        error: data.error?.message || `USPS address verification HTTP error ${res.status}`,
      };
    }

    const deliverability = data.deliverability || 'undeliverable';
    const isValid = deliverability.startsWith('deliverable');

    return {
      valid: isValid,
      deliverability,
      standardizedAddress: {
        recipient: data.recipient || norm.name,
        primary_line: data.primary_line || norm.line1,
        secondary_line: data.secondary_line,
        urbanization: data.urbanization,
        last_line: data.last_line,
        city: data.components?.city || norm.city,
        state: data.components?.state || norm.state,
        zip_code: data.components?.zip_code || norm.zip,
        zip_code_plus_4: data.components?.zip_code_plus_4,
        carrier_route: data.components?.carrier_route,
        delivery_point_barcode: data.components?.delivery_point_barcode,
      },
      dpv_confirmation: data.deliverability_analysis?.dpv_confirmation,
    };
  } catch (err: any) {
    return {
      valid: false,
      deliverability: 'undeliverable',
      error: err.message || 'Network error communicating with USPS address verifier',
    };
  }
}

/**
 * Dispatches a formal legal notice letter via physical USPS mail using Lob /v1/letters.
 * Maps:
 * - first_class -> extra_service: undefined
 * - certified -> extra_service: 'certified'
 * - certified_return_receipt -> extra_service: 'certified_return_receipt'
 */
export async function dispatchDocketLetter(
  params: LobLetterDispatchParams
): Promise<LobLetterResult> {
  const apiKey = getLobDispatchApiKey();
  let paymentMode = 'local_mock';
  try {
    paymentMode = resolvePaymentMode();
  } catch {
    paymentMode = 'local_mock';
  }

  // Normalize service level / tier
  const tier: MailTierId =
    params.tier ||
    (params.serviceLevel === 'CERTIFIED'
      ? 'certified'
      : params.serviceLevel === 'CERTIFIED_RETURN_RECEIPT'
      ? 'certified_return_receipt'
      : params.serviceLevel === 'FIRST_CLASS'
      ? 'first_class'
      : (params.serviceLevel as MailTierId) || 'certified');

  // Test mode safety: never order real physical letters under test credentials
  if (!apiKey || paymentMode === 'stripe_test' || paymentMode === 'local_mock' || apiKey.startsWith('test_')) {
    console.log(
      `[Lob Test Dispatch] Simulating ${tier} dispatch for order ${params.orderId} (Docket: ${params.docketId})`
    );

    // If using Lob's real test key (starts with test_), we can dispatch to Lob sandbox
    if (apiKey && apiKey.startsWith('test_')) {
      try {
        return await executeLobHttpRequest(apiKey, params, tier);
      } catch (e: any) {
        console.warn(`[Lob Test API Failed, falling back to mock] ${e.message}`);
      }
    }

    const mockTracking =
      tier === 'first_class'
        ? `94001000000000${Math.floor(100000000 + Math.random() * 900000000)}`
        : `702006400000${Math.floor(10000000 + Math.random() * 90000000)}`;

    return {
      success: true,
      letterId: `test_lob_ltr_${params.orderId}`,
      trackingNumber: mockTracking,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://docketstamp.com'}/mock-proof/${params.orderId}.pdf`,
      carrier: 'USPS',
      expectedDeliveryDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
      isTest: true,
    };
  }

  return await executeLobHttpRequest(apiKey, params, tier);
}

export const dispatchLetter = dispatchDocketLetter;

async function executeLobHttpRequest(
  apiKey: string,
  params: LobLetterDispatchParams,
  tier: MailTierId
): Promise<LobLetterResult> {
  const toNorm = normalizeAddressInput(params.to);
  const fromNorm = normalizeAddressInput(params.from);

  let extraService: string | undefined;
  if (tier === 'certified') {
    extraService = 'certified';
  } else if (tier === 'certified_return_receipt') {
    extraService = 'certified_return_receipt';
  }

  const payload: Record<string, unknown> = {
    description: params.description || `DocketStamp Notice ${params.docketId}`,
    to: {
      name: toNorm.name || toNorm.company,
      company: toNorm.company,
      address_line1: toNorm.line1,
      address_line2: toNorm.line2 || undefined,
      address_city: toNorm.city,
      address_state: toNorm.state,
      address_zip: toNorm.zip,
      address_country: 'US',
    },
    from: {
      name: fromNorm.name || fromNorm.company,
      company: fromNorm.company,
      address_line1: fromNorm.line1,
      address_line2: fromNorm.line2 || undefined,
      address_city: fromNorm.city,
      address_state: fromNorm.state,
      address_zip: fromNorm.zip,
      address_country: 'US',
    },
    file: params.file,
    color: Boolean(params.color),
    double_sided: false, // Invariant 3: Single-page letter
    address_placement: 'top_first_page',
    use_type: 'operational',
    metadata: {
      orderId: params.orderId,
      docketId: params.docketId,
      tier,
      platform: 'DocketStamp',
      ...(params.metadata || {}),
    },
  };

  if (extraService) {
    payload.extra_service = extraService;
  }

  try {
    const res = await fetch('https://api.lob.com/v1/letters', {
      method: 'POST',
      headers: {
        Authorization: getLobAuthHeader(apiKey),
        'Content-Type': 'application/json',
        'Idempotency-Key': `docketstamp_order_${params.orderId}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Lob Dispatch Error]', data);
      return {
        success: false,
        error: data.error?.message || `Lob letter API error ${res.status}`,
        rawResponse: data,
      };
    }

    return {
      success: true,
      letterId: data.id,
      trackingNumber: data.tracking_number,
      url: data.url,
      carrier: data.carrier || 'USPS',
      expectedDeliveryDate: data.expected_delivery_date,
      rawResponse: data,
    };
  } catch (err: any) {
    console.error('[Lob Dispatch Exception]', err);
    return {
      success: false,
      error: err.message || 'Failed to transmit letter to USPS dispatch gateway',
    };
  }
}

export interface LobLetterStatusResult {
  success: boolean;
  status?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  dateSent?: string;
  carrier?: string;
  expectedDeliveryDate?: string;
  error?: string;
}

/**
 * Queries real-time Lob USPS letter delivery and dispatch status.
 */
export async function fetchLobLetterStatus(
  letterId: string
): Promise<LobLetterStatusResult> {
  const apiKey = getLobDispatchApiKey();
  const paymentMode = resolvePaymentMode();

  if (
    !apiKey ||
    paymentMode === 'stripe_test' ||
    paymentMode === 'local_mock' ||
    letterId.startsWith('test_')
  ) {
    return {
      success: true,
      status: 'in_transit',
      trackingNumber: '70200640000012345678',
      trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=70200640000012345678',
      dateSent: new Date().toISOString().split('T')[0],
      carrier: 'USPS',
      expectedDeliveryDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    };
  }

  try {
    const res = await fetch(`https://api.lob.com/v1/letters/${letterId}`, {
      method: 'GET',
      headers: {
        Authorization: getLobAuthHeader(apiKey),
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error?.message || `Lob status API error ${res.status}`,
      };
    }

    const trackingEvents = data.tracking_events || [];
    const latestEvent = trackingEvents[trackingEvents.length - 1];

    return {
      success: true,
      status: latestEvent?.name || data.status || 'rendered',
      trackingNumber: data.tracking_number,
      trackingUrl: data.tracking_number
        ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${data.tracking_number}`
        : data.url,
      dateSent: data.send_date || data.expected_delivery_date,
      carrier: data.carrier || 'USPS',
      expectedDeliveryDate: data.expected_delivery_date,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to query Lob postal status',
    };
  }
}
