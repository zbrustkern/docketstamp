/**
 * Runtime Environment and Secrets Validator
 * Enforces strict boundary separation between public frontend and sensitive backend secrets.
 */

export interface EnvStatus {
  isProduction: boolean;
  stripeSecretConfigured: boolean;
  stripeWebhookConfigured: boolean;
  lobConfigured: boolean;
  handwryttenConfigured?: boolean; // Backward compatibility
  aiProviderConfigured?: "gemini_imagen" | "nano_banana" | "mock_fallback";
  firebaseConfigured: boolean;
  leaksDetected: string[];
}

export function validateEnvironment(): EnvStatus {
  const isProduction = process.env.NODE_ENV === "production";

  // Check for dangerous client-side leakage (private secrets prefixed with NEXT_PUBLIC_)
  const leaksDetected: string[] = [];
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith("NEXT_PUBLIC_")) {
      const lower = key.toLowerCase();
      if (
        lower.includes("secret") ||
        lower.includes("private") ||
        (lower.includes("lob") && lower.includes("key")) ||
        (lower.includes("handwrytten") && lower.includes("key")) ||
        (lower.includes("gemini") && lower.includes("key"))
      ) {
        leaksDetected.push(key);
      }
    }
  });

  if (leaksDetected.length > 0) {
    const errorMsg = `[CRITICAL SECURITY WARNING] Sensitive secret keys detected with NEXT_PUBLIC_ prefix: ${leaksDetected.join(
      ", "
    )}. These keys are exposed to every web browser. Remove NEXT_PUBLIC_ immediately!`;
    console.error(errorMsg);
    if (isProduction) {
      throw new Error(errorMsg);
    }
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const stripeSecretConfigured = Boolean(
    stripeSecret && !stripeSecret.startsWith("sk_test_placeholder")
  );

  const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeWebhookConfigured = Boolean(
    stripeWebhook && !stripeWebhook.startsWith("whsec_placeholder")
  );

  const lobKey =
    process.env.LOB_API_KEY ||
    process.env["lob-api-key"] ||
    process.env.DOCKET_STAMP_SUPPLIER_API_KEY;
  const lobConfigured = Boolean(lobKey && lobKey.trim().length > 0);

  const firebaseConfigured = Boolean(
    process.env.FIREBASE_PROJECT_ID || process.env.K_SERVICE // Cloud Run environment
  );

  return {
    isProduction,
    stripeSecretConfigured,
    stripeWebhookConfigured,
    lobConfigured,
    handwryttenConfigured: lobConfigured, // backward compatibility
    aiProviderConfigured: "mock_fallback",
    firebaseConfigured,
    leaksDetected,
  };
}
