import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminAuth(req)) {
      return NextResponse.json(
        { error: "Unauthorized access to order status sync" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        held: true,
        code: "ADMIN_ACTION_HELD_S0",
        restorationSprint: "S2-T03 / S5-T01",
        error:
          "Manual Lob status sync is held in S0 because the legacy route mutated order status to MAILED from synthetic mock responses. Verified Lob status reconciliation will be restored in Sprint S2/S5.",
      },
      { status: 409 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Sync status exception";
    console.error("[Admin Sync Postal Exception]:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
