import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isTestMode = process.env.NODE_ENV !== "production";

    return NextResponse.json({
      connected: true,
      isTestMode,
      modeLabel: "Lob Programmatic USPS Postal Dispatch",
      postalStandard: "USPS CASS™ Certified",
      services: ["FIRST_CLASS", "CERTIFIED", "CERTIFIED_RETURN_RECEIPT"],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
