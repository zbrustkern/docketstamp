import { hasExplicitMarketingConsent } from "@/lib/admin-console/measurement/privacy";
import { getGoogleMarketingDestination } from "@/lib/marketing-destinations";
import { isCurrentMarketingSurfacePublic } from "@/lib/marketing-privacy";

const destination = getGoogleMarketingDestination();
export const GOOGLE_TAG_ID = destination.tagId;
export const GOOGLE_ADS_ID = destination.adsId;
export const GOOGLE_ADS_CONVERSION_LABEL = destination.conversionLabel;
export const GA4_MEASUREMENT_ID = destination.ga4Id;

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };
type CommerceEvent = "view_item" | "begin_checkout" | "add_shipping_info" | "add_payment_info";

function gtag(): GtagWindow["gtag"] | undefined {
  if (typeof window === "undefined" || !hasExplicitMarketingConsent() || !isCurrentMarketingSurfacePublic()) return undefined;
  const send = (window as GtagWindow).gtag;
  return typeof send === "function" ? send.bind(window) : undefined;
}

function paidValue(amountInCents?: number): number | undefined {
  return Number.isInteger(amountInCents) && Number(amountInCents) > 0 ? Number(amountInCents) / 100 : undefined;
}

function ga4SendTo(): string | undefined { return getGoogleMarketingDestination().ga4Id; }

/** Only a fixed, generic product identity may be sent. Caller IDs/names are intentionally ignored. */
function commerceEvent(eventName: CommerceEvent, amount?: number, extra?: { shipping_tier?: string; payment_type?: string }): void {
  const send = gtag();
  const target = ga4SendTo();
  if (!send || !target) return;
  const value = paidValue(amount);
  send("event", eventName, {
    send_to: target,
    currency: "USD",
    ...(value ? { value } : {}),
    ...(extra?.shipping_tier ? { shipping_tier: extra.shipping_tier } : {}),
    ...(extra?.payment_type ? { payment_type: extra.payment_type } : {}),
    items: [{ item_id: "docketstamp-mailing", item_name: "DocketStamp mailing", item_category: "mailing", ...(value ? { price: value } : {}) }],
  });
}

export function trackGA4ViewItem(item: { itemId: string; itemName: string; price?: number; itemCategory?: string }): void {
  commerceEvent("view_item", item.price === undefined ? undefined : Math.round(item.price * 100));
}

export function trackGA4BeginCheckout(item: { itemId: string; itemName: string; price?: number; itemCategory?: string }): void {
  commerceEvent("begin_checkout", item.price === undefined ? undefined : Math.round(item.price * 100));
}

export function trackGA4AddShippingInfo(item: { itemId: string; itemName: string; price?: number; shippingTier?: string; itemCategory?: string }): void {
  const tier = ({ first_class: "First-class", certified: "Certified", certified_return_receipt: "Certified return receipt" } as Record<string, string>)[item.shippingTier || ""];
  commerceEvent("add_shipping_info", item.price === undefined ? undefined : Math.round(item.price * 100), tier ? { shipping_tier: tier } : undefined);
}

export function trackGA4AddPaymentInfo(item: { itemId: string; itemName: string; price?: number; paymentType?: string; itemCategory?: string }): void {
  const paymentType = item.paymentType === "card" || item.paymentType === "link" ? item.paymentType : undefined;
  commerceEvent("add_payment_info", item.price === undefined ? undefined : Math.round(item.price * 100), paymentType ? { payment_type: paymentType } : undefined);
}

/** The only custom event accepted is generic progress with a bounded step number. */
export function trackGA4CustomEvent(eventName: string, params?: Record<string, unknown>): void {
  if (eventName !== "mailing_progress") return;
  const send = gtag();
  const target = ga4SendTo();
  if (!send || !target) return;
  const step = params?.step_number;
  send("event", "mailing_progress", {
    send_to: target,
    event_category: "mailing_progress",
    page_location: "https://docketstamp.com/",
    page_referrer: "",
    page_title: "DocketStamp",
    ...(Number.isInteger(step) && Number(step) >= 1 && Number(step) <= 8 ? { step_number: Number(step) } : {}),
  });
}

/** Generic purchase reporting contains no order, template, or customer identifiers. */
export function trackGA4Purchase(params: { orderId: string; amountInCents?: number; itemName?: string; itemCategory?: string }): void {
  const send = gtag();
  const target = ga4SendTo();
  const value = paidValue(params.amountInCents);
  if (!send || !target || !value) return;
  send("event", "purchase", {
    send_to: target,
    value,
    currency: "USD",
    items: [{ item_id: "docketstamp-mailing", item_name: "DocketStamp mailing", price: value, item_category: "mailing" }],
  });
}

/** Conversion dispatch is disabled on checkout/order surfaces by the public-route gate. */
export function trackGoogleAdsPurchase(params: { orderId: string; amountInCents?: number; customerEmail?: string; itemName?: string; itemCategory?: string }): void {
  const send = gtag();
  const config = getGoogleMarketingDestination();
  const value = paidValue(params.amountInCents);
  if (!send || !value || !config.adsId || !config.conversionLabel) return;
  send("event", "conversion", { send_to: `${config.adsId}/${config.conversionLabel}`, value, currency: "USD" });
  trackGA4Purchase(params);
}
