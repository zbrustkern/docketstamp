import assert from "node:assert/strict";
import {
  generateAdminSessionToken,
  getAdminSecret,
  getAdminSessionSigningKey,
  isValidAdminSessionToken,
} from "../../lib/admin-auth";
import {
  dispatchDocketLetter,
  getLobDispatchApiKey,
  getLobVerificationApiKey,
  resolveLobDispatchMode,
  verifyUsAddress,
} from "../../src/lib/fulfillment/lob";

async function run() {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;

  try {
    // The suite is offline by construction and only uses explicitly fake keys.
    globalThis.fetch = async () => {
      providerCalls++;
      return new Response(JSON.stringify({ error: { message: "offline stub" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    };

    delete process.env.ADMIN_SECRET_KEY;
    delete process.env.ADMIN_SESSION_SIGNING_KEY;
    delete process.env["admin-secret-key"];
    assert.equal(getAdminSecret(), null);
    assert.equal(getAdminSessionSigningKey(), null);
    assert.throws(() => generateAdminSessionToken(), /not configured/);
    for (const fallback of [
      "ds_dev_admin_2026",
      "ds_staging_admin_2026",
      "smn_internal_admin_session_key_2026",
    ]) {
      process.env.ADMIN_SECRET_KEY = fallback;
      process.env.ADMIN_SESSION_SIGNING_KEY = fallback;
      assert.equal(getAdminSecret(), null, `${fallback} must not become an admin secret`);
      assert.equal(getAdminSessionSigningKey(), null, `${fallback} must not sign sessions`);
    }

    process.env.ADMIN_SESSION_SIGNING_KEY = "test_only_security_suite_signing_key_2026";
    const v2Token = generateAdminSessionToken();
    assert.equal(isValidAdminSessionToken(v2Token), true);
    assert.equal(isValidAdminSessionToken("smn_admin_1234567890abcdef"), false);

    // Generic legacy keys must not bridge the separate verification and dispatch credentials.
    process.env.LOB_API_KEY = "test_legacy_shared_key";
    delete process.env.LOB_ADDRESS_VERIFICATION_KEY;
    delete process.env.LOB_DISPATCH_API_KEY;
    assert.equal(getLobVerificationApiKey(), "");
    assert.equal(getLobDispatchApiKey(), "");

    // The explicit staging CASS mode always returns deterministic local validation
    // and never makes a provider request, even if live Stripe/Lob credentials exist.
    process.env.LOB_ENV = "staging_mock_cass";
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.STRIPE_SECRET_KEY = "sk_live_security_suite_fake";
    process.env.LOB_ADDRESS_VERIFICATION_KEY = "live_fake_address_key";
    process.env.LOB_DISPATCH_API_KEY = "live_fake_dispatch_key";
    assert.equal(resolveLobDispatchMode(), "unconfigured");
    const address = await verifyUsAddress({
      name: "Jane Doe",
      address_line1: "100 Main St",
      address_city: "Austin",
      address_state: "TX",
      address_zip: "78701",
    });
    assert.equal(address.valid, true);
    assert.equal(address.dpv_confirmation, "Y");
    assert.equal(providerCalls, 0, "staging_mock_cass address check must not call Lob");

    const dispatchParams = {
      orderId: "security-suite-order",
      docketId: "DS-TEST-0001",
      description: "Offline safety check",
      to: {
        name: "Jane Doe",
        address_line1: "100 Main St",
        address_city: "Austin",
        address_state: "TX",
        address_zip: "78701",
      },
      from: {
        name: "DocketStamp",
        address_line1: "1 Main St",
        address_city: "Austin",
        address_state: "TX",
        address_zip: "78701",
      },
      file: "<html><body>Offline</body></html>",
      tier: "first_class" as const,
    };
    const liveDispatch = await dispatchDocketLetter(dispatchParams);
    assert.equal(liveDispatch.success, false);
    assert.equal(liveDispatch.mode, "unconfigured");
    assert.equal(providerCalls, 0, "staging_mock_cass must not reach live dispatch");

    // A production process with invalid Stripe configuration must not downgrade
    // to local mock dispatch just because resolvePaymentMode throws.
    process.env.LOB_ENV = "production";
    process.env.STRIPE_SECRET_KEY = "invalid_stripe_configuration";
    process.env.LOB_DISPATCH_API_KEY = "test_fake_dispatch_key";
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal(resolveLobDispatchMode(), "unconfigured");
    const rejectedProductionTestKey = await dispatchDocketLetter(dispatchParams);
    assert.equal(rejectedProductionTestKey.success, false);
    assert.equal(rejectedProductionTestKey.mode, "unconfigured");
    assert.equal(providerCalls, 0);

    // A valid staging/test combination may call only the mocked Lob test endpoint.
    process.env.LOB_ENV = "staging";
    Object.assign(process.env, { NODE_ENV: "test" });
    process.env.STRIPE_SECRET_KEY = "sk_test_security_suite_fake";
    process.env.LOB_DISPATCH_API_KEY = "test_fake_dispatch_key";
    assert.equal(resolveLobDispatchMode(), "test_api");
    const failedTestDispatch = await dispatchDocketLetter(dispatchParams);
    assert.equal(failedTestDispatch.success, false);
    assert.equal(failedTestDispatch.mode, "test_api");
    assert.equal(failedTestDispatch.isSimulatedMock, false);
    assert.equal(providerCalls, 1, "test_api failure must not retry as simulated success");

    console.log("S0 auth and Lob mode safeguards passed (provider calls were stubbed offline).");
  } finally {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
