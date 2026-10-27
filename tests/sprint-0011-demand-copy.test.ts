import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHOOSER_LETTERS, HARDWARE_OEM_PURPOSE_OPTIONS } from '../src/lib/docket/chooser-routing';
import { interpolateNotice } from '../src/lib/docket/renderer/interpolate';
import { renderLobHtmlPayload } from '../src/lib/docket/renderer/lob-html-shell';
import { ALL_NOTICE_CARTRIDGES, getNoticeBySlug } from '../src/lib/docket/notices';
import { debtValidationNotice } from '../src/lib/docket/notices/05-debt-validation-request';
import { biometricPrivacyDeletionNotice } from '../src/lib/docket/notices/09-biometric-privacy-deletion';
import { securityDepositNotice } from '../src/lib/docket/notices/02-security-deposit-return';
import { tenantRepairNotice } from '../src/lib/docket/notices/03-tenant-repair-request';
import { GET as getLlmsTxt } from '../app/llms.txt/route';

function combinedParagraphTokens(document: ReturnType<typeof interpolateNotice>): string[] {
  return document.paragraphs.map((paragraph) => paragraph.map((token) => token.content).join(''));
}

describe('SPRINT-0011 customer-facing copy integration', () => {
  it('keeps nine chooser products on canonical staging slugs and preserves legacy aliases', () => {
    const chooserSlugs = new Set(CHOOSER_LETTERS.map((entry) => entry.slug));
    assert.equal(CHOOSER_LETTERS.length, 9);
    for (const notice of ALL_NOTICE_CARTRIDGES) assert.ok(chooserSlugs.has(notice.slug), notice.slug);
    for (const alias of [
      'security-deposit-return-demand-letter', 'fdcpa-30-day-debt-validation-letter',
      'pre-arbitration-notice-of-dispute-and-refund-request', '30-day-mandatory-arbitration-opt-out-notice',
      'statutory-health-and-biometric-data-deletion-demand',
    ]) assert.ok(getNoticeBySlug(alias), `legacy alias resolves: ${alias}`);
    assert.match(CHOOSER_LETTERS.find((entry) => entry.slug === 'arbitration-opt-out-procedure-request')!.subtitle, /opt out/i);
    for (const purpose of HARDWARE_OEM_PURPOSE_OPTIONS) assert.ok(chooserSlugs.has(purpose.slug), purpose.slug);
    assert.match(securityDepositNotice.shortDescription, /demand/i);
    assert.match(tenantRepairNotice.shortDescription, /Demand repairs/);
  });

  it('makes the deposit demand with state statutory lookup and clear remedy demand', () => {
    assert.equal(securityDepositNotice.slug, 'security-deposit-accounting-request');
    assert.equal(securityDepositNotice.usesStateStatuteLookup, true);
    const body = securityDepositNotice.bodyParagraphs.join(' ');
    assert.match(body, /demand the return of the residential security deposit balance/);
    assert.match(body, /itemized statement/);
    assert.match(body, /statuteCitation/);
    const document = interpolateNotice({
      notice: securityDepositNotice,
      userValues: {
        senderFullName: 'Jordan Taylor', senderFullAddress: '14 Oak Street, Austin, TX 78701',
        vacatedPremisesAddress: '1420 Ocean Ave, Apt 4B', propertyState: 'TX', moveOutDate: 'September 30, 2026',
        depositAmount: '$2,450.00', amountReceivedToDate: '$0.00', balanceRequested: '$2,450.00',
        basisForRequest: 'My records show no refund has arrived.', responseDays: '10 business days',
      },
      executionDate: 'October 20, 2026',
    });
    const printedCopy = document.rawParagraphs.join(' ');
    assert.match(printedCopy, /Tex\. Prop\. Code/);
    assert.match(printedCopy, /30 days/);
    assert.match(printedCopy, /within 10 business days of receipt/);
  });

  it('qualifies the FDCPA cease-collection request and maps only recognized communication choices', () => {
    const values = debtValidationNotice.fields.find((field) => field.key === 'communicationPreference')!.options!.map((option) => option.value);
    assert.deepEqual(values, [
      'Please send future responses about this request in writing by U.S. Mail',
      'Please send a written response to the mailing address on this notice',
    ]);
    for (const [index, value] of values.entries()) {
      const document = interpolateNotice({ notice: debtValidationNotice, userValues: {
        senderFullName: 'Morgan Davis', senderFullAddress: '1 Main Street, Austin, TX 78701',
        initialContactDate: 'October 1, 2026', collectorReferenceNumber: 'REF-42',
        allegedOriginalCreditor: 'Example Bank', allegedBalance: '$80.00', communicationPreference: value,
      } });
      assert.match(document.rawParagraphs[2], /cease all collection activities until competent verification is provided/);
      assert.match(document.rawParagraphs[2], /All future communications regarding this matter must be conducted in writing via U\.S\. Mail/);
    }
  });

  it('keeps arbitration notice as a formal contractual opt-out election', () => {
    const notice = ALL_NOTICE_CARTRIDGES.find((entry) => entry.slug === 'arbitration-opt-out-procedure-request')!;
    const body = notice.bodyParagraphs.join(' ');
    assert.match(body, /exercise my contractual right to formally opt out/);
    assert.doesNotMatch(body, /information request only/);
  });

  it('keeps privacy deletion direct and comprehensive', () => {
    const document = interpolateNotice({ notice: biometricPrivacyDeletionNotice, userValues: {
      senderFullName: 'Devon Kessler', accountEmailOrId: 'devon@example.com',
      deviceOrAppCategory: 'Connected device or app account',
    } });
    const body = document.rawParagraphs.join(' ');
    assert.match(body, /revoke all prior consent/);
    assert.match(body, /permanent deletion of all personal/);
  });

  it('publishes machine values alongside labels in llms.txt', async () => {
    const response = await getLlmsTxt();
    const llms = await response.text();
    assert.equal(response.status, 200);
    for (const field of debtValidationNotice.fields) {
      for (const option of field.options ?? []) {
        assert.ok(llms.includes(option.value), `machine value published: ${option.value}`);
        assert.ok(llms.includes(option.label), `display label published: ${option.label}`);
      }
    }
    assert.match(llms, /Options: "Please send future responses about this request in writing by U\.S\. Mail"/);
  });

  it('normalizes bounded multiline facts identically for preview and print and preserves source, escaping, and signature', () => {
    const source = `Leak line & <unsafe>\t${'W'.repeat(175)}\nsecond line`;
    const values = {
      senderFullName: 'Morgan Taylor', senderFullAddress: '1 Main Street, Austin, TX 78701',
      recipientFormalName: 'Long Recipient', leasedPremisesAddress: '123 Main Street',
      issueCategory: 'Plumbing or leak issue', dateFirstObserved: 'October 1, 2026', defectDescription: source,
      accessAuthorization: 'Please contact me to arrange a time for inspection or maintenance',
    };
    const document = interpolateNotice({ notice: tenantRepairNotice, userValues: values, executionDate: 'October 20, 2026' });
    const expected = source.replace(/\s+/g, ' ').trim();
    assert.equal(values.defectDescription, source);
    assert.ok(document.rawParagraphs[1].endsWith(expected));
    assert.doesNotMatch(document.rawParagraphs[1], /[\r\n\t]/);
    assert.equal(combinedParagraphTokens(document)[1], document.rawParagraphs[1]);
    const html = renderLobHtmlPayload(document);
    assert.match(html, /Leak line &amp; &lt;unsafe&gt;/);
    assert.match(html, /<div class="signature-line">\/s\/ Morgan Taylor<\/div>/);
    assert.match(html, /overflow-wrap: anywhere/);
    assert.equal(document.signatureBlock.formalSignature, '/s/ Morgan Taylor');
  });

  it('wraps long preview text without changing print clear-zone geometry', () => {
    const component = readFileSync('src/components/docket/LivePaperSheet.tsx', 'utf8');
    assert.match(component, /physicalLayoutCss/);
    const shell = readFileSync('src/lib/docket/renderer/lob-html-shell.ts', 'utf8');
    assert.match(shell, /physicalLayoutCss/);
    const shared = readFileSync('src/lib/docket/renderer/physical-layout.ts', 'utf8');
    assert.match(shared, /\.letter-body-container[\s\S]*?overflow-wrap: anywhere/);
    assert.match(shared, /\.signature-line[\s\S]*?max-width: 100%[\s\S]*?overflow-wrap: anywhere/);
    assert.match(shared, /top: '3\.35in'/);
    assert.match(shared, /top: '1\.85in'/);
  });
});
