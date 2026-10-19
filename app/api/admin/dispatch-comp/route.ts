import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        success: false,
        held: true,
        code: "ADMIN_ACTION_HELD_S0",
        restorationSprint: "S3-T02",
        error:
          "Complimentary notice dispatch is held in S0 because the legacy route bypassed interpolateNotice(), renderLobHtmlPayload(), assertNonFitnessEntity(), and UPL compliance footers. Safe canonical comp dispatch will be restored in Sprint S3 (S3-T02).",
      },
      { status: 409 }
    );
  } catch (err: any) {
    console.error("[Admin Dispatch Exception]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
