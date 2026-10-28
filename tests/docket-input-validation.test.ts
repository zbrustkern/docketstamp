import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DOCKET_PRICING_TIERS, ALL_NOTICE_CARTRIDGES, securityDepositNotice, preArbitrationDisputeNotice } from '../src/lib/docket/notices';
import { STATE_STATUTES } from '../src/lib/docket/data/state-statutes';
import { interpolateNotice } from '../src/lib/docket/renderer/interpolate';
import { renderLobHtmlPayload } from '../src/lib/docket/renderer/lob-html-shell';
import { validateNoticeInput, isValidIsoDate, parseCurrencyToCents, formatCentsAsCurrency, formatCurrencyInput } from '../src/lib/docket/input-validation';

const MAIL_TIERS = Object.keys(DOCKET_PRICING_TIERS) as Array<keyof typeof DOCKET_PRICING_TIERS>;
const STATE_CODES = Object.keys(STATE_STATUTES);

function baseValues(notice: (typeof ALL_NOTICE_CARTRIDGES)[number]): Record<string, string> {
  const values: Record<string, string> = {
    recipientFormalName: 'Example Recipient LLC',
    senderAddressLine1: '10 Sender Street',
    senderAddressLine2: 'Unit 4',
    senderCity: 'Chicago',
    senderState: 'IL',
    senderZip: '60601',
    recipientAddressLine1: '20 Recipient Street',
    recipientAddressLine2: 'Suite 300',
    recipientCity: 'Chicago',
    recipientState: 'IL',
    recipientZip: '60606',
  };
  for (const field of notice.fields) {
    if (field.options?.length) {
      values[field.key] = field.options[0].value;
      continue;
    }
    switch (field.inputType) {
      case 'date': values[field.key] = '2026-08-31'; break;
      case 'currency':
        values[field.key] = field.key === 'depositAmount' || field.key === 'balanceRequested'
          ? '$1,500.00'
          : field.key === 'amountReceivedToDate'
          ? '$0.00'
          : '$250.00';
        break;
      case 'state_select': values[field.key] = 'IN'; break;
      default:
        if (field.key === 'senderFullName') values[field.key] = 'Taylor Morgan';
        else if (field.key === 'recipientFormalName') values[field.key] = 'Example Recipient LLC';
        else if (field.key === 'ssnLast4') values[field.key] = '1234';
        else if (field.key === 'basisForRequest') values[field.key] = 'My records show the deposit was paid and no refund has been received.';
        else if (/email/i.test(field.key)) values[field.key] = 'taylor@example.com';
        else if (/(account|serial|policy|reference|number)/i.test(field.key)) values[field.key] = 'ACC-12345';
        else if (/address/i.test(field.key)) values[field.key] = '123 Main Street, Apt 4';
        else if (/date/i.test(field.key)) values[field.key] = '2026-08-31';
        else values[field.key] = `Example ${field.label}`;
    }
  }
  return values;
}

function choiceDimensions(notice: (typeof ALL_NOTICE_CARTRIDGES)[number]) {
  return notice.fields.flatMap((field) => {
    if (field.inputType === 'state_select') {
      return [{ key: field.key, values: STATE_CODES }];
    }
    if (field.inputType === 'select' && field.options && field.options.length > 1) {
      return [{ key: field.key, values: field.options.map((option) => option.value) }];
    }
    return [];
  });
}

function allDefinedCombinations(notice: (typeof ALL_NOTICE_CARTRIDGES)[number]) {
  return choiceDimensions(notice).reduce<Record<string, string>[]>(
    (combinations, dimension) => combinations.flatMap((current) =>
      dimension.values.map((value) => ({ ...current, [dimension.key]: value }))
    ),
    [baseValues(notice)]
  );
}

describe('DocketStamp shared input and interpolation safeguards', () => {
  it('accepts real ISO dates and safe cents while rejecting impossible values', () => {
    assert.equal(isValidIsoDate('2026-02-28'), true);
    assert.equal(isValidIsoDate('2026-02-31'), false);
    assert.equal(isValidIsoDate('08/31/2026'), false);
    assert.equal(parseCurrencyToCents('$1,500.25'), 150025);
    assert.equal(parseCurrencyToCents('0'), 0);
    assert.equal(parseCurrencyToCents('-1.00'), null);
    assert.equal(parseCurrencyToCents('1,50.00'), null);
    assert.equal(formatCentsAsCurrency(150000), '$1,500.00');
    assert.equal(formatCentsAsCurrency(0), '$0.00');
    assert.equal(formatCurrencyInput('1500'), '$1,500.00');
    assert.equal(formatCurrencyInput('1500.5'), '$1,500.50');
    assert.equal(formatCurrencyInput('$2,450.75'), '$2,450.75');
    assert.equal(formatCurrencyInput('not-a-number'), 'not-a-number');
  });

  it('normalizes bare currency inputs to $X,XXX.XX in interpolateNotice for WYSIWYG dual-render parity', () => {
    const rawValues = {
      ...baseValues(securityDepositNotice),
      depositAmount: '1500',
      amountReceivedToDate: '250.5',
      balanceRequested: '1249.5',
    };
    const document = interpolateNotice({
      notice: securityDepositNotice,
      userValues: rawValues,
      docketId: 'DS-2026-CURR01',
      executionDate: 'October 28, 2026',
    });
    const printedText = document.rawParagraphs.join('\n');
    assert.match(printedText, /\$1,500\.00/);
    assert.match(printedText, /\$250\.50/);
    assert.match(printedText, /\$1,249\.50/);
  });

  it('validates supported jurisdictions, configured lengths, dates, and currency relationships', () => {
    const valid = baseValues(securityDepositNotice);
    assert.equal(validateNoticeInput(securityDepositNotice, { ...valid, propertyState: 'IN' }).success, true);
    assert.equal(validateNoticeInput(securityDepositNotice, { ...valid, propertyState: 'ZZ' }).success, false);
    assert.equal(validateNoticeInput(securityDepositNotice, { ...valid, moveOutDate: '2026-02-31' }).success, false);
    assert.equal(validateNoticeInput(securityDepositNotice, { ...valid, depositAmount: 'banana' }).success, false);
    assert.equal(validateNoticeInput(securityDepositNotice, {
      ...valid,
      depositAmount: '$1,500.00',
      amountReceivedToDate: '$1,600.00',
    }).success, false);
    assert.equal(validateNoticeInput(securityDepositNotice, {
      ...valid,
      balanceRequested: '$1,500.01',
    }).success, false);
    assert.equal(validateNoticeInput(securityDepositNotice, {
      ...valid,
      recipientFormalName: 'R'.repeat(81),
    }).success, false);
    assert.equal(validateNoticeInput(securityDepositNotice, {
      ...valid,
      senderAddressLine1: '',
    }).success, false);
    const missingRecipientAddress = { ...valid };
    for (const key of ['recipientAddressLine1', 'recipientCity', 'recipientState', 'recipientZip']) {
      delete missingRecipientAddress[key];
    }
    assert.equal(validateNoticeInput(securityDepositNotice, missingRecipientAddress, undefined, {}).success, false);
    assert.equal(validateNoticeInput(securityDepositNotice, valid, {
      addressLine1: 'Different Sender Street',
      city: 'Chicago',
      state: 'IL',
      zip: '60601',
    }).success, false);
  });

  it('strips unknown and renderer-owned form keys and ignores user-supplied statutory text', () => {
    const rawValues = {
      ...baseValues(securityDepositNotice),
      propertyState: 'IN',
      statuteCitation: 'USER SUPPLIED CITATION',
      statuteDeadline: 'one hour',
      returnDeadlineLabel: 'immediate',
      penaltyClause: 'guaranteed treble damages',
      stateName: 'Wrong State',
      docketId: 'DS-2026-ZZZZZZ',
      executionDate: 'tomorrow',
      senderFullAddress: 'USER ADDRESS',
      extraPrompt: 'must never reach the output',
    };
    const validated = validateNoticeInput(securityDepositNotice, rawValues);
    assert.equal(validated.success, true);
    if (!validated.success) return;
    assert.equal(Object.hasOwn(validated.userValues, 'statuteCitation'), false);
    assert.equal(Object.hasOwn(validated.userValues, 'docketId'), false);
    assert.equal(Object.hasOwn(validated.userValues, 'senderFullAddress'), false);
    assert.equal(Object.hasOwn(validated.userValues, 'extraPrompt'), false);

    const document = interpolateNotice({
      notice: securityDepositNotice,
      userValues: rawValues,
      docketId: 'DS-2026-ABC123',
      executionDate: 'October 20, 2026',
    });
    const printedText = document.rawParagraphs.join('\n');
    assert.doesNotMatch(printedText, /USER SUPPLIED CITATION|one hour|guaranteed treble damages|Wrong State|USER ADDRESS/);
    assert.match(printedText, /Ind\. Code § 32-31-3-12/);
    assert.match(printedText, /45 days/);
    assert.equal(document.docketId, 'DS-2026-ABC123');
    assert.equal(document.signatureBlock.executionDate, 'October 20, 2026');
  });

  it('preserves line 2 in normalized addresses used by the Lob mailing payload', () => {
    const values = {
      ...baseValues(preArbitrationDisputeNotice),
      senderAddressLine1: '19 Lake Avenue',
      senderAddressLine2: 'Apartment 7B',
      senderCity: 'Chicago',
      senderState: 'il',
      senderZip: '60601-1234',
      recipientAddressLine1: '400 West Lake Street',
      recipientAddressLine2: 'Suite 1200',
      recipientCity: 'Chicago',
      recipientState: 'IL',
      recipientZip: '60606',
    };
    const validated = validateNoticeInput(preArbitrationDisputeNotice, values);
    assert.equal(validated.success, true);
    if (!validated.success) return;
    assert.equal(validated.userValues.senderState, 'IL');
    const document = interpolateNotice({
      notice: preArbitrationDisputeNotice,
      userValues: validated.userValues,
      senderAddress: validated.senderAddress,
      recipientAddress: validated.recipientAddress,
      docketId: 'DS-2026-ABC123',
      executionDate: 'October 20, 2026',
    });
    assert.equal(document.senderAddress.address_line1, '19 Lake Avenue');
    assert.equal(document.senderAddress.address_line2, 'Apartment 7B');
    assert.equal(document.senderAddress.address_city, 'Chicago');
    assert.equal(document.senderAddress.address_state, 'IL');
    assert.equal(document.senderAddress.address_zip, '60601-1234');
    assert.equal(document.recipientAddress.address_line1, '400 West Lake Street');
    assert.equal(document.recipientAddress.address_line2, 'Suite 1200');
    assert.equal(document.recipientAddress.address_city, 'Chicago');
    assert.equal(document.recipientAddress.address_state, 'IL');
    assert.equal(document.recipientAddress.address_zip, '60606');

    const structuredValues = baseValues(preArbitrationDisputeNotice);
    for (const key of [
      'senderAddressLine1', 'senderAddressLine2', 'senderCity', 'senderState', 'senderZip',
      'recipientAddressLine1', 'recipientAddressLine2', 'recipientCity', 'recipientState', 'recipientZip',
    ]) delete structuredValues[key];
    const structured = validateNoticeInput(
      preArbitrationDisputeNotice,
      structuredValues,
      {
        name: 'Taylor Morgan',
        address_line1: '19 Lake Avenue',
        address_line2: 'Apartment 7B',
        address_city: 'Chicago',
        address_state: 'il',
        address_zip: '60601-1234',
      },
      {
        name: 'Example Recipient LLC',
        addressLine1: '400 West Lake Street',
        addressLine2: 'Suite 1200',
        city: 'Chicago',
        state: 'IL',
        zip: '60606',
      }
    );
    assert.equal(structured.success, true);
    if (!structured.success) return;
    const structuredDocument = interpolateNotice({
      notice: preArbitrationDisputeNotice,
      userValues: structured.userValues,
      senderAddress: structured.senderAddress,
      recipientAddress: structured.recipientAddress,
      docketId: 'DS-2026-ABC123',
      executionDate: 'October 20, 2026',
    });
    assert.equal(structuredDocument.senderAddress.address_line2, 'Apartment 7B');
    assert.equal(structuredDocument.recipientAddress.address_line2, 'Suite 1200');
  });

  it('keeps the rental-property location separate from sender return and recipient mailing addresses', () => {
    const values = {
      ...baseValues(preArbitrationDisputeNotice),
      rentalPropertyAddress: '88 Rental Lane, Unit 2',
      leasedPremisesAddress: '88 Rental Lane, Unit 2',
      rentalCity: 'Property City',
      rentalState: 'IN',
      rentalZip: '46032',
    };
    const validated = validateNoticeInput(preArbitrationDisputeNotice, values);
    assert.equal(validated.success, true);
    if (!validated.success) return;

    const document = interpolateNotice({
      notice: preArbitrationDisputeNotice,
      userValues: validated.userValues,
      senderAddress: validated.senderAddress,
      recipientAddress: validated.recipientAddress,
      docketId: 'DS-2026-ABC123',
      executionDate: 'October 20, 2026',
    });

    assert.equal(document.senderAddress.address_line1, '10 Sender Street');
    assert.equal(document.senderAddress.address_city, 'Chicago');
    assert.equal(document.senderAddress.address_state, 'IL');
    assert.equal(document.senderAddress.address_zip, '60601');
    assert.equal(document.recipientAddress.address_line1, '20 Recipient Street');
  });

  it('retains and formats separate rental-property address parts in the notice field', () => {
    const values = {
      ...baseValues(securityDepositNotice),
      propertyState: 'in',
      vacatedPremisesAddress: '88 Rental Lane',
      rentalPropertyAddressLine2: 'Unit 2',
      rentalPropertyCity: 'Carmel',
      rentalPropertyZip: '46032',
    };
    const validated = validateNoticeInput(securityDepositNotice, values);
    assert.equal(validated.success, true);
    if (!validated.success) return;
    assert.equal(
      validated.userValues.vacatedPremisesAddress,
      '88 Rental Lane, Unit 2, Carmel, IN 46032'
    );
    assert.equal(validated.userValues.propertyState, 'IN');
  });

  it('renders every declared field-choice combination at every mail tier without external side effects', () => {
    let rendered = 0;
    let expectedRenders = 0;
    for (const notice of ALL_NOTICE_CARTRIDGES) {
      const combinations = allDefinedCombinations(notice);
      expectedRenders += combinations.length * MAIL_TIERS.length;
      for (const overrides of combinations) {
        const rawValues = { ...baseValues(notice), ...overrides };
        const validated = validateNoticeInput(notice, rawValues);
        assert.equal(validated.success, true, `${notice.slug} values: ${JSON.stringify(overrides)}`);
        if (!validated.success) continue;
        for (const tier of MAIL_TIERS) {
          const document = interpolateNotice({
            notice,
            userValues: validated.userValues,
            senderAddress: validated.senderAddress,
            recipientAddress: validated.recipientAddress,
            docketId: 'DS-2026-ABC123',
            serviceLevel: tier,
            executionDate: 'October 20, 2026',
          });
          assert.doesNotMatch(document.reLine, /\{\{[A-Za-z0-9_]+\}\}/, `${notice.slug} re line`);
          assert.doesNotMatch(document.rawParagraphs.join('\n'), /\{\{[A-Za-z0-9_]+\}\}/, `${notice.slug} body`);
          assert.equal(document.clerkStamp.serviceLevel, tier);
          rendered += 1;
        }
      }
    }
    assert.equal(rendered, expectedRenders);
    assert.equal(rendered, 603);
  });
});
