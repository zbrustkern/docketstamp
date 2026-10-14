import { SystemIncident } from "./types";

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

function escapeHtml(text: string): string {
  return text
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

/**
 * Dispatches an automated, tasteful occasion milestone reminder email.
 */
export async function sendOccasionReminderEmail({
  toEmail,
  recipientName,
  occasionTitle,
  occasionDateFormatted,
  daysRemaining,
  sendCardUrl,
}: SendReminderEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!toEmail || !toEmail.includes("@")) {
    return { success: false, error: "Invalid recipient email address" };
  }

  const subject = `💌 Reminder: ${occasionTitle} is in ${daysRemaining} days (${occasionDateFormatted})`;

  const textBody = `
DocketStamp Registry Statutory Reminder
========================================
Just a friendly heads-up: ${occasionTitle} is coming up on ${occasionDateFormatted} (in ${daysRemaining} days).

Formal legal notices typically take 1–2 business days to prepare and 2–5 business days to deliver via USPS First-Class or Certified Mail.
Dispatching your notice now ensures it satisfies statutory notice windows before the deadline!

Prepare your notice:
${sendCardUrl}

Regards,
DocketStamp Registry | docketstamp.com
`.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0F172A; margin: 0; padding: 24px; color: #F8FAFC; }
    .card { background: #1E293B; border: 1px solid #334155; border-radius: 16px; max-width: 560px; margin: 0 auto; padding: 36px; box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
    .badge { display: inline-block; background-color: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
    .title { font-family: Georgia, serif; font-size: 22px; font-weight: 700; color: #F8FAFC; margin: 14px 0 8px 0; }
    .content { font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 16px 0; }
    .highlight-box { background-color: #0F172A; border-left: 3px solid #0284C7; padding: 14px 18px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #E2E8F0; }
    .btn { display: inline-block; background-color: #0284C7; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
    .footer { font-size: 11px; color: #64748B; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Statutory Deadline Reminder</span>
    <h1 class="title">${escapeHtml(occasionTitle)} is in ${daysRemaining} days</h1>
    
    <div class="content">
      <p>Hello,</p>
      <p>This is your formal reminder that a statutory or contractual notice deadline for <strong>${escapeHtml(recipientName)}</strong> is scheduled for <strong>${escapeHtml(occasionDateFormatted)}</strong>.</p>
      
      <div class="highlight-box">
        <strong>📮 USPS Postal Dispatch:</strong> Physical notices dispatched via USPS First-Class or Certified Mail take 1–2 business days to process and 2–5 business days for domestic transit.
      </div>
      
      <a href="${escapeHtml(sendCardUrl)}" class="btn" style="color: #ffffff;">Prepare Notice &rarr;</a>
    </div>

    <div class="footer">
      You are receiving this because you scheduled a notice reminder on <a href="https://docketstamp.com" style="color: #94A3B8;">docketstamp.com</a>.
      <br/>DocketStamp &bull; Official Document & Certified Mail Dispatch Registry.
    </div>
  </div>
</body>
</html>
`.trim();

  const resendApiKey =
    process.env.RESEND_API_KEY ||
    process.env["RESEND_API_KEY"] ||
    process.env["resend-api-key"];

  if (resendApiKey) {
    try {
      const fromEmail =
        process.env.RESEND_FROM_EMAIL || "reminders@docketstamp.com";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `DocketStamp Reminders <${fromEmail}>`,
          to: [toEmail],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || "Resend error" };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // Development simulation
  console.log(`[Reminder Email Sim] (RESEND_API_KEY not configured) -> Would send reminder to: ${toEmail} for ${occasionTitle} (${occasionDateFormatted})`);
  return { success: true };
}
