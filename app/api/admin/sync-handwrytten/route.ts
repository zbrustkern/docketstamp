import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";

/** Historical Handwrytten provider references are not Lob letter identifiers. */
export async function POST(req: NextRequest) {
  if (!verifyAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized access to legacy provider sync" }, { status: 401 });
  }
  return NextResponse.json(
    {
      success: false,
      code: "LEGACY_PROVIDER_ROUTE_RETIRED",
      error: "Historical Handwrytten references cannot be synchronized through Lob.",
    },
    { status: 410 }
  );
}
