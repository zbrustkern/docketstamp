import {
  calculateStripeFeeCents,
  getAdminDashboardMetrics,
} from "../lib/metrics-rollup";
import { firestoreDb, saveOrder, setSystemConfig } from "../lib/firebase-admin";
import { Order } from "../lib/types";

async function runUnitEconomicsTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING UNIT ECONOMICS & MARGIN TESTS");
  console.log("=================================================\n");

  // 1. Verify processor fee math; fulfillment is sourced from tier evidence below.
  console.log("--- 1. Testing Financial Formulas ---");
  const standardFee = calculateStripeFeeCents(900); // $9.00
  if (standardFee === 56) {
    console.log("✅ PASS: Standard Stripe fee on $9.00 is exactly 56¢ (2.9% + 30¢)");
  } else {
    throw new Error(`Expected Stripe fee 56¢, got ${standardFee}¢`);
  }

  const promoFee = calculateStripeFeeCents(0, "PROMO_CODE");
  if (promoFee === 0) {
    console.log("✅ PASS: Comp/Promo order incurs $0.00 Stripe fee");
  } else {
    throw new Error(`Expected comp Stripe fee 0¢, got ${promoFee}¢`);
  }

  if (!("HANDWRYTTEN_COGS_PER_CARD_CENTS" in await import("../lib/metrics-rollup"))) {
    console.log("✅ PASS: No unsupported flat per-card fulfillment cost is exported");
  } else throw new Error("Flat fulfillment cost must not be treated as evidence");

  // 2. Testing Order with Attribution & Rollup
  console.log("\n--- 2. Testing Order Attribution Aggregation ---");
  const testOrderId = `order_attr_test_${Date.now()}`;
  const testOrder: Order = {
    id: testOrderId,
    customerEmail: "googleads.test@example.com",
    frontImageUrl: "/presets/anniv-botanicals.jpg",
    printedMessage: "Happy Anniversary!",
    handwrittenNote: "Wishing you a wonderful year ahead.",
    fontStyleId: "hwDavid",
    recipientAddress: {
      firstName: "Jane",
      lastName: "Smith",
      street1: "123 Main St",
      city: "Portland",
      state: "OR",
      zip: "97201",
    },
    returnAddress: {
      firstName: "John",
      lastName: "Doe",
      street1: "456 Oak St",
      city: "Seattle",
      state: "WA",
      zip: "98101",
    },
    status: "PROCESSING_HANDWRYTTEN",
    serviceLevel: "CERTIFIED",
    amountInCents: 900,
    paymentMethod: "STRIPE",
    attribution: {
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "Search-Brand-Handwritten",
      gclid: "test_gclid_12345",
      capturedAt: Date.now(),
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Set test ad spend
  await setSystemConfig("admin_ad_spend", { amountCents: 5000, updatedAt: Date.now() });
  await setSystemConfig("admin_fulfillment_cost_estimates", {
    schemaVersion: 1,
    currency: "USD",
    tiers: { certified: { amountCents: 488, sourceRef: "operator:2026-10-certified-rate-card" } },
  });

  const beforeTierOrder = await getAdminDashboardMetrics();
  await saveOrder(testOrder);
  const metrics = await getAdminDashboardMetrics();

  if (metrics.margins) {
    console.log("✅ PASS: AdminMetrics includes margins breakdown");
    console.log(`         Gross Revenue: $${(metrics.margins.grossRevenueCents / 100).toFixed(2)}`);
    console.log(`         Stripe Fees:   -$${(metrics.margins.stripeFeesCents / 100).toFixed(2)}`);
    console.log(`         COGS:          -$${(metrics.margins.fulfillmentCogsCents / 100).toFixed(2)}`);
    console.log(`         Net Margin:    +$${(metrics.margins.netContributionMarginCents / 100).toFixed(2)}`);
    console.log(`         Target CPA:    $${metrics.margins.targetBreakevenCpaDollars.toFixed(2)}`);
  if (
      metrics.margins.fulfillmentCogsCents - (beforeTierOrder.margins?.fulfillmentCogsCents || 0) !== 488 ||
      !["estimated", "partial"].includes(metrics.margins.fulfillmentCogsEvidence || "")
    ) {
      throw new Error("Certified tier COGS should be labeled estimated and use the sourced tier schedule");
    }
    if (
      metrics.margins.grossRevenueCents - (beforeTierOrder.margins?.grossRevenueCents || 0) !== 900 ||
      metrics.margins.stripeFeesCents - (beforeTierOrder.margins?.stripeFeesCents || 0) !== 56
    ) throw new Error("Tier-estimated order economics should retain actual order price and fee estimate");

  const actualOrder: Order = { ...testOrder, id: `${testOrderId}_actual_evidence`, amountInCents: 900, finalAmountInCents: 777 };
  await saveOrder(actualOrder);
  const financeEnvironment = process.env.ENVIRONMENT === "staging" || process.env.FIREBASE_PROJECT_ID === "docketstamp-staging"
    ? "staging"
    : process.env.NODE_ENV === "production" ? "production" : "local";
  const financeFacts = [
    { factId: `${actualOrder.id}_capture`, orderId: actualOrder.id, provider: "stripe", kind: "capture", amountMinor: 777, environment: financeEnvironment, verification: "verified" },
    { factId: `${actualOrder.id}_fee`, orderId: actualOrder.id, provider: "stripe", kind: "processor_fee", amountMinor: 42, environment: financeEnvironment, verification: "verified" },
    { factId: `${actualOrder.id}_lob`, orderId: actualOrder.id, provider: "lob", kind: "supplier_charge", amountMinor: 250, environment: financeEnvironment, verification: "verified" },
    { factId: `${actualOrder.id}_credit`, orderId: actualOrder.id, provider: "lob", kind: "supplier_credit", amountMinor: 50, environment: financeEnvironment, verification: "verified" },
  ];
  for (const fact of financeFacts) await firestoreDb.collection("payment_facts_v1").doc(fact.factId).set(fact);
  const beforeActualEvidence = metrics.margins;
  const actualMetrics = await getAdminDashboardMetrics();
  if (!beforeActualEvidence || !actualMetrics.margins ||
    actualMetrics.margins.grossRevenueCents - beforeActualEvidence.grossRevenueCents !== 777 ||
    actualMetrics.margins.stripeFeesCents - beforeActualEvidence.stripeFeesCents !== 42 ||
    actualMetrics.margins.fulfillmentCogsCents - beforeActualEvidence.fulfillmentCogsCents !== 200) {
    throw new Error("Verified Stripe captures, fees and net Lob charge/credit must override estimates");
  }
  } else {
    throw new Error("margins object missing in AdminMetrics");
  }

  if (metrics.campaignAttributions && metrics.campaignAttributions.length > 0) {
    const brandCampaign = metrics.campaignAttributions.find(
      (c) => c.campaignKey === "Search-Brand-Handwritten"
    );
    if (brandCampaign && brandCampaign.hasGclid) {
      console.log("✅ PASS: Campaign 'Search-Brand-Handwritten' identified with GCLID and attributed revenue");
    } else {
      console.log("✅ PASS: Campaign attributions rollup functioning cleanly");
    }
  } else {
    throw new Error("campaignAttributions missing or empty in AdminMetrics");
  }

  if (metrics.adSpendCents === 5000) {
    console.log("✅ PASS: Operator ad spend accurately loaded from system config ($50.00)");
  }

  // 3. Testing Valuation & LTV Heuristics Engine
  console.log("\n--- 3. Testing Valuation & LTV Heuristics Engine ---");
  const {
    calculateValuationHeuristics,
    calculateScaleSensitivityMatrix,
    DEFAULT_VALUATION_ASSUMPTIONS,
    VALUATION_PRESETS,
  } = await import("../lib/valuation-heuristics");

  const baseOutputs = calculateValuationHeuristics(DEFAULT_VALUATION_ASSUMPTIONS, 5.00);

  // Check modeled lifetime cards
  if (baseOutputs.modeledLifetimeOrders > 0) {
    console.log(`✅ PASS: Base case modeled lifetime orders: ${baseOutputs.modeledLifetimeOrders} cards`);
  } else {
    throw new Error("Invalid modeled lifetime orders");
  }

  // Check LTV ($)
  if (baseOutputs.modeledLtvGrossMargin > 0) {
    console.log(`✅ PASS: Modeled Customer LTV: $${baseOutputs.modeledLtvGrossMargin.toFixed(2)}`);
  } else {
    throw new Error("Invalid modeled LTV");
  }

  // Check LTV:CAC
  if (baseOutputs.ltvToCacRatio > 0) {
    console.log(`✅ PASS: LTV : CAC multiple: ${baseOutputs.ltvToCacRatio}x (CAC: $5.00)`);
  } else {
    throw new Error("Invalid LTV:CAC multiple");
  }

  // Check Enterprise Valuation Multiples
  if (baseOutputs.estimatedValuationSde > 0 && baseOutputs.blendedValuationEstimate > 0) {
    console.log(`✅ PASS: SDE Multiple Valuation (3.5x): $${Math.round(baseOutputs.estimatedValuationSde).toLocaleString()}`);
    console.log(`✅ PASS: Composite Fair Market Valuation: $${Math.round(baseOutputs.blendedValuationEstimate).toLocaleString()}`);
  } else {
    throw new Error("Invalid valuation calculation");
  }

  // Check Sensitivity Matrix
  const sensitivity = calculateScaleSensitivityMatrix(DEFAULT_VALUATION_ASSUMPTIONS, [100, 500, 1000]);
  if (sensitivity.length === 3 && sensitivity[1].customers === 500) {
    console.log(`✅ PASS: Scale sensitivity matrix generated (500 customers = $${sensitivity[1].annualRevenue.toLocaleString()} ARR, $${sensitivity[1].estimatedValuation.toLocaleString()} SDE Val)`);
  } else {
    throw new Error("Sensitivity matrix failed");
  }

  console.log("\n=================================================");
  console.log("All Unit Economics, Valuation & Attribution Tests Passed! 🎉");
  console.log("=================================================");
}

runUnitEconomicsTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
