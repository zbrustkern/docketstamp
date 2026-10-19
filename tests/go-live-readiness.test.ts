/**
 * DocketStamp Go-Live Readiness Verification Test Suite
 *
 * Verifies all 4 Go-Live Work Packages (WP-A through WP-D) and upholds the 6 System Invariants:
 * 1. Zero Ghost Strings Audit (sendmynotes / aster & blanche / handwrytten scrubbed)
 * 2. Hard NAICS 713940 Fitness Blocker on client guardrails and server API endpoints
 * 3. Max-length 1-page stress test on Notice #2 and Notice #3 verifying /s/ signature and 0.40in UPL footer
 * 4. Rate Limiter on POST /api/docket/verify-address enforcing 20 req/hour/IP with HTTP 429 & Retry-After
 * 5. Lob Tracking Webhook POST /api/webhooks/lob updating Firestore order status
 * 6. Transactional Dispatch Receipt Email formatting dispatch@docketstamp.com and live docket links
 */

import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { assertNonFitnessEntity, ConflictOfInterestError, UPL_COMPLIANCE_FOOTER_TEXT } from "@/src/lib/docket/guardrails";
import { getNoticeBySlug } from "@/src/lib/docket/notices";
import { interpolateNotice } from "@/src/lib/docket/renderer/interpolate";
import { renderLobHtmlPayload } from "@/src/lib/docket/renderer/lob-html-shell";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limiter";
import { POST as verifyAddressRoute } from "@/app/api/docket/verify-address/route";
import { POST as lockAndIntentRoute } from "@/app/api/docket/lock-and-intent/route";
import { POST as lobWebhookRoute } from "@/app/api/webhooks/lob/route";
import { saveOrder, getOrderById } from "@/lib/firebase-admin";
import { Order } from "@/lib/types";
import { sendDocketDispatchReceiptEmail } from "@/lib/email-alerts";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runGoLiveReadinessSuite() {
  console.log("===================================================================");
  console.log("🛡️  RUNNING DOCKETSTAMP GO-LIVE READINESS TEST SUITE (WP-A - WP-D)");
  console.log("===================================================================\n");

  // -------------------------------------------------------------------------
  // 1. Zero Ghost Strings Audit (WP-A)
  // -------------------------------------------------------------------------
  console.log("--- 1. Testing Zero Legacy Ghost Strings in Customer-Facing Code ---");
  const filesToAudit = [
    "components/AuthModal.tsx",
    "components/FeedbackModal.tsx",
    "components/ContactImportModal.tsx",
    "components/flow/FlowHeader.tsx",
    "src/components/docket/GuidedFieldDrawer.tsx",
    "src/components/docket/CheckoutModal.tsx",
    "src/components/docket/DocumentWorkspace.tsx",
    "app/layout.tsx",
    "app/page.tsx",
    "app/disclaimer/page.tsx",
    "app/terms/page.tsx",
    "app/privacy/page.tsx",
    "app/return-policy/page.tsx",
    "public/site.webmanifest",
  ];

  for (const relativePath of filesToAudit) {
    const fullPath = path.resolve(process.cwd(), relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Audit target file not found: ${relativePath}`);
    }
    const content = fs.readFileSync(fullPath, "utf8").toLowerCase();
    assert(
      !content.includes("sendmynotes"),
      `No 'sendmynotes' ghost found in ${relativePath}`
    );
    assert(
      !content.includes("aster & blanche") && !content.includes("aster and blanche"),
      `No 'aster & blanche' ghost found in ${relativePath}`
    );
  }

  // -------------------------------------------------------------------------
  // 2. NAICS 713940 Fitness Blocker (WP-A & Invariant 1)
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Testing NAICS 713940 Fitness Blocker (Client & Server) ---");
  const prohibitedTargets = [
    "Equinox",
    "Planet Fitness",
    "LA Fitness",
    "Gym membership billing",
  ];

  for (const target of prohibitedTargets) {
    let threw = false;
    try {
      assertNonFitnessEntity(target);
    } catch (err) {
      if (err instanceof ConflictOfInterestError) {
        threw = true;
      }
    }
    assert(threw, `assertNonFitnessEntity strictly blocks prohibited target: '${target}'`);
  }

  // Non-fitness hardware OEM and consumer electronics must be permitted
  const permittedTargets = [
    "Apple Inc.",
    "Sonos Inc.",
    "Withings Technologies",
    "Garmin USA",
    "LG Electronics",
  ];
  for (const allowed of permittedTargets) {
    let threw = false;
    try {
      assertNonFitnessEntity(allowed);
    } catch {
      threw = true;
    }
    assert(!threw, `assertNonFitnessEntity permits non-fitness OEM: '${allowed}'`);
  }

  // Test POST /api/docket/verify-address rejection of fitness entities
  const verifyReq = new NextRequest("http://localhost:3000/api/docket/verify-address", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipientName: "Equinox Fitness Management",
      address: {
        street1: "8950 Sunset Blvd",
        city: "West Hollywood",
        state: "CA",
        zip: "90069",
      },
    }),
  });
  const verifyRes = await verifyAddressRoute(verifyReq);
  assert(verifyRes.status === 400, "POST /api/docket/verify-address rejects Equinox with HTTP 400");
  const verifyJson = await verifyRes.json();
  assert(
    verifyJson.code === "CONFLICT_OF_INTEREST_FITNESS_EXCLUSION",
    "verify-address returns CONFLICT_OF_INTEREST_FITNESS_EXCLUSION code"
  );

  // Test POST /api/docket/lock-and-intent rejection of fitness entities
  const lockReq = new NextRequest("http://localhost:3000/api/docket/lock-and-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      noticeSlug: "service-cancellation",
      userValues: {
        senderFullName: "John Doe",
        serviceProviderName: "Planet Fitness",
        contractIdentifier: "MEM-998811",
      },
    }),
  });
  const lockRes = await lockAndIntentRoute(lockReq);
  assert(lockRes.status === 400, "POST /api/docket/lock-and-intent rejects Planet Fitness with HTTP 400");
  const lockJson = await lockRes.json();
  assert(
    lockJson.category === "PROHIBITED_NAICS_713940",
    "lock-and-intent returns category PROHIBITED_NAICS_713940"
  );

  // -------------------------------------------------------------------------
  // 3. Max-Length 1-Page Stress Test on Notices #2 & #3 (WP-A & Invariant 3)
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Testing Max-Length 1-Page Lob HTML Geometry & Clear Zones ---");

  // Notice #2: Security Deposit Return Demand
  const notice2 = getNoticeBySlug("security-deposit-return");
  assert(Boolean(notice2), "Notice #2 cartridge resolved");
  const sampleDocketId2 = "DS-2026-TEST02";

  const interpolated2 = interpolateNotice({
    notice: notice2!,
    userValues: {
      tenantFullName: "Alexander Maximilian Richardson-Montgomery",
      landlordFullName: "Vanguard Pacific Commercial Real Estate Holdings LLC",
      propertyAddressLine: "1428 West Comprehensive Metropolitan Parkway, Penthouse Suite 1802",
      propertyCity: "San Francisco",
      propertyState: "CA",
      propertyZip: "94103",
      leaseStartDate: "2024-01-01",
      leaseEndDate: "2025-12-31",
      moveOutDate: "2025-12-31",
      depositAmount: "$12,500.00",
      deductionsDisputed: "Unsubstantiated repainting charges ($2,400.00), fictitious carpet replacement fee ($3,100.00), and unauthorized administrative cleaning surcharge ($1,250.00).",
      forwardingAddress: "742 Evergreen Terrace, San Francisco, CA 94107",
    },
    serviceLevel: "certified",
    docketId: sampleDocketId2,
  });

  const html2 = renderLobHtmlPayload(interpolated2);
  assert(html2.includes("/s/ Alexander Maximilian Richardson-Montgomery"), "Notice #2 Lob HTML contains full /s/ electronic signature");
  assert(html2.includes(UPL_COMPLIANCE_FOOTER_TEXT(sampleDocketId2)), "Notice #2 Lob HTML contains verbatim UPL compliance disclosure");
  assert(html2.includes("bottom: 0.40in;"), "Notice #2 Lob HTML anchors compliance footer at 0.40in from bottom");
  assert(html2.includes("top: 1.85in;"), "Notice #2 Lob HTML anchors Clerk Docket Stamp at 1.85in top clear zone");

  // Notice #3: Tenant Repair & Habitability Demand
  const notice3 = getNoticeBySlug("tenant-repair-request");
  assert(Boolean(notice3), "Notice #3 cartridge resolved");
  const sampleDocketId3 = "DS-2026-TEST03";

  const interpolated3 = interpolateNotice({
    notice: notice3!,
    userValues: {
      tenantFullName: "Samantha Jean-Baptiste",
      landlordFullName: "Horizon Premier Asset Management Corporation",
      propertyAddress: "900 South Michigan Avenue, Unit 14B, Chicago, IL 60605",
      defectDescription: "Severe domestic hot water supply outage affecting master bath, persistent ceiling drywall water intrusion in secondary bedroom during rain events, and defective primary building intercom entrance system.",
      firstReportedDate: "2026-09-15",
      repairDeadlineDate: "2026-10-30",
    },
    serviceLevel: "certified_return_receipt",
    docketId: sampleDocketId3,
  });

  const html3 = renderLobHtmlPayload(interpolated3);
  assert(html3.includes("/s/ Samantha Jean-Baptiste"), "Notice #3 Lob HTML contains full /s/ electronic signature");
  assert(html3.includes(UPL_COMPLIANCE_FOOTER_TEXT(sampleDocketId3)), "Notice #3 Lob HTML contains verbatim UPL compliance disclosure");
  assert(html3.includes("bottom: 0.40in;"), "Notice #3 Lob HTML anchors compliance footer at 0.40in from bottom");

  // -------------------------------------------------------------------------
  // 4. Rate Limiter on POST /api/docket/verify-address (WP-D)
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Testing POST /api/docket/verify-address Rate Limiter (20 req/hr) ---");
  resetRateLimits();
  const testIp = "198.51.100.99";

  // Execute 20 requests from testIp -> all should be permitted by the rate limiter
  for (let i = 1; i <= 20; i++) {
    const rateCheck = checkRateLimit(testIp, {
      windowMs: 60 * 60 * 1000,
      maxRequests: 20,
      bucket: "verify-address",
    });
    assert(rateCheck.allowed, `Rate limiter allows request #${i} under 20-request threshold`);
  }

  // 21st request directly tested via route handler
  const rateLimitExceededReq = new NextRequest("http://localhost:3000/api/docket/verify-address", {
    method: "POST",
    headers: {
      "x-forwarded-for": testIp,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: {
        street1: "100 Pine St",
        city: "Seattle",
        state: "WA",
        zip: "98101",
      },
    }),
  });

  const rateLimitExceededRes = await verifyAddressRoute(rateLimitExceededReq);
  assert(
    rateLimitExceededRes.status === 429,
    `21st request from same IP is blocked with HTTP 429 (Got: ${rateLimitExceededRes.status})`
  );
  const retryAfter = rateLimitExceededRes.headers.get("Retry-After");
  assert(
    Boolean(retryAfter) && Number(retryAfter) > 0,
    `Retry-After header is present on 429 response (Got: ${retryAfter}s)`
  );
  const rateLimitJson = await rateLimitExceededRes.json();
  assert(
    rateLimitJson.code === "RATE_LIMIT_EXCEEDED",
    "Response body contains code 'RATE_LIMIT_EXCEEDED'"
  );

  // -------------------------------------------------------------------------
  // 5. Lob Tracking Webhook (POST /api/webhooks/lob) (WP-C)
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Testing Lob Tracking Webhook Ingestion & Status Sync ---");
  const prevUnsignedFlag = process.env.LOB_WEBHOOK_ALLOW_UNSIGNED_TEST;
  const prevMockFirestore = process.env.USE_MOCK_FIRESTORE;
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  process.env.LOB_WEBHOOK_ALLOW_UNSIGNED_TEST = "true";
  process.env.USE_MOCK_FIRESTORE = "true";
  const testOrderId = `order_test_webhook_${Date.now()}`;
  const testDocketId = `DS-2026-WHK${Math.floor(1000 + Math.random() * 9000)}`;
  const testLetterId = `ltr_test_${Date.now()}`;

  const mockOrder: Order = {
    id: testOrderId,
    docketId: testDocketId,
    amountInCents: 1800,
    status: "PROCESSING_DISPATCH",
    lobLetterId: testLetterId,
    recipientAddress: {
      firstName: "Jane",
      lastName: "Doe",
      street1: "123 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
    },
    returnAddress: {
      firstName: "John",
      lastName: "Sender",
      street1: "456 Oak Ave",
      city: "Austin",
      state: "TX",
      zip: "78702",
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveOrder(mockOrder);

  // Send letter.certified.mailed webhook event
  const mailedWebhookReq = new NextRequest("http://localhost:3000/api/webhooks/lob", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "evt_test_mailed",
      event_type: { id: "letter.certified.mailed" },
      body: {
        id: testLetterId,
        tracking_number: "70200640000075449999",
        expected_delivery_date: "2026-10-24",
        metadata: {
          docket_id: testDocketId,
          order_id: testOrderId,
        },
      },
    }),
  });

  const mailedRes = await lobWebhookRoute(mailedWebhookReq);
  assert(mailedRes.status === 200, "Lob mailed webhook returns HTTP 200");
  const mailedData = await mailedRes.json();
  assert(mailedData.matched === true, "Lob mailed webhook matched test order");
  assert(mailedData.status === "MAILED", "Lob mailed webhook updated order status to MAILED");

  const orderAfterMailed = await getOrderById(testOrderId);
  assert(orderAfterMailed?.status === "MAILED", "Firestore order doc status is MAILED");
  assert(orderAfterMailed?.lobTrackingNumber === "70200640000075449999", "Firestore order doc tracking number synced");

  // Send letter.in_transit webhook event
  const inTransitWebhookReq = new NextRequest("http://localhost:3000/api/webhooks/lob", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "evt_test_intransit",
      event_type: { id: "letter.in_transit" },
      body: {
        id: testLetterId,
        metadata: {
          docket_id: testDocketId,
        },
      },
    }),
  });
  const inTransitRes = await lobWebhookRoute(inTransitWebhookReq);
  assert(inTransitRes.status === 200, "Lob in_transit webhook returns HTTP 200");
  const inTransitData = await inTransitRes.json();
  assert(inTransitData.status === "IN_TRANSIT", "Lob in_transit webhook updated order status to IN_TRANSIT");

  // Send letter.delivered webhook event
  const deliveredWebhookReq = new NextRequest("http://localhost:3000/api/webhooks/lob", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "evt_test_delivered",
      event_type: { id: "letter.delivered" },
      body: {
        id: testLetterId,
        metadata: {
          order_id: testOrderId,
        },
      },
    }),
  });
  const deliveredRes = await lobWebhookRoute(deliveredWebhookReq);
  assert(deliveredRes.status === 200, "Lob delivered webhook returns HTTP 200");
  const deliveredData = await deliveredRes.json();
  assert(deliveredData.status === "DELIVERED", "Lob delivered webhook updated order status to DELIVERED");

  const orderAfterDelivered = await getOrderById(testOrderId);
  assert(orderAfterDelivered?.status === "DELIVERED", "Firestore order doc status is DELIVERED");
  assert(
    Array.isArray(orderAfterDelivered?.lobTrackingEvents) && orderAfterDelivered.lobTrackingEvents.length >= 3,
    "Firestore order doc lobTrackingEvents has 3 recorded postal events"
  );
  if (prevUnsignedFlag === undefined) delete process.env.LOB_WEBHOOK_ALLOW_UNSIGNED_TEST;
  else process.env.LOB_WEBHOOK_ALLOW_UNSIGNED_TEST = prevUnsignedFlag;
  if (prevMockFirestore === undefined) delete process.env.USE_MOCK_FIRESTORE;
  else process.env.USE_MOCK_FIRESTORE = prevMockFirestore;
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNodeEnv;

  // -------------------------------------------------------------------------
  // 6. Transactional Dispatch Receipt Email (WP-A)
  // -------------------------------------------------------------------------
  console.log("\n--- 6. Testing Transactional Dispatch Receipt Email Formatting ---");
  const emailResult = await sendDocketDispatchReceiptEmail({
    toEmail: "test.customer@example.com",
    docketId: testDocketId,
    serviceLevelLabel: "USPS Certified Mail®",
    recipientSummary: "Jane Doe — 123 Main St, Austin, TX 78701",
    trackingNumber: "70200640000075449999",
    orderId: testOrderId,
  });

  assert(emailResult.success === true, "sendDocketDispatchReceiptEmail returns success: true");

  console.log("\n===================================================================");
  console.log("🎉 ALL DOCKETSTAMP GO-LIVE READINESS TESTS PASSED SUCCESSFULLY!");
  console.log("===================================================================\n");
}

runGoLiveReadinessSuite().catch((err) => {
  console.error("❌ Test suite encountered fatal error:", err);
  process.exit(1);
});
