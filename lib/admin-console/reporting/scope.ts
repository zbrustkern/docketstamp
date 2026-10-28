import type { ReportScope } from './compute';

export type CalendarRange = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

function calendarParts(at: number, timezone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(at).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)])) as Record<string, number>;
}

export function localDateKey(at: Date, timezone: string): string {
  const p = calendarParts(at.getTime(), timezone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function dateParts(date: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error('INVALID_CALENDAR_DATE');
  const [, y, m, d] = match;
  const parsed = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (parsed.toISOString().slice(0, 10) !== date) throw new Error('INVALID_CALENDAR_DATE');
  return [Number(y), Number(m), Number(d)];
}

/** Convert local midnight to UTC without assuming that every local day is 24 hours. */
export function localMidnightUtc(date: string, timezone: string): string {
  const [year, month, day] = dateParts(date);
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  for (let i = 0; i < 8; i++) {
    const p = calendarParts(guess, timezone);
    const rendered = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const next = guess + target - rendered;
    if (next === guess) break;
    guess = next;
  }
  const result = new Date(guess);
  if (localDateKey(result, timezone) !== date) throw new Error('LOCAL_MIDNIGHT_UNAVAILABLE');
  return result.toISOString();
}

function addDays(date: string, amount: number): string {
  const [year, month, day] = dateParts(date);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

export function calendarScope(
  environment: 'local' | 'staging' | 'production',
  now = new Date(),
  timezone = 'America/Chicago',
  range: CalendarRange = '7d',
  customStart?: string,
  customEndInclusive?: string,
): ReportScope {
  const today = localDateKey(now, timezone);
  let startDate: string;
  let endDateExclusive: string;
  if (range === 'today') { startDate = today; endDateExclusive = addDays(today, 1); }
  else if (range === 'yesterday') { startDate = addDays(today, -1); endDateExclusive = today; }
  else if (range === '30d') { startDate = addDays(today, -29); endDateExclusive = addDays(today, 1); }
  else if (range === 'custom') {
    if (!customStart || !customEndInclusive || customEndInclusive < customStart) throw new Error('INVALID_CUSTOM_DATE_RANGE');
    startDate = customStart; endDateExclusive = addDays(customEndInclusive, 1);
  } else { startDate = addDays(today, -6); endDateExclusive = addDays(today, 1); }
  return {
    startUtc: localMidnightUtc(startDate, timezone), endUtcExclusive: localMidnightUtc(endDateExclusive, timezone),
    displayTimezone: timezone, environment, classification: 'customer', reportVersion: 1, cohortPolicyVersion: 1,
  };
}
