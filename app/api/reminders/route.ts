import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { getNoticeBySlug } from "@/lib/docket/notices";
import {
  createNoticeDeadlineReminder,
  getNoticeDeadlineRemindersForUser,
  optOutNoticeDeadlineReminder,
  ReminderOwnershipError,
  ReminderStateError,
  updateNoticeDeadlineReminder,
} from "@/lib/reminders";
import { getReminderDeliveryReadiness } from "@/lib/reminder-delivery";
import { ReminderValidationError } from "@/lib/reminder-utils";

async function authenticatedUser(req: NextRequest) {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const decoded = token ? await verifyFirebaseIdToken(token) : null;
  if (!decoded?.uid || !decoded.email || decoded.email_verified !== true) return null;
  return { uid: decoded.uid, email: decoded.email.toLowerCase() };
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const requestedUserId = new URL(req.url).searchParams.get("userId");
    if (requestedUserId && requestedUserId !== user.uid) return NextResponse.json({ error: "You can only view your own reminders." }, { status: 403 });
    return NextResponse.json({ version: 1, reminders: await getNoticeDeadlineRemindersForUser(user.uid), delivery: getReminderDeliveryReadiness() });
  } catch (error) {
    console.error("[Reminders] GET failed", error);
    return NextResponse.json({ error: "Could not load reminders." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await req.json();
    const noticeSlug = typeof body?.noticeSlug === "string" ? body.noticeSlug : "";
    if (!getNoticeBySlug(noticeSlug)) return NextResponse.json({ error: "Choose a supported notice before scheduling a reminder." }, { status: 400 });
    const reminder = body.id
      ? await updateNoticeDeadlineReminder({ id: String(body.id), userId: user.uid, userEmail: user.email, input: body })
      : await createNoticeDeadlineReminder({ userId: user.uid, userEmail: user.email, input: body });
    return NextResponse.json({ success: true, reminder }, { status: body.id ? 200 : 201 });
  } catch (error) {
    if (error instanceof ReminderValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof ReminderOwnershipError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ReminderStateError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("[Reminders] POST failed", error);
    return NextResponse.json({ error: "Could not save reminder." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await authenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Reminder ID is required." }, { status: 400 });
    await optOutNoticeDeadlineReminder({ id, userId: user.uid });
    return NextResponse.json({ success: true, status: "opted_out" });
  } catch (error) {
    if (error instanceof ReminderOwnershipError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ReminderStateError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("[Reminders] DELETE failed", error);
    return NextResponse.json({ error: "Could not opt out of reminder." }, { status: 500 });
  }
}
