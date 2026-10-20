import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { getOrderById } from "@/lib/firebase-admin";
import { fetchLobLetterStatus } from "@/lib/fulfillment/lob";
import { resolvePostalProvenance } from "@/lib/order-record";

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let postalLiveStatus: any = null;
    const provenance = resolvePostalProvenance(order);
    if (provenance.provider === "lob" && provenance.reference) {
      try {
        postalLiveStatus = await fetchLobLetterStatus(provenance.reference);
      } catch (err) {
        console.warn("[Order Proof] Notice querying Lob live status:", err);
      }
    }

    return NextResponse.json({
      order,
      postalStatus: postalLiveStatus,
      postalProvenance: provenance,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error fetching order proof";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
