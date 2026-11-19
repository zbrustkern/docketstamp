import assert from "node:assert/strict";
import { MARKETING_CONSENT_STORAGE_KEY, hasExplicitMarketingConsent } from "../lib/admin-console/measurement/privacy";

const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const values = new Map<string, string>();
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: (key: string) => values.get(key) || null } } });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { globalPrivacyControl: false } });
try {
  assert.equal(hasExplicitMarketingConsent(), false, "unknown consent blocks tags");
  values.set(MARKETING_CONSENT_STORAGE_KEY, "granted");
  assert.equal(hasExplicitMarketingConsent(), true, "explicit grant enables marketing delivery");
  values.set("docketstamp_google_offline_preference_set_v1", "1");
  assert.equal(hasExplicitMarketingConsent(), false, "offline conversion preference never enables legacy browser tags");
  values.delete("docketstamp_google_offline_preference_set_v1");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { globalPrivacyControl: true } });
  assert.equal(hasExplicitMarketingConsent(), false, "GPC blocks delivery despite a stored grant");
} finally {
  if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
  if (oldNavigator) Object.defineProperty(globalThis, "navigator", oldNavigator); else Reflect.deleteProperty(globalThis, "navigator");
}
console.log("Explicit marketing consent and GPC gating passed.");
