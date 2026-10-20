import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";

/** Legacy provider name is explicitly retired and never proxies Lob status. */
export async function GET(req: NextRequest) {
  if (!verifyAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "Deprecated provider route", code: "LEGACY_PROVIDER_ROUTE_RETIRED", canonicalRoute: "/api/admin/lob-status" }, { status: 410 });
}
