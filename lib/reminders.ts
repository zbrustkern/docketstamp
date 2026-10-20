import crypto from "crypto";
import { firestoreDb, sanitizeFirestoreData } from "./firebase-admin";
import { OccasionReminder } from "./types";
import {
  NOTICE_REMINDER_CLAIM_LEASE_MS,
  NOTICE_REMINDER_COLLECTION,
  NOTICE_REMINDER_KIND,
  NOTICE_REMINDER_MAX_ATTEMPTS,
  NOTICE_REMINDER_VERSION,
  CreateNoticeReminderInput,
  NoticeDeadlineReminderV1,
} from "./reminder-contract";
import { calculateReminderSchedule, isDeadlinePast, isReminderWindowPast, validateNoticeReminderInput } from "./reminder-utils";

export * from "./reminder-utils";
export * from "./reminder-contract";
export const REMINDERS_COLLECTION = "occasion_reminders"; // historical records only

export class ReminderOwnershipError extends Error { constructor() { super("Reminder not found or not owned by this account."); this.name = "ReminderOwnershipError"; } }
export class ReminderStateError extends Error { constructor(message: string) { super(message); this.name = "ReminderStateError"; } }

function unsubscribeSecret(): string {
  const secret = process.env.REMINDER_UNSUBSCRIBE_SECRET;
  if (!secret || secret.length < 32) throw new Error("REMINDER_UNSUBSCRIBE_SECRET must be configured with at least 32 characters.");
  return secret;
}

export function createReminderUnsubscribeToken(reminderId: string, userId: string): string {
  return crypto.createHmac("sha256", unsubscribeSecret()).update(`${NOTICE_REMINDER_VERSION}:${reminderId}:${userId}`).digest("base64url");
}

export function verifyReminderUnsubscribeToken(reminderId: string, userId: string, token: string): boolean {
  try {
    const expected = Buffer.from(createReminderUnsubscribeToken(reminderId, userId));
    const candidate = Buffer.from(token);
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch { return false; }
}

export async function createNoticeDeadlineReminder(params: {
  userId: string; userEmail: string; input: CreateNoticeReminderInput; now?: number;
}): Promise<NoticeDeadlineReminderV1> {
  const now = params.now ?? Date.now();
  const input = validateNoticeReminderInput(params.input);
  const userEmail = params.userEmail.trim().toLowerCase();
  if (!params.userId || !userEmail.includes("@")) throw new Error("Verified account identity is required.");
  const id = `ndr_${crypto.randomBytes(12).toString("hex")}`;
  const scheduledAt = calculateReminderSchedule(input.deadlineDate, input.timezone, input.leadTimeDays);
  const record: NoticeDeadlineReminderV1 = {
    version: NOTICE_REMINDER_VERSION,
    kind: NOTICE_REMINDER_KIND,
    id,
    userId: params.userId,
    userEmail,
    deadlineDate: input.deadlineDate,
    timezone: input.timezone,
    label: input.label,
    noticeSlug: input.noticeSlug,
    consentAt: now,
    leadTimeDays: input.leadTimeDays,
    scheduledAt,
    status: isDeadlinePast(input.deadlineDate, input.timezone, now) || scheduledAt < now ? "expired" : "scheduled",
    deliveryKey: `notice-deadline-reminder/${id}/1`,
    attemptCount: 0,
    nextAttemptAt: scheduledAt,
    createdAt: now,
    updatedAt: now,
  };
  const ref = firestoreDb.collection(NOTICE_REMINDER_COLLECTION).doc(id);
  await firestoreDb.runTransaction(async (tx) => { tx.create(ref, sanitizeFirestoreData(record)); });
  return record;
}

export async function updateNoticeDeadlineReminder(params: {
  id: string; userId: string; userEmail: string; input: CreateNoticeReminderInput; now?: number;
}): Promise<NoticeDeadlineReminderV1> {
  const now = params.now ?? Date.now();
  const input = validateNoticeReminderInput(params.input);
  const ref = firestoreDb.collection(NOTICE_REMINDER_COLLECTION).doc(params.id);
  let updated: NoticeDeadlineReminderV1 | undefined;
  await firestoreDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ReminderOwnershipError();
    const existing = snapshot.data() as NoticeDeadlineReminderV1;
    if (existing.version !== NOTICE_REMINDER_VERSION || existing.userId !== params.userId) throw new ReminderOwnershipError();
    if (["claimed", "sent", "opted_out"].includes(existing.status)) throw new ReminderStateError("This reminder can no longer be edited.");
    const generation = Number((existing.deliveryKey.split("/").at(-1) || "1")) + 1;
    const scheduledAt = calculateReminderSchedule(input.deadlineDate, input.timezone, input.leadTimeDays);
    updated = {
      ...existing,
      userEmail: params.userEmail.trim().toLowerCase(),
      deadlineDate: input.deadlineDate,
      timezone: input.timezone,
      label: input.label,
      noticeSlug: input.noticeSlug,
      consentAt: now,
      leadTimeDays: input.leadTimeDays,
      scheduledAt,
      status: isDeadlinePast(input.deadlineDate, input.timezone, now) || scheduledAt < now ? "expired" : "scheduled",
      deliveryKey: `notice-deadline-reminder/${params.id}/${generation}`,
      attemptCount: 0,
      nextAttemptAt: scheduledAt,
      claimToken: undefined,
      claimedAt: undefined,
      sentAt: undefined,
      providerEmailId: undefined,
      lastError: undefined,
      updatedAt: now,
    };
    tx.set(ref, sanitizeFirestoreData(updated));
  });
  return updated!;
}

export async function getNoticeDeadlineRemindersForUser(userId: string): Promise<NoticeDeadlineReminderV1[]> {
  if (!userId) return [];
  const snapshot = await firestoreDb.collection(NOTICE_REMINDER_COLLECTION).where("userId", "==", userId).get();
  return snapshot.docs.map((doc) => doc.data() as NoticeDeadlineReminderV1)
    .filter((reminder) => reminder.version === NOTICE_REMINDER_VERSION && reminder.kind === NOTICE_REMINDER_KIND)
    .sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate));
}

export async function optOutNoticeDeadlineReminder(params: { id: string; userId: string; now?: number }): Promise<boolean> {
  const ref = firestoreDb.collection(NOTICE_REMINDER_COLLECTION).doc(params.id);
  await firestoreDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ReminderOwnershipError();
    const reminder = snapshot.data() as NoticeDeadlineReminderV1;
    if (reminder.version !== NOTICE_REMINDER_VERSION || reminder.userId !== params.userId) throw new ReminderOwnershipError();
    if (reminder.status === "sent") throw new ReminderStateError("This reminder was already sent.");
    if (reminder.status !== "opted_out") tx.update(ref, { status: "opted_out", updatedAt: params.now ?? Date.now(), claimToken: undefined });
  });
  return true;
}

export async function optOutNoticeDeadlineReminderByToken(params: { id: string; token: string; now?: number }): Promise<boolean> {
  const ref = firestoreDb.collection(NOTICE_REMINDER_COLLECTION).doc(params.id);
  await firestoreDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ReminderOwnershipError();
    const reminder = snapshot.data() as NoticeDeadlineReminderV1;
    if (!verifyReminderUnsubscribeToken(reminder.id, reminder.userId, params.token)) throw new ReminderOwnershipError();
    if (reminder.status !== "sent" && reminder.status !== "opted_out") tx.update(ref, { status: "opted_out", updatedAt: params.now ?? Date.now(), claimToken: undefined });
  });
  return true;
}

export async function getNoticeReminderById(id: string): Promise<NoticeDeadlineReminderV1 | null> {
  const snapshot = await firestoreDb.collection(NOTICE_REMINDER_COLLECTION).doc(id).get();
  return snapshot.exists ? snapshot.data() as NoticeDeadlineReminderV1 : null;
}

export async function getDueNoticeReminderCandidates(now = Date.now(), limit = 100): Promise<NoticeDeadlineReminderV1[]> {
  const snapshot = await firestoreDb.collection(NOTICE_REMINDER_COLLECTION)
    .where("status", "in", ["scheduled", "failed", "claimed"]).get();
  return snapshot.docs.map((doc) => doc.data() as NoticeDeadlineReminderV1).filter((r) => {
    if (r.version !== NOTICE_REMINDER_VERSION || r.kind !== NOTICE_REMINDER_KIND) return false;
    if (!["scheduled", "failed", "claimed"].includes(r.status)) return false;
    if (r.status === "claimed") return (r.claimedAt ?? now) + NOTICE_REMINDER_CLAIM_LEASE_MS <= now;
    return (r.nextAttemptAt ?? r.scheduledAt) <= now;
  }).filter((r) => r.scheduledAt <= now).slice(0, limit);
}

export async function claimNoticeDeadlineReminder(id: string, now = Date.now()): Promise<NoticeDeadlineReminderV1 | null> {
  const ref = firestoreDb.collection(NOTICE_REMINDER_COLLECTION).doc(id);
  let claimed: NoticeDeadlineReminderV1 | null = null;
  await firestoreDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return;
    const reminder = snapshot.data() as NoticeDeadlineReminderV1;
    if (reminder.version !== NOTICE_REMINDER_VERSION || reminder.kind !== NOTICE_REMINDER_KIND || ["sent", "opted_out", "expired"].includes(reminder.status)) return;
    if (isDeadlinePast(reminder.deadlineDate, reminder.timezone, now) || isReminderWindowPast(reminder.scheduledAt, reminder.timezone, now)) {
      tx.update(ref, { status: "expired", updatedAt: now, claimToken: undefined });
      return;
    }
    if (reminder.status === "claimed" && (reminder.claimedAt ?? now) + NOTICE_REMINDER_CLAIM_LEASE_MS > now) return;
    if (reminder.status !== "claimed" && (reminder.nextAttemptAt ?? reminder.scheduledAt) > now) return;
    if (reminder.attemptCount >= NOTICE_REMINDER_MAX_ATTEMPTS) return;
    const claimToken = crypto.randomUUID();
    claimed = { ...reminder, status: "claimed", claimToken, claimedAt: now, attemptCount: reminder.attemptCount + 1, updatedAt: now };
    tx.set(ref, sanitizeFirestoreData(claimed));
  });
  return claimed;
}

export async function finishNoticeReminderAttempt(params: {
  reminder: NoticeDeadlineReminderV1; success: boolean; error?: string; providerEmailId?: string; now?: number;
}): Promise<void> {
  const now = params.now ?? Date.now();
  const ref = firestoreDb.collection(NOTICE_REMINDER_COLLECTION).doc(params.reminder.id);
  await firestoreDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return;
    const current = snapshot.data() as NoticeDeadlineReminderV1;
    if (current.status !== "claimed" || current.claimToken !== params.reminder.claimToken) return;
    if (params.success) {
      tx.update(ref, { status: "sent", sentAt: now, providerEmailId: params.providerEmailId, claimToken: undefined, lastError: undefined, updatedAt: now });
      return;
    }
    const exhausted = current.attemptCount >= NOTICE_REMINDER_MAX_ATTEMPTS;
    const backoffMs = Math.min(6 * 60 * 60 * 1000, 60_000 * (2 ** Math.max(0, current.attemptCount - 1)));
    tx.update(ref, {
      status: "failed", nextAttemptAt: exhausted ? Number.MAX_SAFE_INTEGER : now + backoffMs,
      lastError: (params.error || "Email delivery failed").slice(0, 500), claimToken: undefined, updatedAt: now,
    });
  });
}

// Legacy occasion data is intentionally preserved as historical data, but new writes are disabled.
export class LegacyOccasionReminderWriteDisabledError extends Error {
  constructor() { super("Annual occasion reminders are retired. Create an explicit one-time notice deadline reminder instead."); this.name = "LegacyOccasionReminderWriteDisabledError"; }
}
export async function saveOccasionReminder(_data: Partial<OccasionReminder>): Promise<OccasionReminder> { throw new LegacyOccasionReminderWriteDisabledError(); }
export async function getRemindersForUser(_params: { userId?: string; email?: string }): Promise<OccasionReminder[]> { return []; }
export async function deleteReminder(_reminderId: string): Promise<boolean> { return false; }
export async function getUpcomingReminders(_daysAhead?: number): Promise<{ reminder: OccasionReminder; daysRemaining: number }[]> { return []; }
