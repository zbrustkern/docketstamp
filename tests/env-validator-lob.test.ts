import assert from "node:assert/strict";
import { validateEnvironment } from "../lib/env-validator";

const keys = ["LOB_API_KEY", "lob-api-key", "DOCKET_STAMP_SUPPLIER_API_KEY", "LOB_DISPATCH_API_KEY", "LOB_ADDRESS_VERIFICATION_KEY"];
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
try {
  for (const key of keys) delete process.env[key];
  process.env.LOB_API_KEY = "old-shared-key";
  assert.equal(validateEnvironment().lobConfigured, false, "old shared credential cannot imply Lob dispatch readiness");
  process.env.LOB_ADDRESS_VERIFICATION_KEY = "address-only";
  assert.equal(validateEnvironment().lobConfigured, false, "address verification key does not imply dispatch readiness");
  assert.equal(validateEnvironment().lobAddressVerificationConfigured, true);
  process.env.LOB_DISPATCH_API_KEY = "dispatch-only";
  assert.equal(validateEnvironment().lobConfigured, true);
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
console.log("Lob split-key readiness checks passed.");
