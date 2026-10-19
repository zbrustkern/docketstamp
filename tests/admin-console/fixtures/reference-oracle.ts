/** Synthetic, credential-free oracle. IDs and values are deliberately non-customer data. */
export const referenceScenarios = [
  { id: "customer-repeat-session", classification: "customer", environment: "production", paymentMode: "live", sessionId: "sess-customer-a", journeyId: "journey-a", entry: "direct", tier: "first_class", orderId: "ord-customer-a1", capturedMinor: 1295, currency: "USD", postal: "uncertain", age: "current", paid: true },
  { id: "customer-repeat-session-2", classification: "customer", environment: "production", paymentMode: "live", sessionId: "sess-customer-a", journeyId: "journey-a", entry: "direct", tier: "certified", orderId: "ord-customer-a2", capturedMinor: 1995, currency: "USD", postal: "delivered", age: "current", paid: true },
  { id: "independent-customer", classification: "customer", environment: "production", paymentMode: "live", sessionId: "sess-customer-b", journeyId: "journey-b", entry: "campaign", tier: "certified_return_receipt", orderId: "ord-customer-b1", capturedMinor: 2795, currency: "USD", postal: "returned", age: "current", paid: true },
  { id: "founder-live-test", classification: "founder", environment: "production", paymentMode: "live", sessionId: "sess-founder", journeyId: "journey-founder", entry: "direct", tier: "first_class", orderId: "ord-founder", capturedMinor: 1295, currency: "USD", postal: "accepted_by_lob", age: "current", paid: true },
  { id: "employee-order", classification: "employee", environment: "production", paymentMode: "live", sessionId: "sess-employee", journeyId: "journey-employee", entry: "direct", tier: "certified", orderId: "ord-employee", capturedMinor: 1995, currency: "USD", postal: "failed", age: "current", paid: true },
  { id: "automated-test-order", classification: "automated_test", environment: "staging", paymentMode: "test", sessionId: "sess-test", journeyId: "journey-test", entry: "staging", tier: "certified_return_receipt", orderId: "ord-test", capturedMinor: 2795, currency: "USD", postal: "accepted_by_lob", age: "current", paid: true },
  { id: "suspected-bot-session", classification: "suspected_bot", environment: "production", paymentMode: "unknown", sessionId: "sess-bot", journeyId: "journey-bot", entry: "campaign", tier: "first_class", orderId: "ord-bot", capturedMinor: 1295, currency: "USD", postal: "unmapped", age: "current", paid: true },
  { id: "unresolved-order", classification: "unresolved", environment: "production", paymentMode: "live", sessionId: null, journeyId: null, entry: "unknown", tier: "certified", orderId: "ord-unresolved", capturedMinor: 1995, currency: "USD", postal: "uncertain", age: "current", paid: true },
  { id: "free-promo-order", classification: "free_promo", environment: "production", paymentMode: "mock", sessionId: "sess-free", journeyId: "journey-free", entry: "offer", tier: "first_class", orderId: "ord-free", capturedMinor: 0, currency: "USD", postal: "queued", age: "current", paid: false },
  { id: "authorized-comp-order", classification: "comp", environment: "production", paymentMode: "mock", sessionId: "sess-comp", journeyId: "journey-comp", entry: "operator", tier: "certified_return_receipt", orderId: "ord-comp", capturedMinor: 0, currency: "USD", postal: "authorized", age: "current", paid: false },
  { id: "direct-entry-no-join", classification: "unresolved", environment: "production", paymentMode: "unknown", sessionId: "sess-missing-join", journeyId: null, entry: "direct", tier: null, orderId: null, capturedMinor: null, currency: null, postal: null, age: "current", paid: false },
  { id: "staged-entry-no-join", classification: "unresolved", environment: "staging", paymentMode: "test", sessionId: "sess-staging-unjoined", journeyId: null, entry: "staging", tier: null, orderId: null, capturedMinor: null, currency: null, postal: null, age: "current", paid: false },
  { id: "stale-evidence", classification: "customer", environment: "production", paymentMode: "live", sessionId: "sess-stale", journeyId: "journey-stale", entry: "campaign", tier: null, orderId: null, capturedMinor: null, currency: null, postal: null, age: "stale", paid: false },
] as const;

export const expectedOracle = {
  classifications: ["customer", "founder", "employee", "automated_test", "comp", "free_promo", "suspected_bot", "unresolved"],
  tierRetailMinor: { first_class: 1295, certified: 1995, certified_return_receipt: 2795 },
  customerLiveVerifiedPaidOrders: 3,
  customerLiveVerifiedCapturedMinorByCurrency: { USD: 6085 },
  customerPaidSessionsWithAtLeastOneOrder: 2,
  customerEligibleSessionsWithEntry: 3,
  paidOrderCountsByTier: { first_class: 1, certified: 1, certified_return_receipt: 1 },
  paidOrderCountIncludesUncertainOrReturnedPostal: true,
  freeAndCompPaidOrderCount: 0,
  internalOrUnknownLiveCaptureOrders: 3,
  conversionsMustNotBeSynthetic: true,
  staleEvidenceMustNotBeReportedFresh: true,
} as const;
