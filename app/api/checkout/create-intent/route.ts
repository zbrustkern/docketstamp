import { NextResponse } from "next/server";

/**
 * The predecessor card checkout cannot create a paid order: it has no
 * deterministic notice template or immutable print snapshot. All supported
 * checkout now starts at /api/docket/lock-and-intent.
 */
export async function POST() {
  return NextResponse.json(
    {
      code: "LEGACY_CHECKOUT_UNSUPPORTED",
      error: "This checkout flow is retired. Prepare and sign a DocketStamp notice before checkout.",
      checkoutUrl: "/",
    },
    { status: 410 }
  );
}
