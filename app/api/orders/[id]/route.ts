import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getOrderById, verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { verifyAdminAuth } from "@/lib/admin-auth";
import type { Order } from "@/lib/types";

type OrderWithAdditionalFields = Order & Record<string, unknown>;

/** Anonymous order links expose status only; never serialize the stored order. */
function toPublicStatus(order: OrderWithAdditionalFields) {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    isRedacted: true as const,
  };
}

/** Authenticated receipt view is deliberately allow-listed and never returns secrets. */
function toAuthorizedOrderView(order: OrderWithAdditionalFields) {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    noticeId: order.noticeId,
    noticeType: order.noticeType,
    customerEmail: order.customerEmail,
    docketId: order.docketId,
    docketNumber: order.docketNumber,
    serviceLevel: order.serviceLevel,
    lobLetterId: order.lobLetterId,
    lobStatus: order.lobStatus,
    lobTrackingNumber: order.lobTrackingNumber,
    lobTrackingUrl: order.lobTrackingUrl,
    expectedDeliveryDate: order.expectedDeliveryDate,
    lobExpectedDeliveryDate: order.lobExpectedDeliveryDate,
    lobMailedDate: order.lobMailedDate,
    returnReceiptUrl: order.returnReceiptUrl,
    recipientAddress: order.recipientAddress,
    returnAddress: order.returnAddress,
    fulfillmentError: order.fulfillmentError,
    scheduledSendDate: order.scheduledSendDate,
    amountInCents: order.amountInCents,
    isRedacted: false as const,
  };
}

function safeTokenMatch(candidate: string | null, expected: string | undefined): boolean {
  if (!candidate || !expected) return false;
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length &&
    candidateBuffer.length > 0 && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

async function hasVerifiedOwnerAccess(req: NextRequest, order: OrderWithAdditionalFields): Promise<boolean> {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const decoded = await verifyFirebaseIdToken(match[1]);
  if (!decoded || decoded.email_verified !== true || !decoded.uid) return false;

  // A bound UID can only authorize itself. Email association is reserved for legacy guest orders.
  if (typeof order.userId === "string" && order.userId.length > 0) {
    return decoded.uid === order.userId;
  }
  return typeof decoded.email === "string" && typeof order.customerEmail === "string" &&
    decoded.email.trim().toLowerCase() === order.customerEmail.trim().toLowerCase();
}

async function canViewFullOrder(
  req: NextRequest,
  order: OrderWithAdditionalFields,
  bodyToken?: string,
): Promise<boolean> {
  const url = new URL(req.url);
  const token = bodyToken || url.searchParams.get("token") || url.searchParams.get("viewToken") || req.headers.get("x-view-token");
  return safeTokenMatch(token, order.viewToken) || verifyAdminAuth(req) || hasVerifiedOwnerAccess(req, order);
}

async function readOrder(id: string) {
  return await getOrderById(id) as OrderWithAdditionalFields | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    const order = await readOrder(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (await canViewFullOrder(req, order)) {
      return NextResponse.json({ order: toAuthorizedOrderView(order) });
    }
    return NextResponse.json({ order: toPublicStatus(order) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error fetching order";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Legacy unlock endpoint retained for clients, but credentials must prove ownership. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    const order = await readOrder(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    let bodyToken: string | undefined;
    try {
      const body = await req.json();
      if (typeof body?.viewToken === "string") bodyToken = body.viewToken;
    } catch {
      // Empty bodies are valid for authenticated account requests.
    }

    if (!(await canViewFullOrder(req, order, bodyToken))) {
      return NextResponse.json(
        { error: "Use the secure order link or sign in with the verified account that owns this order." },
        { status: 401 },
      );
    }
    return NextResponse.json({ success: true, verified: true, order: toAuthorizedOrderView(order) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error verifying order";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
