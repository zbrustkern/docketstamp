import { hasExplicitMarketingConsent } from "@/lib/admin-console/measurement/privacy";
import { getGoogleMarketingDestination } from "@/lib/marketing-destinations";

const destination = getGoogleMarketingDestination();
export const GOOGLE_TAG_ID = destination.tagId;
export const GOOGLE_ADS_ID = destination.adsId;
export const GOOGLE_ADS_CONVERSION_LABEL = destination.conversionLabel;
export const GA4_MEASUREMENT_ID = destination.ga4Id;

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };
function gtag(): GtagWindow["gtag"] | undefined {
  if (typeof window === "undefined" || !hasExplicitMarketingConsent()) return undefined;
  const send = (window as GtagWindow).gtag;
  return typeof send === "function" ? send.bind(window) : undefined;
}
function paidValue(amountInCents?: number): number | undefined {
  return Number.isInteger(amountInCents) && Number(amountInCents) > 0 ? Number(amountInCents) / 100 : undefined;
}
function ga4SendTo(): string | undefined { return getGoogleMarketingDestination().ga4Id; }

export function trackGA4ViewItem(item: { itemId: string; itemName: string; price?: number; itemCategory?: string }): void {
  const send = gtag(); const target = ga4SendTo(); if (!send || !target) return;
  const price = paidValue(item.price === undefined ? undefined : Math.round(item.price * 100));
  send("event", "view_item", { send_to: target, currency: "USD", ...(price ? { value: price } : {}), items: [{ item_id: item.itemId, item_name: item.itemName, ...(price ? { price } : {}), item_category: item.itemCategory || "notice" }] });
}

export function trackGA4BeginCheckout(item: { itemId: string; itemName: string; price?: number; itemCategory?: string }): void {
  const send = gtag(); const target = ga4SendTo(); if (!send || !target) return;
  const price = paidValue(item.price === undefined ? undefined : Math.round(item.price * 100));
  send("event", "begin_checkout", { send_to: target, currency: "USD", ...(price ? { value: price } : {}), items: [{ item_id: item.itemId, item_name: item.itemName, ...(price ? { price } : {}), item_category: item.itemCategory || "notice" }] });
}

export function trackGA4AddShippingInfo(item: { itemId: string; itemName: string; price?: number; shippingTier?: string; itemCategory?: string }): void {
  const send = gtag(); const target = ga4SendTo(); if (!send || !target) return;
  const price = paidValue(item.price === undefined ? undefined : Math.round(item.price * 100));
  send("event", "add_shipping_info", { send_to: target, currency: "USD", ...(price ? { value: price } : {}), shipping_tier: item.shippingTier, items: [{ item_id: item.itemId, item_name: item.itemName, ...(price ? { price } : {}), item_category: item.itemCategory || "notice" }] });
}

export function trackGA4AddPaymentInfo(item: { itemId: string; itemName: string; price?: number; paymentType?: string; itemCategory?: string }): void {
  const send = gtag(); const target = ga4SendTo(); if (!send || !target) return;
  const price = paidValue(item.price === undefined ? undefined : Math.round(item.price * 100));
  send("event", "add_payment_info", { send_to: target, currency: "USD", ...(price ? { value: price } : {}), payment_type: item.paymentType || "card", items: [{ item_id: item.itemId, item_name: item.itemName, ...(price ? { price } : {}), item_category: item.itemCategory || "notice" }] });
}

export function trackGA4CustomEvent(eventName: string, params?: Record<string, unknown>): void {
  const send = gtag(); const target = ga4SendTo(); if (!send || !target) return;
  send("event", eventName, { send_to: target, ...(params || {}) });
}

export function trackGA4Purchase(params: { orderId: string; amountInCents?: number; itemName?: string; itemCategory?: string }): void {
  const send = gtag(); const target = ga4SendTo(); const value = paidValue(params.amountInCents);
  if (!send || !target || !value || !params.orderId) return;
  send("event", "purchase", { send_to: target, transaction_id: params.orderId, value, currency: "USD", items: [{ item_id: params.orderId, item_name: params.itemName || "DocketStamp notice dispatch", price: value, item_category: params.itemCategory || "notice" }] });
}

export function trackGoogleAdsPurchase(params: { orderId: string; amountInCents?: number; customerEmail?: string; itemName?: string; itemCategory?: string }): void {
  if (typeof window === "undefined" || !hasExplicitMarketingConsent() || !params.orderId) return;
  const config = getGoogleMarketingDestination();
  const send = (window as GtagWindow).gtag;
  const value = paidValue(params.amountInCents);
  if (!send || !value || !config.adsId || !config.conversionLabel) return;
  const key = `gads_conv_${params.orderId}`;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "true"); } catch { /* in-memory browser lifetime still sends once per render path */ }
  send("event", "conversion", { send_to: `${config.adsId}/${config.conversionLabel}`, value, currency: "USD", transaction_id: params.orderId });
  trackGA4Purchase(params);
}
