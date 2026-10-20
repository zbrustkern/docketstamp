import assert from "node:assert/strict";
import { LegacyOccasionReminderWriteDisabledError, getRemindersForUser, saveOccasionReminder } from "../lib/reminders";
import { sendOccasionReminderEmail } from "../lib/email-alerts";

async function runLegacyReminderRetirementChecks() {
  await assert.rejects(
    saveOccasionReminder({ userEmail: "legacy@example.com" } as never),
    LegacyOccasionReminderWriteDisabledError,
    "new writes must not create annual occasion reminders",
  );
  assert.deepEqual(await getRemindersForUser({ email: "legacy@example.com" }), [], "legacy reminders are not scheduled by the new reader");
  const email = await sendOccasionReminderEmail({
    toEmail: "legacy@example.com", recipientName: "Customer", occasionTitle: "Birthday",
    occasionDateFormatted: "Oct 20", daysRemaining: 14, sendCardUrl: "https://example.invalid",
  });
  assert.equal(email.success, false, "retired occasion reminders cannot send a birthday email");
  console.log("PASS: historical occasion reminder writes and delivery are retired without converting records");
}

runLegacyReminderRetirementChecks().catch((error) => {
  console.error("Legacy reminder retirement check failed:", error);
  process.exit(1);
});
