export type PaymentMode = "live" | "stripe_test" | "local_mock";

export class PaymentModeConfigError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 503, code = "PAYMENT_GATEWAY_UNCONFIGURED") {
    super(message);
    this.name = "PaymentModeConfigError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Resolves the server-side payment mode based strictly on server environment variables.
 * Client payloads, headers, or flags CANNOT determine or influence this mode.
 *
 * Rules:
 * 1. In production (NODE_ENV === "production"):
 *    - 'local_mock' is strictly prohibited and impossible.
 *    - Secret key MUST start with "sk_live_".
 *    - Missing, placeholder ("sk_test_placeholder..."), or test keys ("sk_test_...") in production
 *      throw PaymentModeConfigError (503).
 *    - Mode is "live".
 *
 * 2. In non-production environments (development, test):
 *    - If secret key starts with "sk_live_": mode is "live".
 *    - If secret key starts with "sk_test_" and is not a placeholder: mode is "stripe_test".
 *    - If ALLOW_LOCAL_MOCK_PAYMENTS === "true" or "1": mode is "local_mock".
 *    - Otherwise (missing/placeholder key without explicit opt-in): throws PaymentModeConfigError (503).
 */
export function resolvePaymentMode(
  env: Record<string, string | undefined> = process.env
): PaymentMode {
  const isProduction = env.NODE_ENV === "production";
  const rawSecret =
    env["stripe-secret-key"] ||
    env.STRIPE_SECRET_KEY ||
    "";
  const secret = rawSecret.trim();

  const allowLocalMock =
    env.ALLOW_LOCAL_MOCK_PAYMENTS === "true" ||
    env.ALLOW_LOCAL_MOCK_PAYMENTS === "1";

  if (isProduction) {
    if (!secret || secret.startsWith("sk_test_placeholder")) {
      throw new PaymentModeConfigError(
        "Stripe live secret key is missing or is a placeholder in production.",
        503,
        "PRODUCTION_STRIPE_KEY_MISSING"
      );
    }

    if (secret.startsWith("sk_test_")) {
      throw new PaymentModeConfigError(
        "Stripe test key configured in production environment.",
        503,
        "PRODUCTION_STRIPE_TEST_KEY_FORBIDDEN"
      );
    }

    if (secret.startsWith("sk_live_")) {
      return "live";
    }

    throw new PaymentModeConfigError(
      "Invalid Stripe live secret key configured in production.",
      503,
      "PRODUCTION_STRIPE_KEY_INVALID"
    );
  }

  // Non-production environment
  if (secret.startsWith("sk_live_")) {
    return "live";
  }

  if (secret.startsWith("sk_test_") && !secret.startsWith("sk_test_placeholder")) {
    return "stripe_test";
  }

  if (allowLocalMock) {
    return "local_mock";
  }

  throw new PaymentModeConfigError(
    "Stripe secret key is missing or unconfigured. To enable simulated checkout in local development or testing, set ALLOW_LOCAL_MOCK_PAYMENTS=true.",
    503,
    "STRIPE_UNCONFIGURED_MOCK_DISABLED"
  );
}

export function isLocalMockAllowed(
  env: Record<string, string | undefined> = process.env
): boolean {
  try {
    return resolvePaymentMode(env) === "local_mock";
  } catch {
    return false;
  }
}

/**
 * Pure decision function: determines if checkout transition can advance to payment step.
 * On init failure, caller MUST stay on the current step with an error and Retry.
 */
export function evaluateCheckoutInitTransition(initSucceeded: boolean): {
  canAdvance: boolean;
  errorMessage?: string;
} {
  if (!initSucceeded) {
    return {
      canAdvance: false,
      errorMessage: "Unable to initialize checkout. Please retry.",
    };
  }
  return { canAdvance: true };
}

/**
 * Pure decision function: determines how payment submission should be routed.
 * Missing Stripe/Elements outside of server-approved local_mock NEVER simulates success or calls onPaymentSuccess.
 */
export function evaluatePaymentSubmission(params: {
  isZeroCost: boolean;
  isMock: boolean;
  hasStripe: boolean;
  hasElements: boolean;
}): {
  mode: "free" | "stripe" | "local_mock" | "blocked_error";
  canCallPaymentSuccessImmediately: boolean;
  errorMessage?: string;
} {
  if (params.isZeroCost) {
    return {
      mode: "free",
      canCallPaymentSuccessImmediately: false,
    };
  }

  if (params.isMock) {
    return {
      mode: "local_mock",
      canCallPaymentSuccessImmediately: false,
    };
  }

  if (!params.hasStripe || !params.hasElements) {
    return {
      mode: "blocked_error",
      canCallPaymentSuccessImmediately: false,
      errorMessage: "Secure payment processor is unavailable. Please check your connection and retry.",
    };
  }

  return {
    mode: "stripe",
    canCallPaymentSuccessImmediately: false,
  };
}
