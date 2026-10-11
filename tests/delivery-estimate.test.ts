import assert from "node:assert";
import {
  calculateDeliveryEstimate,
  isBusinessDay,
  addBusinessDays,
} from "../lib/delivery-estimate";
import { PRODUCT_TIMING, PRODUCT_PRICE, PRODUCT_FORMAT } from "../lib/product-facts";

console.log("=================================================");
console.log("🧪 RUNNING CANONICAL DELIVERY ESTIMATE & FACTS TESTS");
console.log("=================================================");

// 1. Test isBusinessDay weekend and holiday boundaries
console.log("\n--- 1. Testing Weekend and Holiday Boundaries ---");

// Saturday & Sunday
const saturday = new Date(2026, 9, 17); // Oct 17, 2026 is Saturday
const sunday = new Date(2026, 9, 18); // Oct 18, 2026 is Sunday
const monday = new Date(2026, 9, 19); // Oct 19, 2026 is Monday

assert.strictEqual(isBusinessDay(saturday), false, "Saturday is not a business day");
assert.strictEqual(isBusinessDay(sunday), false, "Sunday is not a business day");
assert.strictEqual(isBusinessDay(monday), true, "Regular Monday is a business day");
console.log("✅ PASS: Saturdays and Sundays are excluded from business days");

// Federal Holidays
// New Year's Day (Jan 1, 2026 was Thursday)
const newYearsDay = new Date(2026, 0, 1);
assert.strictEqual(isBusinessDay(newYearsDay), false, "Jan 1 is a federal holiday");

// Independence Day (July 4, 2026 was Saturday -> Friday July 3 observed)
const july3 = new Date(2026, 6, 3);
assert.strictEqual(isBusinessDay(july3), false, "July 3, 2026 (observed Independence Day) is excluded");

// Christmas Day (Dec 25, 2026 is Friday)
const christmas = new Date(2026, 11, 25);
assert.strictEqual(isBusinessDay(christmas), false, "Dec 25, 2026 is Christmas Day federal holiday");
console.log("✅ PASS: US Federal Holidays are excluded from business days");

// 2. Test addBusinessDays skips weekends
console.log("\n--- 2. Testing addBusinessDays Skipping Weekends ---");
const friday = new Date(2026, 9, 16); // Friday Oct 16, 2026
const nextMonday = addBusinessDays(friday, 1);
assert.strictEqual(nextMonday.getDay(), 1, "Adding 1 business day to Friday lands on Monday");
assert.strictEqual(nextMonday.getDate(), 19, "Lands on Oct 19, skipping weekend");
console.log("✅ PASS: Adding business days skips weekends");

// 3. Test calculateDeliveryEstimate return contract and honest guidance
console.log("\n--- 3. Testing calculateDeliveryEstimate Contract & Guidance ---");
const estimate = calculateDeliveryEstimate();
assert.ok(typeof estimate.dispatchDate === "string", "dispatchDate is a string");
assert.ok(typeof estimate.earliestDate === "string", "earliestDate is a string");
assert.ok(typeof estimate.latestDate === "string", "latestDate is a string");
assert.ok(typeof estimate.formattedRange === "string", "formattedRange is a string");
assert.strictEqual(estimate.isEstimate, true, "isEstimate is explicitly true");
assert.ok(estimate.guidanceText.includes("estimated, not guaranteed"), "Guidance explicitly states timing is estimated, not guaranteed");
assert.ok(estimate.guidanceText.includes("1–2 business days"), "Guidance includes 1–2 business days preparation");
assert.ok(estimate.guidanceText.includes("2–7 business days"), "Guidance includes 2–7 business days transit");
console.log("✅ PASS: calculateDeliveryEstimate fulfills honest guidance contract");

// 4. Test scheduled date input
console.log("\n--- 4. Testing Scheduled Delivery Date ---");
const scheduledEstimate = calculateDeliveryEstimate("2026-12-01");
assert.strictEqual(scheduledEstimate.isScheduled, true, "isScheduled is true for scheduled date");
assert.ok(scheduledEstimate.formattedRange.includes("Dec"), "Formatted range reflects December");
console.log("✅ PASS: Scheduled delivery estimates correctly compute future ranges");

// 5. Test canonical product facts values
console.log("\n--- 5. Testing Canonical Product Facts ---");
assert.strictEqual(PRODUCT_PRICE.amountInDollars, 9, "Price is $9");
assert.strictEqual(PRODUCT_PRICE.amountInCents, 900, "Price in cents is 900");
assert.strictEqual(PRODUCT_FORMAT.formatName, "Folded A2", "Format is Folded A2");
assert.strictEqual(PRODUCT_FORMAT.foldedWidthInches, 4.25, "Folded width is 4.25");
assert.strictEqual(PRODUCT_FORMAT.foldedHeightInches, 5.5, "Folded height is 5.5");
assert.strictEqual(PRODUCT_FORMAT.aspectRatioFront.ratioString, "17:22", "Aspect ratio is 17:22");
assert.strictEqual(PRODUCT_TIMING.preparationBusinessDaysMin, 1, "Min prep is 1 business day");
assert.strictEqual(PRODUCT_TIMING.preparationBusinessDaysMax, 2, "Max prep is 2 business days");
assert.strictEqual(PRODUCT_TIMING.transitBusinessDaysMin, 2, "Min transit is 2 business days");
assert.strictEqual(PRODUCT_TIMING.transitBusinessDaysMax, 7, "Max transit is 7 business days");
console.log("✅ PASS: Canonical product facts match canonical product specs exactly");

console.log("\n=================================================");
console.log("🎉 ALL DELIVERY ESTIMATE & PRODUCT FACTS TESTS PASSED");
console.log("=================================================");
