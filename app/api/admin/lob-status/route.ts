import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stripeKey = (process.env.STRIPE_SECRET_KEY || "").trim();
    const paymentMode: "live" | "test" | "unconfigured" = stripeKey.startsWith("sk_live_")
      ? "live"
      : stripeKey.startsWith("sk_test_")
      ? "test"
      : "unconfigured";

    const lobDispatchKey = (process.env.LOB_DISPATCH_API_KEY || "").trim();
    const lobEnv = (process.env.LOB_ENV || "").trim();
    const dispatchMode: "live" | "test_api" | "mock" | "unconfigured" = lobDispatchKey.startsWith("live_")
      ? "live"
      : lobDispatchKey.startsWith("test_")
      ? "test_api"
      : process.env.NODE_ENV !== "production" || lobEnv === "staging_mock_cass"
      ? "mock"
      : "unconfigured";

    const lobCassKey = (process.env.LOB_ADDRESS_VERIFICATION_KEY || "").trim();
    const cassMode: "live" | "test_api" | "staging_mock_cass" | "unconfigured" =
      lobEnv === "staging_mock_cass"
        ? "staging_mock_cass"
        : lobCassKey.startsWith("live_")
        ? "live"
        : lobCassKey.startsWith("test_")
        ? "test_api"
        : "unconfigured";

    const webhookSecret = (process.env.LOB_WEBHOOK_SECRET || "").trim();
    const webhookConfigured = Boolean(
      webhookSecret &&
        webhookSecret !== "whsec_placeholder" &&
        webhookSecret !== "placeholder" &&
        webhookSecret !== "lob_whsec_placeholder"
    );

    const isTestMode = dispatchMode !== "live";

    return NextResponse.json({
      connected: false,
      probeStatus: "unverified_no_recent_probe",
      isTestMode,
      paymentMode,
      dispatchMode,
      cassMode,
      webhookConfigured,
      modeLabel:
        dispatchMode === "live"
          ? "Lob Live Key Configured (Connectivity Unverified)"
          : dispatchMode === "test_api"
          ? "Lob Test API Configured (Connectivity Unverified)"
          : dispatchMode === "mock"
          ? "Sandbox / Mock Dispatch Mode (No Live USPS Mail)"
          : "Lob Dispatch Key Unconfigured (Fail-Closed)",
      postalStandard:
        cassMode === "staging_mock_cass"
          ? "Deterministic Mock CASS (Staging / Non-Production)"
          : cassMode === "unconfigured"
          ? "USPS CASS™ Key Unconfigured"
          : "USPS CASS™ Key Present (Probe Unverified)",
      services: ["FIRST_CLASS", "CERTIFIED", "CERTIFIED_RETURN_RECEIPT"],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
