import { NextRequest, NextResponse } from "next/server";
import { AdminAccessError } from "@/lib/admin-console/commands/access";
import { beginCommand, finishCommand } from "@/lib/admin-console/commands/audit";
import { dispatchAuthorizedObligation, resolvePostalObligation } from "@/lib/admin-console/postal/dispatch";

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
    const result = await dispatchAuthorizedObligation({
      orderId, requestId, actorId: command.actor.actorId, evidenceRef: command.auditId,
      resolveObligation: resolvePostalObligation,
    });
    if (result.status === "uncertain") {
      await finishCommand(command.auditId, "uncertain", "POSTAL_RESULT_AMBIGUOUS");
      return NextResponse.json({ ok: false, ...result }, { status: 202 });
    }
    if (result.status === "blocked") {
      await finishCommand(command.auditId, "failed", result.reason.replace(/[^A-Z0-9_]/g, "_").slice(0, 80) || "POSTAL_BLOCKED");
      return NextResponse.json({ ok: false, ...result }, { status: 409 });
    }
    await finishCommand(command.auditId, result.status === "simulated" ? "succeeded" : "succeeded", result.status === "simulated" ? "POSTAL_SIMULATED" : "POSTAL_ACCEPTED");
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    if (auditId) await finishCommand(auditId, "failed", "POSTAL_COMMAND_FAILED").catch(() => undefined);
    const status = error instanceof AdminAccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "POSTAL_COMMAND_FAILED" }, { status });
  }
}
