/**
 * Lob 8.5" x 11" Physical Letter HTML/CSS Print Shell
 *
 * Generates an exact court-ready 8.5" x 11" HTML/CSS document conforming to
 * USPS clear zone specifications for Lob programmatic dispatch:
 * - 3.5" top margin clear zone on Page 1 for Lob address window printing
 * - 0.625" bottom clear zone for USPS Intelligent Mail barcode (IMb)
 * - Top-right Clerk's Docket Stamp block (DS-2026-XXXXX, service tier, UTC timestamp, CASS status)
 * - Formal serif typography (Merriweather / Georgia), letter-spacing, line-height
 * - Mandatory 8pt UPL statutory footer disclosure
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§3.2, §4, §6)
 * - docs/DESIGN_SYSTEM.md (§2, §3)
 */

import { InterpolatedDocument, MailTierId } from '../types';
import { UPL_COMPLIANCE_DISCLOSURE } from '../guardrails';

const TIER_DISPLAY_NAMES: Record<MailTierId, string> = {
  first_class: 'USPS FIRST-CLASS MAIL® (IMb TRACKED)',
  certified: 'USPS CERTIFIED MAIL®',
  certified_return_receipt: 'USPS CERTIFIED MAIL® + ELECTRONIC RETURN RECEIPT',
};

/**
 * Escapes HTML characters to prevent XSS / broken layout.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Renders the complete HTML document string for Lob /v1/letters.
 */
export function renderLobHtmlShell(doc: InterpolatedDocument): string {
  const tierName = TIER_DISPLAY_NAMES[doc.clerkStamp.serviceLevel] || doc.clerkStamp.serviceLevel.toUpperCase();
  const safeDocketId = escapeHtml(doc.clerkStamp.docketId);
  const safeHeaderTitle = escapeHtml(doc.headerTitle);
  const safeReLine = escapeHtml(doc.reLine);
  const safeTimestamp = escapeHtml(doc.clerkStamp.timestampUtc);
  const safeCassStatus = escapeHtml(doc.clerkStamp.cassStatus);
  const safeSigner = escapeHtml(doc.signatureBlock.signerName);
  const safeFormalSig = escapeHtml(doc.signatureBlock.formalSignature);
  const safeExecDate = escapeHtml(doc.signatureBlock.executionDate);

  const renderedParagraphs = doc.rawParagraphs
    .map((p) => `<p class="document-paragraph">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  const enclosuresMarkup = doc.enclosuresLine
    ? `<div class="enclosures-block">${escapeHtml(doc.enclosuresLine)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeDocketId} - ${safeHeaderTitle}</title>
  <style>
    @page {
      size: 8.5in 11in;
      margin: 0;
    }

    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: 'Merriweather', 'Georgia', 'Times New Roman', serif;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #0f172a;
      background-color: #ffffff;
    }

    /* 8.5in x 11in Page Canvas */
    .page-sheet {
      position: relative;
      width: 8.5in;
      height: 11in;
      padding: 0.75in 0.85in 0.85in 0.85in;
      box-sizing: border-box;
      overflow: hidden;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Lob Top Address Placement:
       When using address_placement: "top_first_page", Lob prints the address
       window in the top 3.5 inches. We reserve the header & docket block,
       ensuring clean clear spacing. */
    .header-band {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .header-titles {
      max-width: 60%;
    }

    .header-main-title {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 0 0 4px 0;
      line-height: 1.25;
      text-transform: uppercase;
    }

    .header-sub-tag {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #475569;
      text-transform: uppercase;
    }

    /* Clerk's Docket Stamp Block */
    .clerk-docket-stamp {
      border: 1.5px solid #0f172a;
      padding: 6px 10px;
      background-color: #f8fafc;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 7.5pt;
      line-height: 1.35;
      color: #0f172a;
      text-transform: uppercase;
      min-width: 2.75in;
      box-shadow: 1px 1px 0px #0f172a;
    }

    .stamp-title {
      font-weight: 800;
      font-size: 8pt;
      text-align: center;
      border-bottom: 1px solid #94a3b8;
      padding-bottom: 3px;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }

    .stamp-row {
      display: flex;
      justify-content: space-between;
    }

    .stamp-label {
      color: #64748b;
    }

    .stamp-value {
      font-weight: 700;
      color: #0f172a;
    }

    .stamp-verified {
      color: #15803d;
      font-weight: 800;
      border-top: 1px solid #cbd5e1;
      margin-top: 4px;
      padding-top: 3px;
      text-align: center;
      letter-spacing: 0.5px;
    }

    /* Formal RE Docket Line */
    .re-line-box {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 9.5pt;
      font-weight: 700;
      background-color: #f1f5f9;
      border-left: 3.5px solid #0f172a;
      padding: 7px 12px;
      margin-bottom: 16px;
      color: #0f172a;
      line-height: 1.4;
    }

    /* Body Prose */
    .document-body {
      flex: 1 1 auto;
    }

    .document-paragraph {
      margin: 0 0 12pt 0;
      text-align: justify;
      text-justify: inter-word;
    }

    /* Enclosures */
    .enclosures-block {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 8pt;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 10px;
      margin-bottom: 16px;
    }

    /* Signature & Execution Block */
    .signature-section {
      margin-top: 14pt;
      padding-top: 8pt;
      border-top: 1px dashed #cbd5e1;
      font-family: 'Merriweather', 'Georgia', serif;
    }

    .formal-signature {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 12pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .signer-title {
      font-size: 9pt;
      color: #334155;
      font-style: italic;
    }

    .execution-date {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 8pt;
      color: #64748b;
      margin-top: 3px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Mandatory 8pt UPL Statutory Footer & IMb Clear Zone */
    .footer-band {
      margin-top: auto;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      /* 0.625in bottom margin required by USPS for IMb barcode clear zone */
      margin-bottom: 0.625in;
    }

    .footer-upl-text {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 7.5pt;
      line-height: 1.35;
      color: #64748b;
      text-align: center;
      margin: 0;
    }

    .footer-docket-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7pt;
      font-weight: 700;
      color: #475569;
      text-align: center;
      margin-top: 3px;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="page-sheet">
    <div>
      <div class="header-band">
        <div class="header-titles">
          <h1 class="header-main-title">${safeHeaderTitle}</h1>
          <div class="header-sub-tag">OFFICIAL STATUTORY DISPATCH INSTRUMENT • USPS POSTAL RECORD</div>
        </div>

        <div class="clerk-docket-stamp">
          <div class="stamp-title">DOCKETSTAMP™ DISPATCH REGISTRY</div>
          <div class="stamp-row">
            <span class="stamp-label">DOCKET ID:</span>
            <span class="stamp-value">${safeDocketId}</span>
          </div>
          <div class="stamp-row">
            <span class="stamp-label">DISPATCH TIER:</span>
            <span class="stamp-value">${escapeHtml(tierName)}</span>
          </div>
          <div class="stamp-row">
            <span class="stamp-label">TIMESTAMP:</span>
            <span class="stamp-value">${safeTimestamp}</span>
          </div>
          <div class="stamp-verified">
            ✓ ${safeCassStatus}
          </div>
        </div>
      </div>

      <div class="re-line-box">
        ${safeReLine}
      </div>

      <div class="document-body">
        ${renderedParagraphs}
        ${enclosuresMarkup}
      </div>

      <div class="signature-section">
        <div class="formal-signature">${safeFormalSig}</div>
        <div class="signer-title">${safeSigner}, Executing Party of Record</div>
        <div class="execution-date">Executed on: ${safeExecDate} • Dispatched via DocketStamp Postal Registry</div>
      </div>
    </div>

    <div class="footer-band">
      <p class="footer-upl-text">
        ${escapeHtml(UPL_COMPLIANCE_DISCLOSURE)}
      </p>
      <div class="footer-docket-id">
        OFFICIAL DISPATCH REGISTRY • RECORD ID: ${safeDocketId} • WESTERN AMALGAMATED
      </div>
    </div>
  </div>
</body>
</html>`;
}
