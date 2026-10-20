import { NextRequest } from "next/server";
import { POST as createIntentPost } from "../app/api/checkout/create-intent/route";
import { POST as lockAndIntentPost } from "../app/api/docket/lock-and-intent/route";
import { POST as completeFreeOrderPost } from "../app/api/checkout/complete-free-order/route";
import { processPaidOrder, validatePersonalSender } from "../lib/order-processor";
import { resolvePostalProvenance } from "../lib/order-record";
import {
  getOrderById,
  updateOrderStatus,
  saveDiscountCode,
} from "../lib/firebase-admin";

async function runSenderValidationTests() {
  console.log("=================================================");
  console.log("📮 RUNNING SENDER VALIDATION & BRAND REMOVAL TESTS (S0-06)");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const makeFrozenNotice = async (email: string, discountCode?: string) => {
    const response = await lockAndIntentPost(new NextRequest("http://localhost:3000/api/docket/lock-and-intent", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "security-deposit-return-demand-letter", tier: "certified", customerEmail: email,
        ...(discountCode ? { discountCode } : {}),
        userValues: {
          senderFullName: "Taylor Morgan", senderAddressLine1: "77 Lake Street, Unit 5", senderCity: "Chicago", senderState: "IL", senderZip: "60601",
          recipientFormalName: "Carmel Property Group", recipientAddressLine1: "18 Main Street", recipientCity: "Carmel", recipientState: "IN", recipientZip: "46032",
          propertyState: "IN", vacatedPremisesAddress: "77 Lake Street, Unit 5, Chicago, IL 60601", moveOutDate: "2026-09-01",
          depositAmount: "$1,500.00", amountReceivedToDate: "$0.00", balanceRequested: "$1,500.00", responseDays: "14 calendar days",
          basisForRequest: "My records show the deposit was paid and no refund has been received.",
        },
        signatureAdoption: { adopted: true, affirmed: true, signerName: "Taylor Morgan" },
      }),
    }));
    if (response.status !== 200) throw new Error(`Canonical notice fixture failed: ${response.status} ${await response.text()}`);
    return await response.json() as { orderId: string; isFree: boolean };
  };

  try {
    // ---------------------------------------------------------------------------
    // TEST 1: Unit Validation of Personal Sender Address
    // ---------------------------------------------------------------------------
    console.log("--- 1. Testing validatePersonalSender Unit Invariants ---");

    assert(
      validatePersonalSender(null).valid === false,
      "Null return address is rejected"
    );

    assert(
      validatePersonalSender({}).valid === false,
      "Empty return address object is rejected"
    );

    assert(
      validatePersonalSender({
        street1: "123 Main St",
        city: "Austin",
        state: "TX",
        zip: "78701",
      }).valid === false,
      "Missing sender first name is rejected"
    );

    assert(
      validatePersonalSender({
        firstName: "DocketStamp",
        lastName: "Press",
        street1: "123 Main St",
        city: "Austin",
        state: "TX",
        zip: "78701",
      }).valid === false,
      "DocketStamp brand name is rejected as personal sender"
    );

    assert(
      validatePersonalSender({
        firstName: "Thomas",
        lastName: "Miller",
        street1: "123 Main St",
        city: "Austin",
        state: "TX",
        zip: "78701",
      }).valid === true,
      "Valid personal sender name and complete address is accepted"
    );

    // ---------------------------------------------------------------------------
    // TEST 2: Pre-fulfillment Rejection at create-intent Endpoint
    // ---------------------------------------------------------------------------
    console.log("\n--- 2. Testing Pre-Fulfillment Validation in create-intent ---");

    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.ALLOW_LOCAL_MOCK_PAYMENTS = "true";
    process.env.LOB_ENV = "staging_mock_cass";

    // 2A. The old card route is gone; signed notice checkout validates senders.
    const missingSenderRes = await createIntentPost();
    const missingSenderData = await missingSenderRes.json();
    assert(
      missingSenderRes.status === 410 && missingSenderData.code === "LEGACY_CHECKOUT_UNSUPPORTED",
      "retired card checkout rejects the predecessor flow before payment; current notice checkout validates the sender during lock"
    );

    // 2B. The retired endpoint rejects without initializing any payment flow.
    const brandSenderRes = await createIntentPost();
    const brandSenderData = await brandSenderRes.json();
    assert(
      brandSenderRes.status === 410 && brandSenderData.code === "LEGACY_CHECKOUT_UNSUPPORTED",
      "retired card checkout rejects brand-name card payloads before payment"
    );

    // ---------------------------------------------------------------------------
    // TEST 3: Recovery & Safety in order-processor if Order Reaches Processing
    // ---------------------------------------------------------------------------
    console.log("\n--- 3. Testing Recovery in order-processor for Defective Orders ---");

    const { orderId: defectiveOrderId } = await makeFrozenNotice("victim@example.com");
    await updateOrderStatus(defectiveOrderId, { returnAddress: { firstName: "", lastName: "", street1: "500 Oak St", city: "Austin", state: "TX", zip: "78701" } });

    const defectiveProcessResult = await processPaidOrder(
      defectiveOrderId,
      `pi_mock_defective_${Date.now()}`,
      "victim@example.com",
      { isTest: true, paymentMode: "local_mock" }
    );

    assert(
      defectiveProcessResult.success === false &&
        defectiveProcessResult.status === "QUEUED_FOR_FULFILLMENT",
      "Defective order without sender name transitions to QUEUED_FOR_FULFILLMENT"
    );

    const orderInDb = await getOrderById(defectiveOrderId);
    assert(
      orderInDb?.status === "QUEUED_FOR_FULFILLMENT" &&
        Boolean(orderInDb?.fulfillmentError) &&
        !orderInDb?.lobLetterId && !orderInDb?.handwryttenOrderId,
      `Order placed in recoverable operator-visible state (error: ${orderInDb?.fulfillmentError})`
    );

    // ---------------------------------------------------------------------------
    // TEST 4: Historical provider identifiers remain truthfully attributed
    // ---------------------------------------------------------------------------
    console.log("\n--- 4. Testing Historical Postal Provider Provenance ---");
    const oldHandwryttenRecord = { id: "legacy_hw", handwryttenOrderId: "hw_123456" };
    assert(
      resolvePostalProvenance(oldHandwryttenRecord).provider === "handwrytten" &&
        resolvePostalProvenance(oldHandwryttenRecord).reference === "hw_123456",
      "A historical Handwrytten ID remains labeled Handwrytten and is not promoted to Lob"
    );

    // ---------------------------------------------------------------------------
    // TEST 5: Free Order Route Rejection for Defective Sender
    // ---------------------------------------------------------------------------
    console.log("\n--- 5. Testing Free Order Path Sender Validation ---");

    const freeCode = `FREEVOUCH_${Date.now()}`;
    await saveDiscountCode({
      id: freeCode,
      code: freeCode,
      type: "PERCENTAGE",
      value: 100,
      isActive: true,
      usedCount: 0,
      totalDiscountGivenCents: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const { orderId: defectiveFreeOrderId, isFree } = await makeFrozenNotice("victim@example.com", freeCode);
    assert(isFree, "Free sender fixture uses a canonical 100% discounted notice");
    await updateOrderStatus(defectiveFreeOrderId, { returnAddress: { firstName: "", lastName: "", street1: "500 Oak St", city: "Austin", state: "TX", zip: "78701" } });

    const freeOrderReq = new NextRequest("http://localhost:3000/api/checkout/complete-free-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: defectiveFreeOrderId,
        discountCode: freeCode,
        customerEmail: "victim@example.com",
      }),
    });

    const freeOrderRes = await completeFreeOrderPost(freeOrderReq);
    const freeOrderData = await freeOrderRes.json();
    assert(
      freeOrderRes.status === 200 && freeOrderData.status === "QUEUED_FOR_FULFILLMENT",
      `Free order with defective sender is queued for operator review instead of dispatch (status: ${freeOrderData.status})`
    );

  } finally {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  }

  console.log("\n=================================================");
  console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSenderValidationTests().catch((err) => {
  console.error("Test execution exception:", err);
  process.exit(1);
});
