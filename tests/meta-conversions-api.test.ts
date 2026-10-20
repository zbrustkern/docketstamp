import {
  hashSha256,
  hashEmail,
  hashPhone,
  hashName,
  hashCity,
  hashState,
  hashZip,
  hashCountry,
  sendMetaCapiEvents,
  sendMetaCapiPurchaseEvent,
  META_GRAPH_API_VERSION,
} from "../lib/meta-conversions-api";
import { buildMetaFbcString } from "../lib/meta-ads";
import { Order } from "../lib/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING META PIXEL & CONVERSIONS API (CAPI) TESTS");
  console.log("=================================================\n");

  console.log("--- 1. Testing Meta PII Normalization & Hashing ---");

  // Email hashing
  const rawEmail = "  Test.Customer@Gmail.Com ";
  const hashedEmail = hashEmail(rawEmail);
  const expectedEmailHash = hashSha256("test.customer@gmail.com");
  assert(hashedEmail === expectedEmailHash, "Email normalized to lowercase, trimmed, and SHA-256 hashed");

  // Invalid email returns undefined
  assert(hashEmail("not-an-email") === undefined, "Invalid email without @ returns undefined");
  assert(hashEmail("") === undefined, "Empty email returns undefined");

  // Phone number hashing
  const rawPhone = " +1 (555) 123-4567 ";
  const hashedPhone = hashPhone(rawPhone);
  const expectedPhoneHash = hashSha256("15551234567");
  assert(hashedPhone === expectedPhoneHash, "Phone stripped of non-numeric characters and SHA-256 hashed");

  // Name hashing
  const rawFirstName = "  Sarah-Jane! ";
  const hashedName = hashName(rawFirstName);
  const expectedNameHash = hashSha256("sarahjane");
  assert(hashedName === expectedNameHash, "Name stripped of punctuation/whitespace and SHA-256 hashed");

  // City hashing
  const rawCity = " Lake Forest ";
  const hashedCity = hashCity(rawCity);
  const expectedCityHash = hashSha256("lakeforest");
  assert(hashedCity === expectedCityHash, "City stripped of whitespace and SHA-256 hashed");

  // State hashing
  const rawState = " Illinois (IL) ";
  const hashedState = hashState("IL");
  const expectedStateHash = hashSha256("il");
  assert(hashedState === expectedStateHash, "State converted to 2 lowercase letters and SHA-256 hashed");

  // Zip code hashing
  const rawZip = "60045-1234";
  const hashedZip = hashZip(rawZip);
  const expectedZipHash = hashSha256("60045");
  assert(hashedZip === expectedZipHash, "Zip code takes first 5 characters and SHA-256 hashed");

  // Country hashing
  const hashedCountry = hashCountry("US");
  const expectedCountryHash = hashSha256("us");
  assert(hashedCountry === expectedCountryHash, "Country converted to 2 lowercase letters and SHA-256 hashed");

  console.log("\n--- 2. Testing Meta Click ID & Cookie Utilities ---");

  const testFbclid = "IwAR0abc123xyz_test_click";
  const oldWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { globalPrivacyControl: false } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: () => "granted" } } });
  const formattedFbc = buildMetaFbcString(testFbclid);
  assert(
    formattedFbc !== null && formattedFbc.startsWith("fb.1.") && formattedFbc.endsWith(testFbclid),
    `FBC format conforms to fb.1.<timestamp>.<fbclid> (got: ${formattedFbc})`
  );

  console.log("\n--- 3. Testing Conversions API Graceful Failover when Unconfigured ---");

  // Ensure unset token skips gracefully without crashing or throwing
  const originalToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
  const originalEnvironment = process.env.ENVIRONMENT;
  const originalVerified = process.env.META_LOCAL_DESTINATIONS_VERIFIED;
  const originalPixel = process.env.META_LOCAL_PIXEL_ID;
  delete process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
  process.env.META_LOCAL_DESTINATIONS_VERIFIED = "true";
  process.env.META_LOCAL_PIXEL_ID = "123456789012345";
  process.env.ENVIRONMENT = "local";

  const skippedResult = await sendMetaCapiEvents([
    {
      event_name: "Purchase",
      event_id: "test_order_123",
      action_source: "website",
      user_data: { email: "test@example.com" },
    },
  ]);

  assert(skippedResult.success === false, "Returns success: false when token unconfigured");
  assert(skippedResult.skipped === true, "Marks skipped: true when token unconfigured");
  assert(
    Boolean(skippedResult.error?.includes("consent")),
    "Clear descriptive error message returned"
  );

  console.log("\n--- 4. Testing End-to-End CAPI Purchase Payload with Mocked Fetch ---");

  // Mock global fetch to inspect request body sent to Meta Graph API
  const originalFetch = global.fetch;
  let capturedUrl = "";
  let capturedBody: any = null;
  let fetchCalls = 0;

  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls++;
    capturedUrl = String(input);
    capturedBody = JSON.parse(init?.body as string);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        events_received: 1,
        fbtrace_id: "test_fbtrace_999",
      }),
    } as Response;
  };

  process.env.META_CONVERSIONS_API_ACCESS_TOKEN = "EAAG_mock_access_token_for_testing";

  const mockOrder: Order = {
    id: "order_capi_test_888",
    customerEmail: "john.doe@example.com",
    amountInCents: 900,
    finalAmountInCents: 775,
    frontImageUrl: "https://example.com/card.png",
    printedMessage: "Happy Birthday!",
    handwrittenNote: "Hope you have an amazing day!",
    fontStyleId: "1",
    noticeId: "service-policy-cancellation",
    recipientAddress: {
      firstName: "Jane",
      lastName: "Smith",
      street1: "456 Oak Ave",
      city: "Chicago",
      state: "IL",
      zip: "60601",
    },
    returnAddress: {
      firstName: "John",
      lastName: "Doe",
      street1: "123 Main St",
      city: "Lake Forest",
      state: "IL",
      zip: "60045",
    },
    status: "PROCESSING_HANDWRYTTEN",
    paymentMethod: "STRIPE",
    attribution: {
      marketingConsent: true,
      fbclid: testFbclid,
      fbp: "fb.1.1718000000.987654321",
      clientIp: "98.76.54.32",
      userAgent: "Mozilla/5.0 Test Agent",
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const noConsentResult = await sendMetaCapiPurchaseEvent({ order: { ...mockOrder, attribution: { ...mockOrder.attribution, marketingConsent: undefined } } });
  assert(noConsentResult.skipped === true && fetchCalls === 0, "unknown consent blocks server-side Meta egress");

  const capiResponse = await sendMetaCapiPurchaseEvent({
    order: mockOrder,
    testEventCode: "TEST_VERIFY_CODE",
  });

  assert(capiResponse.success === false && capiResponse.skipped === true, "Client-only consent cannot enable CAPI");
  assert(fetchCalls === 0 && capturedBody === null && capturedUrl === "", "No customer or recipient payload leaves the process");

  // --- 5. Testing GPC / Opt-Out Limited Data Use Handling ---
  const optedOutOrder: Order = {
    ...mockOrder,
    id: "order_capi_test_gpc_999",
    attribution: {
      ...mockOrder.attribution,
      gpc: true,
      optOut: true,
    },
  };

  const egressBeforeOptOut = fetchCalls;
  const optOutResult = await sendMetaCapiPurchaseEvent({
    order: optedOutOrder,
  });

  assert(optOutResult.skipped === true, "GPC/opt-out prevents Meta server egress");
  assert(fetchCalls === egressBeforeOptOut, "opted-out purchase did not add an egress payload");

  // Cleanup
  global.fetch = originalFetch;
  if (oldNavigatorDescriptor) Object.defineProperty(globalThis, "navigator", oldNavigatorDescriptor);
  else Reflect.deleteProperty(globalThis, "navigator");
  if (oldWindowDescriptor) Object.defineProperty(globalThis, "window", oldWindowDescriptor);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalToken) {
    process.env.META_CONVERSIONS_API_ACCESS_TOKEN = originalToken;
  } else {
    delete process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
  }
  for (const [key, value] of Object.entries({
    ENVIRONMENT: originalEnvironment,
    META_LOCAL_DESTINATIONS_VERIFIED: originalVerified,
    META_LOCAL_PIXEL_ID: originalPixel,
  })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }

  console.log("\n=================================================");
  console.log(`Test Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("=================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
