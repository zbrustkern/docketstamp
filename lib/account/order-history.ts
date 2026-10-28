import type { Order } from "@/lib/types";
import { resolvePostalProvenance } from "@/lib/order-record";

function safeTrackingUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function getOrderHistoryPresentation(order: Order) {
  const stored = order as Order & { schemaVersion?: number; kind?: string };
  const postal = resolvePostalProvenance(stored);
  const providerLabel = postal.provider === "lob"
    ? (order.serviceLevel === "CERTIFIED" || order.serviceLevel === "CERTIFIED_RETURN_RECEIPT"
        ? "USPS Certified Mail"
        : "USPS Postal Record")
    : postal.provider === "handwrytten"
    ? "Historical Handwrytten record"
    : postal.evidence === "conflict"
    ? "Postal provider unclear (conflicting references)"
    : "Postal provider not confirmed";
  const providerStatus = postal.provider === "lob"
    ? order.lobStatus
    : postal.provider === "handwrytten"
    ? order.handwryttenStatus
    : undefined;
  const trackingUrl = postal.provider === "lob"
    ? (order.lobTrackingNumber
        ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(order.lobTrackingNumber)}`
        : safeTrackingUrl(order.lobTrackingUrl))
    : postal.provider === "handwrytten"
    ? safeTrackingUrl(order.handwryttenTrackingUrl)
    : undefined;
  const trackingNumber = postal.provider === "lob"
    ? order.lobTrackingNumber
    : postal.provider === "handwrytten"
    ? order.handwryttenTrackingNumber
    : undefined;
  const mailedDate = postal.provider === "lob"
    ? order.lobMailedDate
    : postal.provider === "handwrytten"
    ? order.handwryttenMailedDate
    : undefined;
  const statusLabels: Record<string, string> = {
    PENDING_PAYMENT: "Payment pending",
    PAYMENT_RECEIVED: "Payment recorded",
    DISPATCHING: "Dispatch processing",
    PROCESSING_HANDWRYTTEN: "Historical provider processing",
    PROCESSING_DISPATCH: "Dispatch processing",
    QUEUED_FOR_FULFILLMENT: "Fulfillment queued",
    DISPATCHED_TO_USPS: "Dispatch status recorded",
    MAILED: "Mailed status recorded",
    IN_TRANSIT: "In-transit status recorded",
    DELIVERED: "Delivery status recorded",
    RETURNED_TO_SENDER: "Return status recorded",
    PAYMENT_VERIFICATION_FAILED: "Payment verification failed",
    FAILED: "Processing failed",
  };

  return {
    postal,
    recordKind: stored.schemaVersion === 2 && stored.kind === "notice" ? "DocketStamp notice record" : "Historical order record",
    providerLabel,
    providerStatus: providerStatus || "No provider status recorded",
    providerReference: postal.provider === "unknown" ? undefined : postal.reference,
    trackingUrl,
    trackingNumber,
    mailedDate: mailedDate || "Not available",
    docketReference: order.docketId || order.docketNumber || "Not available",
    serviceLevel: order.serviceLevel || "Not available",
    statusLabel: statusLabels[order.status] || "Status unavailable",
  };
}
