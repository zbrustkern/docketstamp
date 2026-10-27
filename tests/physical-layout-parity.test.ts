import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ALL_NOTICE_CARTRIDGES } from '../src/lib/docket/notices';
import { interpolateNotice } from '../src/lib/docket/renderer/interpolate';
import { renderLobHtmlPayload } from '../src/lib/docket/renderer/lob-html-shell';
import { PHYSICAL_LAYOUT, physicalLayoutCss } from '../src/lib/docket/renderer/physical-layout';
import { UPL_COMPLIANCE_FOOTER_TEXT } from '../src/lib/docket/guardrails';
import { LivePaperSheet } from '../src/components/docket/LivePaperSheet';

function maximumValues(notice: (typeof ALL_NOTICE_CARTRIDGES)[number]): Record<string, string> {
  const values: Record<string, string> = {
    senderFullName: 'Alexandria Maximilian Customer Name',
    recipientFormalName: 'Example Institutional Recipient Office',
    rentalPropertyAddress: '1234 Long Residential Avenue, Building 17, Unit 809',
    senderAddressLine1: '9876 Extended Residential Boulevard Apartment 1204',
    senderAddressLine2: 'ATTENTION OF CUSTOMER OPERATIONS DEPARTMENT',
    senderCity: 'San Francisco', senderState: 'CA', senderZip: '94105-1204',
    recipientAddressLine1: '8400 Long Corporate Parkway Suite 1400',
    recipientAddressLine2: 'LEGAL AND ADMINISTRATIVE NOTICES DEPARTMENT',
    recipientCity: 'Los Angeles', recipientState: 'CA', recipientZip: '90012-3401',
    accountNumber: 'A'.repeat(64),
  };
  for (const field of notice.fields) {
    if (values[field.key]) continue;
    if (field.options?.length) {
      values[field.key] = field.options[0].value;
      continue;
    }
    const max = field.maxLength || 72;
    values[field.key] = (`MAXIMUM ${field.key.toUpperCase()} VALUE `).repeat(Math.ceil(max / (field.key.length + 14))).slice(0, max);
  }
  return values;
}

test('shared physical layout pins one Letter page and exact USPS and disclosure geometry', () => {
  const css = physicalLayoutCss();
  assert.equal(PHYSICAL_LAYOUT.page.width, '8.5in');
  assert.equal(PHYSICAL_LAYOUT.page.height, '11in');
  for (const declaration of [
    'top: 1.85in;', 'right: 0.60in;', 'width: 3.15in;',
    'top: 3.35in;', 'left: 0.75in;', 'right: 0.75in;', 'bottom: 0.80in;',
    'bottom: 0.40in;', 'font-size: 6.8pt;', 'font-size: 9.5pt;',
  ]) assert.ok(css.includes(declaration), `shared layout keeps ${declaration}`);
  assert.ok(css.includes('overflow: visible;'), 'content that exceeds the paper remains observable for layout verification');
});

test('all nine notices and three tiers retain max-length content and exact disclosures in one-page output', () => {
  const tiers = ['first_class', 'certified', 'certified_return_receipt'] as const;
  for (const notice of ALL_NOTICE_CARTRIDGES) {
    for (const serviceLevel of tiers) {
      const docketId = `DS-2026-${'Q'.repeat(72)}`;
      const doc = interpolateNotice({ notice, userValues: maximumValues(notice), serviceLevel, docketId });
      const html = renderLobHtmlPayload(doc);
      assert.ok(html.includes('@page { size: 8.5in 11in; margin: 0; }'), `${notice.slug}/${serviceLevel}: Letter page`);
      assert.ok(html.includes(`DOCKET ID:</strong>  ${docketId}`), `${notice.slug}/${serviceLevel}: long docket id retained`);
      assert.ok(html.includes(UPL_COMPLIANCE_FOOTER_TEXT(docketId)), `${notice.slug}/${serviceLevel}: mandatory footer retained`);
      assert.ok(html.includes('Reserved 0in–1.80in for Lob address_placement: top_first_page'));
      assert.ok(!/<(?:div|address)[^>]*class="[^"]*postal-address-(?:sender|recipient)/.test(html), `${notice.slug}/${serviceLevel}: supplier address clear zone has no customer-owned address blocks`);
      assert.ok(html.includes('top: 1.85in;') && html.includes('top: 3.35in;') && html.includes('bottom: 0.40in;'), `${notice.slug}/${serviceLevel}: protected zones`);
      for (const paragraph of doc.rawParagraphs) {
        const escaped = paragraph.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        assert.ok(html.includes(escaped), `${notice.slug}/${serviceLevel}: no content removed from the frozen body`);
      }
    }
  }
});

test('interactive paper uses the shared sheet and keeps token controls inside the letter flow', () => {
  const notice = ALL_NOTICE_CARTRIDGES[0];
  const doc = interpolateNotice({ notice, userValues: {}, docketId: 'DS-2026-PREVIEW', serviceLevel: 'certified' });
  const markup = renderToStaticMarkup(React.createElement(LivePaperSheet, {
    doc, onTokenClick: () => {}, activeFieldKey: 'moveOutDate',
  }));
  assert.ok(markup.includes('data-testid="live-paper-sheet"'));
  assert.ok(markup.includes('data-testid="docusign-tag-moveOutDate"'));
  assert.ok(markup.includes('Sincerely,'));
  assert.ok(markup.includes(UPL_COMPLIANCE_FOOTER_TEXT(doc.docketId)));
  assert.ok(markup.includes('width: 8.5in; height: 11in;'));
});
