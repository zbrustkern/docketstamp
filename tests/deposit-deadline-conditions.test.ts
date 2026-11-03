import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { securityDepositNotice } from '../src/lib/docket/notices/02-security-deposit-return';
import { STATE_STATUTES } from '../src/lib/docket/data/state-statutes';
import { interpolateNotice } from '../src/lib/docket/renderer/interpolate';
import { renderLobHtmlPayload } from '../src/lib/docket/renderer/lob-html-shell';
import { assessPhysicalFit } from '../src/lib/docket/renderer/physical-fit';
import { validateNoticeInput } from '../src/lib/docket/input-validation';
import { LivePaperSheet } from '../src/components/docket/LivePaperSheet';

const facts = {
  senderFullName: 'Alex Example', recipientFormalName: 'Example Property Office',
  senderAddressLine1: '100 Main St', senderCity: 'Austin', senderState: 'TX', senderZip: '78701',
  recipientAddressLine1: '200 Oak St', recipientCity: 'Austin', recipientState: 'TX', recipientZip: '78701',
  vacatedPremisesAddress: '300 Elm St', moveOutDate: '2026-09-01',
  depositAmount: '1500', amountReceivedToDate: '0', balanceRequested: '1500',
  basisForRequest: 'My records show no refund has arrived.', responseDays: '10 business days',
};

function documentFor(propertyState: string, extra: Record<string, string> = {}) {
  return interpolateNotice({ notice: securityDepositNotice,
    userValues: { ...facts, propertyState, ...extra },
    docketId: 'DS-2026-CONDITIONS', executionDate: 'November 3, 2026' });
}

test('Texas timing preserves surrender and forwarding-address conditions without asserting compliance', () => {
  const text = documentFor('TX').rawParagraphs.join(' ');
  assert.ok(text.includes(`Texas security-deposit law (${STATE_STATUTES.TX.statuteCitation})`));
  assert.match(text, /30-day refund period runs from surrender, subject to the written forwarding-address requirement in § 92\.107/);
  assert.doesNotMatch(text, /I (?:have )?(?:provided|delivered|surrendered)|deadline (?:has|expired)|bad.faith|treble|penalty|damages/i);
});

test('Arizona timing states all three triggers and exact excluded days, not an elapsed deadline', () => {
  const text = documentFor('AZ').rawParagraphs.join(' ');
  assert.match(text, /Arizona security-deposit law \(Ariz\. Rev\. Stat\. § 33-1321\(D\)\)/);
  assert.match(text, /14-day period excludes Saturdays, Sundays and legal holidays/);
  assert.match(text, /follows termination of tenancy, delivery of possession and tenant demand/);
  assert.doesNotMatch(text, /14 (?:business )?days of surrender|already (?:due|expired)|I (?:have )?(?:terminated|delivered)/i);
});

test('all supported states retain citations and demands; unreviewed timing uses a qualified general fallback', () => {
  for (const [state, statute] of Object.entries(STATE_STATUTES)) {
    const doc = documentFor(state);
    const text = doc.rawParagraphs.join(' ');
    assert.ok(text.includes(statute.statuteCitation), `${state}: citation`);
    assert.match(text, /demand the return of the residential security deposit balance of \$1,500\.00/);
    assert.match(text, /within 10 business days of receipt/);
    assert.match(text, /My requested response period does not change any statutory deadline/);
    assert.match(text, /I reserve all remedies available under applicable law/);
    assert.doesNotMatch(text, /statutory bad-faith|treble|guaranteed|\{\{/i);
    if (!['TX', 'AZ'].includes(state)) {
      assert.match(doc.rawParagraphs[2], /Any statutory return or accounting deadline depends on the applicable triggers, conditions and exceptions/);
      assert.doesNotMatch(doc.rawParagraphs[2], /\d+ (?:calendar |business )?days/);
    }
  }
});

test('missing/unsupported state never borrows sender state or defaults to a statutory deadline', () => {
  for (const state of ['', 'ZZ', 'PR']) {
    const doc = documentFor(state);
    assert.match(doc.rawParagraphs[2], /\[STATUTE CITATION\]/);
    assert.doesNotMatch(doc.rawParagraphs[2], /Tex\. Prop\. Code|30-day|14-day/);
    const result = validateNoticeInput(securityDepositNotice, { ...facts, propertyState: state });
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.issues.some((issue) => issue.path === 'propertyState'));
  }
});

test('caller-supplied statutory prose and penalty assertions cannot replace renderer-owned text', () => {
  const injected = { depositDeadlineStatement: 'PAY NOW: deadline expired; guaranteed treble damages',
    statuteCitation: 'FAKE CITATION', statuteDeadline: '1 hour', penaltyClause: 'automatic penalties' };
  for (const state of ['TX', 'AZ', 'IN', '']) {
    const doc = documentFor(state, injected);
    assert.doesNotMatch(doc.rawParagraphs.join(' '), /PAY NOW|FAKE CITATION|1 hour|guaranteed treble|automatic penalties/);
  }
  const validated = validateNoticeInput(securityDepositNotice, { ...facts, propertyState: 'TX', ...injected });
  assert.equal(validated.success, true);
  if (validated.success) assert.equal(Object.hasOwn(validated.userValues, 'depositDeadlineStatement'), false);
});

test('preview tokens, React paper and print preserve the same timing paragraph and one-page fit', () => {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  for (const state of ['TX', 'AZ', 'IN', 'CA']) {
    for (const serviceLevel of ['first_class', 'certified', 'certified_return_receipt'] as const) {
      const doc = { ...documentFor(state), clerkStamp: { ...documentFor(state).clerkStamp, serviceLevel } };
      const paragraph = doc.rawParagraphs[2];
      assert.equal(doc.paragraphs[2].map((token) => token.content).join(''), paragraph);
      assert.ok(renderLobHtmlPayload(doc).includes(escape(paragraph)));
      const preview = renderToStaticMarkup(React.createElement(LivePaperSheet, { doc, onTokenClick: () => {} }));
      const plain = preview.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'");
      assert.ok(plain.includes(escape(paragraph)), `${state}: visible preview`);
      assert.equal(assessPhysicalFit(doc).fits, true, `${state}/${serviceLevel}: ordinary letter fits`);
    }
  }
});
