import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyPostalCodeSuggestion,
  EMPTY_POSTAL_CODE_SUGGESTION,
  failPostalCodeLookup,
  finishPostalCodeLookup,
  getAddressFieldKey,
  getAddressFieldValues,
  getGuidedFieldsInVisualOrder,
  normalizeUsZip,
  startPostalCodeLookup,
} from '../src/components/docket/address-intake';
import { securityDepositNotice, tenantRepairNotice } from '../src/lib/docket/notices';
import { intentToVacateNotice } from '../src/lib/docket/notices';
import { GuidedFieldDrawer } from '../src/components/docket/GuidedFieldDrawer';
import { validateNoticeDraft } from '../src/lib/docket/draft-recovery';

describe('bounded address intake', () => {
  it('keeps rental property, sender mailing, and recipient destination addresses independent', () => {
    const values = {
      leasedPremisesAddress: '21 Rental Way',
      rentalPropertyAddressLine2: 'Apt 4B',
      rentalPropertyCity: 'Austin',
      propertyState: 'TX',
      rentalPropertyZip: '78701',
      senderAddressLine1: '1 Return Road',
      senderAddressLine2: 'Unit 7',
      senderCity: 'Los Angeles',
      senderState: 'CA',
      senderZip: '90001',
      recipientAddressLine1: '9 Landlord Avenue',
      recipientAddressLine2: 'Floor 3',
      recipientCity: 'New York',
      recipientState: 'NY',
      recipientZip: '10001',
    };

    assert.deepEqual(getAddressFieldValues(values, 'rentalProperty'), {
      line1: '21 Rental Way', line2: 'Apt 4B', city: 'Austin', state: 'TX', zip: '78701',
    });
    assert.deepEqual(getAddressFieldValues(values, 'senderMailing'), {
      line1: '1 Return Road', line2: 'Unit 7', city: 'Los Angeles', state: 'CA', zip: '90001',
    });
    assert.deepEqual(getAddressFieldValues(values, 'recipientDestination'), {
      line1: '9 Landlord Avenue', line2: 'Floor 3', city: 'New York', state: 'NY', zip: '10001',
    });
    assert.equal(getAddressFieldKey('rentalProperty', 'line1', 'vacatedPremisesAddress'), 'vacatedPremisesAddress');
    assert.equal(getAddressFieldKey('senderMailing', 'line1'), 'senderAddressLine1');
    assert.equal(getAddressFieldValues({ leasedPremisesAddress: '21 Rental Way' }, 'senderMailing').line1, '');
  });

  it('orders tenant recovery focus to match the visible rental address first', () => {
    assert.deepEqual(
      getGuidedFieldsInVisualOrder(tenantRepairNotice).slice(0, 3).map((field) => field.key),
      ['leasedPremisesAddress', 'senderFullName', 'recipientFormalName']
    );
    assert.deepEqual(
      getGuidedFieldsInVisualOrder(securityDepositNotice).slice(0, 4).map((field) => field.key),
      ['vacatedPremisesAddress', 'propertyState', 'senderFullName', 'recipientFormalName']
    );

    const validation = validateNoticeDraft(intentToVacateNotice, {});
    assert.equal(validation.firstInvalidFieldKey, 'leasedPremisesAddress');
  });

  it('does not treat a rental-property address as the sender mailing address', () => {
    const validation = validateNoticeDraft(intentToVacateNotice, {
      senderFullName: 'Taylor Tenant',
      leasedPremisesAddress: '21 Rental Way',
      rentalPropertyCity: 'Austin',
      propertyState: 'TX',
      rentalPropertyZip: '78701',
      recipientFormalName: 'Northside Properties',
      recipientAddressLine1: '9 Recipient Avenue',
      recipientCity: 'New York',
      recipientState: 'NY',
      recipientZip: '10001',
      moveOutDate: '2026-09-01',
      leaseNoticePeriod: '30-Day',
      forwardingAddress: 'PO Box 77, Portland, OR 97201',
    });

    assert.equal(validation.isValid, false);
    assert.match(validation.fieldErrors.senderAddressLine1, /sender street address/i);
  });

  it('renders the rental address before sender and recipient, with separate roles and forwarding address', () => {
    const html = renderToStaticMarkup(React.createElement(GuidedFieldDrawer, {
      notice: intentToVacateNotice,
      userValues: {
        senderFullName: 'Taylor Tenant',
        leasedPremisesAddress: '21 Rental Way',
        rentalPropertyAddressLine2: 'Apt 4B',
        rentalPropertyCity: 'Austin',
        propertyState: 'TX',
        rentalPropertyZip: '78701',
        senderAddressLine1: '1 Return Road',
        senderAddressLine2: 'Unit 7',
        senderCity: 'Los Angeles',
        senderState: 'CA',
        senderZip: '90001',
        recipientFormalName: 'Northside Properties',
        recipientAddressLine1: '9 Recipient Avenue',
        recipientAddressLine2: 'Floor 3',
        recipientCity: 'New York',
        recipientState: 'NY',
        recipientZip: '10001',
        forwardingAddress: 'PO Box 77, Portland, OR 97201',
      },
      onChange: () => undefined,
      activeFieldKey: null,
      onFieldFocus: () => undefined,
      isSignatureAdopted: false,
      isAffirmed: false,
      onAffirmationChange: () => undefined,
      validation: validateNoticeDraft(intentToVacateNotice, {
        senderFullName: 'Taylor Tenant',
        leasedPremisesAddress: '21 Rental Way',
        propertyState: 'TX',
        recipientFormalName: 'Northside Properties',
        recipientAddressLine1: '9 Recipient Avenue',
        recipientCity: 'New York',
        recipientState: 'NY',
        recipientZip: '10001',
        moveOutDate: '2026-09-01',
        leaseNoticePeriod: '30-Day',
        forwardingAddress: 'PO Box 77, Portland, OR 97201',
        senderAddressLine1: '1 Return Road',
        senderCity: 'Los Angeles',
        senderState: 'CA',
        senderZip: '90001',
      }),
      onReviewLetter: () => undefined,
      onResetDraft: () => undefined,
      onAdoptSignature: () => undefined,
      onNextRequiredField: () => undefined,
      onCompleteDrawer: () => undefined,
    }));

    const propertyIndex = html.indexOf('data-testid="rental-property-section"');
    const senderIndex = html.indexOf('data-testid="senderMailing-address-fields"');
    const recipientIndex = html.indexOf('data-testid="recipientDestination-address-fields"');
    assert.ok(propertyIndex >= 0 && propertyIndex < senderIndex && senderIndex < recipientIndex);
    assert.match(html, /aria-label="rental property unit, apartment, or suite"[^>]*value="Apt 4B"/);
    assert.match(html, /aria-label="sender mailing street address"[^>]*value="1 Return Road"/);
    assert.match(html, /aria-label="sender mailing unit, apartment, or suite"[^>]*value="Unit 7"/);
    assert.match(html, /aria-label="recipient destination street address"[^>]*value="9 Recipient Avenue"/);
    assert.match(html, /Where the landlord must remit your security deposit refund and accounting[\s\S]*sender mailing \/ return address/);
  });

  it('treats ZIP results as user-confirmed suggestions and preserves manual or restored city/state', () => {
    const loading = startPostalCodeLookup(4, '78701', 2);
    const suggested = finishPostalCodeLookup(loading, {
      requestId: 4,
      zip: '78701',
      editRevision: 2,
      currentZip: '78701',
      currentEditRevision: 2,
      locations: [{ city: 'Austin', state: 'TX' }],
    });

    assert.equal(suggested.status, 'suggestion');
    assert.equal(applyPostalCodeSuggestion({
      state: suggested,
      currentZip: '78701',
      currentEditRevision: 2,
      currentCity: '',
      currentState: '',
    })?.state, 'TX');
    assert.equal(applyPostalCodeSuggestion({
      state: suggested,
      currentZip: '78701',
      currentEditRevision: 2,
      currentCity: 'Restored City',
      currentState: 'CA',
    }), null);
    assert.equal(applyPostalCodeSuggestion({
      state: suggested,
      currentZip: '78701',
      currentEditRevision: 2,
      currentCity: '',
      currentState: 'CA',
    }), null);
  });

  it('falls back to manual entry for unknown and multi-city ZIP results', () => {
    const unknownLoading = startPostalCodeLookup(1, '00000', 0);
    const unknown = finishPostalCodeLookup(unknownLoading, {
      requestId: 1,
      zip: '00000',
      editRevision: 0,
      currentZip: '00000',
      currentEditRevision: 0,
      locations: [],
    });
    assert.equal(unknown.status, 'unknown');

    const multiLoading = startPostalCodeLookup(2, '12345', 0);
    const multi = finishPostalCodeLookup(multiLoading, {
      requestId: 2,
      zip: '12345',
      editRevision: 0,
      currentZip: '12345',
      currentEditRevision: 0,
      locations: [
        { city: 'Northville', state: 'NY' },
        { city: 'Southville', state: 'NY' },
      ],
    });
    assert.equal(multi.status, 'ambiguous');
    assert.equal(multi.suggestion, null);

    const failed = failPostalCodeLookup(multiLoading, {
      requestId: 2,
      zip: '12345',
      currentZip: '12345',
      editRevision: 0,
      currentEditRevision: 0,
    });
    assert.equal(failed.status, 'error');
  });

  it('ignores stale ZIP responses after a newer request or a manual edit', () => {
    const newerRequest = startPostalCodeLookup(2, '10001', 3);
    const staleResponse = finishPostalCodeLookup(newerRequest, {
      requestId: 1,
      zip: '78701',
      editRevision: 2,
      currentZip: '10001',
      currentEditRevision: 3,
      locations: [{ city: 'Austin', state: 'TX' }],
    });
    assert.equal(staleResponse, newerRequest);

    const started = startPostalCodeLookup(3, '78701', 8);
    const editedWhilePending = finishPostalCodeLookup(started, {
      requestId: 3,
      zip: '78701',
      editRevision: 8,
      currentZip: '78701',
      currentEditRevision: 9,
      locations: [{ city: 'Austin', state: 'TX' }],
    });
    assert.equal(editedWhilePending, started);
    assert.equal(applyPostalCodeSuggestion({
      state: started,
      currentZip: '78701',
      currentEditRevision: 9,
      currentCity: 'Manual City',
      currentState: 'WA',
    }), null);
  });

  it('preserves restored units and address parts, and normalizes only valid five-digit ZIPs', () => {
    const restored = {
      leasedPremisesAddress: '512 Elm Street',
      rentalPropertyAddressLine2: 'Apt 2B',
      rentalPropertyCity: 'Chicago',
      propertyState: 'IL',
      rentalPropertyZip: '60614-1200',
    };
    assert.deepEqual(getAddressFieldValues(restored, 'rentalProperty'), {
      line1: '512 Elm Street', line2: 'Apt 2B', city: 'Chicago', state: 'IL', zip: '60614-1200',
    });
    assert.equal(applyPostalCodeSuggestion({
      state: { ...EMPTY_POSTAL_CODE_SUGGESTION, status: 'suggestion', zip: '60614', suggestion: { city: 'Chicago', state: 'IL' } },
      currentZip: '60614',
      currentEditRevision: 0,
      currentCity: 'Chicago',
      currentState: 'IL',
    }), null);
    assert.equal(normalizeUsZip('60614-1200'), '60614');
    assert.equal(normalizeUsZip('6061'), null);
  });
});
