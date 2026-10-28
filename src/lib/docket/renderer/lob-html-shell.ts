/**
 * Lob 8.5" x 11" notice HTML/CSS print shell
 *
 * Implements the print geometry currently used by the notice renderer:
 * - 0in to 1.80in clear zone reserved for Lob's top_first_page address placement
 * - Top-Right DocketStamp preparation record at top: 1.85in; right: 0.60in; width: 3.15in
 * - Letter body container starting strictly at top: 3.35in; left: 0.75in; right: 0.75in
 * - Signature block with a typed signature line
 * - Locked 6.8pt UPL compliance footer at bottom: 0.40in
 */

import { InterpolatedDocument, MailTierId } from '../types';
import { UPL_COMPLIANCE_FOOTER_TEXT } from '../guardrails';
import { physicalLayoutCss } from './physical-layout';

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
 * Generates the self-contained 8.5in x 11in HTML string for Lob /v1/letters
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
  ${physicalLayoutCss()}
</style>
</head>
<body><main class="paper-page">
  <!-- Reserved 0in–1.80in for Lob address_placement: top_first_page. Keep customer address content out of submitted HTML. -->
  <!-- Top-Right DocketStamp Preparation Record -->
  <div class="docket-stamp-box">
    <div class="docket-stamp-header">DOCKETSTAMP™ PREPARATION RECORD</div>
    <div><strong>DOCKET ID:</strong>  ${safeDocketId}</div>
    <div><strong>PREPARED UTC:</strong>  ${safeTimestamp}</div>
    <div><strong>MAILING SERVICE:</strong>   ${safeTier}</div>
    <div><strong>ADDRESS STATUS:</strong>    ${safeCassStatus}</div>
  </div>

  <!-- Letter Body Content Zone -->
  <div class="letter-body-container">
    <div class="doc-header-title">${safeHeaderTitle}</div>
    <div class="re-docket-block">${safeReLine}</div>
    <div class="salutation">TO: ${safeRecipient}</div>

    <div class="letter-paragraphs">
      ${paragraphsHtml}
    </div>

    <!-- Typed Signature Block -->
    <div class="signature-block">
      <div style="font-size: 9pt;">Sincerely,</div>
      <div class="signature-line">${safeFormalSig}</div>
      <div style="font-size: 8pt; color: #475569;">
        ${safeSigner} &bull; Executed on ${safeExecDate} &bull; Docket ID: ${safeDocketId}
      </div>
    </div>

    ${enclosuresHtml}
  </div>

  <!-- UPL Compliance Footer (0.40in from bottom) -->
  <div class="compliance-footer">
    ${escapeHtml(UPL_COMPLIANCE_FOOTER_TEXT(doc.docketId))}
  </div>
</main></body>
</html>`;
}

export const renderLobHtmlShell = renderLobHtmlPayload;
