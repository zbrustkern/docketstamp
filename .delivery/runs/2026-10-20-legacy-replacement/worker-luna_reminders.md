# Luna worker result — SPRINT-0008 one-time notice reminders

**Workspace:** isolated clone `/tmp/docketstamp-replacement-20261020/reminders`  
**Base:** `fe52dcf`  
**Status:** implemented locally; coordinator review and integration remain pending.

## Contract and behavior

Added `NoticeDeadlineReminderV1` in `lib/reminder-contract.ts`. New reminder requests require an explicit ISO calendar date, validated IANA timezone, user-entered label, supported notice slug, explicit `consent: true`, and lead time of 0, 1, 3, 7, 14, or 30 days. Scheduling uses 09:00 on the lead date in the user's timezone. Calendar-date arithmetic handles DST and leap years; past dates and missed reminder windows expire and never roll to the following year.

New records live in `notice_deadline_reminders`. The old `occasion_reminders` collection is not migrated or rewritten. The new reader excludes it; legacy occasion writes and emails are retired so birthday data cannot create a notice deadline or trigger annual email. The existing checkout caller catches the disabled legacy writer as a non-critical reminder failure.

`GET` and `POST` `/api/reminders` require a verified Firebase UID and verified email. `POST` creates or reschedules; `DELETE ?id=` performs owner-checked, idempotent opt-out. An email unsubscribe HMAC is confirmed with a non-mutating GET and applied by POST. `POST /api/reminders/scheduler` is an authenticated callable path guarded by an independent `REMINDER_SCHEDULER_SECRET` (32+ characters, timing-safe comparison). No existing cron/scheduler entry was found and no recurring schedule was added. Resend requests use the reminder generation's stable idempotency key; failures retry with bounded backoff and a five-attempt limit.

Email copy repeats the user-entered label/date, links to `/notices/{noticeSlug}`, makes clear that DocketStamp does not determine or verify deadlines, includes the statutory UPL disclosure and unsubscribe route, and does not sign, pay, or dispatch. Scheduler behavior is tested with an injected sender; the email request test stubs `fetch`, so no live email was sent.

## Files changed

- `.env.example` documents the separate server-only `REMINDER_UNSUBSCRIBE_SECRET` and `REMINDER_SCHEDULER_SECRET`; it does not contain credentials or configure a schedule.
- `app/api/reminders/route.ts`, `app/api/reminders/scheduler/route.ts`, and `app/api/reminders/unsubscribe/route.ts` implement the authenticated reminder APIs.
- `lib/reminder-contract.ts`, `lib/reminder-utils.ts`, `lib/reminders.ts`, and `lib/reminder-scheduler.ts` implement validation, date handling, persistence, ownership, idempotent claim/retry and opt-out.
- `lib/email-alerts.ts` adds the one-time notice reminder sender and disables the retired occasion email.
- `tests/notice-deadline-reminders.test.ts` covers the replacement behavior; `tests/reminders.test.ts` now verifies legacy occasion write/delivery retirement.

## Validation

- `node --import tsx --test tests/notice-deadline-reminders.test.ts` — **10 passed, 0 failed**. Includes invalid consent/date/timezone/lead inputs; DST start/end; leap day; owner and reschedule checks; preservation/exclusion of a historical birthday record; GET confirmation and explicit HMAC unsubscribe POST; concurrent scheduler runs; deep link; provider idempotency key; bounded retry/backoff; past/missed-date expiration; scheduler-secret fail-closed behavior; and mocked email payload/UPL disclosure.
- `node --import tsx tests/reminders.test.ts` — **passed** legacy retirement assertions.
- `npm run test:firebase` — **6 passed**.
- `npm run test:security` and `npm run test:payment-mode` initially hit sandbox `tsx` IPC `listen EPERM`; the required CLI workaround, `node --import tsx tests/transaction-security.test.ts` and `node --import tsx tests/payment-mode-safety.test.ts`, passed (**10/10** and **26/26** respectively). Those suites only used their existing mock paths; no reminder sender is invoked.
- `npx tsc --noEmit --pretty false` — reports **63 project diagnostics**; none mention changed reminder modules or reminder tests. The replacement roadmap records the same 63 diagnostics on the pre-change checkout.
- `npm run build` — **blocked** because the sandbox cannot resolve `fonts.googleapis.com`; Next.js could not fetch Inter, JetBrains Mono, or Merriweather. No source error from the reminder package was reported before the font fetch failure.
- `git diff --check` — passed.

## Limits and coordinator follow-up

The account and order pages are outside this worker's scope and still submit/read the retired occasion shape; account UI must be connected to the documented version-1 fields and supported lead-time constant before release. Existing `occasion_reminders` documents remain historical records and no migration or deletion was performed. An external scheduler must remain unconfigured pending separate review. Delivery requires server-only `REMINDER_UNSUBSCRIBE_SECRET`, `REMINDER_SCHEDULER_SECRET`, and `RESEND_API_KEY`; without Resend configuration email attempts fail closed. Resend documents provider idempotency retention of 24 hours, so this protects concurrent runs and bounded retries but does not establish indefinite deduplication after a very long ambiguous outage. No payment, sign, postal, or customer-email side effect is part of a reminder.
