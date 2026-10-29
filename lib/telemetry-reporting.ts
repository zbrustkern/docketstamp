import { TelemetryEvent, Order, EntrySource } from "./types";

export interface FunnelStageMetric {
  stageNumber: number;
  stageKey: string;
  stageName: string;
  uniqueSessions: number;
  conversionFromPrior: number; // percentage (100% for stage 1)
  dropOffCount: number;
  dropOffToNext: number; // percentage dropped out before reaching this stage
}

export interface FunnelCohortBreakdown {
  sessions: number;
  paidOrders: number;
  conversionRate: number; // percentage
  stageDropOff: Record<string, number>;
}

export interface FunnelAttributionSummary {
  attributedPaidOrders: number;
  unattributedPaidOrders: number;
  excludedTestOrders: number;
  duplicateEventsFiltered: number;
  duplicateOrdersFiltered: number;
}

export interface FunnelConversionReport {
  totalSessions: number;
  homepageSessions: number;
  verifiedPaidOrders: number;
  homepagePaidOrders: number;
  conversionRate: number; // homepagePaidOrders / homepageSessions * 100
  stages: FunnelStageMetric[];
  byDevice: Record<"desktop" | "mobile" | "tablet" | "unknown", FunnelCohortBreakdown>;
  bySource: Record<string, FunnelCohortBreakdown>;
  attributionSummary: FunnelAttributionSummary;
}

export interface ComputeFunnelReportOptions {
  experienceVersion?: string; // defaults to 'home_v2'
  excludeTestOrders?: boolean; // defaults to true
}

const FUNNEL_STAGE_DEFINITIONS: Array<{
  stageNumber: number;
  stageKey: string;
  stageName: string;
  matchingEvents: string[];
}> = [
  {
    stageNumber: 1,
    stageKey: "landing_view",
    stageName: "Home Chooser View",
    matchingEvents: ["landing_view", "landing_viewed", "session_start"],
  },
  {
    stageNumber: 2,
    stageKey: "product_select",
    stageName: "Letter Selection",
    matchingEvents: ["product_select", "letter_select", "cover_preset_selected"],
  },
  {
    stageNumber: 3,
    stageKey: "editor_start",
    stageName: "Workspace Details Started",
    matchingEvents: ["editor_start", "builder_started"],
  },
  {
    stageNumber: 4,
    stageKey: "editor_complete",
    stageName: "Details & Review Completed",
    matchingEvents: ["editor_complete", "card_completed"],
  },
  {
    stageNumber: 5,
    stageKey: "checkout_view",
    stageName: "Delivery & Checkout Initialized",
    matchingEvents: ["checkout_view", "checkout_initiated", "payment_viewed"],
  },
  {
    stageNumber: 6,
    stageKey: "payment_submitted",
    stageName: "Payment Details Submitted",
    matchingEvents: ["payment_submitted", "payment_attempted"],
  },
  {
    stageNumber: 7,
    stageKey: "order_paid_confirmed",
    stageName: "Authoritative Payment Confirmed",
    matchingEvents: ["order_paid_confirmed", "purchase_verified", "payment_succeeded"],
  },
];

/**
 * Checks whether an order belongs to a non-customer test or founder cohort.
 */
export function isTestOrCompOrder(order: Partial<Order>): boolean {
  if (order.isTest === true || order.isComp === true || order.isFounderTest === true) {
    return true;
  }
  if (order.paymentMode === "stripe_test" || order.paymentMode === "local_mock") {
    return true;
  }
  if (order.paymentMethod === "STUDIO_COMP") {
    return true;
  }
  const email = (order.customerEmail || "").toLowerCase();
  if (email.includes("founder") || email.includes("test@") || email.endsWith("@example.com")) {
    return true;
  }
  return false;
}

/**
 * Legacy funnel inputs carry order snapshots rather than payment facts. Only
 * server lifecycle states reached after payment verification are counted here;
 * PENDING_PAYMENT, verification failures, and terminal failures are not proof
 * of a capture. The v1 admin report remains authoritative because it joins the
 * verified payment_facts_v1 collection directly.
 */
function hasVerifiedPaidLifecycle(order: Partial<Order>): boolean {
  const paymentConfirmedStatuses = new Set<Order['status']>([
    'PAYMENT_RECEIVED', 'DISPATCHING', 'PROCESSING_HANDWRYTTEN',
    'PROCESSING_DISPATCH', 'QUEUED_FOR_FULFILLMENT', 'DISPATCHED_TO_USPS',
    'MAILED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED_TO_SENDER',
  ]);
  if (!order.status || !paymentConfirmedStatuses.has(order.status)) return false;
  return order.paymentMethod !== 'PROMO_CODE' && order.paymentMethod !== 'STUDIO_COMP';
}

/**
 * Computes deterministic funnel conversion and stage drop-off reports from raw
 * telemetry events and authoritative order records.
 *
 * Implements Sprint S6 of docs/DOCKETSTAMP_HOME_REDESIGN_SPRINTS.md:
 * - Deterministic deduplication by (sessionId, eventName, noticeSlug, draftRevision/orderId)
 * - Strict isolation of client events from server payment authority
 * - Verified paid orders per eligible homepage session (experienceVersion: 'home_v2')
 * - Stage-by-stage conversion and drop-off rates broken down by device and entry source
 * - Explicit exclusions (isTest: true) and explicit 'unknown' attribution bucket
 */
export function computeFunnelConversionReport(
  events: TelemetryEvent[],
  orders: Order[] = [],
  options: ComputeFunnelReportOptions = {}
): FunnelConversionReport {
  const targetExpVersion = options.experienceVersion || "home_v2";
  const excludeTests = options.excludeTestOrders !== false;

  // 1. Deduplicate events by (sessionId, eventName, noticeSlug, revisionOrOrderId)
  const seenEventKeys = new Set<string>();
  const deduplicatedEvents: TelemetryEvent[] = [];
  let duplicateEventsFiltered = 0;

  for (const evt of events) {
    if (!evt || !evt.sessionId || !evt.eventName) continue;
    const notice = evt.noticeSlug || (evt.metadata?.noticeSlug as string) || "";
    const revOrOrder =
      evt.draftRevision !== undefined
        ? String(evt.draftRevision)
        : evt.orderId || (evt.metadata?.orderId as string) || "";
    const dedupeKey = evt.dedupeKey || `${evt.sessionId}:${evt.eventName}:${notice}:${revOrOrder}`;

    if (seenEventKeys.has(dedupeKey)) {
      duplicateEventsFiltered++;
      continue;
    }
    seenEventKeys.add(dedupeKey);
    deduplicatedEvents.push(evt);
  }

  // 2. Identify sessions and homepage sessions
  const allSessions = new Set<string>();
  const homepageSessions = new Set<string>();
  const sessionDeviceMap = new Map<string, "desktop" | "mobile" | "tablet" | "unknown">();
  const sessionSourceMap = new Map<string, string>();
  const sessionHighestStage = new Map<string, number>();

  for (const evt of deduplicatedEvents) {
    allSessions.add(evt.sessionId);

    // Detect device type
    const devType =
      evt.deviceCategory ||
      evt.deviceType ||
      (evt.metadata?.deviceCategory as any) ||
      "unknown";
    if (!sessionDeviceMap.has(evt.sessionId) || sessionDeviceMap.get(evt.sessionId) === "unknown") {
      sessionDeviceMap.set(evt.sessionId, devType);
    }

    // Detect entry source
    const src =
      evt.entrySource ||
      (evt.metadata?.entrySource as string) ||
      evt.utmSource ||
      "direct_notice";
    if (!sessionSourceMap.has(evt.sessionId) || sessionSourceMap.get(evt.sessionId) === "unknown") {
      sessionSourceMap.set(evt.sessionId, src);
    }

    // Check if this event qualifies session as homepage v2 visitor
    const expVer =
      evt.experienceVersion ||
      (evt.metadata?.experienceVersion as string) ||
      (evt.path === "/" ? "home_v2" : undefined);

    if (
      (evt.eventName === "landing_view" ||
        evt.eventName === "landing_viewed" ||
        evt.eventName === "product_select" ||
        evt.path === "/") &&
      (expVer === targetExpVersion || !expVer)
    ) {
      homepageSessions.add(evt.sessionId);
    }
  }

  // 3. Track unique homepage sessions per stage
  const stageSessionsMap: Map<string, Set<string>> = new Map();
  for (const stageDef of FUNNEL_STAGE_DEFINITIONS) {
    stageSessionsMap.set(stageDef.stageKey, new Set<string>());
  }

  for (const evt of deduplicatedEvents) {
    // Only analyze homepage cohort sessions
    if (!homepageSessions.has(evt.sessionId)) continue;

    for (const stageDef of FUNNEL_STAGE_DEFINITIONS) {
      if (stageDef.matchingEvents.includes(evt.eventName)) {
        stageSessionsMap.get(stageDef.stageKey)!.add(evt.sessionId);
        const currHigh = sessionHighestStage.get(evt.sessionId) || 0;
        if (stageDef.stageNumber > currHigh) {
          sessionHighestStage.set(evt.sessionId, stageDef.stageNumber);
        }
      }
    }
  }

  // 4. Deduplicate and analyze authoritative orders
  const seenOrderIds = new Set<string>();
  let duplicateOrdersFiltered = 0;
  let excludedTestOrders = 0;
  let attributedPaidOrders = 0;
  let unattributedPaidOrders = 0;
  let homepagePaidOrders = 0;
  let verifiedPaidOrders = 0;

  const validPaidOrders: Order[] = [];

  for (const order of orders) {
    if (!order || !order.id) continue;
    if (seenOrderIds.has(order.id)) {
      duplicateOrdersFiltered++;
      continue;
    }
    seenOrderIds.add(order.id);

    if (excludeTests && isTestOrCompOrder(order)) {
      excludedTestOrders++;
      continue;
    }

    // Do not turn an order row into payment authority just because it exists.
    if (!hasVerifiedPaidLifecycle(order)) continue;
    verifiedPaidOrders++;
    validPaidOrders.push(order);

    const orderSessionId =
      order.sessionId ||
      (order.attribution as any)?.sessionId ||
      order.telemetrySessionId;

    if (orderSessionId && allSessions.has(orderSessionId)) {
      attributedPaidOrders++;
      if (homepageSessions.has(orderSessionId)) {
        homepagePaidOrders++;
        // Ensure stage 7 records this session
        stageSessionsMap.get("order_paid_confirmed")!.add(orderSessionId);
        sessionHighestStage.set(orderSessionId, 7);
      }
    } else {
      unattributedPaidOrders++;
    }
  }

  // 5. Construct stage-by-stage funnel metrics
  const stages: FunnelStageMetric[] = [];
  let priorCount = homepageSessions.size;

  for (let i = 0; i < FUNNEL_STAGE_DEFINITIONS.length; i++) {
    const stageDef = FUNNEL_STAGE_DEFINITIONS[i];
    const stageSet = stageSessionsMap.get(stageDef.stageKey) || new Set();
    const count = i === 0 ? Math.max(stageSet.size, homepageSessions.size) : stageSet.size;

    const conversionFromPrior = priorCount > 0 ? Math.round((count / priorCount) * 1000) / 10 : 0;
    const dropOffCount = Math.max(0, priorCount - count);
    const dropOffToNext = priorCount > 0 ? Math.round((dropOffCount / priorCount) * 1000) / 10 : 0;

    stages.push({
      stageNumber: stageDef.stageNumber,
      stageKey: stageDef.stageKey,
      stageName: stageDef.stageName,
      uniqueSessions: count,
      conversionFromPrior: i === 0 ? 100 : conversionFromPrior,
      dropOffCount: i === 0 ? 0 : dropOffCount,
      dropOffToNext: i === 0 ? 0 : dropOffToNext,
    });

    priorCount = count;
  }

  // 6. Cohort breakdown by Device Category
  const byDevice: Record<"desktop" | "mobile" | "tablet" | "unknown", FunnelCohortBreakdown> = {
    desktop: { sessions: 0, paidOrders: 0, conversionRate: 0, stageDropOff: {} },
    mobile: { sessions: 0, paidOrders: 0, conversionRate: 0, stageDropOff: {} },
    tablet: { sessions: 0, paidOrders: 0, conversionRate: 0, stageDropOff: {} },
    unknown: { sessions: 0, paidOrders: 0, conversionRate: 0, stageDropOff: {} },
  };

  // 7. Cohort breakdown by Entry Source
  const bySource: Record<string, FunnelCohortBreakdown> = {};

  for (const sId of homepageSessions) {
    const dev = sessionDeviceMap.get(sId) || "unknown";
    const src = sessionSourceMap.get(sId) || "unknown";

    if (!byDevice[dev]) {
      byDevice[dev] = { sessions: 0, paidOrders: 0, conversionRate: 0, stageDropOff: {} };
    }
    byDevice[dev].sessions++;

    if (!bySource[src]) {
      bySource[src] = { sessions: 0, paidOrders: 0, conversionRate: 0, stageDropOff: {} };
    }
    bySource[src].sessions++;

    // Record drop-off step for this session
    const highestStageNum = sessionHighestStage.get(sId) || 1;
    if (highestStageNum < 7) {
      const dropStage = FUNNEL_STAGE_DEFINITIONS[highestStageNum - 1]?.stageKey || "landing_view";
      byDevice[dev].stageDropOff[dropStage] = (byDevice[dev].stageDropOff[dropStage] || 0) + 1;
      bySource[src].stageDropOff[dropStage] = (bySource[src].stageDropOff[dropStage] || 0) + 1;
    }
  }

  // Attribute paid orders to cohorts
  for (const order of validPaidOrders) {
    const orderSessionId =
      order.sessionId ||
      (order.attribution as any)?.sessionId ||
      order.telemetrySessionId;

    if (orderSessionId && homepageSessions.has(orderSessionId)) {
      const dev = sessionDeviceMap.get(orderSessionId) || "unknown";
      const src = sessionSourceMap.get(orderSessionId) || "unknown";
      if (byDevice[dev]) byDevice[dev].paidOrders++;
      if (bySource[src]) bySource[src].paidOrders++;
    } else {
      // Unattributed orders land in the explicit 'unknown' source bucket
      if (!bySource["unknown"]) {
        bySource["unknown"] = { sessions: 0, paidOrders: 0, conversionRate: 0, stageDropOff: {} };
      }
      bySource["unknown"].paidOrders++;
    }
  }

  // Compute conversion rates for device cohorts
  for (const dev of Object.keys(byDevice) as Array<"desktop" | "mobile" | "tablet" | "unknown">) {
    const cohort = byDevice[dev];
    cohort.conversionRate =
      cohort.sessions > 0 ? Math.round((cohort.paidOrders / cohort.sessions) * 1000) / 10 : 0;
  }

  // Compute conversion rates for source cohorts
  for (const src of Object.keys(bySource)) {
    const cohort = bySource[src];
    cohort.conversionRate =
      cohort.sessions > 0 ? Math.round((cohort.paidOrders / cohort.sessions) * 1000) / 10 : 0;
  }

  const overallConversionRate =
    homepageSessions.size > 0
      ? Math.round((homepagePaidOrders / homepageSessions.size) * 1000) / 10
      : 0;

  return {
    totalSessions: allSessions.size,
    homepageSessions: homepageSessions.size,
    verifiedPaidOrders,
    homepagePaidOrders,
    conversionRate: overallConversionRate,
    stages,
    byDevice,
    bySource,
    attributionSummary: {
      attributedPaidOrders,
      unattributedPaidOrders,
      excludedTestOrders,
      duplicateEventsFiltered,
      duplicateOrdersFiltered,
    },
  };
}
