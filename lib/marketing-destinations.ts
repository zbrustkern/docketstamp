/** Marketing destinations are opt-in, environment-scoped operator configuration.
 * An ID is considered usable only when the matching environment has an explicit
 * ownership-verification marker. No inherited or cross-environment fallback is
 * permitted.
 */
export type MarketingEnvironment = "local" | "staging" | "production";
export interface GoogleMarketingDestination {
  tagId?: string;
  adsId?: string;
  conversionLabel?: string;
  ga4Id?: string;
}
export interface MarketingDestinationStatus {
  environment: MarketingEnvironment;
  google: { enabled: boolean; reason: "verified" | "verification_required" | "destination_missing"; configured: string[] };
  meta: { enabled: boolean; reason: "verified" | "verification_required" | "destination_missing" | "account_mismatch" | "access_token_missing"; configured: boolean };
}

// Next.js only embeds NEXT_PUBLIC variables when references are statically named.
// Keep this map explicit so the verified destination config reaches the browser.
function publicEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_LOCAL_MARKETING_DESTINATIONS_VERIFIED: process.env.NEXT_PUBLIC_LOCAL_MARKETING_DESTINATIONS_VERIFIED,
    NEXT_PUBLIC_LOCAL_GOOGLE_TAG_ID: process.env.NEXT_PUBLIC_LOCAL_GOOGLE_TAG_ID,
    NEXT_PUBLIC_LOCAL_GOOGLE_ADS_ID: process.env.NEXT_PUBLIC_LOCAL_GOOGLE_ADS_ID,
    NEXT_PUBLIC_LOCAL_GOOGLE_ADS_CONVERSION_LABEL: process.env.NEXT_PUBLIC_LOCAL_GOOGLE_ADS_CONVERSION_LABEL,
    NEXT_PUBLIC_LOCAL_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_LOCAL_GA4_MEASUREMENT_ID,
    NEXT_PUBLIC_LOCAL_META_PIXEL_ID: process.env.NEXT_PUBLIC_LOCAL_META_PIXEL_ID,
    NEXT_PUBLIC_STAGING_MARKETING_DESTINATIONS_VERIFIED: process.env.NEXT_PUBLIC_STAGING_MARKETING_DESTINATIONS_VERIFIED,
    NEXT_PUBLIC_STAGING_GOOGLE_TAG_ID: process.env.NEXT_PUBLIC_STAGING_GOOGLE_TAG_ID,
    NEXT_PUBLIC_STAGING_GOOGLE_ADS_ID: process.env.NEXT_PUBLIC_STAGING_GOOGLE_ADS_ID,
    NEXT_PUBLIC_STAGING_GOOGLE_ADS_CONVERSION_LABEL: process.env.NEXT_PUBLIC_STAGING_GOOGLE_ADS_CONVERSION_LABEL,
    NEXT_PUBLIC_STAGING_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_STAGING_GA4_MEASUREMENT_ID,
    NEXT_PUBLIC_STAGING_META_PIXEL_ID: process.env.NEXT_PUBLIC_STAGING_META_PIXEL_ID,
    NEXT_PUBLIC_PRODUCTION_MARKETING_DESTINATIONS_VERIFIED: process.env.NEXT_PUBLIC_PRODUCTION_MARKETING_DESTINATIONS_VERIFIED,
    NEXT_PUBLIC_PRODUCTION_GOOGLE_TAG_ID: process.env.NEXT_PUBLIC_PRODUCTION_GOOGLE_TAG_ID,
    NEXT_PUBLIC_PRODUCTION_GOOGLE_ADS_ID: process.env.NEXT_PUBLIC_PRODUCTION_GOOGLE_ADS_ID,
    NEXT_PUBLIC_PRODUCTION_GOOGLE_ADS_CONVERSION_LABEL: process.env.NEXT_PUBLIC_PRODUCTION_GOOGLE_ADS_CONVERSION_LABEL,
    NEXT_PUBLIC_PRODUCTION_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_PRODUCTION_GA4_MEASUREMENT_ID,
    NEXT_PUBLIC_PRODUCTION_META_PIXEL_ID: process.env.NEXT_PUBLIC_PRODUCTION_META_PIXEL_ID,
  };
}

export function getMarketingEnvironment(env: NodeJS.ProcessEnv = { ...process.env, ...publicEnvironment() }): MarketingEnvironment {
  if (env.ENVIRONMENT === "staging" || env.NEXT_PUBLIC_ENVIRONMENT === "staging" ||
      env.FIREBASE_PROJECT_ID === "docketstamp-staging" || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "docketstamp-staging") return "staging";
  if (env.ENVIRONMENT === "production" || env.NEXT_PUBLIC_ENVIRONMENT === "production" || env.NODE_ENV === "production") return "production";
  return "local";
}

function googleValues(environment: MarketingEnvironment, env: NodeJS.ProcessEnv) {
  const prefix = environment.toUpperCase();
  return {
    tagId: env[`NEXT_PUBLIC_${prefix}_GOOGLE_TAG_ID`]?.trim(),
    adsId: env[`NEXT_PUBLIC_${prefix}_GOOGLE_ADS_ID`]?.trim(),
    conversionLabel: env[`NEXT_PUBLIC_${prefix}_GOOGLE_ADS_CONVERSION_LABEL`]?.trim(),
    ga4Id: env[`NEXT_PUBLIC_${prefix}_GA4_MEASUREMENT_ID`]?.trim(),
    verified: env[`NEXT_PUBLIC_${prefix}_MARKETING_DESTINATIONS_VERIFIED`] === "true",
  };
}

function validTagId(value?: string): boolean { return Boolean(value && /^(GT-[A-Z0-9]+|G-[A-Z0-9]+|AW-[0-9]+)$/.test(value)); }
function validAdsId(value?: string): boolean { return Boolean(value && /^AW-[0-9]+$/.test(value)); }
function validGa4Id(value?: string): boolean { return Boolean(value && /^G-[A-Z0-9]+$/.test(value)); }
function validConversionLabel(value?: string): boolean { return Boolean(value && /^[A-Za-z0-9_-]+$/.test(value)); }

export function getGoogleMarketingDestination(
  environment = getMarketingEnvironment(),
  env: NodeJS.ProcessEnv = publicEnvironment(),
): GoogleMarketingDestination {
  const values = googleValues(environment, env);
  if (!values.verified) return {};
  return {
    ...(validTagId(values.tagId) ? { tagId: values.tagId } : {}),
    ...(validAdsId(values.adsId) ? { adsId: values.adsId } : {}),
    ...(validConversionLabel(values.conversionLabel) ? { conversionLabel: values.conversionLabel } : {}),
    ...(validGa4Id(values.ga4Id) ? { ga4Id: values.ga4Id } : {}),
  };
}

export function getMetaPixelDestination(
  environment = getMarketingEnvironment(),
  env: NodeJS.ProcessEnv = publicEnvironment(),
): string | undefined {
  const prefix = environment.toUpperCase();
  if (env[`NEXT_PUBLIC_${prefix}_MARKETING_DESTINATIONS_VERIFIED`] !== "true") return undefined;
  const pixelId = env[`NEXT_PUBLIC_${prefix}_META_PIXEL_ID`]?.trim();
  return pixelId && /^\d{6,20}$/.test(pixelId) ? pixelId : undefined;
}

export function getServerMetaPixelDestination(
  environment = getMarketingEnvironment(),
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const prefix = environment.toUpperCase();
  if (env[`META_${prefix}_DESTINATIONS_VERIFIED`] !== "true") return undefined;
  const pixelId = env[`META_${prefix}_PIXEL_ID`]?.trim();
  return pixelId && /^\d{6,20}$/.test(pixelId) ? pixelId : undefined;
}

export function getMarketingDestinationStatus(env: NodeJS.ProcessEnv = { ...process.env, ...publicEnvironment() }): MarketingDestinationStatus {
  const environment = getMarketingEnvironment(env);
  const values = googleValues(environment, env);
  const googleIds = {
    tagId: validTagId(values.tagId) ? values.tagId : undefined,
    adsId: validAdsId(values.adsId) ? values.adsId : undefined,
    conversionLabel: validConversionLabel(values.conversionLabel) ? values.conversionLabel : undefined,
    ga4Id: validGa4Id(values.ga4Id) ? values.ga4Id : undefined,
  };
  const configured = Object.entries(googleIds).filter(([, value]) => Boolean(value)).map(([key]) => key);
  const googleEnabled = values.verified && Boolean(googleIds.ga4Id || (googleIds.adsId && googleIds.conversionLabel));
  const publicMetaId = getMetaPixelDestination(environment, env);
  const serverMetaId = getServerMetaPixelDestination(environment, env);
  const publicMeta = Boolean(publicMetaId);
  const serverMeta = Boolean(serverMetaId);
  const metaToken = env.META_CONVERSIONS_API_ACCESS_TOKEN || env["meta-conversions-api-access-token"] || env.META_ACCESS_TOKEN;
  const metaEnabled = Boolean(publicMetaId && serverMetaId && publicMetaId === serverMetaId && metaToken);
  return {
    environment,
    google: {
      enabled: googleEnabled,
      reason: !values.verified ? "verification_required" : googleEnabled ? "verified" : "destination_missing",
      configured,
    },
    meta: {
      enabled: metaEnabled,
      reason: !publicMeta || !serverMeta
        ? (env[`NEXT_PUBLIC_${environment.toUpperCase()}_MARKETING_DESTINATIONS_VERIFIED`] === "true" ? "destination_missing" : "verification_required")
        : publicMetaId !== serverMetaId
        ? "account_mismatch"
        : !metaToken
        ? "access_token_missing"
        : "verified",
      configured: Boolean(publicMetaId && serverMetaId && publicMetaId === serverMetaId),
    },
  };
}
