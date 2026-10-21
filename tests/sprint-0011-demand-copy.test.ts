import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHOOSER_LETTERS, HARDWARE_OEM_PURPOSE_OPTIONS } from '../src/lib/docket/chooser-routing';
import { interpolateNotice } from '../src/lib/docket/renderer/interpolate';
import { renderLobHtmlPayload } from '../src/lib/docket/renderer/lob-html-shell';
import { ALL_NOTICE_CARTRIDGES } from '../src/lib/docket/notices';
import { debtValidationNotice } from '../src/lib/docket/notices/05-debt-validation-request';
import { biometricPrivacyDeletionNotice } from '../src/lib/docket/notices/09-biometric-privacy-deletion';
import { securityDepositNotice } from '../src/lib/docket/notices/02-security-deposit-return';
import { tenantRepairNotice } from '../src/lib/docket/notices/03-tenant-repair-request';
import { GET as getLlmsTxt } from '../app/llms.txt/route';

const bySlug = new Map(CHOOSER_LETTERS.map((letter) => [letter.slug, letter]));
const debtPreferenceValues = [
  'All future communications regarding this matter must be conducted strictly in writing by U.S. Mail',
  'Please forward written verification documentation to the mailing address listed above',
];
const privacyFrameworkValues = [
  'Applicable State Consumer Data & Biometric Privacy Statutes (including CCPA/CPRA, MHMDA, TDPSA, and BIPA)',
  'General Consumer Data Protection & Revocation of Processing Consent',
];

function combinedParagraphTokens(document: ReturnType<typeof interpolateNotice>): string[] {
  return document.paragraphs.map((paragraph) => paragraph.map((token) => token.content).join(''));
}

describe('SPRINT-0011 demand copy contract', () => {
  it('uses approved action titles and concise action subtitles while retaining canonical slugs', () => {
    const titles: Record<string, string> = {
      'security-deposit-return-demand-letter': 'Demand your security deposit back',
      'tenant-repair-and-maintenance-notice': 'Demand repairs from your landlord',
      'fdcpa-30-day-debt-validation-letter': 'Dispute a debt and demand verification',
      'pre-arbitration-notice-of-dispute-and-refund-request': 'Demand a refund for removed or restricted features',
      'statutory-health-and-biometric-data-deletion-demand': 'Demand deletion of your personal data',
      'fcra-credit-bureau-written-dispute-letter': 'Dispute a credit-report error',
      'written-contract-and-policy-cancellation-letter': 'Cancel a service or policy in writing',
      'tenant-notice-of-intent-to-vacate': 'Give formal move-out notice',
      '30-day-mandatory-arbitration-opt-out-notice': 'Send an arbitration opt-out notice',
    };
    const subtitles: Record<string, string> = {
      'security-deposit-return-demand-letter': 'Send a formal demand to your landlord or property manager.',
      'tenant-repair-and-maintenance-notice': 'Demand repairs and a written response from your landlord.',
      'fdcpa-30-day-debt-validation-letter': 'Challenge a collection claim and demand written verification.',
      'statutory-health-and-biometric-data-deletion-demand': 'Put your data-deletion demand and consent revocation in writing.',
    };
    assert.equal(CHOOSER_LETTERS.length, 9);
    for (const [slug, title] of Object.entries(titles)) {
      assert.equal(bySlug.get(slug)?.displayTitle, title, slug);
      assert.ok(ALL_NOTICE_CARTRIDGES.some((notice) => notice.slug === slug), `canonical slug retained: ${slug}`);
    }
    for (const [slug, subtitle] of Object.entries(subtitles)) assert.equal(bySlug.get(slug)?.subtitle, subtitle, slug);
    assert.match(bySlug.get('30-day-mandatory-arbitration-opt-out-notice')!.subtitle, /agreement.*eligibility/i);
    for (const purpose of HARDWARE_OEM_PURPOSE_OPTIONS) assert.equal(bySlug.get(purpose.slug)?.displayTitle, purpose.label, purpose.slug);
  });

  it('prints the exact deposit demand and requested response without unverified deadline or penalty claims', () => {
    assert.equal(securityDepositNotice.title, 'Security Deposit Demand Letter');
    assert.equal(securityDepositNotice.documentHeaderTitle, 'FORMAL DEMAND FOR RETURN OF SECURITY DEPOSIT');
    assert.deepEqual(securityDepositNotice.bodyParagraphs, [
      'I demand return of {{balanceRequested}} from my security deposit for {{vacatedPremisesAddress}}. My move-out date was {{moveOutDate}}. I paid {{depositAmount}} and have received {{amountReceivedToDate}} back.',
      'This demand concerns the security deposit return and accounting requirements addressed in {{statuteCitation}}. If you claim deductions, provide an itemized explanation and supporting records, and remit the undisputed balance.',
      'Send payment payable to {{senderFullName}} and your written response to {{senderFullAddress}}. I request a response within {{responseDays}} of receipt. This requested response period does not change any statutory deadline.',
    ]);
    const document = interpolateNotice({
      notice: securityDepositNotice,
      userValues: {
        senderFullName: 'Jordan Taylor', propertyState: 'CA', vacatedPremisesAddress: '1420 Ocean Ave, Apt 4B',
        moveOutDate: 'September 30, 2026', depositAmount: '$2,450.00', amountReceivedToDate: '$0.00',
        balanceRequested: '$2,450.00', responseDays: '10 business days',
      },
      executionDate: 'October 20, 2026',
    });
    const printedCopy = document.rawParagraphs.join(' ');
    assert.match(printedCopy, /Cal\. Civ\. Code § 1950\.5/);
    assert.match(printedCopy, /I request a response within 10 business days of receipt/i);
    assert.match(printedCopy, /This requested response period does not change any statutory deadline/i);
    assert.doesNotMatch(printedCopy, /statuteDeadline|penalt|bad faith|following termination of tenancy/i);
  });

  it('preserves debt enum values while rendering only recognized safe labels and a conditional FDCPA demand', () => {
    const preferenceField = debtValidationNotice.fields.find((field) => field.key === 'communicationPreference')!;
    assert.deepEqual(preferenceField.options?.map((option) => option.value), debtPreferenceValues);
    for (const [index, value] of debtPreferenceValues.entries()) {
      const document = interpolateNotice({
        notice: debtValidationNotice,
        userValues: {
          senderFullName: 'Morgan Davis', initialContactDate: 'October 1, 2026', collectorReferenceNumber: 'REF-42',
          allegedOriginalCreditor: 'Example Bank', allegedBalance: '$80.00', communicationPreference: value,
        },
      });
      const expected = index === 0
        ? 'My requested preference is to receive future communications about this matter in writing by U.S. Mail.'
        : 'Please send written verification to the mailing address listed above.';
      assert.match(document.rawParagraphs.join(' '), /If the FDCPA applies and I submit this written dispute within the validation period, I demand that you cease collection of the disputed debt until you mail verification as required by 15 U\.S\.C\. § 1692g\(b\)/i);
      assert.equal(document.rawParagraphs[3], expected);
      assert.equal(combinedParagraphTokens(document)[3], expected);
      assert.doesNotMatch(document.rawParagraphs.join(' '), /must be conducted strictly|full statutory verification/i);
    }
  });

  it('preserves missing debt selections as required fields and leaves unknown values unchanged', () => {
    for (const communicationPreference of [undefined, '', 'unknown enum value']) {
      const values = {
        senderFullName: 'Morgan Davis', initialContactDate: 'October 1, 2026', collectorReferenceNumber: 'REF-42',
        allegedOriginalCreditor: 'Example Bank', allegedBalance: '$80.00',
        ...(communicationPreference !== undefined ? { communicationPreference } : {}),
      };
      const document = interpolateNotice({ notice: debtValidationNotice, userValues: values });
      const token = document.paragraphs[3].find((part) => part.type === 'variable' && part.key === 'communicationPreference');
      assert.ok(token?.type === 'variable');
      if (communicationPreference === undefined || communicationPreference === '') {
        assert.equal(token.isFilled, false);
        assert.equal(token.content, '');
        assert.match(document.rawParagraphs[3], /\[COMMUNICATION PREFERENCE\]/);
      } else {
        assert.equal(token.isFilled, true);
        assert.equal(token.content, communicationPreference);
        assert.equal(document.rawParagraphs[3], communicationPreference);
      }
    }
  });

  it('preserves privacy enum values while applying finite safe wording and one coverage qualification', () => {
    const frameworkField = biometricPrivacyDeletionNotice.fields.find((field) => field.key === 'applicablePrivacyFramework')!;
    assert.deepEqual(frameworkField.options?.map((option) => option.value), privacyFrameworkValues);
    for (const [index, value] of privacyFrameworkValues.entries()) {
      const document = interpolateNotice({
        notice: biometricPrivacyDeletionNotice,
        userValues: {
          senderFullName: 'Devon Kessler', accountEmailOrId: 'devon@example.com',
          deviceOrAppCategory: 'Connected Health & Biometric Sensor Device', applicablePrivacyFramework: value,
        },
      });
      const expected = index === 0 ? 'state consumer-data and biometric-privacy protections' : 'general consumer privacy protections';
      const printedCopy = document.rawParagraphs.join(' ');
      assert.match(printedCopy, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.equal(combinedParagraphTokens(document)[1], document.rawParagraphs[1]);
      assert.match(printedCopy, /to the extent applicable law covers my account and request/i);
      assert.match(printedCopy, /where applicable, revoke consent for processing/i);
      assert.match(printedCopy, /If you retain any data, explain what is retained and why/i);
      assert.match(printedCopy, /tell me what verification or designated submission method you require/i);
      assert.doesNotMatch(printedCopy, /complete and permanent deletion|immediately cease|within the applicable statutory response period|CCPA\/CPRA|MHMDA|BIPA|framework I selected/i);
    }
  });

  it('preserves missing privacy selections as required fields and leaves unknown values unchanged', () => {
    for (const applicablePrivacyFramework of [undefined, '', 'unknown enum value']) {
      const values = {
        senderFullName: 'Devon Kessler', accountEmailOrId: 'devon@example.com',
        deviceOrAppCategory: 'Connected Health & Biometric Sensor Device',
        ...(applicablePrivacyFramework !== undefined ? { applicablePrivacyFramework } : {}),
      };
      const document = interpolateNotice({ notice: biometricPrivacyDeletionNotice, userValues: values });
      const token = document.paragraphs[1].find((part) => part.type === 'variable' && part.key === 'applicablePrivacyFramework');
      assert.ok(token?.type === 'variable');
      if (applicablePrivacyFramework === undefined || applicablePrivacyFramework === '') {
        assert.equal(token.isFilled, false);
        assert.equal(token.content, '');
        assert.match(document.rawParagraphs[1], /\[APPLICABLE PRIVACY FRAMEWORK\]/);
      } else {
        assert.equal(token.isFilled, true);
        assert.equal(token.content, applicablePrivacyFramework);
        assert.match(document.rawParagraphs[1], new RegExp(applicablePrivacyFramework.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
    }
  });

  it('publishes both machine enum values and labels in llms.txt', async () => {
    const response = await getLlmsTxt();
    const llms = await response.text();
    assert.equal(response.status, 200);
    for (const value of [...debtPreferenceValues, ...privacyFrameworkValues]) assert.ok(llms.includes(`value: "${value}"`));
    assert.match(llms, /display label; submit the exact value/);
    assert.match(llms, /"Prefer future communications in writing by U\.S\. Mail"/);
    assert.match(llms, /"Potential state privacy framework \(coverage depends on the request and applicable law\)"/);
  });

  it('normalizes multiline bounded facts for preview and print while preserving caller data, escaping, and signature', () => {
    const source = `Leak line & <unsafe>\t${'W'.repeat(175)}\nsecond line`;
    const values = {
      senderFullName: 'Morgan Taylor', recipientFormalName: 'Long Recipient', leasedPremisesAddress: '123 Main Street',
      issueCategory: 'Plumbing / Water Leak', dateFirstObserved: 'October 1, 2026', defectDescription: source,
      accessAuthorization: 'Tenant requests scheduled appointment prior to entry',
    };
    const document = interpolateNotice({ notice: tenantRepairNotice, userValues: values, executionDate: 'October 20, 2026' });
    const expected = source.replace(/\s+/g, ' ').trim();
    assert.equal(values.defectDescription, source, 'source values remain unmodified');
    assert.equal(document.rawParagraphs[1].endsWith(expected), true);
    assert.doesNotMatch(document.rawParagraphs[1], /[\r\n\t]/);
    assert.equal(combinedParagraphTokens(document)[1], document.rawParagraphs[1]);
    const html = renderLobHtmlPayload(document);
    assert.match(html, /Leak line &amp; &lt;unsafe&gt;/);
    assert.match(html, /<div class="signature-line">\/s\/ Morgan Taylor<\/div>/);
    assert.match(html, /overflow-wrap: anywhere/);
    assert.equal(document.signatureBlock.formalSignature, '/s/ Morgan Taylor');
  });

  it('enables wrapping for the preview name, subject, filled tokens, body, and signature', () => {
    const component = readFileSync('src/components/docket/LivePaperSheet.tsx', 'utf8');
    assert.match(component, /\[overflow-wrap:anywhere\]/);
    assert.match(component, /max-w-full/);
    assert.match(component, /\[overflow-wrap:anywhere\][\s\S]*text-justify/);
    const shell = readFileSync('src/lib/docket/renderer/lob-html-shell.ts', 'utf8');
    assert.match(shell, /\.letter-body-container[\s\S]*?overflow-wrap: anywhere/);
    assert.match(shell, /\.signature-line[\s\S]*?max-width: 100%[\s\S]*?overflow-wrap: anywhere/);
  });
});
