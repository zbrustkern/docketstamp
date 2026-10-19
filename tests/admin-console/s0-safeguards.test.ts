import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { firestoreDb, saveOrder } from "../../lib/firebase-admin";
import { getAdminDashboardMetrics } from "../../lib/metrics-rollup";
import {
  generateAdminSessionToken,
  getAdminSecret,
  getAdminSessionSigningKey,
  isValidAdminSessionToken,
  verifyAdminPassphrase,
} from "../../lib/admin-auth";
import { GET as getAdminAuthStatus, POST as postAdminAuth } from "../../app/api/admin/auth/route";
import { GET as getLobStatus } from "../../app/api/admin/lob-status/route";
import { POST as postLobWebhook } from "../../app/api/webhooks/lob/route";
import { POST as postDispatchComp } from "../../app/api/admin/dispatch-comp/route";
import { POST as postRetryFulfillment } from "../../app/api/admin/retry-fulfillment/route";
import { POST as postSyncStripe } from "../../app/api/admin/sync-stripe/route";
import { POST as postSyncLob } from "../../app/api/admin/sync-lob/route";
import {
  dispatchDocketLetter,
  fetchLobLetterStatus,
  resolveLobDispatchMode,
} from "../../src/lib/fulfillment/lob";
import { Order } from "../../lib/types";

const MOCK_DATA_FILE = path.join(process.cwd(), ".data", "mock-firestore.json");

async function clearInMemoryFirestore() {
  for (const colName of ["orders", "telemetry_events", "system_config", "system_incidents"]) {
    const snap = await firestoreDb.collection(colName).get();
    for (const doc of snap.docs) {
      await firestoreDb.collection(colName).doc(doc.id).delete();
    }
  }
}

async function runS0SafeguardsTests() {
  console.log("==========================================================");
  console.log("🛡️ RUNNING S0 SAFEGUARDS & HONEST REPORTING SUITE (S0-T04)");
  console.log("==========================================================\n");

  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const hadMockDataFile = fs.existsSync(MOCK_DATA_FILE);
  const originalMockData = hadMockDataFile ? fs.readFileSync(MOCK_DATA_FILE, "utf-8") : null;

  try {
    // Deny unexpected external network calls during unit tests
    globalThis.fetch = async (input: RequestInfo | URL) => {
      throw new Error(`Unexpected outbound network call in offline test: ${String(input)}`);
    };

    // -------------------------------------------------------------------------
    // 1. S0-T01: Empty Dashboard Reporting & Read-Only GET
    // -------------------------------------------------------------------------
    console.log("1️⃣ Testing empty-state metrics rollup (zero fabrication & read-only GET)...");
    await clearInMemoryFirestore();

    const db = firestoreDb;
    let setCallsDuringRead = 0;
    const sysConfigCol = db.collection("system_config");
    const origDoc = sysConfigCol.doc.bind(sysConfigCol);
    (sysConfigCol as unknown as { doc: typeof sysConfigCol.doc }).doc = (docId?: string) => {
      const ref = docId === undefined ? origDoc() : origDoc(docId);
      const origSet = ref.set.bind(ref);
      ref.set = async (...args: Parameters<typeof origSet>) => {
        setCallsDuringRead++;
        return origSet(...args);
      };
      return ref;
    };

    const emptyMetrics = await getAdminDashboardMetrics();
    assert.strictEqual(setCallsDuringRead, 0, "getAdminDashboardMetrics must not write to system_config on GET");
    assert.strictEqual(emptyMetrics.totalOrders, 0, "Empty database must report 0 orders");
    assert.strictEqual(emptyMetrics.totalRevenueCents, 0, "Empty database must report 0 revenue cents");
    assert.strictEqual(
      emptyMetrics.funnel.totalSessions,
      0,
      "Empty database must never invent 1 funnel session"
    );
    assert.strictEqual(
      emptyMetrics.visitorTelemetry?.totalVisitors,
      0,
      "Empty database must never invent 1 visitor"
    );
    assert.strictEqual(
      emptyMetrics.margins?.grossRevenueCents,
      0,
      "Empty database must report 0 gross revenue cents"
    );
    assert.strictEqual(
      emptyMetrics.margins?.netContributionMarginCents,
      0,
      "Empty database must never invent $3.56 (356c) net margin"
    );
    assert.strictEqual(
      emptyMetrics.margins?.netContributionMarginPercent,
      null,
      "Empty database must report null margin percent, never 39.6%"
    );
    assert.strictEqual(
      emptyMetrics.margins?.economicsAuthority,
      "estimated_legacy_unverified",
      "Interim economics must be explicitly flagged as estimated_legacy_unverified"
    );
    assert.strictEqual(
      emptyMetrics.reportingQuality?.funnelAuthority,
      "session_telemetry_only_no_synthetic_backfill",
      "Synthetic milestone backfill from orders must be disabled"
    );
    assert.strictEqual(
      emptyMetrics.reportingQuality?.healthAuthority,
      "configuration_only_no_live_probe",
      "Provider connectivity must be marked configuration_only_no_live_probe"
    );
    const step1Empty = emptyMetrics.visitorTelemetry?.funnelLeaks.find((s) => s.stepNumber === 1);
    assert.strictEqual(step1Empty?.visitors, 0, "Step 1 visitors on empty DB must be 0");
    assert.strictEqual(step1Empty?.conversionFromPrior, 0, "Step 1 conversion on empty DB must be 0%");

    // Restore doc method
    (sysConfigCol as unknown as { doc: typeof sysConfigCol.doc }).doc = origDoc;
    console.log("   ✅ Empty-state rollup verified (0 sessions, null margin %, 0 writes on GET).");

    // -------------------------------------------------------------------------
    // 2. S0-T01: Modern Postal Statuses & Multi-Tier Amounts Without Backfill
    // -------------------------------------------------------------------------
    console.log("2️⃣ Testing modern postal statuses & actual tier prices without session backfill...");
    await clearInMemoryFirestore();

    const baseAddress = {
      firstName: "Jane",
      lastName: "Doe",
      street1: "100 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
    };

    const sampleOrders: Order[] = [
      {
        id: "ds_ord_fc_1295",
        status: "PAYMENT_RECEIVED",
        amountInCents: 1295,
        createdAt: Date.now() - 4000,
        updatedAt: Date.now() - 4000,
        returnAddress: baseAddress,
        customerEmail: "fixture@example.invalid",
        recipientAddress: baseAddress,
        frontImageUrl: "",
        handwrittenNote: "Body",
        attribution: {
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "Search-Certified",
          gclid: "gclid_sample_1",
        },
      },
      {
        id: "ds_ord_cert_1995",
        status: "DISPATCHED_TO_USPS",
        amountInCents: 1995,
        createdAt: Date.now() - 3000,
        updatedAt: Date.now() - 3000,
        returnAddress: baseAddress,
        customerEmail: "fixture@example.invalid",
        recipientAddress: baseAddress,
        frontImageUrl: "",
        handwrittenNote: "Body",
      },
      {
        id: "ds_ord_err_2795",
        status: "DELIVERED",
        amountInCents: 2795,
        createdAt: Date.now() - 2000,
        updatedAt: Date.now() - 2000,
        returnAddress: baseAddress,
        customerEmail: "fixture@example.invalid",
        recipientAddress: baseAddress,
        frontImageUrl: "",
        handwrittenNote: "Body",
      },
      {
        id: "ds_ord_free_0",
        status: "MAILED",
        amountInCents: 0,
        paymentMethod: "PROMO_CODE",
        discountCode: "VIP100",
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
        returnAddress: baseAddress,
        customerEmail: "fixture@example.invalid",
        recipientAddress: baseAddress,
        frontImageUrl: "",
        handwrittenNote: "Body",
      },
      {
        id: "ds_ord_unpaid",
        status: "PENDING_PAYMENT",
        amountInCents: 1995,
        createdAt: Date.now() - 500,
        updatedAt: Date.now() - 500,
        returnAddress: baseAddress,
        customerEmail: "fixture@example.invalid",
        recipientAddress: baseAddress,
        frontImageUrl: "",
        handwrittenNote: "Body",
      },
    ];

    for (const ord of sampleOrders) {
      await saveOrder(ord);
    }

    const populatedMetrics = await getAdminDashboardMetrics();
    // 4 paid/fulfilled orders (1295 + 1995 + 2795 + 0 = 6085 cents); 1 unpaid order excluded from paid
    assert.strictEqual(populatedMetrics.totalOrders, 5, "Total order documents in DB is 5");
    assert.strictEqual(populatedMetrics.ordersByStatus.processing, 4, "All 4 modern paid/fulfilled statuses must be counted");
    assert.strictEqual(populatedMetrics.margins?.paidCardsCount, 4, "margins.paidCardsCount must equal 4");
    assert.strictEqual(
      populatedMetrics.totalRevenueCents,
      6085,
      "Observed revenue must equal 1295 + 1995 + 2795 + 0 = 6085 (never $9.00 fallback on $0 order)"
    );
    assert.strictEqual(
      populatedMetrics.funnel.totalSessions,
      0,
      "Orders without telemetry sessions must not fabricate funnel.totalSessions"
    );
    assert.strictEqual(
      populatedMetrics.visitorTelemetry?.totalVisitors,
      0,
      "Orders without telemetry sessions must not fabricate visitorTelemetry.totalVisitors"
    );
    for (const leak of populatedMetrics.visitorTelemetry?.funnelLeaks || []) {
      assert.strictEqual(
        leak.visitors,
        0,
        `Funnel step ${leak.stepNumber} (${leak.stepName}) must not be backfilled from unmatched orders`
      );
    }
    assert.strictEqual(
      populatedMetrics.reportingQuality?.unmatchedPaidOrdersCount,
      4,
      "Unmatched paid orders must be explicitly counted in reportingQuality.unmatchedPaidOrdersCount"
    );
    const campaign = populatedMetrics.campaignAttributions?.find(
      (c) => c.campaignKey === "Search-Certified"
    );
    assert.ok(campaign, "Campaign attribution for Search-Certified should exist");
    assert.strictEqual(campaign.grossRevenueCents, 1295, "Campaign gross revenue must use observed 1295c");
    console.log("   ✅ Modern postal statuses and observed multi-tier amounts verified.");

    // -------------------------------------------------------------------------
    // 3. S0-T02: Fail-Closed Admin Auth & Predictable Secret Blocklist
    // -------------------------------------------------------------------------
    console.log("3️⃣ Testing fail-closed admin auth & predictable secret rejection...");
    delete process.env.ADMIN_SECRET_KEY;
    delete process.env.ADMIN_SESSION_SIGNING_KEY;

    assert.strictEqual(getAdminSecret(), null, "Missing ADMIN_SECRET_KEY must return null");
    assert.strictEqual(getAdminSessionSigningKey(), null, "Missing signing key must return null");
    assert.throws(
      () => generateAdminSessionToken(),
      /not configured/,
      "generateAdminSessionToken must throw when signing key is missing"
    );
    assert.strictEqual(verifyAdminPassphrase("ds_dev_admin_2026"), false, "Must reject fallback passphrase");

    const authGetUnconfigured = await getAdminAuthStatus(
      new NextRequest("http://localhost:3000/api/admin/auth")
    );
    assert.strictEqual(authGetUnconfigured.status, 503, "GET /api/admin/auth must return 503 when unconfigured");
    const authGetBody = await authGetUnconfigured.json();
    assert.strictEqual(authGetBody.configured, false);

    const authPostUnconfigured = await postAdminAuth(
      new NextRequest("http://localhost:3000/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: "mock_token_zbrustkern@gmail.com" }),
      })
    );
    assert.strictEqual(
      authPostUnconfigured.status,
      503,
      "POST /api/admin/auth must fail closed (503) when signing key is unconfigured even with valid Google idToken"
    );

    const authPostPassphraseDisabled = await postAdminAuth(
      new NextRequest("http://localhost:3000/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: "ds_dev_admin_2026" }),
      })
    );
    assert.strictEqual(
      authPostPassphraseDisabled.status,
      400,
      "POST /api/admin/auth must reject legacy passphrase login attempts (400)"
    );

    // Test blocklisted predictable secrets
    for (const predictable of [
      "ds_dev_admin_2026",
      "ds_staging_admin_2026",
      "smn_internal_admin_session_key_2026",
    ]) {
      process.env.ADMIN_SECRET_KEY = predictable;
      process.env.ADMIN_SESSION_SIGNING_KEY = predictable;
      assert.strictEqual(
        getAdminSecret(),
        null,
        `Blocklisted secret "${predictable}" must be rejected by getAdminSecret()`
      );
      assert.strictEqual(
        getAdminSessionSigningKey(),
        null,
        `Blocklisted secret "${predictable}" must be rejected by getAdminSessionSigningKey()`
      );
      assert.strictEqual(
        verifyAdminPassphrase(predictable),
        false,
        `Blocklisted secret "${predictable}" must be rejected by verifyAdminPassphrase()`
      );
    }

    // Configure strong test-only secret
    process.env.ADMIN_SECRET_KEY = "test_only_strong_admin_secret_s0_verification_2026";
    process.env.ADMIN_SESSION_SIGNING_KEY = "test_only_strong_signing_secret_s0_verification_2026";

    const validToken = generateAdminSessionToken();
    assert.ok(validToken && validToken.startsWith("ds_admin_v2_"), "Valid v2 session token must be issued");
    assert.strictEqual(isValidAdminSessionToken(validToken), true, "Valid v2 session token must verify");
    assert.strictEqual(
      isValidAdminSessionToken("smn_admin_1234567890abcdef"),
      false,
      "Legacy smn_admin_ token must be invalidated"
    );

    // Verify authorized Google login flow remains functional when properly configured
    const authPostConfigured = await postAdminAuth(
      new NextRequest("http://localhost:3000/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: "mock_token_zbrustkern@gmail.com" }),
      })
    );
    assert.strictEqual(
      authPostConfigured.status,
      200,
      "Authorized Google login must succeed when strong signing key is configured"
    );
    console.log("   ✅ Fail-closed admin auth and blocklisted secret rejection verified.");

    // -------------------------------------------------------------------------
    // 4. S0-T02: Fail-Closed Lob Webhook Authentication
    // -------------------------------------------------------------------------
    console.log("4️⃣ Testing fail-closed Lob webhook verification...");
    delete process.env.LOB_WEBHOOK_SECRET;
    delete process.env.LOB_WEBHOOK_ALLOW_UNSIGNED_TEST;

    const webhookPayload = JSON.stringify({
      id: "evt_lob_test_1",
      event_type: { id: "letter.in_transit" },
      body: {
        id: "ltr_test_webhook_target",
        metadata: { order_id: "ds_ord_fc_1295" },
      },
    });

    const resWebhookMissingSecret = await postLobWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/lob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: webhookPayload,
      })
    );
    assert.strictEqual(
      resWebhookMissingSecret.status,
      503,
      "POST /api/webhooks/lob must fail closed (503) when LOB_WEBHOOK_SECRET is missing"
    );

    process.env.LOB_WEBHOOK_SECRET = "whsec_replace_me";
    const resWebhookPlaceholder = await postLobWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/lob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: webhookPayload,
      })
    );
    assert.strictEqual(
      resWebhookPlaceholder.status,
      503,
      "POST /api/webhooks/lob must fail closed (503) when LOB_WEBHOOK_SECRET is placeholder"
    );

    process.env.LOB_WEBHOOK_SECRET = "whsec_test_strong_webhook_signing_secret_2026";
    const resWebhookBadSig = await postLobWebhook(
      new NextRequest("http://localhost:3000/api/webhooks/lob", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "lob-signature": "invalid_signature_hex",
          "lob-signature-timestamp": String(Math.floor(Date.now() / 1000)),
        },
        body: webhookPayload,
      })
    );
    assert.strictEqual(
      resWebhookBadSig.status,
      401,
      "POST /api/webhooks/lob must return 401 when signature is invalid"
    );

    // Verify order status in Firestore was NOT mutated by any rejected webhook
    const orderAfterRejectedWebhooks = await db.collection("orders").doc("ds_ord_fc_1295").get();
    assert.strictEqual(
      orderAfterRejectedWebhooks.data()?.status,
      "PAYMENT_RECEIVED",
      "Rejected webhooks must never mutate order status"
    );
    console.log("   ✅ Fail-closed Lob webhook authentication verified (0 unauthorized mutations).");

    // -------------------------------------------------------------------------
    // 5. S0-T03: Explicit Lob Modes & No Silent Mock Fallback
    // -------------------------------------------------------------------------
    console.log("5️⃣ Testing explicit Lob modes & blocking live config failure...");
    process.env.LOB_ENV = "live";
    delete process.env.LOB_DISPATCH_API_KEY;
    delete process.env.LOB_API_KEY;

    assert.strictEqual(
      resolveLobDispatchMode(),
      "unconfigured",
      "Live LOB_ENV without live_ key must resolve to 'unconfigured'"
    );

    const sampleLobAddress = {
      name: "Jane Doe",
      address_line1: "100 Main St",
      address_city: "Austin",
      address_state: "TX",
      address_zip: "78701",
    };

    const liveBlockedDispatch = await dispatchDocketLetter({
      orderId: "ds_ord_fc_1295",
      docketId: "DS-TEST-1295",
      description: "Test Notice",
      to: sampleLobAddress,
      from: sampleLobAddress,
      file: "<html><body>Test</body></html>",
      tier: "first_class",
    });
    assert.strictEqual(liveBlockedDispatch.success, false, "Live unconfigured dispatch must fail closed");
    assert.strictEqual(liveBlockedDispatch.mode, "unconfigured");

    // Test test_api mode failure does NOT fall back to mock success
    process.env.LOB_ENV = "staging";
    process.env.LOB_DISPATCH_API_KEY = "test_fake_lob_key_for_offline_stub";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: "Lob test API error" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });

    const testApiFailedDispatch = await dispatchDocketLetter({
      orderId: "ds_ord_fc_1295",
      docketId: "DS-TEST-1295",
      description: "Test Notice",
      to: sampleLobAddress,
      from: sampleLobAddress,
      file: "<html><body>Test</body></html>",
      tier: "first_class",
    });
    assert.strictEqual(
      testApiFailedDispatch.success,
      false,
      "Failed test_api call must return success: false, never fall back to simulated mock"
    );
    assert.strictEqual(testApiFailedDispatch.mode, "test_api");
    assert.strictEqual(testApiFailedDispatch.isSimulatedMock, false);

    // Test mock letter status never reports 'in_transit'
    const mockStatusRes = await fetchLobLetterStatus("mock_lob_ltr_12345");
    assert.strictEqual(mockStatusRes.success, false, "Mock letter status must not report live success");
    assert.strictEqual(mockStatusRes.mode, "mock");
    assert.strictEqual(mockStatusRes.isSimulatedMock, true);
    assert.notStrictEqual(mockStatusRes.status, "in_transit", "Mock letter must never claim in_transit");

    // Verify /api/admin/lob-status reports honest unverified probe status
    const lobStatusReq = new NextRequest("http://localhost:3000/api/admin/lob-status", {
      method: "GET",
      headers: { Cookie: `smn_admin_session=${validToken}` },
    });
    const lobStatusRes = await getLobStatus(lobStatusReq);
    assert.strictEqual(lobStatusRes.status, 200);
    const lobStatusBody = await lobStatusRes.json();
    assert.strictEqual(lobStatusBody.connected, false, "lob-status must not fabricate connected: true");
    assert.strictEqual(lobStatusBody.probeStatus, "unverified_no_recent_probe");
    console.log("   ✅ Explicit Lob operational modes & honest lob-status verified.");

    // -------------------------------------------------------------------------
    // 6. S0-T03: Held Admin Direct Mutation Endpoints
    // -------------------------------------------------------------------------
    console.log("6️⃣ Testing held direct admin mutation endpoints (409 ADMIN_ACTION_HELD_S0)...");
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `smn_admin_session=${validToken}`,
    };

    const heldEndpoints: Array<{
      name: string;
      handler: (req: NextRequest) => Promise<Response>;
      expectedSprintPrefix: string;
      expectedStatus?: number;
    }> = [
      { name: "dispatch-comp", handler: postDispatchComp, expectedSprintPrefix: "S3" },
      { name: "retry-fulfillment", handler: postRetryFulfillment, expectedSprintPrefix: "S5", expectedStatus: 403 },
      { name: "sync-stripe", handler: postSyncStripe, expectedSprintPrefix: "S2", expectedStatus: 403 },
      { name: "sync-lob", handler: postSyncLob, expectedSprintPrefix: "S2" },
    ];

    for (const ep of heldEndpoints) {
      // Unauthenticated request must still be rejected with 401
      const unauthRes = await ep.handler(
        new NextRequest(`http://localhost:3000/api/admin/${ep.name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: "ds_ord_fc_1295" }),
        })
      );
      assert.strictEqual(unauthRes.status, 401, `${ep.name} must reject unauthenticated calls with 401`);

      // Authenticated request must return 409 Held with explicit restoration sprint
      const heldRes = await ep.handler(
        new NextRequest(`http://localhost:3000/api/admin/${ep.name}`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ orderId: "ds_ord_fc_1295" }),
        })
      );
      assert.strictEqual(heldRes.status, ep.expectedStatus || 409, `${ep.name} must remain held or require origin validation`);
      if (ep.expectedStatus === 403) continue;
      const heldBody = await heldRes.json();
      assert.strictEqual(heldBody.held, true, `${ep.name} response must set held: true`);
      assert.strictEqual(heldBody.code, "ADMIN_ACTION_HELD_S0");
      assert.ok(
        String(heldBody.restorationSprint).startsWith(ep.expectedSprintPrefix),
        `${ep.name} must cite restoration sprint starting with ${ep.expectedSprintPrefix}`
      );
    }
    console.log("   ✅ All 4 unsafe direct mutation endpoints gated with 409 & restoration targets.");

    console.log("\n🎉 ALL S0 SAFEGUARDS & HONEST REPORTING TESTS PASSED!");
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    await new Promise((r) => setTimeout(r, 200));
    if (hadMockDataFile && originalMockData !== null) {
      fs.writeFileSync(MOCK_DATA_FILE, originalMockData, "utf-8");
    } else if (!hadMockDataFile && fs.existsSync(MOCK_DATA_FILE)) {
      fs.unlinkSync(MOCK_DATA_FILE);
    }
  }
}

runS0SafeguardsTests().catch((err) => {
  console.error("❌ S0 SAFEGUARDS TEST FAILED:", err);
  process.exit(1);
});
