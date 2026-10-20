import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getOrderHistoryPresentation } from "../../lib/account/order-history";
import type { Order } from "../../lib/types";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-legacy-1",
    customerEmail: "person@example.com",
    amountInCents: 2500,
    status: "MAILED",
    recipientAddress: { firstName: "A", lastName: "B", street1: "1 Main", city: "Madison", state: "WI", zip: "53703" },
    returnAddress: { firstName: "C", lastName: "D", street1: "2 Oak", city: "Madison", state: "WI", zip: "53703" },
    ...overrides,
  };
}

describe("order history presentation", () => {
  it("keeps ambiguous legacy provider references unknown and avoids cross-provider tracking", () => {
    const history = getOrderHistoryPresentation(order({ lobLetterId: "lob-123", handwryttenOrderId: "hw-456", lobTrackingUrl: "https://track.lob.com/lob-123", handwryttenTrackingUrl: "https://track.example/hw-456" }));
    assert.equal(history.recordKind, "Historical order record");
    assert.equal(history.postal.provider, "unknown");
    assert.equal(history.postal.evidence, "conflict");
    assert.equal(history.providerLabel, "Postal provider unclear (conflicting references)");
    assert.equal(history.trackingUrl, undefined);
    assert.equal(history.statusLabel, "Mailed status recorded");
    assert.equal(history.docketReference, "Not available");
    assert.equal(history.serviceLevel, "Not available");
  });

  it("labels an explicit legacy Handwrytten record and exposes only its own tracking data", () => {
    const history = getOrderHistoryPresentation(order({
      status: "IN_TRANSIT",
      handwryttenOrderId: "hw-456",
      handwryttenStatus: "in_transit",
      handwryttenTrackingNumber: "track-hw",
      handwryttenTrackingUrl: "https://track.example/hw-456",
      lobTrackingNumber: "must-not-leak",
      lobTrackingUrl: "https://track.lob.com/wrong",
    }));
    assert.equal(history.postal.provider, "handwrytten");
    assert.equal(history.providerLabel, "Historical Handwrytten record");
    assert.equal(history.providerStatus, "in_transit");
    assert.equal(history.trackingNumber, "track-hw");
    assert.equal(history.trackingUrl, "https://track.example/hw-456");
    assert.equal(history.statusLabel, "In-transit status recorded");
  });

  it("does not call unsafe tracking URLs or fabricate docket and service evidence", () => {
    const history = getOrderHistoryPresentation(order({ handwryttenOrderId: "hw-1", handwryttenTrackingUrl: "javascript:alert(1)" }));
    assert.equal(history.trackingUrl, undefined);
    assert.equal(history.docketReference, "Not available");
    assert.equal(history.serviceLevel, "Not available");
  });

  it("uses canonical notice metadata only when present", () => {
    const history = getOrderHistoryPresentation(order({ schemaVersion: 2, kind: "notice", postalProvider: "lob", postalProviderReference: "lob-canonical", lobLetterId: "lob-canonical", docketId: "DS-123", serviceLevel: "CERTIFIED" }));
    assert.equal(history.recordKind, "DocketStamp notice record");
    assert.equal(history.postal.provider, "lob");
    assert.equal(history.postal.reference, "lob-canonical");
    assert.equal(history.docketReference, "DS-123");
    assert.equal(history.serviceLevel, "CERTIFIED");
  });
});
