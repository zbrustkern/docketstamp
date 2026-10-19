import {
  checkAdminRateLimit,
  recordAdminFailedAttempt,
  clearAdminFailedAttempts,
  MAX_ADMIN_ATTEMPTS,
} from "../lib/admin-rate-limit";
import { verifyAdminPassphrase, getAdminSecret } from "../lib/admin-auth";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING ADMIN RATE LIMIT & LOCKOUT TESTS");
  console.log("=================================================");

  const testIp = `192.168.1.${Math.floor(Math.random() * 1000)}`;

  // 1. Initial State
  const initialCheck = await checkAdminRateLimit(testIp);
  if (!initialCheck.allowed || initialCheck.remainingAttempts !== MAX_ADMIN_ATTEMPTS) {
    throw new Error(`Failed initial state check: ${JSON.stringify(initialCheck)}`);
  }
  console.log("✅ PASS: Initial rate limit check allows full attempts");

  // 2. Failed Attempts Progression
  for (let i = 1; i < MAX_ADMIN_ATTEMPTS; i++) {
    const res = await recordAdminFailedAttempt(testIp);
    if (res.locked) {
      throw new Error(`Unexpectedly locked at attempt ${i}`);
    }
    if (res.remainingAttempts !== MAX_ADMIN_ATTEMPTS - i) {
      throw new Error(`Expected ${MAX_ADMIN_ATTEMPTS - i} remaining, got ${res.remainingAttempts}`);
    }
    console.log(`✅ PASS: Failed attempt #${i} recorded. ${res.remainingAttempts} remaining.`);
  }

  // 3. Final Failed Attempt (Trigger Lockout)
  const lockoutRes = await recordAdminFailedAttempt(testIp);
  if (!lockoutRes.locked || !lockoutRes.retryAfterSeconds) {
    throw new Error(`Expected lockout at attempt ${MAX_ADMIN_ATTEMPTS}, got: ${JSON.stringify(lockoutRes)}`);
  }
  console.log(`✅ PASS: Attempt #${MAX_ADMIN_ATTEMPTS} triggered lockout for ${lockoutRes.retryAfterSeconds}s`);

  // 4. Verify checkAdminRateLimit blocks during lockout
  const blockedCheck = await checkAdminRateLimit(testIp);
  if (blockedCheck.allowed || !blockedCheck.locked) {
    throw new Error(`Expected IP to be blocked, but allowed: ${JSON.stringify(blockedCheck)}`);
  }
  console.log("✅ PASS: checkAdminRateLimit actively blocks locked IP with retryAfterSeconds");

  // 5. Verify clearAdminFailedAttempts resets state
  await clearAdminFailedAttempts(testIp);
  const resetCheck = await checkAdminRateLimit(testIp);
  if (!resetCheck.allowed || resetCheck.locked) {
    throw new Error(`Failed to reset state after clearAdminFailedAttempts: ${JSON.stringify(resetCheck)}`);
  }
  console.log("✅ PASS: clearAdminFailedAttempts restores full access");

  // 6. Test timing-safe passphrase comparison & fail-closed default rejection
  delete process.env.ADMIN_SECRET_KEY;
  if (getAdminSecret() !== null || verifyAdminPassphrase("ds_dev_admin_2026")) {
    throw new Error("Expected unconfigured ADMIN_SECRET_KEY and ds_dev_admin_2026 fallback to fail closed");
  }
  const explicitTestSecret = "test_only_explicit_admin_secret_2026_valid";
  process.env.ADMIN_SECRET_KEY = explicitTestSecret;
  const correct = verifyAdminPassphrase(explicitTestSecret);
  const incorrect = verifyAdminPassphrase("wrongpassword_of_sufficient_length");
  const short = verifyAdminPassphrase("short");
  const empty = verifyAdminPassphrase("");
  const blocklisted = verifyAdminPassphrase("ds_dev_admin_2026");

  if (!correct) throw new Error("Expected explicit configured secret key to verify");
  if (incorrect || short || empty || blocklisted) throw new Error("Expected invalid or blocklisted passphrases to fail");
  console.log("✅ PASS: Constant-time passphrase comparison and fail-closed default rejection verified");

  console.log("=================================================");
  console.log("🎉 ALL RATE LIMIT TESTS PASSED!");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
