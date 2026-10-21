/**
 * Lob 8.5" x 11" Physical Letter HTML/CSS Print Shell
 *
 * Implements the exact 1-page court-ready geometry specified in Section 9 of
 * docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md:
 * - 0in to 1.80in top clear zone for USPS Certified Mail banner and window envelopes
 * - Top-Right Clerk's Docket Stamp box at top: 1.85in; right: 0.60in; width: 3.15in
 * - Letter body container starting strictly at top: 3.35in; left: 0.75in; right: 0.75in
 * - Signature block with /s/ Full Name electronic signature line
 * - Locked 6.8pt UPL compliance footer at bottom: 0.40in
 */

import { InterpolatedDocument, MailTierId } from '../types';
import { UPL_COMPLIANCE_FOOTER_TEXT } from '../guardrails';

const TIER_DISPATCH_LABELS: Record<MailTierId, string> = {
  first_class: 'USPS FIRST-CLASS MAIL®',
  certified: 'USPS CERTIFIED MAIL®',
  certified_return_receipt: 'USPS CERTIFIED + RETURN RECEIPT',
};

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates the self-contained 1-page 8.5in x 11in HTML string for Lob /v1/letters
 */
export function renderLobHtmlPayload(doc: InterpolatedDocument): string {
  const safeDocketId = escapeHtml(doc.docketId);
  const safeHeaderTitle = escapeHtml(doc.headerTitle);
  const safeReLine = escapeHtml(doc.reLine);
  const safeTimestamp = escapeHtml(doc.clerkStamp.timestampUtc);
  const safeTier = escapeHtml(TIER_DISPATCH_LABELS[doc.clerkStamp.serviceLevel] || doc.clerkStamp.serviceLevel.toUpperCase());
  const safeCassStatus = escapeHtml(doc.clerkStamp.cassStatus || 'ADDRESS VERIFICATION NOT CONFIRMED');
  const safeSigner = escapeHtml(doc.signatureBlock.signerName);
  const safeFormalSig = escapeHtml(doc.signatureBlock.formalSignature);
  const safeExecDate = escapeHtml(doc.signatureBlock.executionDate);
  const safeRecipient = escapeHtml(doc.recipientAddress.name || 'RECEIVING PARTY / MANAGEMENT ENTITY');

  const paragraphsHtml = doc.rawParagraphs
    .map((p) => `<p class="paragraph">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n      ');

  const enclosuresHtml = doc.enclosuresLine
    ? `<div style="margin-top: 10px; font-size: 8.5pt; font-style: italic; color: #475569;">${escapeHtml(doc.enclosuresLine)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeDocketId} - ${safeHeaderTitle}</title>
<style>
  @page { size: 8.5in 11in; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    width: 8.5in;
    height: 11in;
    margin: 0;
    padding: 0;
    position: relative;
    font-family: Georgia, 'Times New Roman', serif;
    color: #0F172A;
    background: #FFFFFF;
    overflow: hidden;
  }
  /* Top-Right Clerk's Docket Stamp Box (Clears left window & top certified banner) */
  .docket-stamp-box {
    position: absolute;
    top: 1.85in;
    right: 0.60in;
    width: 3.15in;
    border: 1.5px solid #0F172A;
    background-color: #F8FAFC;
    padding: 7px 9px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 7.5pt;
    line-height: 1.35;
  }
  .docket-stamp-header {
    font-weight: bold;
    border-bottom: 1px solid #0F172A;
    padding-bottom: 3px;
    margin-bottom: 4px;
    letter-spacing: 0.03em;
  }
  /* Formal Letter Content Zone */
  .letter-body-container {
    position: absolute;
    top: 3.35in;
    left: 0.75in;
    right: 0.75in;
    bottom: 0.80in;
    overflow-wrap: anywhere;
  }
  .doc-header-title {
    font-size: 10.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 2px solid #0F172A;
    padding-bottom: 5px;
    margin-bottom: 10px;
  }
  .re-docket-block {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt;
    font-weight: bold;
    background-color: #F1F5F9;
    border-left: 3px solid #0284C7;
    padding: 6px 10px;
    margin-bottom: 14px;
  }
  .salutation {
    font-size: 9.5pt;
    font-weight: bold;
    margin-bottom: 10px;
  }
  .paragraph {
    font-size: 9.5pt;
    line-height: 1.50;
    text-align: justify;
    margin: 0 0 10px 0;
  }
  .signature-block {
    margin-top: 16px;
  }
  .signature-line {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11pt;
    font-weight: bold;
    border-bottom: 1px solid #334155;
    display: inline-block;
    max-width: 100%;
    overflow-wrap: anywhere;
    min-width: 2.8in;
    padding-bottom: 2px;
    margin-top: 8px;
    margin-bottom: 4px;
  }
  .compliance-footer {
    position: absolute;
    bottom: 0.40in;
    left: 0.75in;
    right: 0.75in;
    border-top: 1px solid #CBD5E1;
    padding-top: 4px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 6.8pt;
    color: #64748B;
    text-align: center;
    line-height: 1.3;
  }
</style>
</head>
<body>
  <!-- Top-Right Clerk's Docket Stamp Box -->
  <div class="docket-stamp-box">
    <div class="docket-stamp-header">DOCKETSTAMP™ OFFICIAL DISPATCH REGISTRY</div>
    <div><strong>DOCKET ID:</strong>  ${safeDocketId}</div>
    <div><strong>FILED UTC:</strong>  ${safeTimestamp}</div>
    <div><strong>DISPATCH:</strong>   ${safeTier}</div>
    <div><strong>ROUTING:</strong>    ${safeCassStatus}</div>
  </div>

  <!-- Letter Body Content Zone -->
  <div class="letter-body-container">
    <div class="doc-header-title">${safeHeaderTitle}</div>
    <div class="re-docket-block">${safeReLine}</div>
    <div class="salutation">TO: ${safeRecipient}</div>

    <div class="letter-paragraphs">
      ${paragraphsHtml}
    </div>

    <!-- Formal Signature Block -->
    <div class="signature-block">
      <div style="font-size: 9pt;">Respectfully submitted,</div>
      <div class="signature-line">${safeFormalSig}</div>
      <div style="font-size: 8pt; color: #475569;">
        ${safeSigner} &bull; Executed on ${safeExecDate} &bull; Docket ID: ${safeDocketId}
      </div>
    </div>

    ${enclosuresHtml}
  </div>

  <!-- Locked UPL Compliance Footer (0.40in from bottom) -->
  <div class="compliance-footer">
    ${UPL_COMPLIANCE_FOOTER_TEXT(doc.docketId)}
  </div>
</body>
</html>`;
}

export const renderLobHtmlShell = renderLobHtmlPayload;
