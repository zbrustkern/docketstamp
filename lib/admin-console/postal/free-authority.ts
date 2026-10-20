import crypto from "node:crypto";
import { firestoreDb, sanitizeFirestoreData } from "@/lib/firebase-admin";
import type { Order } from "@/lib/types";
import { computeOrderSnapshotHash } from "@/lib/admin-console/finance/authority";
import { serverEnvironment } from "@/lib/admin-console/commands/access";
import { readOrderRecord, validateFrozenNoticeOrder } from "@/lib/order-record";

const COLLECTION = "free_authorizations_v1";
const hashId = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const iso = () => new Date().toISOString();

export interface FreeAuthorizationFact {
  schemaVersion: 1;
  product: "docketstamp";
  environment: "local" | "staging" | "production";
  authorizationId: string;
  orderId: string;
  kind: "comp" | "promo";
  evidenceRef: string;
  actorId: string;
  snapshotHash: string;
  snapshotVersion: 1;
  currency: "USD";
  payableAmountMinor: 0;
  authorizedAt: string;
}

function eligibleZeroOrder(order: Order): boolean {
  return (order.finalAmountInCents ?? order.amountInCents) === 0 && Boolean(
    order.recipientAddress && order.returnAddress && order.serviceLevel,
  ) && readOrderRecord(order).schemaVersion === 2 && readOrderRecord(order).kind === "notice" && !validateFrozenNoticeOrder(order);
}

/** Internal server writer: create durable evidence for an already committed free order. */
export async function authorizeFreeOrder(
  orderId: string,
  input: { kind: "comp" | "promo"; evidenceRef: string; actorId: string },
): Promise<FreeAuthorizationFact> {
  if (!orderId || !input.evidenceRef || !input.actorId) throw new Error("FREE_AUTHORITY_EVIDENCE_REQUIRED");
  const orderRef = firestoreDb.collection("orders").doc(orderId);
  const factId = hashId(`free-authority:${serverEnvironment()}:${orderId}`);
  const factRef = firestoreDb.collection(COLLECTION).doc(factId);
  return firestoreDb.runTransaction(async (tx: any) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error("FREE_ORDER_NOT_FOUND");
    const order = orderSnap.data() as Order;
    if (!eligibleZeroOrder(order)) throw new Error("FREE_ORDER_NOT_CANONICAL_ZERO_VALUE");
    if (input.kind === "comp" && order.isComp !== true) throw new Error("COMP_ORDER_REQUIRED");
    if (input.kind === "promo" && order.paymentMethod !== "PROMO_CODE") throw new Error("PROMO_ORDER_REQUIRED");
    const snapshotHash = computeOrderSnapshotHash(order);
    const current = await tx.get(factRef);
    if (current.exists) {
      const existing = current.data() as FreeAuthorizationFact;
      if (existing.snapshotHash !== snapshotHash || existing.kind !== input.kind) throw new Error("FREE_AUTHORITY_CONFLICT");
      return existing;
    }
    const fact: FreeAuthorizationFact = {
      schemaVersion: 1, product: "docketstamp", environment: serverEnvironment(),
      authorizationId: factId, orderId, kind: input.kind,
      evidenceRef: input.evidenceRef.slice(0, 200), actorId: input.actorId.slice(0, 200),
      snapshotHash, snapshotVersion: 1, currency: "USD", payableAmountMinor: 0, authorizedAt: iso(),
    };
    tx.create(factRef, sanitizeFirestoreData(fact));
    tx.update(orderRef, sanitizeFirestoreData({
      freeAuthorizationFactId: factId, paymentSnapshotHash: snapshotHash,
    }));
    return fact;
  });
}

export async function getFreeObligation(orderId: string) {
  const orderSnap = await firestoreDb.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) return null;
  const order = orderSnap.data() as Order & { freeAuthorizationFactId?: string; paymentSnapshotHash?: string };
  if (!order.freeAuthorizationFactId || !order.paymentSnapshotHash) return null;
  const factSnap = await firestoreDb.collection(COLLECTION).doc(order.freeAuthorizationFactId).get();
  if (!factSnap.exists) return null;
  const fact = factSnap.data() as FreeAuthorizationFact;
  const snapshotHash = computeOrderSnapshotHash(order);
  if (
    fact.schemaVersion !== 1 || fact.product !== "docketstamp" || fact.environment !== serverEnvironment() ||
    fact.orderId !== orderId || fact.authorizationId !== order.freeAuthorizationFactId ||
    fact.payableAmountMinor !== 0 || fact.currency !== "USD" ||
    fact.snapshotHash !== snapshotHash || order.paymentSnapshotHash !== snapshotHash || !eligibleZeroOrder(order)
  ) return null;
  const tier = order.serviceLevel === "FIRST_CLASS" ? "first_class" : order.serviceLevel === "CERTIFIED_RETURN_RECEIPT" ? "certified_return_receipt" : "certified";
  return {
    verified: true as const, orderId, order, freeAuthorizationFact: fact,
    freeAuthorizationFactId: fact.authorizationId, snapshotHash, snapshotVersion: 1 as const,
    environment: fact.environment, currency: "USD" as const, payableAmountMinor: 0 as const, tier,
  };
}
