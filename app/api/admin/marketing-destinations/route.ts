import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getMarketingDestinationStatus } from "@/lib/marketing-destinations";

export async function GET(req: NextRequest) {
  if (!verifyAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = getMarketingDestinationStatus();
  return NextResponse.json({
    ...status,
    // The console only needs readiness and the configured destination classes;
    // raw account IDs, verification markers and secrets never leave the server.
    status: "configuration_only_no_live_probe",
  }, { headers: { "Cache-Control": "no-store" } });
}
