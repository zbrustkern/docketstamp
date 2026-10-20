import { firestoreDb, getSystemConfig, setSystemConfig, getOrdersCollection, sanitizeFirestoreData } from "./firebase-admin";
import { TELEMETRY_COLLECTION } from "./telemetry";
import {
  TelemetryEvent,
  Order,
  AdminMetrics,
  ScenarioPerformanceMetric,
  FinancialMargins,
  CampaignAttributionMetric,
  VisitorSessionRecord,
  FunnelStepLeak,
  AcquisitionSourceMetric,
  VisitorTelemetryMetrics,
} from "./types";
import { getAllNotices as getAllNoticeTemplates, getNoticeById } from "@/src/lib/docket/notices";

export function calculateStripeFeeCents(amountInCents: number, paymentMethod?: string): number {
  if (paymentMethod === "PROMO_CODE" || paymentMethod === "STUDIO_COMP" || amountInCents === 0) {
    return 0;
  }
  return Math.round(amountInCents * 0.029) + 30; // 2.9% + $0.30 (56¢ on $9.00)
}

export interface TelemetrySummary {
  totalSessions: number;
  activeSessionIds: string[]; // Keep recent 500 session IDs to calculate unique sessions
  coverSelected: number;
  noteCompleted: number;
  addressCompleted: number;
  checkoutInitiated: number;
  paid: number;
  // Per-order durable purchase ledger IDs (Finding 1)
  paidOrderIds?: string[];
  // Unique session tracking per stage (sliding window per stage to prevent unbounded doc growth)
  stageSessionIds?: {
    coverSelected: string[];
    noteCompleted: string[];
    addressCompleted: string[];
    checkoutInitiated: string[];
    paid: string[];
    [stage: string]: string[];
  };
  // Raw event counters (separate from unique session funnel)
  rawEventCounts?: Record<string, number>;
  scenarios: Record<
    string,
    {
      views: number;
      customizations: number;
      checkouts: number;
      paid: number;
    }
  >;
  recentSessions?: VisitorSessionRecord[];
  deviceCounts?: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  geoCounts?: Record<string, number>;
  sourceCounts?: Record<
    string,
    {
      sessions: number;
      paid: number;
      dropOffs: Record<string, number>;
    }
  >;
  updatedAt: number;
}

const SUMMARY_CONFIG_KEY = "telemetry_summary";

let ingestQueue: Promise<void> = Promise.resolve();

/**
 * Persistently stores a telemetry event and updates the pre-aggregated summary document.
 * Serializes concurrent writes to ensure atomic summary updates without race conditions.
 */
export function ingestTelemetryEvent(event: TelemetryEvent): Promise<void> {
  const run = () => executeIngest(event);
  ingestQueue = ingestQueue.then(run, run);
  return ingestQueue;
}

async function executeIngest(event: TelemetryEvent): Promise<void> {
  // 1. Write the raw event document for audit trail
  const sanitized = sanitizeFirestoreData(event);
  await firestoreDb.collection(TELEMETRY_COLLECTION).doc(sanitized.id).set(sanitized);

  // 2. Fetch existing summary
  const summary = (await getSystemConfig<TelemetrySummary>(SUMMARY_CONFIG_KEY)) || {
    totalSessions: 0,
    activeSessionIds: [],
    coverSelected: 0,
    noteCompleted: 0,
    addressCompleted: 0,
    checkoutInitiated: 0,
    paid: 0,
    paidOrderIds: [],
    scenarios: {},
    recentSessions: [],
    deviceCounts: { mobile: 0, desktop: 0, tablet: 0 },
    geoCounts: {},
    sourceCounts: {},
    updatedAt: Date.now(),
  };

  summary.recentSessions = summary.recentSessions || [];
  summary.deviceCounts = summary.deviceCounts || { mobile: 0, desktop: 0, tablet: 0 };
  summary.geoCounts = summary.geoCounts || {};
  summary.sourceCounts = summary.sourceCounts || {};
  summary.paidOrderIds = summary.paidOrderIds || [];

  // Ensure stageSessionIds and rawEventCounts exist
  summary.stageSessionIds = summary.stageSessionIds || {
    coverSelected: [],
    noteCompleted: [],
    addressCompleted: [],
    checkoutInitiated: [],
    paid: [],
  };
  summary.stageSessionIds.coverSelected = summary.stageSessionIds.coverSelected || [];
  summary.stageSessionIds.noteCompleted = summary.stageSessionIds.noteCompleted || [];
  summary.stageSessionIds.addressCompleted = summary.stageSessionIds.addressCompleted || [];
  summary.stageSessionIds.checkoutInitiated = summary.stageSessionIds.checkoutInitiated || [];
  summary.stageSessionIds.paid = summary.stageSessionIds.paid || [];
  summary.rawEventCounts = summary.rawEventCounts || {};

  // Track raw event count
  summary.rawEventCounts[event.eventName] = (summary.rawEventCounts[event.eventName] || 0) + 1;

  // Track unique session ID
  let isNewSession = false;
  if (event.sessionId) {
    if (!summary.activeSessionIds.includes(event.sessionId)) {
      isNewSession = true;
      summary.activeSessionIds.push(event.sessionId);
      if (summary.activeSessionIds.length > 500) {
        summary.activeSessionIds = summary.activeSessionIds.slice(-500);
      }
      summary.totalSessions = Math.max(summary.totalSessions + 1, summary.activeSessionIds.length);
    }
  }

  // Update unique-session funnel counters (at most once per sessionId; step_navigated never completes a step)
  if (
    event.eventName === "cover_preset_selected" ||
    event.eventName === "ai_generate_succeeded" ||
    event.eventName === "card_completed"
  ) {
    if (event.sessionId && !summary.stageSessionIds.coverSelected.includes(event.sessionId)) {
      summary.stageSessionIds.coverSelected.push(event.sessionId);
      if (summary.stageSessionIds.coverSelected.length > 1000) {
        summary.stageSessionIds.coverSelected = summary.stageSessionIds.coverSelected.slice(-1000);
      }
      summary.coverSelected++;
    }
  } else if (event.eventName === "note_completed") {
    if (event.sessionId && !summary.stageSessionIds.noteCompleted.includes(event.sessionId)) {
      summary.stageSessionIds.noteCompleted.push(event.sessionId);
      if (summary.stageSessionIds.noteCompleted.length > 1000) {
        summary.stageSessionIds.noteCompleted = summary.stageSessionIds.noteCompleted.slice(-1000);
      }
      summary.noteCompleted++;
    }
  } else if (event.eventName === "address_completed") {
    if (event.sessionId && !summary.stageSessionIds.addressCompleted.includes(event.sessionId)) {
      summary.stageSessionIds.addressCompleted.push(event.sessionId);
      if (summary.stageSessionIds.addressCompleted.length > 1000) {
        summary.stageSessionIds.addressCompleted = summary.stageSessionIds.addressCompleted.slice(-1000);
      }
      summary.addressCompleted++;
    }
  } else if (
    event.eventName === "checkout_initiated" ||
    event.eventName === "payment_viewed"
  ) {
    if (event.sessionId && !summary.stageSessionIds.checkoutInitiated.includes(event.sessionId)) {
      summary.stageSessionIds.checkoutInitiated.push(event.sessionId);
      if (summary.stageSessionIds.checkoutInitiated.length > 1000) {
        summary.stageSessionIds.checkoutInitiated = summary.stageSessionIds.checkoutInitiated.slice(-1000);
      }
      summary.checkoutInitiated++;
    }
  } else if (
    event.eventName === "purchase_verified" ||
    event.eventName === "payment_succeeded"
  ) {
    if (!summary.paidOrderIds) {
      summary.paidOrderIds = [];
    }
    const orderKey = event.orderId || event.sessionId;
    const isTest = Boolean(event.metadata?.isTest);
    const sessionAlreadyPaid = event.sessionId ? summary.stageSessionIds.paid.includes(event.sessionId) : false;
    const orderAlreadyPaid = orderKey ? summary.paidOrderIds.includes(orderKey) : false;

    // 1. Session conversion tracking (unique visitor sessions that converted)
    if (event.sessionId && !sessionAlreadyPaid) {
      summary.stageSessionIds.paid.push(event.sessionId);
      if (summary.stageSessionIds.paid.length > 1000) {
        summary.stageSessionIds.paid = summary.stageSessionIds.paid.slice(-1000);
      }
    }

    // 2. Durable per-order purchase ledger tracking (counts every paid order, including repeat purchases in same session)
    if (!orderAlreadyPaid) {
      if (orderKey) {
        summary.paidOrderIds.push(orderKey);
        if (summary.paidOrderIds.length > 2000) {
          summary.paidOrderIds = summary.paidOrderIds.slice(-2000);
        }
      }
      if (!isTest) {
        summary.paid++;
      }
    }
  }

  // Determine current step number and label
  let stepNum = event.step || 1;
  let stepName = "Cover Selection";
  if (event.eventName === "purchase_verified" || event.eventName === "payment_succeeded") {
    stepNum = 5;
    stepName = "Paid & Penned";
  } else if (
    event.eventName === "checkout_initiated" ||
    event.eventName === "payment_viewed" ||
    event.step === 4
  ) {
    stepNum = 4;
    stepName = "Stripe Checkout";
  } else if (event.eventName === "address_completed" || event.step === 3) {
    stepNum = 3;
    stepName = "Recipient Address";
  } else if (
    event.eventName === "note_completed" ||
    event.eventName === "inside_note_edited" ||
    event.eventName === "inspiration_applied" ||
    event.eventName === "note_shuffled" ||
    event.step === 2
  ) {
    stepNum = 2;
    stepName = "Inside Note";
  } else if (
    event.eventName === "card_completed" ||
    event.eventName === "cover_preset_selected" ||
    event.eventName === "ai_generate_succeeded" ||
    event.step === 1
  ) {
    stepNum = 1;
    stepName = "Cover Selection";
  }

  // Determine source & medium
  let source = event.utmSource || "direct";
  let medium = event.utmMedium || (event.gclid ? "cpc" : "none");
  if (event.gclid) {
    source = "google";
    medium = "cpc";
  } else if (event.referrer && !event.utmSource) {
    try {
      const host = new URL(event.referrer).hostname.toLowerCase();
      if (host.includes("google.")) {
        source = "google";
        medium = "organic";
      } else if (host.includes("bing.")) {
        source = "bing";
        medium = "organic";
      } else if (host.includes("facebook") || host.includes("instagram") || host.includes("meta")) {
        source = "meta";
        medium = "social";
      } else if (host.includes("t.co") || host.includes("twitter") || host.includes("x.com")) {
        source = "x";
        medium = "social";
      } else if (host.includes("reddit")) {
        source = "reddit";
        medium = "social";
      } else {
        source = host;
        medium = "referral";
      }
    } catch {
      // ignore invalid URL
    }
  }

  // Update or insert visitor session record
  let existingSession = summary.recentSessions.find((s) => s.sessionId === event.sessionId);
  if (existingSession) {
    existingSession.lastSeenAt = Date.now();
    if (stepNum > existingSession.highestStep) {
      existingSession.highestStep = stepNum;
      existingSession.highestStepName = stepName;
    }
    if (event.eventName === "purchase_verified" || event.eventName === "payment_succeeded") {
      existingSession.completed = true;
      existingSession.dropOffStep = undefined;
      if (event.orderId) existingSession.orderId = event.orderId;
    } else if (!existingSession.completed) {
      existingSession.dropOffStep = existingSession.highestStepName;
    }
    if (event.deviceType) existingSession.deviceType = event.deviceType;
    if (event.ipCity) existingSession.city = event.ipCity;
    if (event.ipRegion) existingSession.region = event.ipRegion;
    if (event.ipCountry) existingSession.country = event.ipCountry;
    if (event.googleClientId) existingSession.googleClientId = event.googleClientId;
    if (event.utmCampaign) existingSession.campaign = event.utmCampaign;
    if (event.isBot !== undefined) existingSession.isBot = event.isBot;
    if (event.userAgent) existingSession.userAgent = event.userAgent;
  } else {
    const isCompleted = event.eventName === "purchase_verified" || event.eventName === "payment_succeeded";
    const newSession: VisitorSessionRecord = {
      sessionId: event.sessionId,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      highestStep: stepNum,
      highestStepName: stepName,
      dropOffStep: isCompleted ? undefined : stepName,
      completed: isCompleted,
      orderId: event.orderId,
      source,
      medium,
      campaign: event.utmCampaign,
      gclid: event.gclid,
      deviceType: event.deviceType || "desktop",
      screenResolution: event.screenResolution,
      city: event.ipCity,
      region: event.ipRegion,
      country: event.ipCountry,
      landingPath: event.landingPath || event.path,
      googleClientId: event.googleClientId,
      userAgent: event.userAgent,
      isBot: event.isBot,
    };
    summary.recentSessions.unshift(newSession);
    if (summary.recentSessions.length > 50) {
      summary.recentSessions = summary.recentSessions.slice(0, 50);
    }
  }

  // Update device breakdown
  const dType = event.deviceType || "desktop";
  summary.deviceCounts[dType] = (summary.deviceCounts[dType] || 0) + 1;

  // Update geo breakdown
  if (event.ipCity) {
    const locKey = `${event.ipCity}${event.ipRegion ? ", " + event.ipRegion : ""}`;
    summary.geoCounts[locKey] = (summary.geoCounts[locKey] || 0) + 1;
  }

  // Update traffic source breakdown
  const srcKey = `${source} / ${medium}`;
  if (!summary.sourceCounts[srcKey]) {
    summary.sourceCounts[srcKey] = {
      sessions: 0,
      paid: 0,
      dropOffs: {},
    };
  }
  if (isNewSession) {
    summary.sourceCounts[srcKey].sessions++;
  }
  if (event.eventName === "purchase_verified" || event.eventName === "payment_succeeded") {
    summary.sourceCounts[srcKey].paid++;
  } else {
    summary.sourceCounts[srcKey].dropOffs[stepName] =
      (summary.sourceCounts[srcKey].dropOffs[stepName] || 0) + 1;
  }

  // Update scenario-specific telemetry
  const scenarioSlug =
    (event.metadata?.scenarioSlug as string) ||
    (event.path?.startsWith("/send/") ? event.path.split("/")[3] : undefined);

  if (scenarioSlug) {
    if (!summary.scenarios[scenarioSlug]) {
      summary.scenarios[scenarioSlug] = {
        views: 0,
        customizations: 0,
        checkouts: 0,
        paid: 0,
      };
    }

    const s = summary.scenarios[scenarioSlug];
    if (
      event.eventName === "session_start" ||
      event.eventName === "scenario_landing_viewed" ||
      event.eventName === "landing_viewed"
    ) {
      s.views++;
    } else if (
      event.eventName === "note_completed" ||
      event.eventName === "inside_note_edited" ||
      event.eventName === "scenario_customized" ||
      event.eventName === "card_completed" ||
      event.eventName === "cover_preset_selected"
    ) {
      s.customizations++;
    } else if (
      event.eventName === "checkout_initiated" ||
      event.eventName === "payment_viewed"
    ) {
      s.checkouts++;
    } else if (
      event.eventName === "purchase_verified" ||
      event.eventName === "payment_succeeded"
    ) {
      s.paid++;
    }
  }

  summary.updatedAt = Date.now();

  // Save updated aggregate summary
  await setSystemConfig(SUMMARY_CONFIG_KEY, summary as unknown as Record<string, unknown>);
}

/**
 * Server-only function for recording authority events (purchase_verified, fulfillment_*).
 * Webhooks and backend order processors call this directly, completely bypassing /api/telemetry.
 */
export async function recordServerTelemetry(params: {
  eventName:
    | "purchase_verified"
    | "fulfillment_submitted"
    | "fulfillment_failed"
    | "order_paid_confirmed"
    | "order_fulfilled";
  sessionId: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
  experienceVersion?: string;
  draftRevision?: number;
}): Promise<string> {
  const metadata: Record<string, unknown> = { ...(params.metadata || {}) };
  let noticeCategory: string | undefined;
  let cohort: "notice" | "legacy_card" | "unknown" = "unknown";
  if (params.orderId) {
    const orderSnapshot = await getOrdersCollection().doc(params.orderId).get();
    if (orderSnapshot.exists) {
      const order = orderSnapshot.data() as Partial<Order> & { noticeId?: string; noticeType?: string };
      const paidAmount = typeof order.finalAmountInCents === "number" ? order.finalAmountInCents : order.amountInCents;
      if (typeof paidAmount === "number" && Number.isInteger(paidAmount) && paidAmount >= 0) metadata.amountInCents = paidAmount;
      else delete metadata.amountInCents;
      const noticeRef = order.noticeType || order.noticeId;
      const definition = noticeRef ? getNoticeById(noticeRef) : undefined;
      if (definition) {
        noticeCategory = definition.category;
        cohort = "notice";
      } else if (order.experienceVersion === "home_v2") {
        cohort = "legacy_card";
      }
      if (!noticeCategory) delete metadata.noticeCategory;
    } else {
      delete metadata.amountInCents;
      delete metadata.noticeCategory;
    }
  } else {
    delete metadata.amountInCents;
    delete metadata.noticeCategory;
  }
  const eventId = `evt_srv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Date.now();
  const eventDoc: TelemetryEvent = {
    id: eventId,
    eventName: params.eventName,
    sessionId: params.sessionId,
    orderId: params.orderId,
    metadata,
    path: "/api/server",
    timestamp: now,
    createdAt: now,
    experienceVersion: params.experienceVersion,
    ...(noticeCategory ? { noticeCategory } : {}),
    cohort,
    draftRevision: params.draftRevision,
  };

  await ingestTelemetryEvent(eventDoc);
  return eventId;
}

/**
 * Retrieves the funnel summary without performing automatic collection scans or Firestore writes on GET.
 */
export async function getTelemetrySummary(): Promise<TelemetrySummary> {
  const existing = await getSystemConfig<TelemetrySummary>(SUMMARY_CONFIG_KEY);
  if (existing) {
    return existing;
  }

  return {
    totalSessions: 0,
    activeSessionIds: [],
    coverSelected: 0,
    noteCompleted: 0,
    addressCompleted: 0,
    checkoutInitiated: 0,
    paid: 0,
    paidOrderIds: [],
    scenarios: {},
    recentSessions: [],
    deviceCounts: { mobile: 0, desktop: 0, tablet: 0 },
    geoCounts: {},
    sourceCounts: {},
    updatedAt: 0,
  };
}

/**
 * Explicit maintenance helper to rebuild telemetry summary from raw events.
 * Never invoked automatically during dashboard GET requests.
 */
export async function backfillTelemetrySummaryFromEvents(): Promise<TelemetrySummary> {
  const summary: TelemetrySummary = {
    totalSessions: 0,
    activeSessionIds: [],
    coverSelected: 0,
    noteCompleted: 0,
    addressCompleted: 0,
    checkoutInitiated: 0,
    paid: 0,
    scenarios: {},
    updatedAt: Date.now(),
  };

  try {
    const snap = await firestoreDb.collection(TELEMETRY_COLLECTION).get();
    const sessions = new Set<string>();
    const coverSessions = new Set<string>();
    const noteSessions = new Set<string>();
    const addressSessions = new Set<string>();
    const checkoutSessions = new Set<string>();
    const paidSessions = new Set<string>();

    snap.forEach((doc) => {
      const evt = doc.data() as TelemetryEvent;
      if (evt.sessionId) sessions.add(evt.sessionId);

      switch (evt.eventName) {
        case "card_completed":
        case "cover_preset_selected":
        case "ai_generate_succeeded":
          if (evt.sessionId) coverSessions.add(evt.sessionId);
          break;
        case "note_completed":
          if (evt.sessionId) noteSessions.add(evt.sessionId);
          break;
        case "address_completed":
          if (evt.sessionId) addressSessions.add(evt.sessionId);
          break;
        case "checkout_initiated":
        case "payment_viewed":
          if (evt.sessionId) checkoutSessions.add(evt.sessionId);
          break;
        case "purchase_verified":
        case "payment_succeeded":
          if (evt.sessionId) paidSessions.add(evt.sessionId);
          break;
      }

      const slug =
        (evt.metadata?.scenarioSlug as string) ||
        (evt.path?.startsWith("/send/") ? evt.path.split("/")[3] : undefined);

      if (slug) {
        if (!summary.scenarios[slug]) {
          summary.scenarios[slug] = { views: 0, customizations: 0, checkouts: 0, paid: 0 };
        }
        const s = summary.scenarios[slug];
        if (
          evt.eventName === "session_start" ||
          evt.eventName === "scenario_landing_viewed" ||
          evt.eventName === "landing_viewed"
        ) {
          s.views++;
        } else if (
          evt.eventName === "note_completed" ||
          evt.eventName === "inside_note_edited" ||
          evt.eventName === "scenario_customized" ||
          evt.eventName === "card_completed" ||
          evt.eventName === "cover_preset_selected"
        ) {
          s.customizations++;
        } else if (
          evt.eventName === "checkout_initiated" ||
          evt.eventName === "payment_viewed"
        ) {
          s.checkouts++;
        } else if (
          evt.eventName === "purchase_verified" ||
          evt.eventName === "payment_succeeded"
        ) {
          s.paid++;
        }
      }
    });

    summary.activeSessionIds = Array.from(sessions).slice(-500);
    summary.totalSessions = sessions.size;
    summary.coverSelected = coverSessions.size;
    summary.noteCompleted = noteSessions.size;
    summary.addressCompleted = addressSessions.size;
    summary.checkoutInitiated = checkoutSessions.size;
    summary.paid = paidSessions.size;
    summary.stageSessionIds = {
      coverSelected: Array.from(coverSessions).slice(-1000),
      noteCompleted: Array.from(noteSessions).slice(-1000),
      addressCompleted: Array.from(addressSessions).slice(-1000),
      checkoutInitiated: Array.from(checkoutSessions).slice(-1000),
      paid: Array.from(paidSessions).slice(-1000),
    };
    summary.updatedAt = Date.now();

    await setSystemConfig(SUMMARY_CONFIG_KEY, summary as unknown as Record<string, unknown>);
  } catch (err) {
    console.warn("[Metrics Rollup] Backfill notice:", err);
  }

  return summary;
}

/**
 * Determines whether an order belongs to a non-customer cohort (founder test, studio comp, test mode, or mock).
 * These orders must be excluded from customer conversion and business metrics.
 */
export function isExcludedOrderCohort(o: Partial<Order>): boolean {
  return (
    o.isTest === true ||
    o.isComp === true ||
    o.isFounderTest === true ||
    o.paymentMode === "stripe_test" ||
    o.paymentMode === "local_mock" ||
    o.paymentMethod === "STUDIO_COMP" ||
    Boolean(o.customerEmail && o.customerEmail.toLowerCase().includes("founder"))
  );
}

/**
 * Recognizes all paid/post-payment order statuses, including modern DocketStamp Lob USPS lifecycle states.
 * Never treats modern postal progress (PROCESSING_DISPATCH, IN_TRANSIT, DELIVERED, etc.) as unpaid.
 */
export function isPaidOrderStatus(o: Partial<Order>): boolean {
  if (!o.status) return false;
  if (o.status === "PENDING_PAYMENT" || o.status === "PAYMENT_VERIFICATION_FAILED") {
    return false;
  }
  if (
    o.status === "PAYMENT_RECEIVED" ||
    o.status === "DISPATCHING" ||
    o.status === "PROCESSING_HANDWRYTTEN" ||
    o.status === "PROCESSING_DISPATCH" ||
    o.status === "DISPATCHED_TO_USPS" ||
    o.status === "MAILED" ||
    o.status === "IN_TRANSIT" ||
    o.status === "DELIVERED" ||
    o.status === "RETURNED_TO_SENDER"
  ) {
    return true;
  }
  if (o.status === "QUEUED_FOR_FULFILLMENT") {
    return (
      Boolean(o.stripePaymentId) ||
      (typeof o.finalAmountInCents === "number" && o.finalAmountInCents > 0) ||
      (typeof o.amountInCents === "number" && o.amountInCents > 0) ||
      o.paymentMethod === "PROMO_CODE"
    );
  }
  return false;
}

/**
 * Computes scalable admin dashboard metrics by combining:
 * 1. Pre-aggregated telemetry summary (observed sessions only; no synthetic order backfill)
 * 2. High-performance order queries with limit and status filtering
 */
export async function getAdminDashboardMetrics(): Promise<AdminMetrics> {
  // 1. Fetch latest 50 orders sorted newest first
  const ordersSnapshot = await getOrdersCollection()
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const recentOrders: Order[] = [];
  ordersSnapshot.forEach((doc) => {
    recentOrders.push(doc.data() as Order);
  });

  // 2. Fetch all orders for status totals (or from summary)
  const allOrdersSnap = await getOrdersCollection().get();
  const financeFactSnap = await firestoreDb.collection("payment_facts_v1").get().catch(() => null);
  const fulfillmentEstimateDoc = await getSystemConfig<{
    schemaVersion?: number;
    currency?: string;
    tiers?: Partial<Record<"first_class" | "certified" | "certified_return_receipt", { amountCents?: number; sourceRef?: string }>>;
  }>("admin_fulfillment_cost_estimates").catch(() => null);
  const processorFeesByOrder = new Map<string, number>();
  const capturesByOrder = new Map<string, number>();
  const lobCostsByOrder = new Map<string, number>();
  const lobCreditsByOrder = new Map<string, number>();
  const runtimeEnvironment = process.env.ENVIRONMENT === "staging" || process.env.FIREBASE_PROJECT_ID === "docketstamp-staging" ? "staging" : process.env.NODE_ENV === "production" ? "production" : "local";
  financeFactSnap?.forEach((doc) => {
    const fact = doc.data() as Record<string, unknown>;
    if (fact.provider !== "stripe" && fact.provider !== "lob") return;
    if (fact.environment !== runtimeEnvironment || fact.verification !== "verified" || typeof fact.orderId !== "string" || !Number.isInteger(fact.amountMinor)) return;
    const amount = Number(fact.amountMinor);
    if (fact.kind === "capture" && fact.provider === "stripe") capturesByOrder.set(fact.orderId, amount);
    if (fact.kind === "processor_fee" && fact.provider === "stripe") processorFeesByOrder.set(fact.orderId, (processorFeesByOrder.get(fact.orderId) || 0) + amount);
    if (fact.provider === "lob" && fact.kind === "supplier_charge") lobCostsByOrder.set(fact.orderId, (lobCostsByOrder.get(fact.orderId) || 0) + amount);
    if (fact.provider === "lob" && fact.kind === "supplier_credit") lobCreditsByOrder.set(fact.orderId, (lobCreditsByOrder.get(fact.orderId) || 0) + amount);
  });
  let totalRevenueCents = 0;
  let pendingCount = 0;
  let processingCount = 0;
  let failedCount = 0;

  const noticeCategoryCounts: Record<string, number> = {};
  let legacyCardOrderCount = 0;
  let unknownNoticeOrderCount = 0;

  let stripeFeesCents = 0;
  let fulfillmentCogsCents = 0;
  let verifiedFeeOrderCount = 0;
  let verifiedCogsOrderCount = 0;
  let estimatedCogsOrderCount = 0;
  let unknownFulfillmentOrdersCount = 0;
  const campaignAgg: Record<string, CampaignAttributionMetric> = {};

  allOrdersSnap.forEach((doc) => {
    const o = doc.data() as Order;

    // S0-05 & Finding 1: Exclude founder testing, free comps, and synthetic test traffic from customer conversion and revenue metrics
    if (isExcludedOrderCohort(o)) {
      return;
    }

    const isPaid = isPaidOrderStatus(o);

    if (isPaid) {
      const orderRev = capturesByOrder.get(o.id) ?? (
        typeof o.finalAmountInCents === "number"
          ? o.finalAmountInCents
          : typeof o.amountInCents === "number"
          ? o.amountInCents
          : 0);
      totalRevenueCents += orderRev;
      processingCount++;

      const observedStripeFee = processorFeesByOrder.get(o.id);
      const orderStripeFee = observedStripeFee ?? calculateStripeFeeCents(orderRev, o.paymentMethod);
      if (observedStripeFee !== undefined) verifiedFeeOrderCount++;
      const providerCost = lobCostsByOrder.get(o.id);
      const providerCredit = lobCreditsByOrder.get(o.id) || 0;
      const providerNetCost = providerCost === undefined ? undefined : Math.max(0, providerCost - providerCredit);
      const tier = o.serviceLevel === "FIRST_CLASS" ? "first_class" : o.serviceLevel === "CERTIFIED_RETURN_RECEIPT" ? "certified_return_receipt" : "certified";
      const tierEstimate = fulfillmentEstimateDoc?.schemaVersion === 1 && fulfillmentEstimateDoc.currency === "USD" ? fulfillmentEstimateDoc.tiers?.[tier] : undefined;
      const estimateIsTraceable = Number.isInteger(tierEstimate?.amountCents) && Number(tierEstimate?.amountCents) > 0 && typeof tierEstimate?.sourceRef === "string" && tierEstimate.sourceRef.trim().length > 0;
      const orderCogs = providerNetCost ?? (estimateIsTraceable ? Number(tierEstimate!.amountCents) : 0);
      if (providerNetCost !== undefined) verifiedCogsOrderCount++;
      else if (estimateIsTraceable) estimatedCogsOrderCount++;
      else unknownFulfillmentOrdersCount++;
      const orderNetMargin = orderRev - orderStripeFee - orderCogs;

      stripeFeesCents += orderStripeFee;
      fulfillmentCogsCents += orderCogs;

      // Group attribution by Campaign / Source
      const utmCampaign = o.attribution?.utmCampaign?.trim() || "";
      const utmSource = o.attribution?.utmSource?.trim() || "";
      const utmMedium = o.attribution?.utmMedium?.trim() || "";
      const hasGclid = Boolean(o.attribution?.gclid);

      let key = "Direct / Organic";
      if (utmCampaign) {
        key = utmCampaign;
      } else if (utmSource || utmMedium) {
        key = `${utmSource || "direct"} / ${utmMedium || "none"}`;
      } else if (hasGclid) {
        key = "Google Ads (Auto-tagged)";
      }

      if (!campaignAgg[key]) {
        campaignAgg[key] = {
          campaignKey: key,
          utmSource: utmSource || (hasGclid ? "google" : "direct"),
          utmMedium: utmMedium || (hasGclid ? "cpc" : "none"),
          utmCampaign: utmCampaign || (hasGclid ? "Google Ads" : "(not set)"),
          hasGclid,
          orderCount: 0,
          grossRevenueCents: 0,
          netContributionMarginCents: 0,
          lastOrderAt: o.createdAt,
        };
      }

      campaignAgg[key].orderCount++;
      campaignAgg[key].grossRevenueCents += orderRev;
      campaignAgg[key].netContributionMarginCents += orderNetMargin;
      if (o.createdAt && (!campaignAgg[key].lastOrderAt || o.createdAt > campaignAgg[key].lastOrderAt!)) {
        campaignAgg[key].lastOrderAt = o.createdAt;
      }
    } else if (o.status === "PENDING_PAYMENT") {
      pendingCount++;
    } else if (o.status === "FAILED" || o.status === "PAYMENT_VERIFICATION_FAILED") {
      failedCount++;
    }

    if (isPaid) {
      const noticeRef = o.noticeType || o.noticeId;
      const definition = noticeRef ? getNoticeById(noticeRef) : undefined;
      if (definition) {
        noticeCategoryCounts[definition.category] = (noticeCategoryCounts[definition.category] || 0) + 1;
      } else if (o.experienceVersion === "home_v2") {
        legacyCardOrderCount++;
      } else {
        unknownNoticeOrderCount++;
      }
    }
  });

  const categorizedOrderCount = Object.values(noticeCategoryCounts).reduce((sum, count) => sum + count, 0) + legacyCardOrderCount + unknownNoticeOrderCount;
  const noticeCategoryPopularity = [
    ...Object.entries(noticeCategoryCounts).map(([category, count]) => ({ category, cohort: "notice" as const, count, percentage: categorizedOrderCount ? Math.round((count / categorizedOrderCount) * 100) : 0 })),
    ...(legacyCardOrderCount ? [{ category: "Legacy card", cohort: "legacy_card" as const, count: legacyCardOrderCount, percentage: categorizedOrderCount ? Math.round((legacyCardOrderCount / categorizedOrderCount) * 100) : 0 }] : []),
    ...(unknownNoticeOrderCount ? [{ category: "Unknown / unmapped", cohort: "unknown" as const, count: unknownNoticeOrderCount, percentage: categorizedOrderCount ? Math.round((unknownNoticeOrderCount / categorizedOrderCount) * 100) : 0 }] : []),
  ].sort((a, b) => b.count - a.count);

  // 3. Margin & Unit Economics Summaries (No fabricated $9.00, $3.56, or 39.6% defaults on empty data)
  const paidCardsCount = processingCount;
  const netContributionMarginCents = totalRevenueCents - stripeFeesCents - fulfillmentCogsCents;
  const netContributionMarginPercent =
    totalRevenueCents > 0
      ? Math.round((netContributionMarginCents / totalRevenueCents) * 1000) / 10
      : null;

  const averageOrderRevenueCents = paidCardsCount > 0 ? Math.round(totalRevenueCents / paidCardsCount) : 0;
  const averageStripeFeeCents = paidCardsCount > 0 ? Math.round(stripeFeesCents / paidCardsCount) : 0;
  const averageFulfillmentCogsCents = paidCardsCount > 0 ? Math.round(fulfillmentCogsCents / paidCardsCount) : 0;
  const averageNetContributionCents = paidCardsCount > 0 ? Math.round(netContributionMarginCents / paidCardsCount) : 0;
  const targetBreakevenCpaDollars = paidCardsCount > 0 ? Number((averageNetContributionCents / 100).toFixed(2)) : 0;

  const cogsEvidence: NonNullable<FinancialMargins["fulfillmentCogsEvidence"]> = unknownFulfillmentOrdersCount > 0
    ? (verifiedCogsOrderCount || estimatedCogsOrderCount ? "partial" : "unavailable")
    : estimatedCogsOrderCount > 0
    ? (verifiedCogsOrderCount ? "partial" : "estimated")
    : "verified";
  const feeEvidence: NonNullable<FinancialMargins["stripeFeeEvidence"]> = processingCount === 0 ? "unavailable" : verifiedFeeOrderCount === processingCount ? "verified" : verifiedFeeOrderCount > 0 ? "partial" : "estimated";
  const margins: FinancialMargins = {
    grossRevenueCents: totalRevenueCents,
    stripeFeesCents,
    fulfillmentCogsCents,
    netContributionMarginCents,
    netContributionMarginPercent,
    paidCardsCount,
    averageOrderRevenueCents,
    averageStripeFeeCents,
    averageFulfillmentCogsCents,
    averageNetContributionCents,
    targetBreakevenCpaDollars,
    economicsAuthority: cogsEvidence === "verified" && feeEvidence === "verified" ? "verified_ledger" : estimatedCogsOrderCount > 0 && unknownFulfillmentOrdersCount === 0 ? "estimated_tier_schedule" : "partial_ledger",
    stripeFeeEvidence: feeEvidence,
    fulfillmentCogsEvidence: cogsEvidence,
    unknownFulfillmentOrdersCount,
  };

  const campaignAttributions = Object.values(campaignAgg).sort(
    (a, b) => b.netContributionMarginCents - a.netContributionMarginCents
  );

  // Fetch operator tracked ad spend from system config
  let adSpendCents = 0;
  try {
    const adSpendDoc = await getSystemConfig<{ amountCents: number }>("admin_ad_spend");
    if (adSpendDoc?.amountCents) {
      adSpendCents = adSpendDoc.amountCents;
    }
  } catch (err) {
    console.warn("[Metrics Rollup] Error reading ad spend config:", err);
  }

  // Fetch saved valuation heuristic assumptions if present
  let valuationAssumptions: any = undefined;
  try {
    const valDoc = await getSystemConfig("admin_valuation_assumptions");
    if (valDoc) {
      valuationAssumptions = valDoc;
    }
  } catch (err) {
    console.warn("[Metrics Rollup] Error reading valuation assumptions:", err);
  }

  // 4. Load pre-aggregated telemetry funnel (strictly observed sessions; no synthetic order backfill or minimum-1 denominator)
  const telemetry = await getTelemetrySummary();

  const totalSessions = telemetry.totalSessions;
  const coverCount = telemetry.coverSelected;
  const noteCount = telemetry.noteCompleted;
  const addressCount = telemetry.addressCompleted;
  const checkoutCount = telemetry.checkoutInitiated;
  const paidCount = telemetry.paid;
  const unmatchedPaidOrdersCount = Math.max(0, processingCount - telemetry.paid);

  // 5. Construct enriched visitor telemetry
  const totalDev =
    (telemetry.deviceCounts?.mobile || 0) +
    (telemetry.deviceCounts?.desktop || 0) +
    (telemetry.deviceCounts?.tablet || 0);
  const mobCount = telemetry.deviceCounts?.mobile || 0;
  const deskCount = telemetry.deviceCounts?.desktop || 0;
  const tabCount = telemetry.deviceCounts?.tablet || 0;

  const deviceBreakdown = {
    mobile: mobCount,
    desktop: deskCount,
    tablet: tabCount,
    mobilePercent: totalDev > 0 ? Math.round((mobCount / totalDev) * 100) : 0,
    desktopPercent: totalDev > 0 ? Math.round((deskCount / totalDev) * 100) : 0,
    tabletPercent: totalDev > 0 ? Math.round((tabCount / totalDev) * 100) : 0,
  };

  const topLocations = Object.entries(telemetry.geoCounts || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([loc, count]) => {
      const parts = loc.split(", ");
      return {
        city: parts[0] || loc,
        region: parts[1] || undefined,
        count,
      };
    });

  const acquisitionSources: AcquisitionSourceMetric[] = Object.entries(telemetry.sourceCounts || {})
    .map(([key, data]) => {
      const [src, med] = key.split(" / ");
      let topDrop = "None";
      let maxDrop = -1;
      for (const [step, count] of Object.entries(data.dropOffs || {})) {
        if (count > maxDrop) {
          maxDrop = count;
          topDrop = step;
        }
      }
      return {
        sourceKey: key,
        source: src || "direct",
        medium: med || "none",
        sessions: data.sessions,
        completedOrders: data.paid,
        conversionRate: data.sessions > 0 ? Math.round((data.paid / data.sessions) * 1000) / 10 : 0,
        topDropOffStep: topDrop,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);

  const funnelLeaks: FunnelStepLeak[] = [
    {
      stepNumber: 1,
      stepName: "1. Landed & Browsing",
      visitors: totalSessions,
      conversionFromPrior: totalSessions > 0 ? 100 : 0,
      leakToNext: totalSessions > 0 ? Math.max(0, Math.round(((totalSessions - coverCount) / totalSessions) * 100)) : 0,
    },
    {
      stepNumber: 2,
      stepName: "2. Cover Selected",
      visitors: coverCount,
      conversionFromPrior: totalSessions > 0 ? Math.min(100, Math.round((coverCount / totalSessions) * 100)) : 0,
      leakToNext: coverCount > 0 ? Math.max(0, Math.round(((coverCount - noteCount) / coverCount) * 100)) : 0,
    },
    {
      stepNumber: 3,
      stepName: "3. Note Written",
      visitors: noteCount,
      conversionFromPrior: coverCount > 0 ? Math.min(100, Math.round((noteCount / coverCount) * 100)) : 0,
      leakToNext: noteCount > 0 ? Math.max(0, Math.round(((noteCount - addressCount) / noteCount) * 100)) : 0,
    },
    {
      stepNumber: 4,
      stepName: "4. Address Entered",
      visitors: addressCount,
      conversionFromPrior: noteCount > 0 ? Math.min(100, Math.round((addressCount / noteCount) * 100)) : 0,
      leakToNext: addressCount > 0 ? Math.max(0, Math.round(((addressCount - checkoutCount) / addressCount) * 100)) : 0,
    },
    {
      stepNumber: 5,
      stepName: "5. Checkout Initiated",
      visitors: checkoutCount,
      conversionFromPrior: addressCount > 0 ? Math.min(100, Math.round((checkoutCount / addressCount) * 100)) : 0,
      leakToNext: checkoutCount > 0 ? Math.max(0, Math.round(((checkoutCount - paidCount) / checkoutCount) * 100)) : 0,
    },
    {
      stepNumber: 6,
      stepName: "6. Paid Order",
      visitors: paidCount,
      conversionFromPrior: checkoutCount > 0 ? Math.min(100, Math.round((paidCount / checkoutCount) * 100)) : 0,
      leakToNext: 0,
    },
  ];

  const recentSessions = telemetry.recentSessions || [];
  const botVisitors = recentSessions.filter((s) => s.isBot).length;
  const humanVisitors = Math.max(0, totalSessions - botVisitors);

  const visitorTelemetry: VisitorTelemetryMetrics = {
    totalVisitors: totalSessions,
    humanVisitors,
    botVisitors,
    funnelLeaks,
    acquisitionSources,
    deviceBreakdown,
    topLocations,
    recentSessions,
  };

  return {
    totalRevenueCents,
    totalOrders: allOrdersSnap.size,
    ordersByStatus: {
      pending: pendingCount,
      processing: processingCount,
      failed: failedCount,
    },
    funnel: {
      totalSessions,
      coverSelected: coverCount,
      noteCompleted: noteCount,
      addressCompleted: addressCount,
      checkoutInitiated: checkoutCount,
      paid: paidCount,
    },
    visitorTelemetry,
    noticeCategoryPopularity,
    legacyCardOrderCount,
    margins,
    campaignAttributions,
    adSpendCents,
    valuationAssumptions,
    reportingQuality: {
      status: "legacy_interim_unverified",
      funnelAuthority: "session_telemetry_only_no_synthetic_backfill",
      economicsAuthority: cogsEvidence === "unavailable" || cogsEvidence === "partial" || feeEvidence === "partial" || feeEvidence === "estimated"
        ? "estimated_pending_provider_fee_cogs_ledger"
        : "verified_ledger",
      healthAuthority: "configuration_only_no_live_probe",
      hasVerifiedRevenue: totalRevenueCents > 0,
      hasObservedSessions: totalSessions > 0,
      unmatchedPaidOrdersCount,
      notes: [
        "Funnel counts reflect observed telemetry sessions only without synthetic order backfill or minimum-1 denominators.",
        `Stripe fee evidence: ${feeEvidence}; fulfillment COGS evidence: ${cogsEvidence}. Tier estimates are used only when admin_fulfillment_cost_estimates contains per-tier amounts and source references; no flat card COGS is assumed.`,
      ],
    },
    recentOrders,
  };
}

/**
 * Scalable scenario performance calculation using the telemetry rollup
 */
export async function getScenarioPerformanceMetrics(): Promise<{
  scenarios: ScenarioPerformanceMetric[];
  totalViews: number;
  totalOrders: number;
}> {
  const allConfigured = getAllNoticeTemplates();
  const summary = await getTelemetrySummary();

  let totalViews = 0;
  let totalOrders = 0;

  const scenarios: ScenarioPerformanceMetric[] = allConfigured.map((notice) => {
    const bucket = summary.scenarios[notice.id] || {
      views: 0,
      customizations: 0,
      checkouts: 0,
      paid: 0,
    };

    const views = bucket.views;
    const customizations = bucket.customizations;
    const checkouts = bucket.checkouts;
    const paidOrders = bucket.paid;

    totalViews += views;
    totalOrders += paidOrders;

    const conversionRate = views > 0 ? (paidOrders / views) * 100 : 0;

    let bottleneckStep: "Cover Selection" | "Inside Note" | "Mailing Address" | "Payment" | null = null;
    let recommendation = "Scenario active. Monitor incoming search traffic.";
    let status: "healthy" | "needs_attention" | "top_performer" | "gathering_data" = "gathering_data";

    if (views >= 5) {
      if (customizations < views * 0.4) {
        bottleneckStep = "Inside Note";
        recommendation = "High drop-off on starter note. Test a more concise bracketed template.";
        status = "needs_attention";
      } else if (checkouts < customizations * 0.4) {
        bottleneckStep = "Mailing Address";
        recommendation = "Customizations look strong, but address step drops off. Verify form ease-of-use.";
        status = "needs_attention";
      } else if (paidOrders === 0 && checkouts >= 2) {
        bottleneckStep = "Payment";
        recommendation = "Users reach checkout but abandon. Ensure Apple Pay & promo badges are visible.";
        status = "needs_attention";
      } else if (conversionRate >= 5) {
        status = "top_performer";
        recommendation = "Outstanding conversion rate. Consider spinning up adjacent sub-queries.";
      } else {
        status = "healthy";
        recommendation = "Funnel conversion is healthy and performing within target benchmarks.";
      }
    }

    return {
      slug: notice.id,
      occasionSlug: notice.category.toLowerCase(),
      path: `/notices/${notice.id}`,
      title: notice.title,
      category: notice.category,
      views,
      customizations,
      checkouts,
      paidOrders,
      conversionRate,
      primaryDropoffStep: bottleneckStep || "None Detected",
      actionableInsight: recommendation,
      status,
    };
  });

  return {
    scenarios,
    totalViews,
    totalOrders,
  };
}
