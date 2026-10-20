export interface MailingAddress {
  firstName: string;
  lastName: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_RECEIVED"
  | "DISPATCHING"
  | "PROCESSING_HANDWRYTTEN"
  | "PROCESSING_DISPATCH"
  | "QUEUED_FOR_FULFILLMENT"
  | "DISPATCHED_TO_USPS"
  | "MAILED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "RETURNED_TO_SENDER"
  | "PAYMENT_VERIFICATION_FAILED"
  | "FAILED";

export type OccasionType = "birthday" | "anniversary" | "holiday" | "milestone" | "custom" | "statutory_deadline";

export interface RecipientOccasion {
  occasionType: OccasionType;
  occasionTitle?: string;
  month: number; // 1-12
  day: number; // 1-31
  year?: number;
  remindMe: boolean;
  remindDaysBefore?: number; // default 14
}

export interface OccasionReminder {
  id: string;
  recipientName: string;
  recipientAddress?: MailingAddress;
  recipientId?: string; // id of SavedAddress if saved
  userEmail: string;
  userId?: string;
  occasionType: OccasionType;
  occasionTitle: string; // e.g. "Sarah's Birthday"
  month: number; // 1-12
  day: number; // 1-31
  year?: number;
  remindDaysBefore: number; // default: 14
  optIn: boolean;
  notes?: string;
  orderId?: string;
  lastNotifiedYear?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SavedAddress extends MailingAddress {
  id: string;
  label?: string;
  occasionReminderDate?: string; // legacy YYYY-MM-DD
  occasionType?: OccasionType;
  occasionTitle?: string;
  occasionMonth?: number; // 1-12
  occasionDay?: number; // 1-31
  occasionYear?: number;
  remindMe?: boolean;
  remindDaysBefore?: number; // default 14
}

export interface OrderAttribution {
  sessionId?: string;
  entrySource?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  fbclid?: string;
  fbp?: string; // Meta Pixel browser cookie (_fbp)
  fbc?: string; // Meta click identifier (_fbc or formatted from fbclid)
  clientIp?: string;
  userAgent?: string;
  referrer?: string;
  landingPath?: string;
  googleClientId?: string;
  gpc?: boolean; // Global Privacy Control signal detected
  optOut?: boolean; // User opted out of marketing tracking
  capturedAt?: number;
}

export interface DocumentIntegrityEvidence {
  schemaVersion: 1;
  algorithm: 'sha256';
  digest: string;
  lockedAt: number;
  signatureAdoption: {
    signerName: string;
    adoptedAt: number;
    affirmationVersion: string;
  };
}

export interface Order {
  /** v2 orders are deterministic DocketStamp notice orders; absent means pre-migration history. */
  schemaVersion?: 2;
  kind?: "notice";
  noticeVersion?: number;
  id: string;
  stripePaymentId?: string;
  customerEmail: string;
  userId?: string;
  docketId?: string;
  docketNumber?: string;
  noticeId?: string;
  noticeType?: string;
  serviceLevel?: "FIRST_CLASS" | "CERTIFIED" | "CERTIFIED_RETURN_RECEIPT";
  lobLetterId?: string;
  /** Explicit provider identity for a postal reference. Legacy aliases are never inferred as Lob. */
  postalProvider?: "lob" | "handwrytten" | "unknown";
  postalProviderReference?: string;
  lobStatus?: string;
  lobTrackingNumber?: string;
  lobTrackingUrl?: string;
  expectedDeliveryDate?: string;
  lobExpectedDeliveryDate?: string;
  lobMailedDate?: string;
  lobTrackingEvents?: any[];
  returnReceiptUrl?: string;
  documentHtml?: string;
  documentIntegrityEvidence?: DocumentIntegrityEvidence;
  frontImageUrl?: string;
  printedMessage?: string;
  handwrittenNote?: string;
  fontStyleId?: string;
  recipientAddress: MailingAddress;
  returnAddress: MailingAddress;
  status: OrderStatus;
  handwryttenOrderId?: string;
  handwryttenStatus?: string; // e.g. "writing", "mailed", "processing"
  handwryttenTrackingNumber?: string;
  handwryttenTrackingUrl?: string;
  handwryttenMailedDate?: string;
  fulfillmentError?: string;
  scheduledSendDate?: string; // YYYY-MM-DD if scheduled
  dispatchStartedAt?: number;
  amountInCents: number;
  originalAmountInCents?: number;
  discountCode?: string;
  discountAmountInCents?: number;
  paymentMethod?: "STRIPE" | "PROMO_CODE" | "STUDIO_COMP";
  attribution?: OrderAttribution;
  metaCapiTrackedAt?: number; // Timestamp when Meta Conversions API purchase was dispatched
  recipientOccasion?: RecipientOccasion;
  viewToken?: string;
  isRedacted?: boolean;
  isTest?: boolean;
  isComp?: boolean;
  isFounderTest?: boolean;
  paymentMode?: "live" | "stripe_test" | "local_mock";
  finalAmountInCents?: number;
  experienceVersion?: string;
  sessionId?: string;
  entrySource?: string;
  telemetrySessionId?: string;
  createdAt: number;
  updatedAt: number;
}

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface DiscountCode {
  id: string; // Uppercase code (e.g. "WELCOME10")
  code: string; // Uppercase code
  type: DiscountType;
  value: number; // Percentage (e.g. 20 for 20%) or Fixed Cents (e.g. 200 for $2.00, 900 for $9.00)
  description?: string;
  isActive: boolean;
  maxUses?: number | null; // null or undefined means unlimited
  usedCount: number;
  totalDiscountGivenCents: number; // cumulative savings in cents
  expiresAt?: number | null; // timestamp ms, null = never expires
  createdAt: number;
  updatedAt: number;
}

export interface SystemIncident {
  id: string;
  type: "STRIPE" | "IMAGE_GEN" | "HANDWRYTTEN" | "WEBHOOK" | "SYSTEM" | "SECURITY";
  category?: "OPERATOR_ACTION" | "STUDIO_BILLING" | "CUSTOMER_RECOVERED" | "TRANSIENT";
  severity: "error" | "warning" | "info";
  summary: string;
  technicalDetails?: string;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: number;
  resolutionNote?: string;
  createdAt: number;
}

export type ImageCacheStatus = "AVAILABLE" | "RESERVED" | "CLAIMED";

export interface ImageCachePoolItem {
  id: string;
  occasion: string;
  prompt: string;
  imageUrl: string;
  status: ImageCacheStatus;
  reservedAt?: number;
  createdAt: number;
  provider?: string;
  model?: string;
  isGenerated?: boolean;
}

export interface HandwryttenAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface HandwryttenOrderParams {
  orderId?: string; // Internal order ID for idempotency & deduplication
  imageUrl: string;
  printedGreeting?: string;
  handwrittenMessage: string;
  fontId: string;
  recipient: MailingAddress;
  returnAddress: MailingAddress;
  scheduledSendDate?: string; // YYYY-MM-DD
}

export interface HandwryttenOrderResult {
  success: boolean;
  order_id?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface FontOption {
  id: string;
  name: string;
  sample: string;
  fontClass: string;
  description: string;
  handwryttenFontId: string;
  handwryttenFontLabel?: string;
}

// User Accounts Model
export interface UserAccount {
  uid: string;
  email: string;
  displayName?: string;
  savedAddresses: SavedAddress[];
  defaultReturnAddress?: MailingAddress;
  savedCovers: string[];
  creditsBalance: number;
  createdAt: number;
  updatedAt: number;
}

// Customer Journey Telemetry
export type TelemetryEventName =
  | "session_start"
  | "agent_url_prefilled"
  | "scenario_landing_viewed"
  | "scenario_customized"
  | "cover_preset_selected"
  | "ai_generate_started"
  | "ai_generate_succeeded"
  | "ai_generate_rate_limited"
  | "step_navigated"
  | "inside_note_edited"
  | "inspiration_applied"
  | "note_shuffled"
  | "font_style_selected"
  | "address_completed"
  | "checkout_initiated"
  | "payment_attempted"
  | "payment_succeeded"
  | "payment_failed"
  | "card_abandoned"
  // Source plan §10 additions:
  | "landing_viewed"
  | "builder_started"
  | "card_completed"
  | "custom_generation_requested"
  | "custom_generation_completed"
  | "custom_generation_failed"
  | "note_completed"
  | "payment_viewed"
  | "wallet_availability_observed"
  | "payment_canceled"
  | "reminder_opt_in"
  // Server-only authority events (§10):
  | "purchase_verified"
  | "fulfillment_submitted"
  | "fulfillment_failed"
  // DocketStamp v2 Funnel Events (Sprint S6):
  | "landing_view"
  | "product_select"
  | "letter_select"
  | "editor_start"
  | "editor_complete"
  | "checkout_view"
  | "payment_submitted"
  | "order_paid_confirmed"
  | "order_fulfilled";

export type VisitorTelemetryEventType = TelemetryEventName;

export type EntrySource =
  | "home_chooser"
  | "companies_directory"
  | "recipient_prefill"
  | "staged_draft"
  | "direct_notice"
  | "unknown";

export interface TelemetryEvent {
  id: string;
  eventName: TelemetryEventName;
  sessionId: string;
  step?: number;
  orderId?: string;
  metadata?: Record<string, unknown>;
  path: string;
  timestamp: number;
  createdAt: number;
  // Common context (§10 & S6)
  experienceVersion?: string;
  draftRevision?: number;
  entrySource?: EntrySource | string;
  noticeSlug?: string;
  recipientId?: string;
  tier?: string;
  deviceCategory?: "mobile" | "tablet" | "desktop";
  dedupeKey?: string;
  // Enriched visitor attribution & tech telemetry
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
  landingPath?: string;
  googleClientId?: string; // from _ga cookie
  deviceType?: "mobile" | "tablet" | "desktop";
  screenResolution?: string;
  ipCity?: string;
  ipRegion?: string;
  ipCountry?: string;
  userAgent?: string;
  isBot?: boolean;
}

export type VisitorEvent = TelemetryEvent;

// Programmatic SEO Scenario Types
export interface ScenarioEtiquetteTip {
  title: string;
  content: string;
}

export interface ScenarioFaqItem {
  question: string;
  answer: string;
}

export interface ScenarioConfig {
  slug: string; // e.g. "after-job-interview"
  aliases?: string[]; // e.g. ["loss-of-pet", "pet-loss"]
  occasionSlug: string; // e.g. "thank-you"
  occasionName: string; // e.g. "Thank You"
  category: "career" | "milestone" | "sympathy" | "gratitude" | "support";
  badgeText: string;
  h1Title: string;
  heroTagline: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  coverUrl: string;
  coverPrompt: string;
  printedGreeting: string;
  handwrittenNote: string;
  fontStyleId: string;
  fontName: string;
  etiquetteTips: ScenarioEtiquetteTip[];
  faq: ScenarioFaqItem[];
}

export interface ScenarioPerformanceMetric {
  slug: string;
  occasionSlug: string;
  path: string;
  title: string;
  category: string;
  views: number;
  customizations: number;
  checkouts: number;
  paidOrders: number;
  conversionRate: number; // e.g. 7.5 (%)
  primaryDropoffStep: string;
  status: "top_performer" | "healthy" | "needs_attention" | "gathering_data";
  actionableInsight: string;
}

export interface FinancialMargins {
  grossRevenueCents: number;
  stripeFeesCents: number;
  fulfillmentCogsCents: number;
  netContributionMarginCents: number;
  netContributionMarginPercent: number | null;
  paidCardsCount: number;
  averageOrderRevenueCents: number;
  averageStripeFeeCents: number;
  averageFulfillmentCogsCents: number;
  averageNetContributionCents: number; // break-even target CPA
  targetBreakevenCpaDollars: number;
  economicsAuthority?: "estimated_legacy_unverified" | "verified_ledger";
}

export interface AdminReportingQuality {
  status: "legacy_interim_unverified";
  funnelAuthority: "session_telemetry_only_no_synthetic_backfill";
  economicsAuthority: "estimated_pending_provider_fee_cogs_ledger";
  healthAuthority: "configuration_only_no_live_probe";
  hasVerifiedRevenue: boolean;
  hasObservedSessions: boolean;
  unmatchedPaidOrdersCount: number;
  notes: string[];
}

export interface CampaignAttributionMetric {
  campaignKey: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  hasGclid: boolean;
  orderCount: number;
  grossRevenueCents: number;
  netContributionMarginCents: number;
  lastOrderAt?: number;
}

export interface ValuationHeuristicAssumptions {
  annualCardsPerCustomer: number; // default: 3.0
  customerLifespanYears: number; // default: 2.5
  addressBookAdoptionRate: number; // default: 0.40 (40%)
  addressBookOrderMultiplier: number; // default: 1.8 (1.8x boost)
  valuationMultipleSde: number; // default: 3.5x
  valuationMultipleRevenue: number; // default: 1.5x
  monthlyFixedOverheadDollars: number; // default: 25.0
  targetActiveCustomers: number; // default: 500
}

export interface ValuationHeuristicOutputs {
  modeledLifetimeOrders: number;
  modeledLifetimeRevenue: number;
  modeledLtvGrossMargin: number; // Customer LTV
  blendedCac: number;
  ltvToCacRatio: number;
  cacPaybackCards: number;
  cacPaybackMonths: number;
  annualizedCustomerValue: number;
  annualRunRateRevenue: number;
  annualRunRateContribution: number;
  annualFixedOverhead: number;
  annualNetProfitSde: number;
  estimatedValuationSde: number;
  estimatedValuationRevenue: number;
  estimatedCustomerEquity: number;
  blendedValuationEstimate: number;
}

export interface VisitorSessionRecord {
  sessionId: string;
  firstSeenAt: number;
  lastSeenAt: number;
  highestStep: number; // 1: Cover, 2: Note, 3: Address, 4: Checkout, 5: Paid
  highestStepName: string;
  dropOffStep?: string;
  completed: boolean;
  orderId?: string;
  source: string;
  medium: string;
  campaign?: string;
  gclid?: string;
  fbclid?: string;
  deviceType: "mobile" | "tablet" | "desktop";
  screenResolution?: string;
  city?: string;
  region?: string;
  country?: string;
  landingPath?: string;
  googleClientId?: string;
  userAgent?: string;
  isBot?: boolean;
}

export interface FunnelStepLeak {
  stepNumber: number;
  stepName: string;
  visitors: number;
  conversionFromPrior: number; // percentage (100% for step 1)
  leakToNext: number; // percentage that dropped out before next step
}

export interface AcquisitionSourceMetric {
  sourceKey: string;
  source: string;
  medium: string;
  campaign?: string;
  sessions: number;
  completedOrders: number;
  conversionRate: number; // percentage
  topDropOffStep: string;
}

export interface VisitorTelemetryMetrics {
  totalVisitors: number;
  humanVisitors: number;
  botVisitors: number;
  funnelLeaks: FunnelStepLeak[];
  acquisitionSources: AcquisitionSourceMetric[];
  deviceBreakdown: {
    mobile: number;
    desktop: number;
    tablet: number;
    mobilePercent: number;
    desktopPercent: number;
    tabletPercent: number;
  };
  topLocations: { city: string; region?: string; country?: string; count: number }[];
  recentSessions: VisitorSessionRecord[];
}

// Admin Dashboard Analytics
export interface AdminMetrics {
  totalRevenueCents: number;
  totalOrders: number;
  ordersByStatus: {
    pending: number;
    processing: number;
    failed: number;
  };
  funnel: {
    totalSessions: number;
    coverSelected: number;
    noteCompleted: number;
    addressCompleted: number;
    checkoutInitiated: number;
    paid: number;
  };
  visitorTelemetry?: VisitorTelemetryMetrics;
  fontPopularity?: { fontId: string; fontName: string; count: number; percentage: number }[];
  occasionPopularity?: { occasion: string; count: number; percentage: number }[];
  margins?: FinancialMargins;
  campaignAttributions?: CampaignAttributionMetric[];
  adSpendCents?: number;
  valuationAssumptions?: ValuationHeuristicAssumptions;
  reportingQuality?: AdminReportingQuality;
  recentOrders: Order[];
}

export interface FeatureFlagsMap {
  reworkV3Experience: boolean;
  [key: string]: boolean;
}

export interface FeatureFlagsState {
  flags: FeatureFlagsMap;
  updatedAt?: number;
  updatedBy?: string;
}
