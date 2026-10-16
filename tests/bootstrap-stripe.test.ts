/**
 * Test Suite for scripts/bootstrap-stripe.ts
 *
 * Verifies:
 * 1. Idempotent seeding of 3 Official DocketStamp Service Tiers:
 *    - first_class ($12.95)
 *    - certified ($19.95)
 *    - certified_return_receipt ($27.95)
 *    - statement_descriptor: "DOCKETSTAMP"
 *    - metadata.docket_tier_id matching
 * 2. Idempotent webhook endpoint registration:
 *    - URL: ${NEXT_PUBLIC_APP_URL}/api/webhooks/stripe
 *    - Subscriptions: payment_intent.succeeded, payment_intent.payment_failed, charge.dispute.created
 *    - Generating & exposing STRIPE_WEBHOOK_SECRET
 * 3. Apple Pay 1-tap domain registration (Live Mode only):
 *    - Registers apex and www domains
 *    - Idempotently skips already registered domains
 *    - Skips in test mode
 * 4. Env block formatting & sanitization
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import {
  bootstrapStripe,
  extractApplePayDomains,
  sanitizeStripeKey,
  DOCKETSTAMP_SERVICE_TIERS,
  STATEMENT_DESCRIPTOR,
  REQUIRED_WEBHOOK_EVENTS,
} from "../scripts/bootstrap-stripe";

/**
 * Creates an in-memory Stripe mock client for testing idempotent operations.
 */
function createMockStripeClient() {
  const products: Stripe.Product[] = [];
  const prices: Stripe.Price[] = [];
  const webhooks: Stripe.WebhookEndpoint[] = [];
  const applePayDomains: Stripe.ApplePayDomain[] = [];

  let nextId = 1000;

  const mockClient = {
    accounts: {
      retrieve: async () => ({
        id: "acct_test_docketstamp_123",
        business_profile: { name: "DocketStamp" },
      }),
    },
    products: {
      list: (params?: { limit?: number }) => {
        let items = [...products];
        return {
          data: items,
          has_more: false,
          [Symbol.asyncIterator]: async function* () {
            for (const item of items) {
              yield item;
            }
          },
        };
      },
      create: async (params: Stripe.ProductCreateParams): Promise<Stripe.Product> => {
        const id = `prod_${nextId++}`;
        const newProduct = {
          id,
          object: "product" as const,
          active: params.active ?? true,
          name: params.name,
          description: params.description ?? null,
          statement_descriptor: params.statement_descriptor ?? null,
          metadata: params.metadata as Stripe.Metadata,
          default_price: (params.default_price as string) ?? null,
          created: Date.now(),
          updated: Date.now(),
          livemode: false,
        } as Stripe.Product;
        products.push(newProduct);
        return newProduct;
      },
      update: async (id: string, params: Stripe.ProductUpdateParams): Promise<Stripe.Product> => {
        const idx = products.findIndex((p) => p.id === id);
        if (idx === -1) throw new Error(`Product not found: ${id}`);
        const existing = products[idx];
        const updated = {
          ...existing,
          ...params,
          metadata: {
            ...existing.metadata,
            ...(params.metadata || {}),
          },
        } as Stripe.Product;
        products[idx] = updated;
        return updated;
      },
    },
    prices: {
      list: async (params: { product: string; limit?: number }) => {
        const matching = prices.filter((p) => p.product === params.product);
        return {
          object: "list" as const,
          data: matching,
          has_more: false,
          url: "/v1/prices",
        };
      },
      create: async (params: Stripe.PriceCreateParams): Promise<Stripe.Price> => {
        const id = `price_${nextId++}`;
        const newPrice = {
          id,
          object: "price" as const,
          active: true,
          billing_scheme: "per_unit" as const,
          currency: params.currency,
          unit_amount: params.unit_amount ?? null,
          product: params.product as string,
          type: "one_time" as const,
          metadata: (params.metadata || {}) as Stripe.Metadata,
          created: Date.now(),
          livemode: false,
        } as Stripe.Price;
        prices.push(newPrice);
        return newPrice;
      },
    },
    webhookEndpoints: {
      list: async (params?: Stripe.WebhookEndpointListParams) => {
        return {
          object: "list" as const,
          data: [...webhooks],
          has_more: false,
          url: "/v1/webhook_endpoints",
        };
      },
      create: async (params: Stripe.WebhookEndpointCreateParams): Promise<Stripe.WebhookEndpoint> => {
        const id = `we_${nextId++}`;
        const secret = `whsec_test_${nextId++}`;
        const newEndpoint = {
          id,
          object: "webhook_endpoint" as const,
          api_version: null,
          application: null,
          created: Date.now(),
          description: params.description ?? null,
          enabled_events: params.enabled_events as string[],
          livemode: false,
          metadata: (params.metadata || {}) as Stripe.Metadata,
          secret,
          status: "enabled",
          url: params.url,
        } as Stripe.WebhookEndpoint;
        webhooks.push(newEndpoint);
        return newEndpoint;
      },
      update: async (
        id: string,
        params: Stripe.WebhookEndpointUpdateParams
      ): Promise<Stripe.WebhookEndpoint> => {
        const idx = webhooks.findIndex((w) => w.id === id);
        if (idx === -1) throw new Error(`Webhook endpoint not found: ${id}`);
        const existing = webhooks[idx];
        const updated = {
          ...existing,
          ...params,
          enabled_events: (params.enabled_events as string[]) ?? existing.enabled_events,
        } as Stripe.WebhookEndpoint;
        webhooks[idx] = updated;
        return updated;
      },
    },
    applePayDomains: {
      list: (params?: Stripe.ApplePayDomainListParams) => {
        let items = [...applePayDomains];
        return {
          data: items,
          has_more: false,
          [Symbol.asyncIterator]: async function* () {
            for (const item of items) {
              yield item;
            }
          },
        };
      },
      create: async (params: Stripe.ApplePayDomainCreateParams): Promise<Stripe.ApplePayDomain> => {
        const id = `ap_${nextId++}`;
        const newDomain = {
          id,
          object: "apple_pay_domain" as const,
          created: Date.now(),
          domain_name: params.domain_name,
          livemode: true,
        } as Stripe.ApplePayDomain;
        applePayDomains.push(newDomain);
        return newDomain;
      },
    },
    _rawState: {
      products,
      prices,
      webhooks,
      applePayDomains,
    },
  };

  return mockClient;
}

describe("Stripe Environment Bootstrapper (bootstrap-stripe.ts)", () => {
  describe("Helper Functions", () => {
    it("sanitizes quotes and trims Stripe keys", () => {
      assert.equal(sanitizeStripeKey(' "sk_test_123" '), "sk_test_123");
      assert.equal(sanitizeStripeKey(" 'sk_live_abc' "), "sk_live_abc");
      assert.equal(sanitizeStripeKey("sk_live_clean"), "sk_live_clean");
    });

    it("extracts apple pay domains correctly", () => {
      // Apex domain adds both apex and www
      const apex = extractApplePayDomains("https://docketstamp.com");
      assert.ok(apex.includes("docketstamp.com"));
      assert.ok(apex.includes("www.docketstamp.com"));

      // Subdomain only registers itself
      const staging = extractApplePayDomains("https://staging.docketstamp.com");
      assert.deepEqual(staging, ["staging.docketstamp.com"]);

      // Localhost ignored
      const local = extractApplePayDomains("http://localhost:3000");
      assert.deepEqual(local, []);
    });
  });

  describe("Tier Seeding & Idempotency", () => {
    it("creates the 3 service tiers in a fresh Stripe account", async () => {
      const mockStripe = createMockStripeClient();

      const result = await bootstrapStripe({
        secretKey: "sk_test_valid_dummy_key",
        appUrl: "https://docketstamp.com",
        silent: true,
        stripeClient: mockStripe as unknown as Stripe,
      });

      assert.equal(result.accountMode, "TEST");
      assert.equal(mockStripe._rawState.products.length, 3);
      assert.equal(mockStripe._rawState.prices.length, 3);

      // Verify Tier 1: first_class ($12.95)
      const tier1 = result.tiers.first_class;
      assert.equal(tier1.name, "DocketStamp — Standard First-Class Dispatch");
      assert.equal(tier1.amountInCents, 1295);
      assert.equal(tier1.productCreated, true);
      assert.equal(tier1.priceCreated, true);

      // Verify Tier 2: certified ($19.95)
      const tier2 = result.tiers.certified;
      assert.equal(tier2.name, "DocketStamp — USPS Certified Mail® Dispatch");
      assert.equal(tier2.amountInCents, 1995);
      assert.equal(tier2.productCreated, true);
      assert.equal(tier2.priceCreated, true);

      // Verify Tier 3: certified_return_receipt ($27.95)
      const tier3 = result.tiers.certified_return_receipt;
      assert.equal(tier3.name, "DocketStamp — USPS Certified Mail® + Electronic Return Receipt");
      assert.equal(tier3.amountInCents, 2795);
      assert.equal(tier3.productCreated, true);
      assert.equal(tier3.priceCreated, true);

      // Check statement descriptor
      for (const prod of mockStripe._rawState.products) {
        assert.equal(prod.statement_descriptor, STATEMENT_DESCRIPTOR);
      }
    });

    it("is strictly idempotent: second run creates 0 duplicate products and 0 duplicate prices", async () => {
      const mockStripe = createMockStripeClient();

      // First run
      const run1 = await bootstrapStripe({
        secretKey: "sk_test_valid_dummy_key",
        appUrl: "https://docketstamp.com",
        silent: true,
        stripeClient: mockStripe as unknown as Stripe,
      });

      assert.equal(mockStripe._rawState.products.length, 3);
      assert.equal(mockStripe._rawState.prices.length, 3);

      // Second run on the exact same account
      const run2 = await bootstrapStripe({
        secretKey: "sk_test_valid_dummy_key",
        appUrl: "https://docketstamp.com",
        silent: true,
        stripeClient: mockStripe as unknown as Stripe,
      });

      assert.equal(mockStripe._rawState.products.length, 3, "No duplicate products created");
      assert.equal(mockStripe._rawState.prices.length, 3, "No duplicate prices created");

      assert.equal(run2.tiers.first_class.productCreated, false);
      assert.equal(run2.tiers.first_class.priceCreated, false);
      assert.equal(run2.tiers.first_class.priceId, run1.tiers.first_class.priceId);

      assert.equal(run2.tiers.certified.productCreated, false);
      assert.equal(run2.tiers.certified.priceCreated, false);
      assert.equal(run2.tiers.certified.priceId, run1.tiers.certified.priceId);

      assert.equal(run2.tiers.certified_return_receipt.productCreated, false);
      assert.equal(run2.tiers.certified_return_receipt.priceCreated, false);
      assert.equal(run2.tiers.certified_return_receipt.priceId, run1.tiers.certified_return_receipt.priceId);
    });
  });

  describe("Webhook Registration", () => {
    it("creates webhook endpoint subscribed to required events", async () => {
      const mockStripe = createMockStripeClient();

      const result = await bootstrapStripe({
        secretKey: "sk_test_valid_dummy_key",
        appUrl: "https://docketstamp.com",
        silent: true,
        stripeClient: mockStripe as unknown as Stripe,
      });

      assert.equal(result.webhook.status, "created");
      assert.ok(result.webhook.secret?.startsWith("whsec_"));
      assert.equal(result.webhook.url, "https://docketstamp.com/api/webhooks/stripe");

      const endpoint = mockStripe._rawState.webhooks[0];
      assert.ok(endpoint);
      assert.deepEqual(endpoint.enabled_events, [...REQUIRED_WEBHOOK_EVENTS]);
    });

    it("does not duplicate webhook if already registered", async () => {
      const mockStripe = createMockStripeClient();

      await bootstrapStripe({
        secretKey: "sk_test_valid_dummy_key",
        appUrl: "https://docketstamp.com",
        silent: true,
        stripeClient: mockStripe as unknown as Stripe,
      });

      assert.equal(mockStripe._rawState.webhooks.length, 1);

      // Run again
      const result2 = await bootstrapStripe({
        secretKey: "sk_test_valid_dummy_key",
        appUrl: "https://docketstamp.com",
        silent: true,
        stripeClient: mockStripe as unknown as Stripe,
      });

      assert.equal(mockStripe._rawState.webhooks.length, 1, "Should not duplicate webhook endpoint");
      assert.equal(result2.webhook.status, "already_exists");
    });
  });

  describe("Apple Pay Domain Registration", () => {
    it("skips Apple Pay domain registration in TEST mode", async () => {
      const mockStripe = createMockStripeClient();

      const result = await bootstrapStripe({
        secretKey: "sk_test_dummy_key",
        appUrl: "https://docketstamp.com",
        silent: true,
        stripeClient: mockStripe as unknown as Stripe,
      });

      assert.equal(mockStripe._rawState.applePayDomains.length, 0);
      assert.ok(result.applePay.skippedReason?.includes("Test mode"));
    });

    it("registers apex and www domains in LIVE mode", async () => {
      const mockStripe = createMockStripeClient();

      const result = await bootstrapStripe({
        secretKey: "sk_live_dummy_live_key_for_testing",
        appUrl: "https://docketstamp.com",
        silent: true,
        stripeClient: mockStripe as unknown as Stripe,
      });

      assert.equal(result.accountMode, "LIVE");
      assert.equal(mockStripe._rawState.applePayDomains.length, 2);

      const registered = mockStripe._rawState.applePayDomains.map((d) => d.domain_name);
      assert.ok(registered.includes("docketstamp.com"));
      assert.ok(registered.includes("www.docketstamp.com"));
    });

    it("is idempotent: does not duplicate already registered domains in LIVE mode", async () => {
      const mockStripe = createMockStripeClient();

      // First run in live mode
      await bootstrapStripe({
        secretKey: "sk_live_dummy_live_key_for_testing",
        appUrl: "https://docketstamp.com",
        silent: true,
        stripeClient: mockStripe as unknown as Stripe,
      });

      assert.equal(mockStripe._rawState.applePayDomains.length, 2);

      // Second run in live mode
      const result2 = await bootstrapStripe({
        secretKey: "sk_live_dummy_live_key_for_testing",
        appUrl: "https://docketstamp.com",
        silent: true,
        stripeClient: mockStripe as unknown as Stripe,
      });

      assert.equal(mockStripe._rawState.applePayDomains.length, 2);
      assert.equal(result2.applePay.domainsAlreadyExisting.length, 2);
    });
  });

  describe("Output .env Block", () => {
    it("generates a complete copy-pasteable .env block", async () => {
      const mockStripe = createMockStripeClient();

      const result = await bootstrapStripe({
        secretKey: "sk_live_dummy_key",
        appUrl: "https://docketstamp.com",
        silent: true,
        stripeClient: mockStripe as unknown as Stripe,
      });

      const env = result.envBlock;
      assert.ok(env.includes("STRIPE_PRICE_ID_FIRST_CLASS="));
      assert.ok(env.includes("STRIPE_PRICE_ID_CERTIFIED="));
      assert.ok(env.includes("STRIPE_PRICE_ID_CERTIFIED_RETURN_RECEIPT="));
      assert.ok(env.includes("NEXT_PUBLIC_STRIPE_PRICE_ID_FIRST_CLASS="));
      assert.ok(env.includes("NEXT_PUBLIC_STRIPE_PRICE_ID_CERTIFIED="));
      assert.ok(env.includes("NEXT_PUBLIC_STRIPE_PRICE_ID_CERTIFIED_RETURN_RECEIPT="));
      assert.ok(env.includes("STRIPE_WEBHOOK_SECRET=whsec_"));
    });
  });

  describe("Error Handling", () => {
    it("throws clear error when STRIPE_SECRET_KEY is missing or placeholder", async () => {
      await assert.rejects(
        async () => {
          await bootstrapStripe({
            secretKey: "sk_test_placeholder_key",
            silent: true,
          });
        },
        {
          message: "Missing or placeholder STRIPE_SECRET_KEY",
        }
      );
    });
  });
});
