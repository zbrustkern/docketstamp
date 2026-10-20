import assert from "node:assert/strict";
import {
  getMetaTestEventCode,
  sendMetaCapiEvents,
  sendMetaCapiPurchaseEvent,
} from "../lib/meta-conversions-api";
import { markMetaCapiTrackedAtOnSuccess } from "../lib/meta-capi-tracking";
import type { Order } from "../lib/types";

async function run() {
  assert.equal(getMetaTestEventCode("local", {
    META_LOCAL_TEST_EVENT_CODE: "LOCAL_CODE", META_TEST_EVENT_CODE: "UNSCOPED",
  }), "LOCAL_CODE");
  assert.equal(getMetaTestEventCode("staging", {
    META_STAGING_TEST_EVENT_CODE: "STAGING_CODE", META_TEST_EVENT_CODE: "UNSCOPED",
  }), "STAGING_CODE");
  assert.equal(getMetaTestEventCode("production", {
    META_PRODUCTION_TEST_EVENT_CODE: "MUST_NOT_BE_USED", META_TEST_EVENT_CODE: "UNSCOPED",
  }), undefined, "production never receives a test-event code");

  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls++;
    throw new Error("CAPI fetch must stay disabled");
  };

  const testEnv = process.env as Record<string, string | undefined>;
  const originalEnvironment = testEnv.ENVIRONMENT;
  const originalNodeEnv = testEnv.NODE_ENV;
  const originalToken = testEnv.META_CONVERSIONS_API_ACCESS_TOKEN;
  testEnv.ENVIRONMENT = "production";
  testEnv.NODE_ENV = "production";
  process.env.META_CONVERSIONS_API_ACCESS_TOKEN = "test-only-token";

  const order = {
    id: "order-unverified-consent",
    amountInCents: 1295,
    attribution: { marketingConsent: true },
  } as unknown as Order;
  const purchase = await sendMetaCapiPurchaseEvent({ order });
  assert.equal(purchase.success, false);
  assert.equal(purchase.skipped, true, "body-level grant assertion cannot enable CAPI");
  const generic = await sendMetaCapiEvents([{
    event_name: "Purchase", event_id: order.id, action_source: "website", user_data: {},
  }]);
  assert.equal(generic.success, false, "generic server CAPI sender is fail-closed too");
  assert.equal(generic.skipped, true);
  assert.equal(fetchCalls, 0, "no server event leaves the process before verifiable consent exists");

  global.fetch = originalFetch;
  if (originalEnvironment === undefined) delete testEnv.ENVIRONMENT;
  else testEnv.ENVIRONMENT = originalEnvironment;
  if (originalNodeEnv === undefined) delete testEnv.NODE_ENV;
  else testEnv.NODE_ENV = originalNodeEnv;
  if (originalToken === undefined) delete testEnv.META_CONVERSIONS_API_ACCESS_TOKEN;
  else testEnv.META_CONVERSIONS_API_ACCESS_TOKEN = originalToken;

  let writes = 0;
  const mark = async (_timestamp: number) => { writes++; };
  assert.equal(await markMetaCapiTrackedAtOnSuccess({ success: false }, mark, 123), false);
  assert.equal(await markMetaCapiTrackedAtOnSuccess({ success: true }, mark, 456), true);
  assert.equal(writes, 1, "only an accepted CAPI result receives a tracked timestamp");

  console.log("CAPI consent fail-closed, environment-scoped test codes, and retryable tracking passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
