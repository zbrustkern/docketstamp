/**
 * USPS First-Class Mail Delivery Timing Guidance
 *
 * Governing documents:
 * - /docs/CANONICAL_PRODUCT_SPECS.md (rows: Preparation time, Transit time)
 * - /docs/CONVERSION_REDESIGN_WORK_PLAN.md (§0, §4.4)
 * - /lib/product-facts.ts
 *
 * Rules:
 * - Preparation typically 1–2 business days.
 * - Transit typically 2–7 business days domestically via USPS First-Class.
 * - All dates are explicitly estimates, not guarantees.
 * - Excludes weekends (Saturday & Sunday) and standard US Federal Holidays.
 * - Eliminates artificial 2 PM cutoffs and "same-day" dispatch promises.
 */

import { PRODUCT_TIMING } from "./product-facts";

/**
 * Standard fixed and floating US Federal Holidays (observed):
 * 1. New Year's Day (Jan 1)
 * 2. Martin Luther King Jr. Day (3rd Monday in Jan)
 * 3. Washington's Birthday / Presidents' Day (3rd Monday in Feb)
 * 4. Memorial Day (Last Monday in May)
 * 5. Juneteenth National Independence Day (Jun 19)
 * 6. Independence Day (Jul 4)
 * 7. Labor Day (1st Monday in Sep)
 * 8. Columbus Day (2nd Monday in Oct)
 * 9. Veterans Day (Nov 11)
 * 10. Thanksgiving Day (4th Thursday in Nov)
 * 11. Christmas Day (Dec 25)
 */
function isUSFederalHoliday(date: Date): boolean {
  const month = date.getMonth(); // 0-indexed (0 = Jan, 11 = Dec)
  const day = date.getDate();
  const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat

  // Helper for Nth day of week in month
  const nthDayOfMonth = Math.ceil(day / 7);
  const isLastMondayInMay =
    month === 4 && dayOfWeek === 1 && day + 7 > 31;

  // Fixed dates with weekend observation logic:
  // If holiday falls on Saturday, observed on Friday. If Sunday, observed on Monday.
  const isFixedHoliday = (m: number, d: number) => {
    if (month === m && day === d && dayOfWeek >= 1 && dayOfWeek <= 5) return true;
    // Observed on Friday if Saturday
    if (month === m && day === d - 1 && dayOfWeek === 5) return true;
    // Observed on Monday if Sunday
    if (month === m && day === d + 1 && dayOfWeek === 1) return true;
    return false;
  };

  // 1. New Year's Day (Jan 1)
  if (isFixedHoliday(0, 1)) return true;
  // 2. MLK Day: 3rd Monday in Jan
  if (month === 0 && dayOfWeek === 1 && nthDayOfMonth === 3) return true;
  // 3. Presidents' Day: 3rd Monday in Feb
  if (month === 1 && dayOfWeek === 1 && nthDayOfMonth === 3) return true;
  // 4. Memorial Day: Last Monday in May
  if (isLastMondayInMay) return true;
  // 5. Juneteenth: Jun 19
  if (isFixedHoliday(5, 19)) return true;
  // 6. Independence Day: Jul 4
  if (isFixedHoliday(6, 4)) return true;
  // 7. Labor Day: 1st Monday in Sep
  if (month === 8 && dayOfWeek === 1 && nthDayOfMonth === 1) return true;
  // 8. Columbus Day: 2nd Monday in Oct
  if (month === 9 && dayOfWeek === 1 && nthDayOfMonth === 2) return true;
  // 9. Veterans Day: Nov 11
  if (isFixedHoliday(10, 11)) return true;
  // 10. Thanksgiving Day: 4th Thursday in Nov
  if (month === 10 && dayOfWeek === 4 && nthDayOfMonth === 4) return true;
  // 11. Christmas Day: Dec 25
  if (isFixedHoliday(11, 25)) return true;

  return false;
}

/**
 * Checks if a date is a business day (Monday through Friday, excluding federal holidays).
 */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return false; // Weekend
  }
  return !isUSFederalHoliday(date);
}

/**
 * Adds a given number of business days to a starting date.
 */
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      added++;
    }
  }
  return result;
}

export interface DeliveryWindow {
  dispatchDate: string; // Formatted estimated dispatch date
  earliestDate: string; // e.g. "Wed, Oct 1"
  latestDate: string;   // e.g. "Fri, Oct 10"
  formattedRange: string; // e.g. "Oct 1 – Oct 10 (Estimated)"
  isScheduled: boolean;
  isEstimate: boolean;
  guidanceText: string;
}

/**
 * Calculates conservative estimated delivery timing based on canonical specifications:
 * - Preparation typically 1–2 business days.
 * - Transit typically 2–7 business days domestically via USPS First-Class.
 * - Excludes weekends and federal holidays.
 * - Always labelled as estimated.
 */
export function calculateDeliveryEstimate(scheduledDateString?: string): DeliveryWindow {
  let baseDate: Date;
  let isScheduled = false;

  if (scheduledDateString && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDateString)) {
    const [year, month, day] = scheduledDateString.split("-").map(Number);
    baseDate = new Date(year, month - 1, day);
    isScheduled = true;
  } else {
    // Current date. No artificial 2 PM cutoff; preparation is estimated at 1–2 business days.
    baseDate = new Date();
  }

  // Preparation window: typically 1 to 2 business days
  // If scheduled, the scheduled date is the targeted dispatch base date.
  const earliestDispatch = isScheduled ? baseDate : addBusinessDays(baseDate, PRODUCT_TIMING.preparationBusinessDaysMin);
  const latestDispatch = isScheduled ? addBusinessDays(baseDate, 1) : addBusinessDays(baseDate, PRODUCT_TIMING.preparationBusinessDaysMax);

  // Domestic Transit window: typically 2 to 7 business days from dispatch
  const earliestDelivery = addBusinessDays(earliestDispatch, PRODUCT_TIMING.transitBusinessDaysMin);
  const latestDelivery = addBusinessDays(latestDispatch, PRODUCT_TIMING.transitBusinessDaysMax);

  const formatShort = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const formatFull = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const formattedRange = `${formatShort(earliestDelivery)} – ${formatShort(latestDelivery)}`;

  return {
    dispatchDate: formatFull(earliestDispatch),
    earliestDate: formatFull(earliestDelivery),
    latestDate: formatFull(latestDelivery),
    formattedRange,
    isScheduled,
    isEstimate: true,
    guidanceText: PRODUCT_TIMING.summaryGuidance,
  };
}
