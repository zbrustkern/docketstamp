import assert from "node:assert/strict";
import {
  getGoogleMarketingDestination,
  getMarketingDestinationStatus,
  getMetaPixelDestination,
  getServerMetaPixelDestination,
} from "../lib/marketing-destinations";

const verified = {
  NODE_ENV: "test" as const,
  ENVIRONMENT: "staging",
  NEXT_PUBLIC_ENVIRONMENT: "staging",
  NEXT_PUBLIC_STAGING_MARKETING_DESTINATIONS_VERIFIED: "true",
  NEXT_PUBLIC_STAGING_GOOGLE_ADS_ID: "AW-123456789",
  NEXT_PUBLIC_STAGING_GOOGLE_ADS_CONVERSION_LABEL: "Conversion_Label",
  NEXT_PUBLIC_STAGING_GA4_MEASUREMENT_ID: "G-ABC123",
  NEXT_PUBLIC_STAGING_META_PIXEL_ID: "123456789012345",
  META_STAGING_DESTINATIONS_VERIFIED: "true",
  META_STAGING_PIXEL_ID: "123456789012345",
  META_CONVERSIONS_API_ACCESS_TOKEN: "test-token",
};

assert.deepEqual(getGoogleMarketingDestination("staging", verified), {
  adsId: "AW-123456789",
  conversionLabel: "Conversion_Label",
  ga4Id: "G-ABC123",
});
assert.equal(getGoogleMarketingDestination("production", verified).ga4Id, undefined, "staging IDs never inherit into production");
assert.equal(getMetaPixelDestination("staging", verified), "123456789012345");
assert.equal(getServerMetaPixelDestination("staging", verified), "123456789012345");
assert.equal(getMarketingDestinationStatus(verified).google.enabled, true);
assert.equal(getMarketingDestinationStatus(verified).meta.enabled, true);

const missingOwnership = { ...verified, NEXT_PUBLIC_STAGING_MARKETING_DESTINATIONS_VERIFIED: "false" };
assert.deepEqual(getGoogleMarketingDestination("staging", missingOwnership), {}, "unverified public IDs remain disabled");
assert.equal(getMetaPixelDestination("staging", missingOwnership), undefined);
assert.equal(getServerMetaPixelDestination("staging", { ...verified, META_STAGING_DESTINATIONS_VERIFIED: "false" }), undefined);
assert.equal(getMarketingDestinationStatus({ ...verified, META_STAGING_PIXEL_ID: "999999999999999" }).meta.reason, "account_mismatch");
assert.equal(getMarketingDestinationStatus({ ...verified, NEXT_PUBLIC_STAGING_GA4_MEASUREMENT_ID: "bad" }).google.enabled, true, "valid configured Ads pair remains enabled without malformed GA4");

console.log("Marketing destination isolation, verification, and mismatch checks passed.");
