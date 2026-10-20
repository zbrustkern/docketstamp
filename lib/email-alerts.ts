import { SystemIncident } from "./types";
import { STATUTORY_COMPLIANCE_DISCLOSURE, UPL_COMPLIANCE_FOOTER_TEXT } from "@/src/lib/docket/guardrails";

export interface SendAlertEmailParams {
  incident: SystemIncident;
  toEmail: string;
}

/**
 * Dispatches an automated incident alert email to the studio operator.
 * Supports Resend API (default modern standard) with zero extra npm dependencies,
 * and falls back cleanly to development console auditing if RESEND_API_KEY is not yet set.
 */
export async function sendIncidentAlertEmail({
  incident,
  toEmail,
}: SendAlertEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!toEmail || !toEmail.includes("@")) {
    return { success: false, error: "Invalid recipient email address" };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://docketstamp.com";
  const adminUrl = `${appUrl}/admin`;

  const subject = `🚨 [DocketStamp Registry Alert] ${incident.type}: ${incident.summary}`;

  const textBody = `
DocketStamp Registry Incident Alert
=====================================
Type: ${incident.type}
Severity: ${incident.severity.toUpperCase()}
Incident ID: ${incident.id}
Time: ${new Date(incident.createdAt).toLocaleString()}

Summary:
${incident.summary}

Technical Details:
${incident.technicalDetails || "No additional technical details recorded."}

Resolve Incident:
${adminUrl}
`.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0F172A; margin: 0; padding: 24px; color: #F8FAFC; }
    .card { background: #1E293B; border: 1px solid #334155; border-radius: 12px; max-width: 600px; margin: 0 auto; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    .header { border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }
    .badge { display: inline-block; background-color: #FEE2E2; color: #991B1B; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
    .title { font-size: 20px; font-weight: 700; color: #F8FAFC; margin: 12px 0 6px 0; }
    .meta { font-size: 13px; color: #94A3B8; }
    .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #CBD5E1; margin-top: 24px; margin-bottom: 8px; }
    .summary-box { background-color: #450A0A; border-left: 4px solid #EF4444; padding: 12px 16px; font-size: 15px; font-weight: 500; color: #FCA5A5; border-radius: 4px; }
    pre { background-color: #0F172A; color: #E2E8F0; padding: 14px; border-radius: 8px; font-size: 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; font-family: ui-monospace, Menlo, monospace; border: 1px solid #334155; }
    .btn { display: inline-block; background-color: #0284C7; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 24px; }
    .footer { font-size: 12px; color: #64748B; text-align: center; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">${incident.severity} • ${incident.type}</span>
      <h1 class="title">Registry Incident Alert</h1>
      <div class="meta">ID: <code>${incident.id}</code> &bull; ${new Date(incident.createdAt).toLocaleString()}</div>
    </div>

    <div class="section-title">Incident Summary</div>
    <div class="summary-box">${escapeHtml(incident.summary)}</div>

    ${
      incident.technicalDetails
        ? `
      <div class="section-title">Technical Diagnostics</div>
      <pre>${escapeHtml(String(incident.technicalDetails))}</pre>
    `
        : ""
    }

    <a href="${adminUrl}" class="btn" style="color: #ffffff;">Open Admin Incident Feed &rarr;</a>
  </div>
  <div class="footer">
    DocketStamp Registry Alerts &bull; Sent automatically from docketstamp.com system monitor
  </div>
</body>
</html>
`.trim();

  // 1. Resend API Dispatch
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail =
        process.env.RESEND_FROM_EMAIL || "alerts@docketstamp.com";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `DocketStamp Registry Alerts <${fromEmail}>`,
          to: [toEmail],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("[Email Alert] Resend API error:", data);
        return { success: false, error: data.message || "Resend error" };
      }

      console.log(`[Email Alert] Sent successfully to ${toEmail} via Resend. ID: ${data.id}`);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Email Alert] Exception sending email:", msg);
      return { success: false, error: msg };
    }
  }

  // 2. Fallback: Log email ready in development/mock mode
  console.log(`[Email Alert Sim] (RESEND_API_KEY not configured) -> Would send to: ${toEmail}\nSubject: ${subject}\n${textBody}`);
  return {
    success: true,
    error: "RESEND_API_KEY not set in environment; alert logged to console.",
  };
}

function escapeHtml(text?: string | null): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface SendReminderEmailParams {
  toEmail: string;
  recipientName: string;
  occasionTitle: string;
  occasionDateFormatted: string;
  daysRemaining: number;
  sendCardUrl: string;
}

export interface SendNoticeDeadlineReminderEmailParams {
  toEmail: string;
  label: string;
  deadlineDateFormatted: string;
  leadTimeDays: number;
  reviewUrl: string;
  unsubscribeUrl: string;
  idempotencyKey: string;
}

/** Sends a one-time reminder tied to a user's explicit calendar date and consent. */
export async function sendNoticeDeadlineReminderEmail({
  toEmail, label, deadlineDateFormatted, leadTimeDays, reviewUrl, unsubscribeUrl, idempotencyKey,
}: SendNoticeDeadlineReminderEmailParams): Promise<{ success: boolean; error?: string; emailId?: string }> {
  if (!toEmail || !toEmail.includes("@")) return { success: false, error: "Invalid recipient email address" };
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { success: false, error: "RESEND_API_KEY is not configured; no email was sent." };

  const escapedLabel = escapeHtml(label);
  const safeReviewUrl = escapeHtml(reviewUrl);
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);
  const when = leadTimeDays === 0 ? "today" : `in ${leadTimeDays} ${leadTimeDays === 1 ? "day" : "days"}`;
  const disclosure = STATUTORY_COMPLIANCE_DISCLOSURE;
  const text = `You asked DocketStamp to remind you about: ${label}\nDate you entered: ${deadlineDateFormatted}\n\nReview a notice: ${reviewUrl}\n\nUnsubscribe: ${unsubscribeUrl}\n\n${disclosure}`;
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f5f9;color:#0f172a;padding:24px"><main style="max-width:560px;margin:auto;background:white;border:1px solid #cbd5e1;border-radius:12px;padding:28px"><p style="font-size:12px;text-transform:uppercase;color:#0369a1;font-weight:bold">One-time notice reminder</p><h1 style="font-size:22px">A date you entered is ${when}</h1><p><strong>${escapedLabel}</strong></p><p>Date you entered: <strong>${escapeHtml(deadlineDateFormatted)}</strong></p><p>This message is a reminder of the date and label you supplied. DocketStamp does not determine or verify legal deadlines.</p><p><a href="${safeReviewUrl}" style="display:inline-block;background:#0369a1;color:white;padding:12px 18px;border-radius:6px;text-decoration:none">Review notice options</a></p><p style="font-size:12px"><a href="${safeUnsubscribeUrl}">Manage or unsubscribe from this reminder</a></p><hr/><p style="font-size:11px;color:#475569">${escapeHtml(disclosure)}</p></main></body></html>`;
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || "reminders@docketstamp.com";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        from: `DocketStamp Reminders <${fromEmail}>`, to: [toEmail],
        subject: `Reminder: ${label} — ${deadlineDateFormatted}`, text, html,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { success: false, error: result.message || `Resend error (${response.status})` };
    return { success: true, emailId: result.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Legacy occasion reminders are retained as historical records but no longer send mail. */
export async function sendOccasionReminderEmail(_params: SendReminderEmailParams): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: "Annual occasion reminder email delivery is retired. Use an explicit one-time notice deadline reminder." };
}

export interface SendDocketDispatchReceiptEmailParams {
  toEmail: string;
  docketId: string;
  serviceLevelLabel?: string;
  recipientName?: string;
  recipientAddressSummary?: string;
  recipientSummary?: string;
  trackingNumber?: string;
  orderId?: string;
}

/**
 * Dispatches an official customer transactional dispatch receipt email.
 * Dark-slate / institutional style containing docket record, service level,
 * recipient summary, tracking link, and mandatory UPL compliance footer.
 */
export async function sendDocketDispatchReceiptEmail({
  toEmail,
  docketId,
  serviceLevelLabel = "USPS Certified Mail®",
  recipientName,
  recipientAddressSummary,
  recipientSummary,
  trackingNumber,
  orderId,
}: SendDocketDispatchReceiptEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!toEmail || !toEmail.includes("@")) {
    return { success: false, error: "Invalid recipient email address" };
  }

  const effectiveRecipientName =
    recipientName ||
    (recipientSummary ? recipientSummary.split("—")[0].trim() : "Designated Recipient");
  const effectiveAddressSummary =
    recipientAddressSummary ||
    (recipientSummary ? (recipientSummary.split("—")[1] || recipientSummary).trim() : "");

  const subject = `Official Docket Dispatched: ${docketId} (${serviceLevelLabel})`;
  const docketUrl = `https://docketstamp.com/docket/${docketId}`;
  const uplFooter = UPL_COMPLIANCE_FOOTER_TEXT(docketId);

  const textBody = `
DocketStamp Official Dispatch Registry
======================================
Official Dispatch Certification & Receipt

DOCKET ID:       ${docketId}
SERVICE LEVEL:   ${serviceLevelLabel}
RECIPIENT:       ${effectiveRecipientName}
DESTINATION:     ${effectiveAddressSummary}
${trackingNumber ? `USPS TRACKING:   ${trackingNumber}\n` : ""}${orderId ? `ORDER ID:        ${orderId}\n` : ""}
LIVE DOCKET TRACKING & PROOF RECORD:
${docketUrl}

--------------------------------------
${uplFooter}
`.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0F172A; margin: 0; padding: 24px; color: #F8FAFC; }
    .card { background: #1E293B; border: 1px solid #334155; border-radius: 16px; max-width: 600px; margin: 0 auto; padding: 36px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .header { border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }
    .badge { display: inline-block; background-color: #0284C7; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; font-family: ui-monospace, Menlo, monospace; }
    .title { font-size: 22px; font-weight: 700; color: #F8FAFC; margin: 16px 0 6px 0; }
    .docket-id { font-family: ui-monospace, Menlo, monospace; font-size: 14px; color: #38BDF8; font-weight: bold; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .details-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #334155; }
    .details-table td.label { width: 35%; color: #94A3B8; font-family: ui-monospace, Menlo, monospace; text-transform: uppercase; font-size: 11px; }
    .details-table td.value { color: #F8FAFC; font-weight: 500; }
    .btn { display: inline-block; background-color: #0284C7; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0; font-family: ui-monospace, Menlo, monospace; text-transform: uppercase; letter-spacing: 0.05em; }
    .footer { font-size: 10px; color: #94A3B8; margin-top: 32px; border-top: 1px solid #334155; padding-top: 20px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">Official USPS Dispatch</span>
      <h1 class="title">Formal Legal Notice Dispatched</h1>
      <div class="docket-id">DOCKET ID: ${escapeHtml(docketId)}</div>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 16px 0;">
      Your administrative instrument has been processed, verified via USPS CASS™, and inducted into the postal stream.
    </p>

    <table class="details-table">
      <tr>
        <td class="label">Docket ID</td>
        <td class="value" style="font-family: ui-monospace, Menlo, monospace; color: #38BDF8;">${escapeHtml(docketId)}</td>
      </tr>
      <tr>
        <td class="label">Service Level</td>
        <td class="value">${escapeHtml(serviceLevelLabel)}</td>
      </tr>
      <tr>
        <td class="label">Recipient</td>
        <td class="value">${escapeHtml(effectiveRecipientName)}</td>
      </tr>
      <tr>
        <td class="label">Destination</td>
        <td class="value">${escapeHtml(effectiveAddressSummary)}</td>
      </tr>
      ${
        trackingNumber
          ? `<tr>
        <td class="label">USPS Tracking</td>
        <td class="value" style="font-family: ui-monospace, Menlo, monospace; color: #10B981; font-weight: bold;">${escapeHtml(
          trackingNumber
        )}</td>
      </tr>`
          : ""
      }
    </table>

    <div style="text-align: center;">
      <a href="${escapeHtml(docketUrl)}" class="btn" style="color: #ffffff;">View Official Docket Record &rarr;</a>
    </div>

    <div class="footer">
      <strong>STATUTORY DOCKET NOTICE:</strong> ${escapeHtml(uplFooter)}
      <br/><br/>
      DocketStamp Official Registry &bull; Dispatched via Western Amalgamated &bull; <a href="https://docketstamp.com" style="color: #38BDF8; text-decoration: none;">docketstamp.com</a>
    </div>
  </div>
</body>
</html>
`.trim();

  const resendApiKey =
    process.env.RESEND_API_KEY ||
    process.env["RESEND_API_KEY"] ||
    process.env["resend-api-key"];

  const fromEmail = process.env.RESEND_DISPATCH_FROM_EMAIL || "dispatch@docketstamp.com";
  const fromHeader = `DocketStamp Official Registry <${fromEmail}>`;

  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [toEmail],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("[Dispatch Receipt Email] Resend API error:", data);
        return { success: false, error: data.message || "Resend error" };
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Dispatch Receipt Email] Exception sending email:", msg);
      return { success: false, error: msg };
    }
  }

  // Development / Mock mode
  console.log(
    `[Dispatch Receipt Email Sim] (RESEND_API_KEY not configured) -> Would send to: ${toEmail}\nFrom: ${fromHeader}\nSubject: ${subject}\n${textBody}`
  );
  return { success: true };
}
