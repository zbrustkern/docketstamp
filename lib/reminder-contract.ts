/** Canonical, one-time notice reminder contract. Legacy occasion data stays separate. */
export const NOTICE_REMINDER_VERSION = 1 as const;
export const NOTICE_REMINDER_KIND = "notice_deadline" as const;
export const NOTICE_REMINDER_LEAD_TIME_OPTIONS = [0, 1, 3, 7, 14, 30] as const;
export const NOTICE_REMINDER_COLLECTION = "notice_deadline_reminders";
export const NOTICE_REMINDER_MAX_ATTEMPTS = 5;
export const NOTICE_REMINDER_CLAIM_LEASE_MS = 5 * 60 * 1000;

export type NoticeReminderStatus = "scheduled" | "claimed" | "sent" | "failed" | "opted_out" | "expired";

export interface NoticeDeadlineReminderV1 {
  version: typeof NOTICE_REMINDER_VERSION;
  kind: typeof NOTICE_REMINDER_KIND;
  id: string;
  userId: string;
  userEmail: string;
  deadlineDate: string;
  timezone: string;
  label: string;
  noticeSlug: string;
  consentAt: number;
  leadTimeDays: (typeof NOTICE_REMINDER_LEAD_TIME_OPTIONS)[number];
  scheduledAt: number;
  status: NoticeReminderStatus;
  deliveryKey: string;
  attemptCount: number;
  nextAttemptAt: number;
  claimToken?: string;
  claimedAt?: number;
  sentAt?: number;
  providerEmailId?: string;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateNoticeReminderInput {
  deadlineDate: string;
  timezone: string;
  label: string;
  noticeSlug: string;
  consent: true;
  leadTimeDays: number;
}
