import "./helpers/firebase-auth-test-verifier";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { firestoreDb } from "../lib/firebase-admin";
import {
  createNoticeDeadlineReminder,
  createReminderUnsubscribeToken,
  getNoticeDeadlineRemindersForUser,
  optOutNoticeDeadlineReminder,
  optOutNoticeDeadlineReminderByToken,
  updateNoticeDeadlineReminder,
} from "../lib/reminders";
import { runNoticeReminderScheduler } from "../lib/reminder-scheduler";
import { calculateReminderSchedule, isDeadlinePast, localReminderTimeToEpoch, formatDeadlineDate, validateNoticeReminderInput } from "../lib/reminder-utils";
import { GET as getReminders, POST as postReminder } from "../app/api/reminders/route";
import { GET as getUnsubscribe, POST as postUnsubscribe } from "../app/api/reminders/unsubscribe/route";
import { POST as runSchedulerRoute } from "../app/api/reminders/scheduler/route";
import { sendNoticeDeadlineReminderEmail } from "../lib/email-alerts";

const slug = "pre-arbitration-notice-of-dispute-and-refund-request";
const input = (overrides: Record<string, unknown> = {}): any => ({
  deadlineDate: "2026-11-20", timezone: "America/Chicago", label: "Date I entered for account response",
  noticeSlug: slug, consent: true, leadTimeDays: 1, ...overrides,
});

test("date contract rejects impossible dates, missing consent, and unsupported lead times", () => {
  assert.throws(() => validateNoticeReminderInput(input({ deadlineDate: "2026-02-29" })), /valid calendar date/);
  assert.throws(() => validateNoticeReminderInput(input({ consent: false })), /Explicit consent/);
  assert.throws(() => validateNoticeReminderInput(input({ leadTimeDays: 2 })), /leadTimeDays/);
  assert.throws(() => validateNoticeReminderInput(input({ timezone: "Mars/Olympus" })), /IANA timezone/);
});

test("local scheduling handles DST transitions, leap day, calendar lead days, and past deadlines once", () => {
  assert.equal(new Date(localReminderTimeToEpoch("2026-03-08", "America/New_York")).toISOString(), "2026-03-08T13:00:00.000Z");
  assert.equal(new Date(localReminderTimeToEpoch("2026-11-01", "America/New_York")).toISOString(), "2026-11-01T14:00:00.000Z");
  assert.equal(new Date(calculateReminderSchedule("2028-03-01", "America/Chicago", 1)).toISOString(), "2028-02-29T15:00:00.000Z");
  assert.equal(isDeadlinePast("2026-10-21", "America/Chicago", Date.parse("2026-10-22T12:00:00Z")), true);
});

test("authenticated CRUD is versioned, ownership-safe, and leaves historical occasions untouched", async () => {
  const uid = `deadline-test-${crypto.randomUUID()}`;
  const historicalId = `old-${uid}`;
  const now = Date.parse("2026-10-20T12:00:00Z");
  const oldSecret = process.env.REMINDER_UNSUBSCRIBE_SECRET;
  process.env.REMINDER_UNSUBSCRIBE_SECRET = "test-only-reminder-secret-32-characters-long";
  const historicRef = firestoreDb.collection("occasion_reminders").doc(historicalId);
  await historicRef.set({ id: historicalId, userId: uid, userEmail: `${uid}@example.com`, occasionType: "birthday", month: 3, day: 4 });

  const unauth = await postReminder(new NextRequest("http://localhost/api/reminders", { method: "POST", body: JSON.stringify(input()) }));
  assert.equal(unauth.status, 401);

  const createdResponse = await postReminder(new NextRequest("http://localhost/api/reminders", {
    method: "POST", headers: { authorization: `Bearer mock_token_${uid}`, "content-type": "application/json" }, body: JSON.stringify(input()),
  }));
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).reminder;
  assert.equal(created.version, 1);
  assert.equal(created.kind, "notice_deadline");
  assert.equal(created.userId, uid);
  assert.equal(created.status, "scheduled");

  const foreignUpdate = await postReminder(new NextRequest("http://localhost/api/reminders", {
    method: "POST", headers: { authorization: "Bearer mock_token_other-user", "content-type": "application/json" },
    body: JSON.stringify({ ...input({ deadlineDate: "2026-10-23" }), id: created.id }),
  }));
  assert.equal(foreignUpdate.status, 404);

  const updatedResponse = await postReminder(new NextRequest("http://localhost/api/reminders", {
    method: "POST", headers: { authorization: `Bearer mock_token_${uid}`, "content-type": "application/json" },
    body: JSON.stringify({ ...input({ deadlineDate: "2026-10-23", leadTimeDays: 3 }), id: created.id }),
  }));
  assert.equal(updatedResponse.status, 200);
  const updated = (await updatedResponse.json()).reminder;
  assert.equal(updated.deadlineDate, "2026-10-23");
  assert.equal(updated.deliveryKey, `notice-deadline-reminder/${created.id}/2`);

  const ownList = await getReminders(new NextRequest("http://localhost/api/reminders", { headers: { authorization: `Bearer mock_token_${uid}` } }));
  const reminders = (await ownList.json()).reminders;
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].id, created.id);
  assert.equal(reminders.some((r: { id: string }) => r.id === historicalId), false);
  assert.equal((await historicRef.get()).exists, true);

  const optout = await (await import("../app/api/reminders/route")).DELETE(new NextRequest(`http://localhost/api/reminders?id=${created.id}`, { method: "DELETE", headers: { authorization: `Bearer mock_token_${uid}` } }));
  assert.equal(optout.status, 200);
  assert.equal((await getNoticeDeadlineRemindersForUser(uid)).find((r) => r.id === created.id)?.status, "opted_out");
  await historicRef.delete();
  if (oldSecret === undefined) delete process.env.REMINDER_UNSUBSCRIBE_SECRET; else process.env.REMINDER_UNSUBSCRIBE_SECRET = oldSecret;
});

test("explicit HMAC unsubscribe uses a confirmation GET and ownerless POST opt-out", async () => {
  process.env.REMINDER_UNSUBSCRIBE_SECRET = "test-only-reminder-secret-32-characters-long";
  const uid = `unsubscribe-${crypto.randomUUID()}`;
  const reminder = await createNoticeDeadlineReminder({ userId: uid, userEmail: `${uid}@example.com`, input: input({ deadlineDate: "2026-10-30" }), now: Date.parse("2026-10-20T12:00:00Z") });
  const token = createReminderUnsubscribeToken(reminder.id, uid);
  const confirmation = await getUnsubscribe(new NextRequest(`http://localhost/api/reminders/unsubscribe?id=${reminder.id}&token=${token}`));
  assert.equal(confirmation.status, 200);
  assert.match(await confirmation.text(), /Confirm that you want to stop/);
  assert.equal((await getNoticeDeadlineRemindersForUser(uid))[0].status, "scheduled", "GET must not unsubscribe automatically");
  const applied = await postUnsubscribe(new NextRequest("http://localhost/api/reminders/unsubscribe", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: reminder.id, token }),
  }));
  assert.equal(applied.status, 200);
  assert.equal((await getNoticeDeadlineRemindersForUser(uid))[0].status, "opted_out");
  const rejected = await postUnsubscribe(new NextRequest("http://localhost/api/reminders/unsubscribe", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: reminder.id, token: "wrong-token" }),
  }));
  assert.equal(rejected.status, 404);
});

test("concurrent scheduler runs send one email, deep-link to notice review, and never touch payment or postal systems", async () => {
  const uid = `scheduler-${crypto.randomUUID()}`;
  const deadline = "2026-10-22";
  const scheduledAt = calculateReminderSchedule(deadline, "America/Chicago", 1);
  const reminder = await createNoticeDeadlineReminder({ userId: uid, userEmail: `${uid}@example.com`, input: input({ deadlineDate: deadline }), now: scheduledAt - 86400000 });
  let sends = 0;
  let sentUrl = "";
  const sender = async (params: { reviewUrl: string }) => { sends += 1; sentUrl = params.reviewUrl; return { success: true, emailId: "email-test-id" }; };
  const [first, second] = await Promise.all([
    runNoticeReminderScheduler({ now: scheduledAt, send: sender }), runNoticeReminderScheduler({ now: scheduledAt, send: sender }),
  ]);
  assert.equal(sends, 1);
  assert.equal(sentUrl, `https://docketstamp.com/notices/${slug}`);
  assert.equal(first.sent + second.sent, 1);
  assert.equal((await getNoticeDeadlineRemindersForUser(uid))[0].status, "sent");
  assert.ok(reminder.deliveryKey.includes(reminder.id));
});

test("failed email attempts retry with same provider idempotency key and capped backoff", async () => {
  const uid = `retry-${crypto.randomUUID()}`;
  const deadline = "2026-10-24";
  const scheduledAt = calculateReminderSchedule(deadline, "America/Chicago", 1);
  const reminder = await createNoticeDeadlineReminder({ userId: uid, userEmail: `${uid}@example.com`, input: input({ deadlineDate: deadline }), now: scheduledAt - 86400000 });
  let attempts = 0;
  let key = "";
  const failedSender = async (params: { idempotencyKey: string }) => { attempts += 1; key = params.idempotencyKey; return { success: false, error: "temporary provider failure" }; };
  await runNoticeReminderScheduler({ now: scheduledAt, send: failedSender });
  await runNoticeReminderScheduler({ now: scheduledAt + 59_000, send: failedSender });
  assert.equal(attempts, 1, "retry waits for backoff");
  const successSender = async (params: { idempotencyKey: string }) => { attempts += 1; assert.equal(params.idempotencyKey, key); return { success: true, emailId: "retry-ok" }; };
  await runNoticeReminderScheduler({ now: scheduledAt + 60_000, send: successSender });
  assert.equal(attempts, 2);
  assert.equal((await getNoticeDeadlineRemindersForUser(uid))[0].status, "sent");
});

test("past explicit deadline expires once and does not roll into a later year", async () => {
  const uid = `past-${crypto.randomUUID()}`;
  const reminder = await createNoticeDeadlineReminder({ userId: uid, userEmail: `${uid}@example.com`, input: input({ deadlineDate: "2025-10-20", leadTimeDays: 0 }), now: Date.parse("2026-10-20T12:00:00Z") });
  assert.equal(reminder.status, "expired");
  let calls = 0;
  await runNoticeReminderScheduler({ now: Date.parse("2027-10-20T12:00:00Z"), send: async () => { calls += 1; return { success: true }; } });
  assert.equal(calls, 0);
  assert.equal((await getNoticeDeadlineRemindersForUser(uid))[0].deadlineDate, "2025-10-20");
});

test("a missed reminder window expires before the explicit deadline without sending late", async () => {
  const uid = `missed-window-${crypto.randomUUID()}`;
  const deadline = "2026-10-24";
  const scheduledAt = calculateReminderSchedule(deadline, "America/Chicago", 14);
  const reminder = await createNoticeDeadlineReminder({ userId: uid, userEmail: `${uid}@example.com`, input: input({ deadlineDate: deadline, leadTimeDays: 14 }), now: scheduledAt - 86400000 });
  let calls = 0;
  await runNoticeReminderScheduler({ now: scheduledAt + 86400000, send: async () => { calls += 1; return { success: true }; } });
  assert.equal(calls, 0);
  assert.equal((await getNoticeDeadlineRemindersForUser(uid))[0].status, "expired");
  assert.equal(reminder.deadlineDate, deadline);
});

test("scheduler route fails closed without its independent high-entropy secret", async () => {
  const previous = process.env.REMINDER_SCHEDULER_SECRET;
  delete process.env.REMINDER_SCHEDULER_SECRET;
  const rejected = await runSchedulerRoute(new NextRequest("http://localhost/api/reminders/scheduler", { method: "POST" }));
  assert.equal(rejected.status, 401);
  if (previous === undefined) delete process.env.REMINDER_SCHEDULER_SECRET; else process.env.REMINDER_SCHEDULER_SECRET = previous;
});

test("email payload uses the provider idempotency key, notice review link, and UPL disclosure", async () => {
  const oldKey = process.env.RESEND_API_KEY;
  const oldFetch = globalThis.fetch;
  let sentHeaders: HeadersInit | undefined;
  let sentBody = "";
  process.env.RESEND_API_KEY = "test-key-that-is-never-sent-outside-the-fetch-mock";
  globalThis.fetch = (async (_input, init) => {
    sentHeaders = init?.headers;
    sentBody = String(init?.body || "");
    return new Response(JSON.stringify({ id: "mock-resend-id" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await sendNoticeDeadlineReminderEmail({
      toEmail: "user@example.com", label: "My entered date", deadlineDateFormatted: "October 22, 2026",
      leadTimeDays: 1, reviewUrl: `https://docketstamp.com/notices/${slug}`,
      unsubscribeUrl: "https://docketstamp.com/api/reminders/unsubscribe?id=test&token=token",
      idempotencyKey: "notice-deadline-reminder/test/1",
    });
    assert.equal(result.success, true);
    assert.equal(new Headers(sentHeaders).get("Idempotency-Key"), "notice-deadline-reminder/test/1");
    assert.match(sentBody, /\/notices\/pre-arbitration-notice-of-dispute-and-refund-request/);
    assert.match(sentBody, /does not provide legal representation or legal advice/);
    assert.match(sentBody, /does not determine or verify legal deadlines/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
  }
});


test("deadline email date retains the exact supplied calendar day across extreme timezones", () => {
  for (const timezone of ["Pacific/Kiritimati", "Pacific/Pago_Pago", "America/Chicago", "Asia/Tokyo"]) {
    assert.equal(formatDeadlineDate("2026-10-22", timezone), "October 22, 2026");
  }
});


test("saved reminder delivery stays visibly disabled until operator enables configured delivery", async () => {
  const { getReminderDeliveryReadiness } = await import("../lib/reminder-delivery");
  assert.equal(getReminderDeliveryReadiness({}).enabled, false);
  const configured = { RESEND_API_KEY: "test-only", REMINDER_SCHEDULER_SECRET: "s".repeat(32), REMINDER_UNSUBSCRIBE_SECRET: "u".repeat(32) };
  assert.equal(getReminderDeliveryReadiness(configured).status, "disabled");
  assert.equal(getReminderDeliveryReadiness({ ...configured, REMINDER_DELIVERY_ENABLED: "true" }).status, "ready");
});
