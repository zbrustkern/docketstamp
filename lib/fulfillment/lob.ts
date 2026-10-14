/**
 * Lob Programmatic Postal Dispatch API Client
 *
 * Implements USPS CASS Address Verification (/v1/us_verifications)
 * and USPS Physical Letter Dispatch (/v1/letters) supporting:
 * - Tier 1: USPS First-Class Mail ($12.95)
 * - Tier 2: USPS Certified Mail® ($19.95)
 * - Tier 3: USPS Certified Mail® + Electronic Return Receipt ($27.95)
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§4, §6)
 * - ARCHITECTURE.md (§3.2, §5)
 */

import { resolvePaymentMode } from "@/lib/payment-mode";

export type UspsServiceLevel = "FIRST_CLASS" | "CERTIFIED" | "CERTIFIED_RETURN_RECEIPT";

export interface LobAddressInput {
  name: string;
  company?: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country?: string;
}

export interface LobAddressVerificationResult {
  valid: boolean;
  deliverability: "deliverable" | "deliverable_unnecessary_unit" | "deliverable_incorrect_unit" | "deliverable_missing_unit" | "undeliverable";
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
  serviceLevel: UspsServiceLevel;
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
    process.env["lob-api-key"] ||
    process.env.DOCKET_STAMP_SUPPLIER_API_KEY ||
    ""
  );
}

function getLobAuthHeader(): string {
  const key = getLobApiKey();
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

/**
 * Verifies and standardizes a US destination address via USPS CASS (/v1/us_verifications).
 */
export async function verifyUsAddress(
  address: LobAddressInput
): Promise<LobAddressVerificationResult> {
  const apiKey = getLobApiKey();
  const paymentMode = resolvePaymentMode();

  // Test mode safety fallback
  if (!apiKey || paymentMode === "local_mock") {
    return {
      valid: true,
      deliverability: "deliverable",
      standardizedAddress: {
        recipient: address.name,
        primary_line: address.address_line1.toUpperCase(),
        secondary_line: address.address_line2?.toUpperCase(),
        last_line: `${address.address_city.toUpperCase()} ${address.address_state.toUpperCase()} ${address.address_zip}`,
        city: address.address_city.toUpperCase(),
        state: address.address_state.toUpperCase(),
        zip_code: address.address_zip.slice(0, 5),
        zip_code_plus_4: address.address_zip.length > 5 ? address.address_zip.slice(-4) : "0001",
        carrier_route: "C001",
        delivery_point_barcode: "99",
      },
      dpv_confirmation: "Y",
    };
  }

  try {
    const res = await fetch("https://api.lob.com/v1/us_verifications", {
      method: "POST",
      headers: {
        Authorization: getLobAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: address.name,
        primary_line: address.address_line1,
        secondary_line: address.address_line2 || "",
        city: address.address_city,
        state: address.address_state,
        zip_code: address.address_zip,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        valid: false,
        deliverability: "undeliverable",
        error: data.error?.message || `Lob verification HTTP error ${res.status}`,
      };
    }

    const deliverability = data.deliverability || "undeliverable";
    const isValid = deliverability.startsWith("deliverable");

    return {
      valid: isValid,
      deliverability,
      standardizedAddress: {
        recipient: data.recipient || address.name,
        primary_line: data.primary_line || address.address_line1,
        secondary_line: data.secondary_line,
        urbanization: data.urbanization,
        last_line: data.last_line,
        city: data.components?.city || address.address_city,
        state: data.components?.state || address.address_state,
        zip_code: data.components?.zip_code || address.address_zip,
        zip_code_plus_4: data.components?.zip_code_plus_4,
        carrier_route: data.components?.carrier_route,
        delivery_point_barcode: data.components?.delivery_point_barcode,
      },
      dpv_confirmation: data.deliverability_analysis?.dpv_confirmation,
    };
  } catch (err: any) {
    return {
      valid: false,
      deliverability: "undeliverable",
      error: err.message || "Network error communicating with USPS address verifier",
    };
  }
}

/**
 * Dispatches a formal legal notice letter via physical USPS mail.
 * Supports First-Class, Certified Mail®, and Certified Mail® + Electronic Return Receipt.
 */
export async function dispatchLetter(
  params: LobLetterDispatchParams
): Promise<LobLetterResult> {
  const apiKey = getLobApiKey();
  const paymentMode = resolvePaymentMode();

  // Test mode safety: never order real physical letters under test credentials
  if (!apiKey || paymentMode === "stripe_test" || paymentMode === "local_mock") {
    console.log(
      `[Lob Mock] Simulating ${params.serviceLevel} dispatch for order ${params.orderId} (Docket: ${params.docketId})`
    );
    const mockTracking =
      params.serviceLevel === "FIRST_CLASS"
        ? `94001000000000${Math.floor(100000000 + Math.random() * 900000000)}`
        : `702006400000${Math.floor(10000000 + Math.random() * 90000000)}`;

    return {
      success: true,
      letterId: `test_lob_ltr_${params.orderId}`,
      trackingNumber: mockTracking,
      url: `https://docketstamp.com/mock-proof/${params.orderId}.pdf`,
      carrier: "USPS",
      expectedDeliveryDate: new Date(Date.now() + 4 * 86400000).toISOString().split("T")[0],
      isTest: true,
    };
  }

  // Map service level to Lob parameters
  let extraService: string | undefined;
  if (params.serviceLevel === "CERTIFIED") {
    extraService = "certified";
  } else if (params.serviceLevel === "CERTIFIED_RETURN_RECEIPT") {
    extraService = "certified_return_receipt";
  }

  const payload: Record<string, unknown> = {
    description: params.description,
    to: params.to,
    from: params.from,
    file: params.file,
    color: Boolean(params.color),
    double_sided: Boolean(params.doubleSided),
    address_placement: "top_first_page",
    use_type: "operational",
    metadata: {
      orderId: params.orderId,
      docketId: params.docketId,
      serviceLevel: params.serviceLevel,
      platform: "DocketStamp",
      ...(params.metadata || {}),
    },
  };

  if (extraService) {
    payload.extra_service = extraService;
  }

  try {
    const res = await fetch("https://api.lob.com/v1/letters", {
      method: "POST",
      headers: {
        Authorization: getLobAuthHeader(),
        "Content-Type": "application/json",
        "Idempotency-Key": `docketstamp_order_${params.orderId}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[Lob Dispatch Error]", data);
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
      carrier: data.carrier || "USPS",
      expectedDeliveryDate: data.expected_delivery_date,
      rawResponse: data,
    };
  } catch (err: any) {
    console.error("[Lob Dispatch Exception]", err);
    return {
      success: false,
      error: err.message || "Failed to transmit letter to USPS dispatch gateway",
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
  const apiKey = getLobApiKey();
  const paymentMode = resolvePaymentMode();

  if (
    !apiKey ||
    paymentMode === "stripe_test" ||
    paymentMode === "local_mock" ||
    letterId.startsWith("test_")
  ) {
    return {
      success: true,
      status: "processed_for_delivery",
      trackingNumber: "9400100000000012345678",
      trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000012345678",
      dateSent: new Date().toISOString().split("T")[0],
      carrier: "USPS",
      expectedDeliveryDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
    };
  }

  try {
    const res = await fetch(`https://api.lob.com/v1/letters/${letterId}`, {
      method: "GET",
      headers: {
        Authorization: getLobAuthHeader(),
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
      status: latestEvent?.name || data.status || "rendered",
      trackingNumber: data.tracking_number,
      trackingUrl: data.tracking_number
        ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${data.tracking_number}`
        : data.url,
      dateSent: data.send_date || data.expected_delivery_date,
      carrier: data.carrier || "USPS",
      expectedDeliveryDate: data.expected_delivery_date,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to query Lob postal status",
    };
  }
}
