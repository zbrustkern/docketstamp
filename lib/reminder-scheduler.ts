import { sendNoticeDeadlineReminderEmail } from "./email-alerts";
import {
  claimNoticeDeadlineReminder,
  createReminderUnsubscribeToken,
  finishNoticeReminderAttempt,
  getDueNoticeReminderCandidates,
} from "./reminders";
import { formatDeadlineDate } from "./reminder-utils";

export type ReminderEmailSender = typeof sendNoticeDeadlineReminderEmail;

export async function runNoticeReminderScheduler(options: { now?: number; send?: ReminderEmailSender; limit?: number } = {}) {
  const now = options.now ?? Date.now();
  const sender = options.send ?? sendNoticeDeadlineReminderEmail;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://docketstamp.com";
  const candidates = await getDueNoticeReminderCandidates(now, options.limit ?? 100);
  const result = { considered: candidates.length, sent: 0, failed: 0, skipped: 0 };

  for (const candidate of candidates) {
    const claimed = await claimNoticeDeadlineReminder(candidate.id, now);
    if (!claimed) { result.skipped += 1; continue; }
    try {
      const reviewUrl = new URL(`/notices/${encodeURIComponent(claimed.noticeSlug)}`, baseUrl).toString();
      const unsubscribeUrl = new URL(`/api/reminders/unsubscribe?id=${encodeURIComponent(claimed.id)}&token=${encodeURIComponent(createReminderUnsubscribeToken(claimed.id, claimed.userId))}`, baseUrl).toString();
      const emailResult = await sender({
        toEmail: claimed.userEmail,
        label: claimed.label,
        deadlineDateFormatted: formatDeadlineDate(claimed.deadlineDate, claimed.timezone),
        leadTimeDays: claimed.leadTimeDays,
        reviewUrl,
        unsubscribeUrl,
        idempotencyKey: claimed.deliveryKey,
      });
      await finishNoticeReminderAttempt({ reminder: claimed, success: emailResult.success, error: emailResult.error, providerEmailId: emailResult.emailId, now });
      if (emailResult.success) result.sent += 1;
      else result.failed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await finishNoticeReminderAttempt({ reminder: claimed, success: false, error: message, now });
      result.failed += 1;
    }
  }
  return result;
}
