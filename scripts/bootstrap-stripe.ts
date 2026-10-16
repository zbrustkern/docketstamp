/**
 * DocketStamp — Idempotent Stripe Environment Bootstrap Script
 *
 * Configures a fresh or existing Stripe account (Test or Live depending on STRIPE_SECRET_KEY)
 * for DocketStamp in a single command:
 *
 * 1. Seeds the 3 Official DocketStamp Service Tiers (Products & Prices):
 *    - first_class: "DocketStamp — Standard First-Class Dispatch" ($12.95 / 1295 cents)
 *    - certified: "DocketStamp — USPS Certified Mail® Dispatch" ($19.95 / 1995 cents)
 *    - certified_return_receipt: "DocketStamp — USPS Certified Mail® + Electronic Return Receipt" ($27.95 / 2795 cents)
 *    - Sets statement_descriptor on each product to "DOCKETSTAMP"
 *    - Idempotent: checks existing products by metadata.docket_tier_id to prevent duplicates.
 *
 * 2. Registers the Webhook Endpoint Automatically:
 *    - Subscribes ${NEXT_PUBLIC_APP_URL}/api/webhooks/stripe to:
 *      - payment_intent.succeeded
 *      - payment_intent.payment_failed
 *      - charge.dispute.created
 *    - Idempotent: verifies against stripe.webhookEndpoints.list() first.
 *    - Returns newly generated STRIPE_WEBHOOK_SECRET (whsec_...).
 *
 * 3. Registers Domains for 1-Tap Apple Pay (stripe.applePayDomains.create):
 *    - If running with a live key (sk_live_...) and NEXT_PUBLIC_APP_URL is set:
 *      Registers both apex domain and www subdomain (e.g. docketstamp.com & www.docketstamp.com).
 *    - Idempotent: verifies against stripe.applePayDomains.list() first.
 *
 * 4. Outputs a clean copy-pasteable .env block with Price IDs & Webhook Secret.
 *
 * Runnable via:
 *   npx tsx scripts/bootstrap-stripe.ts
 */

import Stripe from "stripe";
import { loadEnvConfig } from "@next/env";

// Load environment variables (.env, .env.local, .env.production, etc.)
loadEnvConfig(process.cwd());

export interface ServiceTierConfig {
  id: "first_class" | "certified" | "certified_return_receipt";
  name: string;
  amountInCents: number;
  description: string;
  serverEnvKey: string;
  clientEnvKey: string;
}

export const DOCKETSTAMP_SERVICE_TIERS: readonly ServiceTierConfig[] = [
  {
    id: "first_class",
    name: "DocketStamp — Standard First-Class Dispatch",
    amountInCents: 1295,
    description:
      "Standard USPS First-Class Mail official legal notice & document dispatch with Intelligent Mail barcode tracking",
    serverEnvKey: "STRIPE_PRICE_ID_FIRST_CLASS",
    clientEnvKey: "NEXT_PUBLIC_STRIPE_PRICE_ID_FIRST_CLASS",
  },
  {
    id: "certified",
    name: "DocketStamp — USPS Certified Mail® Dispatch",
    amountInCents: 1995,
    description:
      "USPS Certified Mail® official legal notice dispatch with tracking, proof of acceptance, and proof of mailing",
    serverEnvKey: "STRIPE_PRICE_ID_CERTIFIED",
    clientEnvKey: "NEXT_PUBLIC_STRIPE_PRICE_ID_CERTIFIED",
  },
  {
    id: "certified_return_receipt",
    name: "DocketStamp — USPS Certified Mail® + Electronic Return Receipt",
    amountInCents: 2795,
    description:
      "USPS Certified Mail® + Electronic Return Receipt (ERR) with legally conclusive recipient signature proof",
    serverEnvKey: "STRIPE_PRICE_ID_CERTIFIED_RETURN_RECEIPT",
    clientEnvKey: "NEXT_PUBLIC_STRIPE_PRICE_ID_CERTIFIED_RETURN_RECEIPT",
  },
] as const;

export const STATEMENT_DESCRIPTOR = "DOCKETSTAMP";

export const REQUIRED_WEBHOOK_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.dispute.created",
] as const;

export interface BootstrapStripeOptions {
  secretKey?: string;
  appUrl?: string;
  silent?: boolean;
  stripeClient?: Stripe;
}

export interface TierBootstrapResult {
  tierId: "first_class" | "certified" | "certified_return_receipt";
  name: string;
  productId: string;
  priceId: string;
  amountInCents: number;
  productCreated: boolean;
  priceCreated: boolean;
}

export interface WebhookBootstrapResult {
  endpointId?: string;
  url?: string;
  secret?: string;
  status: "created" | "already_exists" | "skipped_no_url" | "skipped_localhost" | "failed";
  reason?: string;
}

export interface ApplePayBootstrapResult {
  domainsAttempted: string[];
  domainsRegistered: string[];
  domainsAlreadyExisting: string[];
  skippedReason?: string;
}

export interface BootstrapStripeResult {
  accountMode: "LIVE" | "TEST";
  accountId?: string;
  tiers: Record<"first_class" | "certified" | "certified_return_receipt", TierBootstrapResult>;
  webhook: WebhookBootstrapResult;
  applePay: ApplePayBootstrapResult;
  envBlock: string;
}

/**
 * Normalizes a raw Stripe secret key by trimming whitespace and removing matching quotes.
 */
export function sanitizeStripeKey(raw: string = ""): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"') && key.length >= 2) ||
    (key.startsWith("'") && key.endsWith("'") && key.length >= 2)
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

/**
 * Extracts target hostnames for Apple Pay domain registration from an app URL.
 * Automatically expands apex domains to include www. (and vice versa).
 */
export function extractApplePayDomains(rawUrl: string): string[] {
  if (!rawUrl || !rawUrl.trim()) return [];

  let parsed: URL;
  try {
    const withProtocol = rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`;
    parsed = new URL(withProtocol);
  } catch {
    return [];
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    return [];
  }

  const domains = new Set<string>();
  if (hostname.startsWith("www.")) {
    domains.add(hostname.slice(4));
    domains.add(hostname);
  } else {
    domains.add(hostname);
    const parts = hostname.split(".");
    // If it's a standard two-part domain (e.g. docketstamp.com)
    if (parts.length === 2) {
      domains.add(`www.${hostname}`);
    }
  }

  return Array.from(domains);
}

/**
 * Main idempotent Stripe configuration bootstrap function.
 */
export async function bootstrapStripe(
  options: BootstrapStripeOptions = {}
): Promise<BootstrapStripeResult> {
  const log = (msg: string) => {
    if (!options.silent) {
      console.log(msg);
    }
  };
  const warn = (msg: string) => {
    if (!options.silent) {
      console.warn(msg);
    }
  };

  // 1. Resolve Stripe secret key
  const rawKey =
    options.secretKey ??
    process.env.STRIPE_SECRET_KEY ??
    process.env["stripe-secret-key"] ??
    "";
  const secretKey = sanitizeStripeKey(rawKey);

  if (!secretKey || secretKey.startsWith("sk_test_placeholder") || secretKey === "sk_test_...") {
    const errorMsg =
      "\n❌ ERROR: Valid STRIPE_SECRET_KEY is required to bootstrap Stripe.\n" +
      "Please set STRIPE_SECRET_KEY in your environment, .env, or .env.local file, or pass it inline:\n" +
      "  STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/bootstrap-stripe.ts\n";
    if (!options.silent) {
      console.error(errorMsg);
    }
    throw new Error("Missing or placeholder STRIPE_SECRET_KEY");
  }

  const isLiveMode = secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
  const accountMode = isLiveMode ? "LIVE" : "TEST";
  const maskedKey =
    secretKey.length > 14
      ? `${secretKey.slice(0, 8)}...${secretKey.slice(-4)}`
      : `${secretKey.slice(0, 4)}...`;

  log("\n" + "=".repeat(78));
  log("⚖️  DOCKETSTAMP — STRIPE ENVIRONMENT BOOTSTRAPPER");
  log("=".repeat(78));
  log(`• Account Mode:     ${accountMode} (${maskedKey})`);

  // Initialize or reuse Stripe Client
  const stripe =
    options.stripeClient ??
    new Stripe(secretKey, {
      apiVersion: "2025-01-27.acacia" as unknown as Stripe.LatestApiVersion,
      typescript: true,
      appInfo: {
        name: "DocketStamp Stripe Bootstrapper",
        version: "1.0.0",
      },
    });

  // Optional: check Stripe Account ID
  let accountId: string | undefined;
  try {
    const account = await stripe.accounts.retrieve();
    accountId = account.id;
    log(`• Stripe Account:   ${account.id} (${account.business_profile?.name || account.settings?.dashboard?.display_name || "DocketStamp"})`);
  } catch {
    // Some restricted keys do not have accounts.retrieve permission; safely ignore
  }

  // Resolve Target App URL
  const rawAppUrl =
    options.appUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "";
  const appUrl = rawAppUrl.trim().replace(/\/+$/, "");
  log(`• App Public URL:   ${appUrl || "(not configured)"}`);
  log("-".repeat(78));

  // ---------------------------------------------------------------------------
  // STEP 1: Seed the 3 Official DocketStamp Service Tiers (Products & Prices)
  // ---------------------------------------------------------------------------
  log("\n📦 STEP 1: Seeding 3 Official DocketStamp Service Tiers...");

  // Retrieve existing products to ensure idempotency
  const existingProducts: Stripe.Product[] = [];
  try {
    for await (const product of stripe.products.list({ limit: 100 })) {
      existingProducts.push(product);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to list existing Stripe products: ${msg}`);
  }

  const tierResults: Partial<
    Record<"first_class" | "certified" | "certified_return_receipt", TierBootstrapResult>
  > = {};

  for (const tier of DOCKETSTAMP_SERVICE_TIERS) {
    // Check existing product by metadata.docket_tier_id first, then fallback to exact name
    let product = existingProducts.find(
      (p) => p.metadata?.docket_tier_id === tier.id || p.name === tier.name
    );
    let productCreated = false;

    if (!product) {
      log(`  ➕ Creating product: "${tier.name}" (${tier.id})...`);
      product = await stripe.products.create({
        name: tier.name,
        statement_descriptor: STATEMENT_DESCRIPTOR,
        description: tier.description,
        active: true,
        metadata: {
          docket_tier_id: tier.id,
          project: "DocketStamp",
        },
      });
      productCreated = true;
      log(`     ✓ Created product ID: ${product.id}`);
    } else {
      log(`  ✓ Found existing product: ${product.id} ("${product.name}")`);
      // Verify statement_descriptor, name, active status, and metadata
      const needsUpdate =
        product.metadata?.docket_tier_id !== tier.id ||
        product.statement_descriptor !== STATEMENT_DESCRIPTOR ||
        product.name !== tier.name ||
        !product.active;

      if (needsUpdate) {
        log(`     ↻ Updating product attributes to canonical spec...`);
        product = await stripe.products.update(product.id, {
          name: tier.name,
          statement_descriptor: STATEMENT_DESCRIPTOR,
          active: true,
          metadata: {
            ...product.metadata,
            docket_tier_id: tier.id,
            project: "DocketStamp",
          },
        });
        log(`     ✓ Synchronized product ID: ${product.id}`);
      }
    }

    // Check existing prices for this product
    const pricesList = await stripe.prices.list({
      product: product.id,
      limit: 100,
    });

    let price = pricesList.data.find(
      (p) =>
        p.active &&
        p.currency.toLowerCase() === "usd" &&
        p.unit_amount === tier.amountInCents &&
        p.type === "one_time"
    );
    let priceCreated = false;

    if (!price) {
      log(`  ➕ Creating price for ${tier.id}: $${(tier.amountInCents / 100).toFixed(2)} USD...`);
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: tier.amountInCents,
        currency: "usd",
        metadata: {
          docket_tier_id: tier.id,
          project: "DocketStamp",
        },
      });
      priceCreated = true;
      log(`     ✓ Created price ID: ${price.id}`);
    } else {
      log(`  ✓ Found existing price: ${price.id} ($${(tier.amountInCents / 100).toFixed(2)} USD)`);
    }

    // Ensure product's default_price points to canonical tier price
    const currentDefault =
      typeof product.default_price === "string"
        ? product.default_price
        : product.default_price?.id;

    if (currentDefault !== price.id) {
      await stripe.products.update(product.id, {
        default_price: price.id,
      });
      log(`     ✓ Associated ${price.id} as default_price for product ${product.id}`);
    }

    tierResults[tier.id] = {
      tierId: tier.id,
      name: tier.name,
      productId: product.id,
      priceId: price.id,
      amountInCents: tier.amountInCents,
      productCreated,
      priceCreated,
    };
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Register the Webhook Endpoint Automatically
  // ---------------------------------------------------------------------------
  log("\n🔔 STEP 2: Registering Stripe Webhook Endpoint...");
  const webhookResult: WebhookBootstrapResult = {
    status: "skipped_no_url",
  };

  if (!appUrl) {
    webhookResult.status = "skipped_no_url";
    webhookResult.reason = "NEXT_PUBLIC_APP_URL is not set";
    log("  ⚠️  Skipping: NEXT_PUBLIC_APP_URL is not configured.");
    log("     Set NEXT_PUBLIC_APP_URL=https://docketstamp.com to auto-register webhooks.");
  } else if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    webhookResult.status = "skipped_localhost";
    webhookResult.reason = "Localhost URL cannot receive public Stripe webhooks";
    log(`  ⚠️  Skipping: ${appUrl} is a local development URL.`);
    log("     For local development, forward webhooks using Stripe CLI:");
    log("       stripe listen --forward-to localhost:3000/api/webhooks/stripe");
  } else {
    const webhookTargetUrl = `${appUrl}/api/webhooks/stripe`;
    webhookResult.url = webhookTargetUrl;

    try {
      const endpointsList = await stripe.webhookEndpoints.list({ limit: 100 });
      const existing = endpointsList.data.find(
        (ep) => ep.url.replace(/\/+$/, "") === webhookTargetUrl
      );

      if (existing) {
        webhookResult.endpointId = existing.id;
        webhookResult.status = "already_exists";
        log(`  ✓ Webhook endpoint already registered: ${existing.id} (${existing.url})`);

        // Check for missing events
        const existingEvents = new Set(existing.enabled_events);
        const hasWildcard = existingEvents.has("*");
        const missing = REQUIRED_WEBHOOK_EVENTS.filter(
          (e) => !hasWildcard && !existingEvents.has(e as string)
        );

        if (missing.length > 0) {
          log(`     ↻ Adding missing events: ${missing.join(", ")}...`);
          const merged = Array.from(
            new Set([...existing.enabled_events, ...REQUIRED_WEBHOOK_EVENTS])
          ) as Stripe.WebhookEndpointUpdateParams.EnabledEvent[];
          await stripe.webhookEndpoints.update(existing.id, {
            enabled_events: merged,
          });
          log(`     ✓ Webhook endpoint events updated.`);
        }

        // Stripe hides secret on existing endpoints; preserve current env secret if set
        const existingEnvSecret =
          process.env.STRIPE_WEBHOOK_SECRET || process.env["stripe-webhook-secret"];
        if (existingEnvSecret && !existingEnvSecret.includes("placeholder")) {
          webhookResult.secret = existingEnvSecret;
        }
      } else {
        log(`  ➕ Registering webhook endpoint for: ${webhookTargetUrl}...`);
        const created = await stripe.webhookEndpoints.create({
          url: webhookTargetUrl,
          enabled_events: [...REQUIRED_WEBHOOK_EVENTS],
          description: `DocketStamp Webhook Endpoint (${accountMode})`,
          metadata: {
            project: "DocketStamp",
            mode: accountMode.toLowerCase(),
            managed_by: "scripts/bootstrap-stripe.ts",
          },
        });

        webhookResult.endpointId = created.id;
        webhookResult.status = "created";
        webhookResult.secret = created.secret;
        log(`     ✓ Successfully registered webhook endpoint ID: ${created.id}`);
        log(`     🔑 Generated Webhook Signing Secret: ${created.secret}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      webhookResult.status = "failed";
      webhookResult.reason = msg;
      warn(`  ⚠️  Failed to register webhook endpoint: ${msg}`);
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Register Domains for 1-Tap Apple Pay (stripe.applePayDomains.create)
  // ---------------------------------------------------------------------------
  log("\n🍏 STEP 3: Registering Apple Pay Domains (1-Tap Apple Pay)...");
  const applePayResult: ApplePayBootstrapResult = {
    domainsAttempted: [],
    domainsRegistered: [],
    domainsAlreadyExisting: [],
  };

  if (!isLiveMode) {
    applePayResult.skippedReason =
      "Test mode: Stripe enables Apple Pay test cards automatically without dashboard domain registration.";
    log("  ℹ️  Skipped: Stripe account is in TEST mode.");
    log("     Apple Pay domain registration is only required/supported for Live Mode (sk_live_...).");
  } else if (!appUrl) {
    applePayResult.skippedReason = "NEXT_PUBLIC_APP_URL is not set";
    log("  ⚠️  Skipped: NEXT_PUBLIC_APP_URL is not configured.");
  } else {
    const candidateDomains = extractApplePayDomains(appUrl);
    applePayResult.domainsAttempted = candidateDomains;

    if (candidateDomains.length === 0) {
      applePayResult.skippedReason = "No public domains extracted from app URL";
      log(`  ⚠️  No public domain names found in app URL: ${appUrl}`);
    } else {
      log(`  • Extracted candidate domains: ${candidateDomains.join(", ")}`);

      // List existing registered domains
      const existingDomainSet = new Set<string>();
      try {
        for await (const domainObj of stripe.applePayDomains.list({ limit: 100 })) {
          existingDomainSet.add(domainObj.domain_name.toLowerCase());
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warn(`  ⚠️  Unable to list existing Apple Pay domains: ${msg}`);
      }

      for (const domain of candidateDomains) {
        if (existingDomainSet.has(domain)) {
          applePayResult.domainsAlreadyExisting.push(domain);
          log(`  ✓ Domain already registered: ${domain}`);
          continue;
        }

        try {
          log(`  ➕ Registering domain with Apple Pay: ${domain}...`);
          await stripe.applePayDomains.create({
            domain_name: domain,
          });
          applePayResult.domainsRegistered.push(domain);
          log(`     ✓ Registered ${domain} for Apple Pay!`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          warn(`  ⚠️  Failed to register domain "${domain}": ${msg}`);
          warn(
            `     Note: Stripe verifies https://${domain}/.well-known/apple-developer-merchantid-domain-association.`
          );
          warn(`     Ensure your production server is live and serving this file before re-running.`);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Format Clean Copy-Pasteable .env Block
  // ---------------------------------------------------------------------------
  const firstClassPriceId = tierResults.first_class?.priceId || "price_unconfigured";
  const certifiedPriceId = tierResults.certified?.priceId || "price_unconfigured";
  const returnReceiptPriceId =
    tierResults.certified_return_receipt?.priceId || "price_unconfigured";
  const webhookSecretValue =
    webhookResult.secret ||
    (webhookResult.status === "already_exists"
      ? "(preserve existing STRIPE_WEBHOOK_SECRET)"
      : "whsec_unconfigured");

  const envBlock = [
    `# ==============================================================================`,
    `# DocketStamp Stripe Configuration (${accountMode} MODE)`,
    `# Generated via: npx tsx scripts/bootstrap-stripe.ts`,
    `# ==============================================================================`,
    ``,
    `# [SERVER ONLY] Service Tier Price IDs`,
    `STRIPE_PRICE_ID_FIRST_CLASS=${firstClassPriceId}`,
    `STRIPE_PRICE_ID_CERTIFIED=${certifiedPriceId}`,
    `STRIPE_PRICE_ID_CERTIFIED_RETURN_RECEIPT=${returnReceiptPriceId}`,
    ``,
    `# [CLIENT PUBLIC] Service Tier Price IDs (Loaded by Checkout & Fee Display)`,
    `NEXT_PUBLIC_STRIPE_PRICE_ID_FIRST_CLASS=${firstClassPriceId}`,
    `NEXT_PUBLIC_STRIPE_PRICE_ID_CERTIFIED=${certifiedPriceId}`,
    `NEXT_PUBLIC_STRIPE_PRICE_ID_CERTIFIED_RETURN_RECEIPT=${returnReceiptPriceId}`,
    ``,
    `# [SERVER ONLY] Webhook signing secret`,
    `STRIPE_WEBHOOK_SECRET=${webhookSecretValue}`,
  ].join("\n");

  log("\n" + "=".repeat(78));
  log("🎉 DOCKETSTAMP STRIPE BOOTSTRAP COMPLETE");
  log("=".repeat(78));
  log(
    "Copy and paste the following block into your .env.local or Cloud Secret Manager:\n"
  );
  log(envBlock);
  log("\n" + "=".repeat(78) + "\n");

  if (webhookResult.status === "created" && webhookResult.secret) {
    log(
      "⚠️  IMPORTANT: Store STRIPE_WEBHOOK_SECRET now! Stripe does not display it again.\n"
    );
  }

  return {
    accountMode,
    accountId,
    tiers: tierResults as Record<
      "first_class" | "certified" | "certified_return_receipt",
      TierBootstrapResult
    >,
    webhook: webhookResult,
    applePay: applePayResult,
    envBlock,
  };
}

// Execute directly if run as a CLI script
if (
  typeof process !== "undefined" &&
  process.argv &&
  process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/bootstrap-stripe.ts")
) {
  bootstrapStripe().catch((err) => {
    console.error("\n❌ Fatal Stripe Bootstrap Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
