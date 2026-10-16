/**
 * Work Package 1 (WP-1) Verification Gate
 *
 * Verifies:
 * 1. All 51 jurisdictions (50 states + DC) exist in STATE_STATUTES without omission.
 * 2. All 30 verified institutional recipients from Section 7 resolve cleanly.
 * 3. All 6 notices validate against their Zod schemas.
 * 4. assertNonFitnessEntity() throws ConflictOfInterestError when passed "Equinox" or "Planet Fitness".
 * 5. Non-fitness entities pass assertNonFitnessEntity() cleanly.
 * 6. UPL_COMPLIANCE_FOOTER_TEXT generates compliant statutory disclaimer.
 * 7. Pricing tier metadata covers all 3 USPS fulfillment tiers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  STATE_STATUTES,
  getAllStateStatutes,
  getStateStatute,
} from '../src/lib/docket/data/state-statutes';

import {
  VERIFIED_RECIPIENTS,
  getAllVerifiedRecipients,
  getVerifiedRecipientById,
  getVerifiedRecipientsByCategory,
} from '../src/lib/docket/data/verified-recipients';

import {
  assertNonFitnessEntity,
  ConflictOfInterestError,
  UPL_COMPLIANCE_FOOTER_TEXT,
} from '../src/lib/docket/guardrails';

import {
  NOTICE_REGISTRY,
  ALL_NOTICE_CARTRIDGES,
  getNoticeBySlug,
  getNoticeById,
  DOCKET_PRICING_TIERS,
} from '../src/lib/docket/notices';

describe('WP-1 Verification Gate', () => {
  describe('1. 51-Jurisdiction Statutory Dataset', () => {
    const EXPECTED_STATE_CODES = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
      'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
      'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
      'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
      'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];

    it('contains all 50 states + DC (51 total)', () => {
      const all = getAllStateStatutes();
      assert.equal(all.length, 51, `Expected 51 jurisdictions, got ${all.length}`);
      assert.equal(Object.keys(STATE_STATUTES).length, 51);
    });

    it('has every required state code with non-empty statutory citation and deadline label', () => {
      for (const code of EXPECTED_STATE_CODES) {
        const entry = getStateStatute(code);
        assert.ok(entry, `Missing statute entry for ${code}`);
        assert.equal(entry.stateCode, code);
        assert.ok(entry.stateName && entry.stateName.length > 0, `Missing stateName for ${code}`);
        assert.ok(entry.statuteCitation && entry.statuteCitation.length > 0, `Missing statuteCitation for ${code}`);
        assert.ok(entry.returnDeadlineLabel && entry.returnDeadlineLabel.length > 0, `Missing returnDeadlineLabel for ${code}`);
        assert.ok(entry.statutoryNuance && entry.statutoryNuance.length > 0, `Missing statutoryNuance for ${code}`);
      }
    });

    it('verifies exact citations for California, Texas, New York, and Florida', () => {
      const ca = getStateStatute('CA');
      assert.ok(ca?.statuteCitation.includes('1950.5'));
      assert.equal(ca?.returnDeadlineLabel, '21 calendar days');

      const tx = getStateStatute('TX');
      assert.ok(tx?.statuteCitation.includes('92.103'));
      assert.equal(tx?.returnDeadlineLabel, '30 days');

      const ny = getStateStatute('NY');
      assert.ok(ny?.statuteCitation.includes('7-108'));
      assert.equal(ny?.returnDeadlineLabel, '14 days');

      const fl = getStateStatute('FL');
      assert.ok(fl?.statuteCitation.includes('83.49'));
      assert.equal(fl?.returnDeadlineLabel, '15 days (30 days if imposing claim)');
    });
  });

  describe('2. 30 Pre-Verified Institutional Recipients', () => {
    const EXPECTED_30_IDS = [
      'cra_eqf', 'cra_exp', 'cra_tru',
      'col_pra', 'col_mcm', 'col_lvnv', 'col_cav', 'col_ics', 'col_jcap', 'col_cnv', 'col_tsi', 'col_rad', 'col_hal',
      'srv_adt', 'srv_viv', 'srv_bhs', 'srv_ss', 'srv_tmx', 'srv_ork', 'srv_trg', 'srv_ahs', 'srv_chw',
      'tel_cmcst', 'tel_chtr', 'tel_dtv', 'tel_hgh',
      'ins_geico', 'ins_prog', 'ins_all', 'ins_sf'
    ];

    it('resolves all 30 canonical recipients from Section 7', () => {
      for (const id of EXPECTED_30_IDS) {
        const recipient = getVerifiedRecipientById(id);
        assert.ok(recipient, `Failed to resolve recipient with ID: ${id}`);
        assert.ok(recipient.brandName, `Recipient ${id} missing brandName`);
        assert.ok(recipient.formalRecipientLine, `Recipient ${id} missing formalRecipientLine`);
        assert.ok(recipient.addressLine1, `Recipient ${id} missing addressLine1`);
        assert.ok(recipient.city, `Recipient ${id} missing city`);
        assert.ok(recipient.state, `Recipient ${id} missing state`);
        assert.ok(recipient.zip, `Recipient ${id} missing zip`);
        assert.ok(recipient.recommendedTier, `Recipient ${id} missing recommendedTier`);
      }
    });

    it('categorizes recipients into credit_bureau, debt_collector, home_service, telecom_insurance', () => {
      const creditBureaus = getVerifiedRecipientsByCategory('credit_bureau');
      assert.ok(creditBureaus.length >= 3, 'Should have at least 3 credit bureaus');

      const debtCollectors = getVerifiedRecipientsByCategory('debt_collector');
      assert.equal(debtCollectors.length, 10, 'Should have 10 debt collectors');

      const homeServices = getVerifiedRecipientsByCategory('home_service');
      assert.equal(homeServices.length, 9, 'Should have 9 home services');

      const telecomInsurance = getVerifiedRecipientsByCategory('telecom_insurance');
      assert.equal(telecomInsurance.length, 8, 'Should have 8 telecom/insurance providers');
    });
  });

  describe('3. Notice Cartridges & Zod Schema Validation', () => {
    it('registers exactly 9 notice cartridges', () => {
      assert.equal(ALL_NOTICE_CARTRIDGES.length, 9);
      assert.equal(Object.keys(NOTICE_REGISTRY).length, 9);
    });

    it('validates Cartridge 01 (intent-to-vacate) against Zod schema', () => {
      const notice = getNoticeBySlug('tenant-notice-of-intent-to-vacate');
      assert.ok(notice);
      const validPayload = {
        senderFullName: 'Alex Rivera',
        recipientFormalName: 'Summit Management LLC',
        leasedPremisesAddress: '742 Evergreen Terrace, Springfield, OR 97477',
        leaseNoticePeriod: '30-Day',
        moveOutDate: '2026-11-30',
        forwardingAddress: 'PO Box 99, Eugene, OR 97401',
      };
      const result = notice.zodSchema.safeParse(validPayload);
      assert.ok(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`);
    });

    it('validates Cartridge 02 (security-deposit-return) against Zod schema', () => {
      const notice = getNoticeBySlug('security-deposit-return-demand-letter');
      assert.ok(notice);
      const validPayload = {
        senderFullName: 'Marcus Vance',
        recipientFormalName: 'Oakridge Properties Inc.',
        propertyState: 'TX',
        vacatedPremisesAddress: '402 Pine Street, Apt 3, Austin, TX 78701',
        moveOutDate: '2026-09-01',
        depositAmount: '$1,850.00',
        amountReceivedToDate: '$0.00',
        balanceRequested: '$1,850.00',
        responseDays: '10 business days',
      };
      const result = notice.zodSchema.safeParse(validPayload);
      assert.ok(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`);
    });

    it('validates Cartridge 03 (tenant-repair-request) against Zod schema', () => {
      const notice = getNoticeBySlug('tenant-repair-and-maintenance-notice');
      assert.ok(notice);
      const validPayload = {
        senderFullName: 'Jordan Hayes',
        recipientFormalName: 'Skyline Properties',
        leasedPremisesAddress: '512 Elm St, Apt 2B, Chicago, IL 60614',
        issueCategory: 'Plumbing / Water Leak',
        dateFirstObserved: '2026-10-01',
        defectDescription: 'Persistent leaking pipe under kitchen sink causing base cabinet saturation.',
        accessAuthorization: 'Tenant grants maintenance entry with 24-hour advance notice',
      };
      const result = notice.zodSchema.safeParse(validPayload);
      assert.ok(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`);
    });

    it('validates Cartridge 04 (credit-bureau-dispute) against Zod schema', () => {
      const notice = getNoticeBySlug('fcra-credit-bureau-written-dispute-letter');
      assert.ok(notice);
      const validPayload = {
        senderFullName: 'Taylor S. Morgan',
        recipientFormalName: 'Equifax Information Services LLC',
        bureauEntityId: 'cra_eqf',
        senderDob: '1988-06-14',
        ssnLast4: '4892',
        furnisherName: 'Apex Credit Services',
        partialAccountNumber: '4920-XXXX-XXXX-1029',
        disputeReason: 'Account was paid/settled in full but reflects open balance',
        factualExplanation: 'This account was paid in full on March 15, 2026 with confirmation number #84920.',
      };
      const result = notice.zodSchema.safeParse(validPayload);
      assert.ok(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`);
    });

    it('validates Cartridge 05 (debt-validation-request) against Zod schema', () => {
      const notice = getNoticeBySlug('fdcpa-30-day-debt-validation-letter');
      assert.ok(notice);
      const validPayload = {
        senderFullName: 'Morgan L. Davis',
        recipientFormalName: 'Portfolio Recovery Associates, LLC',
        collectorReferenceNumber: 'PRA-90214-X8',
        allegedOriginalCreditor: 'Synchrony Bank',
        allegedBalance: '$1,420.50',
        initialContactDate: '2026-10-01',
        communicationPreference: 'All future communications regarding this matter must be conducted strictly in writing by U.S. Mail',
      };
      const result = notice.zodSchema.safeParse(validPayload);
      assert.ok(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`);
    });

    it('validates Cartridge 06 (service-policy-cancellation) against Zod schema', () => {
      const notice = getNoticeBySlug('written-contract-and-policy-cancellation-letter');
      assert.ok(notice);
      const validPayload = {
        senderFullName: 'Casey J. Taylor',
        recipientFormalName: 'ADT Security Services',
        accountOrPolicyNumber: 'ADT-948201-B',
        serviceTypeLabel: 'Home Security & Monitoring Agreement',
        effectiveCancellationDate: '2026-11-01',
        servicePropertyAddress: '814 Oakwood Drive, Austin, TX 78704',
      };
      const result = notice.zodSchema.safeParse(validPayload);
      assert.ok(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`);
    });
  });

  describe('4. NAICS 713940 Fitness Exclusion Guardrail', () => {
    it('throws ConflictOfInterestError when passed "Equinox"', () => {
      assert.throws(
        () => assertNonFitnessEntity('Equinox'),
        ConflictOfInterestError
      );
      assert.throws(
        () => assertNonFitnessEntity('Equinox Holdings LLC'),
        ConflictOfInterestError
      );
    });

    it('throws ConflictOfInterestError when passed "Planet Fitness"', () => {
      assert.throws(
        () => assertNonFitnessEntity('Planet Fitness'),
        ConflictOfInterestError
      );
      assert.throws(
        () => assertNonFitnessEntity('Planet Fitness Club #1402'),
        ConflictOfInterestError
      );
    });

    it('throws ConflictOfInterestError for other prohibited fitness entities and NAICS 713940', () => {
      assert.throws(() => assertNonFitnessEntity('LA Fitness'), ConflictOfInterestError);
      assert.throws(() => assertNonFitnessEntity('Gold\'s Gym'), ConflictOfInterestError);
      assert.throws(() => assertNonFitnessEntity('Orangetheory Fitness'), ConflictOfInterestError);
      assert.throws(() => assertNonFitnessEntity('SoulCycle Studio'), ConflictOfInterestError);
      assert.throws(() => assertNonFitnessEntity('Acme Corp', '713940'), ConflictOfInterestError);
      assert.throws(() => assertNonFitnessEntity({ name: 'Downtown Gym' }), ConflictOfInterestError);
    });

    it('permits non-fitness entities without throwing', () => {
      assert.doesNotThrow(() => assertNonFitnessEntity('Equifax Information Services LLC'));
      assert.doesNotThrow(() => assertNonFitnessEntity('Portfolio Recovery Associates'));
      assert.doesNotThrow(() => assertNonFitnessEntity('ADT Security Services'));
      assert.doesNotThrow(() => assertNonFitnessEntity('State Farm Mutual Automobile Insurance'));
      assert.doesNotThrow(() => assertNonFitnessEntity('Oakridge Property Management'));
    });
  });

  describe('5. UPL Statutory Footer & Pricing Metadata', () => {
    it('generates compliant UPL footer text with docketId', () => {
      const footer = UPL_COMPLIANCE_FOOTER_TEXT('DS-2026-ABCDEF');
      assert.ok(footer.includes('DS-2026-ABCDEF'));
      assert.ok(footer.includes('DocketStamp is an automated self-help document preparation'));
      assert.ok(footer.includes('not a law firm'));
    });

    it('defines the 3-tier pricing structure ($12.95, $19.95, $27.95)', () => {
      assert.equal(DOCKET_PRICING_TIERS.first_class.priceCents, 1295);
      assert.equal(DOCKET_PRICING_TIERS.first_class.formattedPrice, '$12.95');
      assert.equal(DOCKET_PRICING_TIERS.first_class.lobExtraService, undefined);

      assert.equal(DOCKET_PRICING_TIERS.certified.priceCents, 1995);
      assert.equal(DOCKET_PRICING_TIERS.certified.formattedPrice, '$19.95');
      assert.equal(DOCKET_PRICING_TIERS.certified.lobExtraService, 'certified');

      assert.equal(DOCKET_PRICING_TIERS.certified_return_receipt.priceCents, 2795);
      assert.equal(DOCKET_PRICING_TIERS.certified_return_receipt.formattedPrice, '$27.95');
      assert.equal(DOCKET_PRICING_TIERS.certified_return_receipt.lobExtraService, 'certified_return_receipt');
    });
  });
});
