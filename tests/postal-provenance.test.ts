import assert from "node:assert/strict";
import { resolvePostalProvenance } from "../lib/admin/postal-reference";

assert.deepEqual(resolvePostalProvenance({ handwryttenOrderId: "hw_legacy_123" }), {
  provider: "handwrytten", reference: "hw_legacy_123", evidence: "legacy_field",
});
assert.deepEqual(resolvePostalProvenance({ lobLetterId: "lob_123" }), {
  provider: "lob", reference: "lob_123", evidence: "legacy_field",
});
assert.equal(resolvePostalProvenance({ handwryttenOrderId: "hw_123" }).provider, "handwrytten");
assert.equal(resolvePostalProvenance({ lobLetterId: "lob_123", handwryttenOrderId: "hw_123" }).provider, "unknown");
assert.equal(resolvePostalProvenance({ postalProvider: "lob", postalProviderReference: "canonical_lob" }).reference, "canonical_lob");
assert.equal(resolvePostalProvenance({ postalProvider: "lob", postalProviderReference: "canonical_lob", lobLetterId: "legacy_conflict" }).provider, "unknown");
assert.equal(resolvePostalProvenance({}).evidence, "missing");
console.log("Postal provider provenance and conflict checks passed.");
