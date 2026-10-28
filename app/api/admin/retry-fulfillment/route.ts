import { NextRequest, NextResponse } from "next/server";
import { AdminAccessError } from "@/lib/admin-console/commands/access";
import { beginCommand, finishCommand } from "@/lib/admin-console/commands/audit";
import { dispatchAuthorizedObligation, resolvePostalObligation } from "@/lib/admin-console/postal/dispatch";
import { getDispatchLock, recordDispatchReconciliation } from "@/lib/admin-console/postal/attempt-store";
import { drainAcceptedDispatchEffects } from "@/lib/admin-console/finance/authority";

function followupAction(status: string) {
  return ["ATTENTION_REQUIRED", "FOLLOWUP_EFFECT_OUTCOME_UNKNOWN"].includes(status)
    ? "Review the accepted-effects outbox and verify receipt delivery before any manual resolution; do not replay these effects automatically."
    : undefined;
}

export async function POST(req: NextRequest) {
  let auditId: string | undefined;
  try {
    const body = await req.json();
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const requestId = typeof body.requestId === "string" ? body.requestId : req.headers.get("x-request-id") || "";
    const reason = typeof body.reason === "string" ? body.reason : "";
    const command = await beginCommand(req, {
      capability: "postal.dispatch", action: "postal.retry", targetType: "order", targetId: orderId,
      requestId, reason, effectSummary: "Reconcile authority and attempt safe postal dispatch of the frozen order snapshot.",
    });
    auditId = command.auditId;
    if (command.duplicate && command.status !== "pending") {
      return NextResponse.json({ ok: true, duplicate: true, status: command.status });
    }
    const reconciliation = body.reconciliation as { resolution?: unknown; providerLetterId?: unknown } | undefined;
    let reconciliationConfirmedNoAcceptance = false;
    if (reconciliation?.resolution === "accepted" || reconciliation?.resolution === "not_accepted") {
      const obligation = await resolvePostalObligation(orderId);
      if (!obligation) throw new Error("POSTAL_AUTHORITY_UNAVAILABLE");
      const modes = ["live", "test_api", "mock"] as const;
      let lock: Record<string, unknown> | null = null;
      let lockMode: typeof modes[number] | null = null;
      for (const mode of modes) {
        lock = await getDispatchLock({ environment: obligation.environment, lobMode: mode, orderId, snapshotVersion: obligation.material.snapshotVersion });
        if (lock) { lockMode = mode; break; }
      }
      if (!lockMode) throw new Error("DISPATCH_LOCK_NOT_FOUND");
      await recordDispatchReconciliation({
        environment: obligation.environment, lobMode: lockMode, orderId,
        snapshotVersion: obligation.material.snapshotVersion,
        resolution: reconciliation.resolution,
        evidenceRef: command.auditId,
        ...(typeof reconciliation.providerLetterId === "string" ? { providerLetterId: reconciliation.providerLetterId } : {}),
      });
      if (reconciliation.resolution === "accepted") {
        const followupStatus = obligation.paymentFactId
          ? await drainAcceptedDispatchEffects({ orderId, authority: { paymentFactId: obligation.paymentFactId } })
          : obligation.freeAuthorizationFactId
            ? await drainAcceptedDispatchEffects({ orderId, authority: { freeAuthorizationFactId: obligation.freeAuthorizationFactId } })
            : "ACCEPTED_AUTHORITY_MISSING";
        await finishCommand(command.auditId, "reconciled", "POSTAL_ACCEPTANCE_RECONCILED");
        return NextResponse.json({ ok: true, status: "accepted", reconciled: true, followupStatus, followupAction: followupAction(followupStatus) });
      }
      reconciliationConfirmedNoAcceptance = true;
    }
    const result = await dispatchAuthorizedObligation({
      orderId, requestId, actorId: command.actor.actorId, evidenceRef: command.auditId,
      resolveObligation: resolvePostalObligation,
      reconciliationConfirmedNoAcceptance,
    });
    if (result.status === "blocked" && result.reason === "ALREADY_ACCEPTED") {
      const obligation = await resolvePostalObligation(orderId);
      const followupStatus = obligation?.paymentFactId
        ? await drainAcceptedDispatchEffects({ orderId, authority: { paymentFactId: obligation.paymentFactId } })
        : obligation?.freeAuthorizationFactId
          ? await drainAcceptedDispatchEffects({ orderId, authority: { freeAuthorizationFactId: obligation.freeAuthorizationFactId } })
          : "ACCEPTED_AUTHORITY_MISSING";
      await finishCommand(command.auditId, "reconciled", "POSTAL_ALREADY_ACCEPTED_FOLLOWUPS_CHECKED");
      return NextResponse.json({ ok: true, status: "accepted", alreadyAccepted: true, followupStatus, followupAction: followupAction(followupStatus) });
    }
    if (result.status === "uncertain") {
      await finishCommand(command.auditId, "uncertain", "POSTAL_RESULT_AMBIGUOUS");
      return NextResponse.json({ ok: false, ...result }, { status: 202 });
    }
    if (result.status === "blocked") {
      await finishCommand(command.auditId, "failed", result.reason.replace(/[^A-Z0-9_]/g, "_").slice(0, 80) || "POSTAL_BLOCKED");
      return NextResponse.json({ ok: false, ...result }, { status: 409 });
    }
    const obligation = result.status === "accepted" ? await resolvePostalObligation(orderId) : null;
    const followupStatus = result.status === "accepted"
      ? obligation?.paymentFactId
        ? await drainAcceptedDispatchEffects({ orderId, authority: { paymentFactId: obligation.paymentFactId } })
        : obligation?.freeAuthorizationFactId
          ? await drainAcceptedDispatchEffects({ orderId, authority: { freeAuthorizationFactId: obligation.freeAuthorizationFactId } })
        : "ACCEPTED_AUTHORITY_MISSING"
      : undefined;
    await finishCommand(command.auditId, "succeeded", result.status === "simulated" ? "POSTAL_SIMULATED" : "POSTAL_ACCEPTED");
    return NextResponse.json({ ok: true, ...result, ...(followupStatus ? { followupStatus, followupAction: followupAction(followupStatus) } : {}) }, { status: 200 });
  } catch (error) {
    if (auditId) await finishCommand(auditId, "failed", "POSTAL_COMMAND_FAILED").catch(() => undefined);
    const status = error instanceof AdminAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "POSTAL_COMMAND_FAILED" }, { status });
  }
}
