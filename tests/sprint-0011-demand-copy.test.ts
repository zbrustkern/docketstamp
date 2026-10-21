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
    assert.match(CHOOSER_LETTERS.find((entry) => entry.slug === 'arbitration-opt-out-procedure-request')!.subtitle, /agreement.*procedure/i);
    for (const purpose of HARDWARE_OEM_PURPOSE_OPTIONS) assert.ok(chooserSlugs.has(purpose.slug), purpose.slug);
    assert.match(securityDepositNotice.shortDescription, /formal demand/i);
    assert.match(tenantRepairNotice.shortDescription, /Demand repairs/);
  });

  it('makes the deposit demand without a generic statutory clock or claim that the requested balance is owed', () => {
    assert.equal(securityDepositNotice.slug, 'security-deposit-accounting-request');
    assert.equal(securityDepositNotice.usesStateStatuteLookup, false);
    const body = securityDepositNotice.bodyParagraphs.join(' ');
    assert.match(body, /balance I believe is due/);
    assert.match(body, /itemized accounting/);
    assert.match(body, /requested response period/);
    assert.doesNotMatch(body, /\{\{statuteCitation\}\}|deadline of \d+|penalt/i);
    const document = interpolateNotice({
      notice: securityDepositNotice,
      userValues: {
        senderFullName: 'Jordan Taylor', senderFullAddress: '14 Oak Street, Austin, TX 78701',
        vacatedPremisesAddress: '1420 Ocean Ave, Apt 4B', moveOutDate: 'September 30, 2026',
        depositAmount: '$2,450.00', amountReceivedToDate: '$0.00', balanceRequested: '$2,450.00',
        basisForRequest: 'My records show no refund has arrived.', responseDays: '10 business days',
      },
      executionDate: 'October 20, 2026',
    });
    const printedCopy = document.rawParagraphs.join(' ');
    assert.match(printedCopy, /I request a response within 10 business days of receipt/);
    assert.match(printedCopy, /does not change any statutory deadline/);
    assert.match(printedCopy, /any amount you agree is due/);
    assert.doesNotMatch(printedCopy, /Cal\. Civ\. Code|statuteCitation|statuteDeadline|penalt/i);
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
      assert.match(document.rawParagraphs[1], /If the FDCPA applies and I submit this written dispute within the validation period, cease collection/);
      assert.equal(combinedParagraphTokens(document)[2], document.rawParagraphs[2]);
      assert.match(document.rawParagraphs[2], /My requested communication preference is:/);
      assert.doesNotMatch(document.rawParagraphs[1], /you must cease collection/i);
      assert.equal(document.rawParagraphs[2], index === 0
        ? 'My requested communication preference is: future responses in writing by U.S. Mail.'
        : 'My requested communication preference is: a written response to the mailing address on this notice.');
    }
  });

  it('keeps arbitration cartridge 08 as an information request, not an election', () => {
    const notice = ALL_NOTICE_CARTRIDGES.find((entry) => entry.slug === 'arbitration-opt-out-procedure-request')!;
    const body = notice.bodyParagraphs.join(' ');
    assert.match(body, /Please send me the agreement version/);
    assert.match(body, /deadline, required submission channel, and scope/);
    assert.match(body, /information request only/);
    assert.doesNotMatch(body, /I elect to opt out|Record this election/);
  });

  it('keeps privacy deletion direct with a single coverage qualification and no universal result claim', () => {
    const document = interpolateNotice({ notice: biometricPrivacyDeletionNotice, userValues: {
      senderFullName: 'Devon Kessler', accountEmailOrId: 'devon@example.com',
      deviceOrAppCategory: 'Connected device or app account',
    } });
    const body = document.rawParagraphs.join(' ');
    assert.match(body, /To the extent applicable privacy law covers this request, I demand deletion/);
    assert.match(body, /revoke consent for processing where applicable/);
    assert.match(body, /If you retain any data, explain what is retained and why, including its retention basis and period/);
    assert.match(body, /verification or designated submission method/);
    assert.doesNotMatch(body, /complete and permanent deletion|immediately cease|CCPA\/CPRA|MHMDA|BIPA/i);
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
    assert.match(component, /\[overflow-wrap:anywhere\]/);
    assert.match(component, /max-w-full/);
    const shell = readFileSync('src/lib/docket/renderer/lob-html-shell.ts', 'utf8');
    assert.match(shell, /\.letter-body-container[\s\S]*?overflow-wrap: anywhere/);
    assert.match(shell, /\.signature-line[\s\S]*?max-width: 100%[\s\S]*?overflow-wrap: anywhere/);
    assert.match(shell, /top: 3\.35in/);
    assert.match(shell, /top: 1\.85in/);
  });
});
