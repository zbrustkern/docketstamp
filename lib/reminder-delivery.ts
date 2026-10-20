/** Operator enables this only after configuring and verifying an external scheduler. */
export function getReminderDeliveryReadiness(env: Record<string, string | undefined> = process.env) {
  const configured = Boolean(env.RESEND_API_KEY &&
    (env.REMINDER_SCHEDULER_SECRET?.length ?? 0) >= 32 &&
    (env.REMINDER_UNSUBSCRIBE_SECRET?.length ?? 0) >= 32);
  const enabled = configured && env.REMINDER_DELIVERY_ENABLED === "true";
  return {
    status: enabled ? "ready" as const : configured ? "disabled" as const : "not_configured" as const,
    enabled,
    message: enabled ? "Email reminders are enabled." : "Email delivery is not enabled yet. Saved dates will not send email until delivery is enabled.",
  };
}
