// Admin presentation delegates to the same browser-safe provenance policy as account/history.
import type { PostalProvider } from "@/lib/order-record";
export { resolvePostalProvenance, type PostalProvenance, type PostalProvider } from "@/lib/order-record";

export function postalProviderLabel(provider: PostalProvider): string {
  return provider === "lob" ? "Lob" : provider === "handwrytten" ? "Legacy Handwrytten" : "Provider unresolved";
}
