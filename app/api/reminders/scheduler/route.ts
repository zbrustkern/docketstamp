import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getReminderDeliveryReadiness } from "@/lib/reminder-delivery";
import { runNoticeReminderScheduler } from "@/lib/reminder-scheduler";

function authorized(req: NextRequest): boolean {
  const configured = process.env.REMINDER_SCHEDULER_SECRET;
  if (!configured || configured.length < 32) return false;
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  const supplied = header.slice(7);
  const expectedBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  return suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

/** Callable from a future scheduler; no external schedule is configured by this route. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Scheduler authorization is not configured or is invalid." }, { status: 401 });
  const delivery = getReminderDeliveryReadiness();
  if (!delivery.enabled) return NextResponse.json({ error: delivery.message, delivery }, { status: 503 });
  try {
    return NextResponse.json(await runNoticeReminderScheduler());
  } catch (error) {
    console.error("[Reminder scheduler] Run failed", error);
    return NextResponse.json({ error: "Reminder scheduler run failed." }, { status: 500 });
  }
}
