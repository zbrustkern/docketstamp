import assert from "node:assert/strict";
import test from "node:test";
import { computeOrderSnapshotHash } from "../lib/admin-console/finance/authority";
import type { Order } from "../lib/types";

const address = {
  firstName: "Alex", lastName: "Example", street1: "100 Main St",
  city: "Chicago", state: "IL", zip: "60601",
};

function fixture(overrides: Record<string, unknown> = {}): Order {
  return {
    id: "snapshot-evidence-fixture",
    customerEmail: "alex@example.test",
    noticeId: "consumer-rights",
    noticeType: "consumer-rights",
    serviceLevel: "CERTIFIED",
    recipientAddress: { ...address },
    returnAddress: { ...address },
    documentHtml: "<html>Frozen notice</html>",
    documentIntegrityEvidence: {
      schemaVersion: 1,
      algorithm: "sha256",
      digest: "a".repeat(64),
      lockedAt: 100,
      signatureAdoption: {
        signerName: "Alex Example",
        adoptedAt: 99,
        affirmationVersion: "self-represented-mail-dispatch-v1",
      },
    },
    status: "PENDING_PAYMENT",
    amountInCents: 1200,
    finalAmountInCents: 1200,
    ...overrides,
  } as unknown as Order;
}

test("canonical notice payment hashes bind signature adoption evidence", () => {
  const canonical = fixture({ schemaVersion: 2, kind: "notice" });
  const original = computeOrderSnapshotHash(canonical);
  const evidence = canonical.documentIntegrityEvidence!;

  for (const changedEvidence of [
    { ...evidence, signatureAdoption: { ...evidence.signatureAdoption, signerName: "Different signer" } },
    { ...evidence, signatureAdoption: { ...evidence.signatureAdoption, adoptedAt: 101 } },
    { ...evidence, signatureAdoption: { ...evidence.signatureAdoption, affirmationVersion: "different-version" } },
  ]) {
    assert.notEqual(
      computeOrderSnapshotHash({ ...canonical, documentIntegrityEvidence: changedEvidence }),
      original,
    );
  }
});

test("markerless historical snapshot hashes retain the prior hash shape", () => {
  const historical = fixture();
  const withoutEvidence = { ...historical, documentIntegrityEvidence: undefined };
  assert.equal(computeOrderSnapshotHash(historical), computeOrderSnapshotHash(withoutEvidence));
});
