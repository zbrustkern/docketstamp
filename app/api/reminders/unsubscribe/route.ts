import { NextRequest, NextResponse } from "next/server";
import { getNoticeReminderById, optOutNoticeDeadlineReminderByToken, verifyReminderUnsubscribeToken } from "@/lib/reminders";

function confirmationPage(id: string, token: string, valid: boolean) {
  const message = valid ? "Confirm that you want to stop this one-time reminder." : "This unsubscribe link is invalid or expired.";
  const form = valid ? `<form method="post"><input type="hidden" name="id" value="${id.replace(/[&<>\"']/g, "")}"><input type="hidden" name="token" value="${token.replace(/[&<>\"']/g, "")}"><button type="submit">Unsubscribe</button></form>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Reminder preferences | DocketStamp</title></head><body style="font:16px Arial,sans-serif;max-width:620px;margin:60px auto;padding:24px;color:#0f172a"><h1>Reminder preferences</h1><p>${message}</p>${form}<p>DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, not a law firm, and does not provide legal representation or advice.</p></body></html>`;
}

function resultPage(message: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Reminder preferences | DocketStamp</title></head><body style="font:16px Arial,sans-serif;max-width:620px;margin:60px auto;padding:24px;color:#0f172a"><h1>Reminder preferences</h1><p>${message}</p><p>DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, not a law firm, and does not provide legal representation or advice.</p></body></html>`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const token = url.searchParams.get("token") || "";
  const reminder = id ? await getNoticeReminderById(id) : null;
  const valid = Boolean(reminder && token && verifyReminderUnsubscribeToken(reminder.id, reminder.userId, token));
  return new NextResponse(confirmationPage(id, token, valid), { status: valid ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let id = "";
  let token = "";
  try {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const body = await req.json(); id = String(body.id || ""); token = String(body.token || "");
    } else {
      const form = await req.formData(); id = String(form.get("id") || ""); token = String(form.get("token") || "");
    }
    if (!id || !token) return NextResponse.json({ error: "Reminder and token are required." }, { status: 400 });
    await optOutNoticeDeadlineReminderByToken({ id, token });
    if (!type.includes("application/json")) return new NextResponse(resultPage("This one-time reminder has been stopped."), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    return NextResponse.json({ success: true, status: "opted_out" });
  } catch {
    return NextResponse.json({ error: "This unsubscribe link is invalid or could not be applied." }, { status: 404 });
  }
}
