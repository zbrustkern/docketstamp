import { NOTICE_REMINDER_LEAD_TIME_OPTIONS } from "./reminder-contract";

export { NOTICE_REMINDER_LEAD_TIME_OPTIONS };

export class ReminderValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ReminderValidationError"; }
}

export function validateReminderDate(date: unknown): string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ReminderValidationError("deadlineDate must use YYYY-MM-DD format.");
  const [year, month, day] = date.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw new ReminderValidationError("deadlineDate must be a valid calendar date.");
  return date;
}

export function validateReminderTimezone(timezone: unknown): string {
  if (typeof timezone !== "string" || timezone.length > 64) throw new ReminderValidationError("timezone must be a valid IANA timezone.");
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(0); }
  catch { throw new ReminderValidationError("timezone must be a valid IANA timezone."); }
  return timezone;
}

export function validateNoticeReminderInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReminderValidationError("Reminder details are required.");
  const input = value as Record<string, unknown>;
  const deadlineDate = validateReminderDate(input.deadlineDate);
  const timezone = validateReminderTimezone(input.timezone);
  if (typeof input.label !== "string" || !input.label.trim() || input.label.trim().length > 160) throw new ReminderValidationError("Enter a reminder label of 1 to 160 characters.");
  if (typeof input.noticeSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.noticeSlug) || input.noticeSlug.length > 120) throw new ReminderValidationError("A valid notice slug is required.");
  if (input.consent !== true) throw new ReminderValidationError("Explicit consent is required to schedule an email reminder.");
  if (!NOTICE_REMINDER_LEAD_TIME_OPTIONS.includes(input.leadTimeDays as (typeof NOTICE_REMINDER_LEAD_TIME_OPTIONS)[number])) throw new ReminderValidationError("leadTimeDays must be one of 0, 1, 3, 7, 14, or 30.");
  return { deadlineDate, timezone, label: input.label.trim(), noticeSlug: input.noticeSlug, consent: true as const, leadTimeDays: input.leadTimeDays as (typeof NOTICE_REMINDER_LEAD_TIME_OPTIONS)[number] };
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day - days));
  return `${result.getUTCFullYear().toString().padStart(4, "0")}-${(result.getUTCMonth() + 1).toString().padStart(2, "0")}-${result.getUTCDate().toString().padStart(2, "0")}`;
}

/** Resolve 09:00 local to an instant. 09:00 avoids DST gap/fold hours. */
export function localReminderTimeToEpoch(date: string, timezone: string, hour = 9): number {
  validateReminderDate(date); validateReminderTimezone(timezone);
  const [year, month, day] = date.split("-").map(Number);
  const desiredWallTime = Date.UTC(year, month - 1, day, hour, 0, 0);
  let guess = desiredWallTime;
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = Object.fromEntries(format.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const representedWallTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const correction = desiredWallTime - representedWallTime;
    guess += correction;
    if (correction === 0) break;
  }
  return guess;
}

export function calculateReminderSchedule(deadlineDate: string, timezone: string, leadTimeDays: number): number {
  return localReminderTimeToEpoch(addCalendarDays(validateReminderDate(deadlineDate), leadTimeDays), timezone, 9);
}

export function isDeadlinePast(deadlineDate: string, timezone: string, now: number): boolean {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: validateReminderTimezone(timezone), year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(now)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}` > validateReminderDate(deadlineDate);
}

export function isReminderWindowPast(scheduledAt: number, timezone: string, now: number): boolean {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: validateReminderTimezone(timezone), year: "numeric", month: "2-digit", day: "2-digit" });
  const localDate = (time: number) => {
    const parts = Object.fromEntries(format.formatToParts(new Date(time)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  return localDate(now) > localDate(scheduledAt);
}

export function formatDeadlineDate(date: string, timezone: string): string {
  // Anchor in the requested local calendar date, including UTC+14/UTC-12 zones.
  const localNoon = localReminderTimeToEpoch(validateReminderDate(date), timezone, 12);
  return new Intl.DateTimeFormat("en-US", { timeZone: validateReminderTimezone(timezone), dateStyle: "long" }).format(new Date(localNoon));
}

// Historical occasion helpers remain available only for archived account metadata rendering.
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTH_SHORT_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatOccasionDate(month: number, day: number, year?: number): string {
  const name = MONTH_SHORT_NAMES[month - 1] || `Month ${month}`;
  return year ? `${name} ${day}, ${year}` : `${name} ${day}`;
}
export function getOccasionTypeDisplay(type: string) {
  const common = { birthday: ["Birthday", "Gift", "🎂", "bg-amber-100 text-amber-800 border-amber-300"], anniversary: ["Anniversary", "Heart", "🥂", "bg-rose-100 text-rose-800 border-rose-300"], holiday: ["Holiday", "Calendar", "🎄", "bg-indigo-100 text-indigo-800 border-indigo-300"], milestone: ["Milestone", "Award", "🏆", "bg-emerald-100 text-emerald-700 border-emerald-300"] } as Record<string, string[]>;
  const [label, iconName, emoji, badgeClass] = common[type] || ["Special Date", "Sparkles", "⭐️", "bg-stone-100 text-stone-800 border-stone-300"];
  return { label, iconName, emoji, badgeClass };
}
