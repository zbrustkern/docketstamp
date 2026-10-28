/** One physical letter-sheet contract shared by preview and Lob HTML output. */
export const PHYSICAL_LAYOUT = Object.freeze({
  page: { width: '8.5in', height: '11in', cssWidth: 816, cssHeight: 1056 },
  postalAddress: { left: '0.625in', topSender: '0.42in', topRecipient: '1.04in', width: '3.35in', fontSize: '8pt', lineHeight: 1.2 },
  certifiedClearZone: { top: '0in', bottom: '1.80in' },
  stamp: { top: '1.85in', right: '0.60in', width: '3.15in', fontSize: '7.5pt', lineHeight: 1.35 },
  body: { top: '3.35in', left: '0.75in', right: '0.75in', bottom: '0.80in' },
  title: { fontSize: '10.5pt', lineHeight: 1.25 },
  subject: { fontSize: '8.5pt', lineHeight: 1.3 },
  paragraph: { fontSize: '9.5pt', lineHeight: 1.5, marginBottom: '10px' },
  footer: { bottom: '0.40in', left: '0.75in', right: '0.75in', fontSize: '6.8pt', lineHeight: 1.3 },
  ink: '#0F172A',
  sans: 'Arial, Helvetica, sans-serif',
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
});

/** CSS declarations are kept in one place so the server renderer and preview use the same measurements. */
export function physicalLayoutCss(includeDocumentRules = true): string {
  const { page, postalAddress, stamp, body, title, subject, paragraph, footer } = PHYSICAL_LAYOUT;
  return `${includeDocumentRules ? `
  @page { size: ${page.width} ${page.height}; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { width: ${page.width}; height: ${page.height}; margin: 0; padding: 0; }
` : ''}
  .paper-page { width: ${page.width}; height: ${page.height}; margin: 0; position: relative; overflow: visible; background: #fff; color: ${PHYSICAL_LAYOUT.ink}; font-family: ${PHYSICAL_LAYOUT.serif}; }
  .postal-address { position: absolute; left: ${postalAddress.left}; width: ${postalAddress.width}; font-family: ${PHYSICAL_LAYOUT.sans}; font-size: ${postalAddress.fontSize}; line-height: ${postalAddress.lineHeight}; overflow-wrap: anywhere; }
  .postal-address-sender { top: ${postalAddress.topSender}; }
  .postal-address-recipient { top: ${postalAddress.topRecipient}; }
  .docket-stamp-box { position: absolute; top: ${stamp.top}; right: ${stamp.right}; width: ${stamp.width}; border: 1.5px solid ${PHYSICAL_LAYOUT.ink}; background: #F8FAFC; padding: 7px 9px; font-family: ${PHYSICAL_LAYOUT.mono}; font-size: ${stamp.fontSize}; line-height: ${stamp.lineHeight}; }
  .docket-stamp-header { font-weight: bold; border-bottom: 1px solid ${PHYSICAL_LAYOUT.ink}; padding-bottom: 3px; margin-bottom: 4px; letter-spacing: 0.03em; }
  .letter-body-container { position: absolute; top: ${body.top}; left: ${body.left}; right: ${body.right}; bottom: ${body.bottom}; overflow-wrap: anywhere; }
  .doc-header-title { font-size: ${title.fontSize}; line-height: ${title.lineHeight}; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid ${PHYSICAL_LAYOUT.ink}; padding-bottom: 5px; margin: 0 0 10px; }
  .re-docket-block { font-family: ${PHYSICAL_LAYOUT.sans}; font-size: ${subject.fontSize}; line-height: ${subject.lineHeight}; font-weight: bold; background: #F1F5F9; border-left: 3px solid #0284C7; padding: 6px 10px; margin: 0 0 14px; }
  .salutation { font-size: 9.5pt; line-height: 1.3; font-weight: bold; margin: 0 0 10px; }
  .paragraph { font-size: ${paragraph.fontSize}; line-height: ${paragraph.lineHeight}; text-align: justify; margin: 0 0 ${paragraph.marginBottom}; }
  .signature-block { margin-top: 16px; }
  .signature-line { display: inline-block; max-width: 100%; min-width: 2.8in; overflow-wrap: anywhere; border-bottom: 1px solid #334155; padding-bottom: 2px; margin: 8px 0 4px; font-family: ${PHYSICAL_LAYOUT.mono}; font-size: 11pt; font-weight: bold; }
  .compliance-footer { position: absolute; bottom: ${footer.bottom}; left: ${footer.left}; right: ${footer.right}; border-top: 1px solid #CBD5E1; padding-top: 4px; font-family: ${PHYSICAL_LAYOUT.sans}; font-size: ${footer.fontSize}; color: #64748B; text-align: center; line-height: ${footer.lineHeight}; }
  .editable-token { display: inline; border: 0; margin: 0; padding: 0; color: inherit; font: inherit; line-height: inherit; text-align: inherit; vertical-align: baseline; background: transparent; cursor: pointer; }
  .editable-token-filled { box-shadow: inset 0 -0.35em #EFF6FF; }
  .editable-token-filled:hover, .editable-address:hover { background: #EFF6FF; }
  .editable-token-empty { color: #92400E; box-shadow: inset 0 -0.35em #FEF3C7; }
  .editable-token-empty:hover { box-shadow: inset 0 -0.7em #FEF3C7; }
  .editable-token.is-active, .editable-address.is-active, .editable-token:focus-visible, .editable-address:focus-visible { outline: 2px solid #D97706; outline-offset: 1px; background-color: #FEF3C7; }
  .editable-address { border: 0; margin: 0; padding: 0; display: inline; background: transparent; color: inherit; font: inherit; line-height: inherit; text-align: left; cursor: pointer; }
  .signature-line.editable-address { display: inline-block; }
`;
}
