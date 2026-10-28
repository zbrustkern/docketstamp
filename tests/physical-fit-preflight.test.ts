import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_NOTICE_CARTRIDGES } from '../src/lib/docket/notices';
import { interpolateNotice } from '../src/lib/docket/renderer/interpolate';
import { assessPhysicalFit, PHYSICAL_ADDRESS_LIMITS, physicalFitCustomerMessage } from '../src/lib/docket/renderer/physical-fit';

function qaMaximumValues(notice: (typeof ALL_NOTICE_CARTRIDGES)[number]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of notice.fields) {
    if (field.options?.length) values[field.key] = field.options[0].value;
    else if (field.inputType === 'date') values[field.key] = '1990-01-01';
    else if (field.inputType === 'currency') values[field.key] = '$999,999.99';
    else if (field.key === 'ssnLast4') values[field.key] = '1234';
    else values[field.key] = 'W'.repeat(field.maxLength || 72);
  }
  Object.assign(values, {
    senderFullName: 'Alexandria Maximilian Customer Name', recipientFormalName: 'Example Institutional Recipient Office',
    senderAddressLine1: '9876 Extended Residential Boulevard Apartment 1204', senderAddressLine2: 'ATTENTION OF CUSTOMER OPERATIONS DEPARTMENT', senderCity: 'San Francisco', senderState: 'CA', senderZip: '94105-1204',
    recipientAddressLine1: '8400 Long Corporate Parkway Suite 1400', recipientAddressLine2: 'LEGAL AND ADMINISTRATIVE NOTICES DEPARTMENT', recipientCity: 'Los Angeles', recipientState: 'CA', recipientZip: '90012-3401',
  });
  return values;
}

function ordinaryValues(notice: (typeof ALL_NOTICE_CARTRIDGES)[number]): Record<string, string> {
  const values: Record<string, string> = {
    senderFullName: 'Alex Example', recipientFormalName: 'Example Property Office',
    senderAddressLine1: '100 Main St', senderAddressLine2: 'Unit 2', senderCity: 'Chicago', senderState: 'IL', senderZip: '60601-1001',
    recipientAddressLine1: '200 Oak St', recipientAddressLine2: '', recipientCity: 'Chicago', recipientState: 'IL', recipientZip: '60602-1001',
    rentalPropertyAddress: '300 Elm St', rentalPropertyCity: 'Chicago', rentalPropertyZip: '60602-1001', propertyState: 'IL',
    moveOutDate: '2026-09-01', senderDob: '1990-01-01', ssnLast4: '1234',
    depositAmount: '$1,500', amountReceivedToDate: '$0', balanceRequested: '$1,500',
    basisForRequest: 'My records show the deposit has not been returned.', responseDays: '14 calendar days',
    factualExplanation: 'My records show the deposit has not been returned.',
  };
  for (const field of notice.fields) {
    if (values[field.key] !== undefined) continue;
    if (field.options?.length) values[field.key] = field.options[0].value;
    else if (field.inputType === 'date') values[field.key] = '2026-09-01';
    else if (field.inputType === 'currency') values[field.key] = '$1,500';
    else values[field.key] = 'Example value';
  }
  return values;
}

test('max-field QA fixtures receive conservative deterministic fit decisions across all notices and tiers', () => {
  const tiers = ['first_class', 'certified', 'certified_return_receipt'] as const;
  const results = new Map<string, boolean>();
  for (const notice of ALL_NOTICE_CARTRIDGES) {
    for (const serviceLevel of tiers) {
      const doc = interpolateNotice({ notice, userValues: qaMaximumValues(notice), serviceLevel, docketId: 'DS-2026-ABC123' });
      const result = assessPhysicalFit(doc);
      results.set(`${notice.slug}/${serviceLevel}`, result.fits);
      if (!result.fits) assert.equal(physicalFitCustomerMessage(result.failure).includes('Shorten'), true);
    }
  }
  assert.equal(results.size, 27);
  for (const [key, fits] of results) {
    // The conservative server estimate intentionally blocks the genuinely
    // overflowing credit fixture and one close security-deposit combination.
    const shouldFit = !key.startsWith('credit-report-dispute-request/') && !key.startsWith('security-deposit-accounting-request/');
    assert.equal(fits, shouldFit, `${key} must match the documented conservative max-field decision`);
  }
});

test('wide and unbroken text cannot bypass the aggregate body-height budget', () => {
  const notice = ALL_NOTICE_CARTRIDGES.find((candidate) => candidate.slug === 'credit-report-dispute-request')!;
  const values = qaMaximumValues(notice);
  values.factualExplanation = '界'.repeat(600);
  const doc = interpolateNotice({ notice, userValues: values, docketId: 'DS-2026-ABC123' });
  const result = assessPhysicalFit(doc);
  assert.equal(result.fits, false);
  assert.equal(result.failure, 'body_overflow');
});

test('word wrapping accounts for unused line width across repeated medium-length words', () => {
  const notice = ALL_NOTICE_CARTRIDGES.find((candidate) => candidate.slug === 'security-deposit-accounting-request')!;
  const doc = interpolateNotice({ notice, userValues: ordinaryValues(notice), docketId: 'DS-2026-ABC123' });
  const repeated = (count: number) => Array(count).fill('abcdefghij').join(' ');
  doc.rawParagraphs = [repeated(14), repeated(14), repeated(14)];
  const fourteenWordsPerParagraph = assessPhysicalFit(doc).estimatedHeightPt;
  doc.rawParagraphs = [repeated(15), repeated(15), repeated(15)];
  const fifteenWordsPerParagraph = assessPhysicalFit(doc).estimatedHeightPt;
  // Each fifteenth word wraps to a third line. Aggregate character division
  // alone would still estimate only two lines for each paragraph.
  assert.ok(Math.abs(fifteenWordsPerParagraph - fourteenWordsPerParagraph - 3 * 9.5 * 1.5) < 0.001);
});

test('emoji graphemes use a wide-symbol bound in the physical estimate', () => {
  const notice = ALL_NOTICE_CARTRIDGES.find((candidate) => candidate.slug === 'security-deposit-accounting-request')!;
  const doc = interpolateNotice({ notice, userValues: ordinaryValues(notice), docketId: 'DS-2026-ABC123' });
  doc.rawParagraphs = ['W'.repeat(50)];
  const latinHeight = assessPhysicalFit(doc).estimatedHeightPt;
  doc.rawParagraphs = ['😀'.repeat(50)];
  const emojiHeight = assessPhysicalFit(doc).estimatedHeightPt;
  assert.ok(emojiHeight > latinHeight, 'emoji should not be charged at the width of a narrow punctuation symbol');
});

test('ordinary deposit request remains within the physical page budget', () => {
  const notice = ALL_NOTICE_CARTRIDGES.find((candidate) => candidate.slug === 'security-deposit-accounting-request')!;
  const values = {
    senderFullName: 'Alex Example', recipientFormalName: 'Example Property Office', propertyState: 'IL',
    vacatedPremisesAddress: '300 Elm St', moveOutDate: '2026-09-01', depositAmount: '$1,500',
    amountReceivedToDate: '$0', balanceRequested: '$1,500',
    basisForRequest: 'My records show the deposit has not been returned.', responseDays: '14 calendar days',
    rentalPropertyAddressLine2: 'Unit 2', rentalPropertyCity: 'Chicago', rentalPropertyZip: '60602-1001',
    senderAddressLine1: '100 Main St', senderCity: 'Chicago', senderState: 'IL', senderZip: '60601-1001',
  };
  const doc = interpolateNotice({ notice, userValues: values, docketId: 'DS-2026-ABC123' });
  const result = assessPhysicalFit(doc);
  assert.equal(result.fits, true);
});

test('ordinary-length content across every notice remains checkout-eligible', () => {
  for (const notice of ALL_NOTICE_CARTRIDGES) {
    const doc = interpolateNotice({ notice, userValues: ordinaryValues(notice), docketId: 'DS-2026-ABC123' });
    assert.equal(assessPhysicalFit(doc).fits, true, notice.slug);
  }
});

test('product address budgets are explicit and oversized lines are blocked', () => {
  assert.deepEqual(PHYSICAL_ADDRESS_LIMITS, { name: 80, company: 80, addressLine: 60, city: 40, state: 2, zip: 10 });
  const notice = ALL_NOTICE_CARTRIDGES[0];
  const values = qaMaximumValues(notice);
  values.senderAddressLine1 = 'W'.repeat(61);
  const doc = interpolateNotice({ notice, userValues: values, docketId: 'DS-2026-ABC123' });
  const result = assessPhysicalFit(doc);
  assert.equal(result.fits, false);
  assert.equal(result.failure, 'address_length');
  assert.match(physicalFitCustomerMessage(result.failure), /one-page layout/);
  assert.doesNotMatch(physicalFitCustomerMessage(result.failure), /standard postal/i);

  const maximumNameDoc = interpolateNotice({ notice, userValues: qaMaximumValues(notice), docketId: 'DS-2026-ABC123' });
  maximumNameDoc.senderAddress.name = 'N'.repeat(PHYSICAL_ADDRESS_LIMITS.name + 1);
  assert.equal(assessPhysicalFit(maximumNameDoc).failure, 'address_length', 'universal name limit also blocks a supplier address overflow');
});
