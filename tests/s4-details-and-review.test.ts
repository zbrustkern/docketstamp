/**
 * S4 Details and Review Regression Tests
 *
 * Verifies Sprint S4 Acceptance Criteria conforming to Sections 7.4, 7.5, 7.6, and 10 of
 * docs/DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md:
 *
 * 1. Understandable Details -> Review and sign -> Delivery and payment progression:
 *    - 3-stage progression indicator (1. Letter details -> 2. Review and sign -> 3. Delivery and payment).
 *    - Plain labels ("Your details", "Recipient details", "Letter details", "Review and sign") instead of internal jargon.
 *    - Display title alongside formal title.
 * 2. Deterministic validation, honest progress, and first-invalid-field focus:
 *    - Empty/invalid street addresses (e.g. "123", "abc"), invalid dates, and invalid options do not count as ready.
 *    - Valid 5-digit ZIP codes and 2-letter state codes enforced.
 *    - NAICS 713940 fitness blocker enforced on recipient name.
 *    - Focuses first invalid field when details are incomplete.
 *    - Signature-only state focuses signature controls (#signature-adoption-control), not sender name.
 * 3. Preview-token clicks:
 *    - Opens mobile drawer and targets corresponding field input.
 *    - Maps fullAddress tokens to street address inputs.
 * 4. Session-scoped draft recovery and strict prefill precedence:
 *    - Preserves values across session reloads.
 *    - Explicit URL parameters (?recipientId=, ?field.*=, ?tier=) take precedence over stale session data.
 *    - Hydration never overwrites subsequent user edits.
 * 5. Revision-tied signature & address invalidation:
 *    - Editing signed content immediately invalidates signature (isSignatureAdopted = false).
 *    - Displays re-review prompt: "Letter details changed — please review your updated letter and re-adopt your signature."
 *    - Editing address fields invalidates address verification to 'unverified'.
 *    - Preserves exact statutory affirmation and UPL compliance disclosures verbatim.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  intentToVacateNotice,
  securityDepositNotice,
  creditBureauDisputeNotice,
  preArbitrationDisputeNotice,
  ALL_NOTICE_CARTRIDGES,
} from '../src/lib/docket/notices';

import {
  validateNoticeDraft,
  isValidStreetAddress,
  isValidZipCode,
  isValidStateCode,
  isValidCalendarDate,
  isValidSelectOption,
  resolveInitialWorkspaceDraft,
  saveNoticeDraft,
  loadNoticeDraft,
  clearNoticeDraft,
  getDraftStorageKey,
} from '../src/lib/docket/draft-recovery';

import {
  getChooserLetterBySlug,
  getLetterMetadata,
} from '../src/lib/docket/chooser-routing';

import {
  UPL_COMPLIANCE_FOOTER_TEXT,
  UPL_COMPLIANCE_DISCLOSURE,
  STATUTORY_COMPLIANCE_DISCLOSURE,
} from '../src/lib/docket/guardrails';

// Mock in-memory sessionStorage for Node.js test environment
const mockSessionStorage: Record<string, string> = {};
const mockWindow = {
  sessionStorage: {
    getItem: (key: string) => mockSessionStorage[key] || null,
    setItem: (key: string, val: string) => {
      mockSessionStorage[key] = String(val);
    },
    removeItem: (key: string) => {
      delete mockSessionStorage[key];
    },
    clear: () => {
      for (const k of Object.keys(mockSessionStorage)) {
        delete mockSessionStorage[k];
      }
    },
  },
  location: {
    search: '',
  },
};

// Install global mock window for draft-recovery functions in test
(global as any).window = mockWindow;

describe('S4 Details and Review Acceptance Gate', () => {
  beforeEach(() => {
    mockWindow.sessionStorage.clear();
    mockWindow.location.search = '';
  });

  describe('1. 3-Stage Progression & Plain Customer Terminology', () => {
    it('keeps the signed-draft review action separate from checkout', () => {
      const drawerSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/GuidedFieldDrawer.tsx'),
        'utf8'
      );
      const workspaceSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/DocumentWorkspace.tsx'),
        'utf8'
      );

      assert.ok(
        drawerSource.includes('onClick={isSignatureAdopted ? onReviewLetter : onNextRequiredField}'),
        'Review letter must reveal the letter after signature instead of invoking the next/checkout action'
      );
      assert.ok(
        workspaceSource.includes('const handleReviewLetter = () =>'),
        'DocumentWorkspace must own an explicit review handler'
      );
      assert.ok(
        workspaceSource.includes("setMobileView('document')"),
        'Review handler must reveal the mobile paper sheet'
      );
    });

    it('provides customer-friendly 3-stage progression in GuidedFieldDrawer and StickyExecutionBar', () => {
      const drawerSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/GuidedFieldDrawer.tsx'),
        'utf8'
      );
      const barSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/StickyExecutionBar.tsx'),
        'utf8'
      );

      // Verify 3 stages in drawer
      assert.ok(
        drawerSource.includes('1. Letter details'),
        'GuidedFieldDrawer must render "1. Letter details"'
      );
      assert.ok(
        drawerSource.includes('2. Review & sign') || drawerSource.includes('2. Review and sign'),
        'GuidedFieldDrawer must render Review and sign stage'
      );
      assert.ok(
        drawerSource.includes('3. Delivery'),
        'GuidedFieldDrawer must render Delivery stage'
      );

      // Verify plain section labels
      assert.ok(drawerSource.includes('Your details'), 'Must use "Your details" section label');
      assert.ok(drawerSource.includes('Recipient details'), 'Must use "Recipient details" section label');
      assert.ok(drawerSource.includes('Letter details'), 'Must use "Letter details" section label');
      assert.ok(drawerSource.includes('Review and sign'), 'Must use "Review and sign" section label');

      // Verify absence of internal jargon
      const forbiddenTerms = [
        'EXECUTING SENDER IDENTITY',
        'DESTINATION RECIPIENT & JURISDICTION',
        'INSTRUMENT DETAILS & STATUTORY PROVISIONS',
        'ELECTRONIC SIGNATURE & STAMP ADOPTION',
        'STATUS: DRAFTING DOCKET',
        'READY FOR EXECUTION',
        'Dispatch Notice',
        'Dispatch Mail',
        'Cartridge Not Found', // user facing copy should be plain
      ];

      for (const term of forbiddenTerms) {
        assert.ok(
          !drawerSource.includes(term),
          `GuidedFieldDrawer must not contain internal jargon: "${term}"`
        );
        assert.ok(
          !barSource.includes(term),
          `StickyExecutionBar must not contain internal jargon: "${term}"`
        );
      }
    });

    it('displays customer-facing display title alongside formal notice title', () => {
      const drawerSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/GuidedFieldDrawer.tsx'),
        'utf8'
      );

      assert.ok(
        drawerSource.includes('getChooserLetterBySlug'),
        'GuidedFieldDrawer must resolve customer display title via getChooserLetterBySlug'
      );

      // Verify all 9 cartridges have display title resolved
      for (const notice of ALL_NOTICE_CARTRIDGES) {
        const meta = getChooserLetterBySlug(notice.slug);
        assert.ok(meta, `Chooser metadata must exist for ${notice.slug}`);
        assert.ok(meta.displayTitle, `Display title must be non-empty for ${notice.slug}`);
      }
    });
  });

  describe('2. Real Deterministic Validation & Honest Progress', () => {
    it('validates street addresses correctly rejecting single words and malformed inputs', () => {
      assert.equal(isValidStreetAddress(''), false);
      assert.equal(isValidStreetAddress('   '), false);
      assert.equal(isValidStreetAddress('123'), false, 'Single number "123" is not a valid street address');
      assert.equal(isValidStreetAddress('abc'), false, 'Single word "abc" is not a valid street address');
      assert.equal(isValidStreetAddress('Main'), false, 'Street name without number is invalid');
      assert.equal(isValidStreetAddress('Main Street'), false, 'Missing street number or box');

      assert.equal(isValidStreetAddress('742 Evergreen Terrace'), true);
      assert.equal(isValidStreetAddress('123 Main St, Apt 4B'), true);
      assert.equal(isValidStreetAddress('P.O. Box 740256'), true);
      assert.equal(isValidStreetAddress('PO Box 100'), true);
      assert.equal(isValidStreetAddress('402 Pine Street'), true);
    });

    it('validates 5-digit US ZIP codes and ZIP+4 strictly', () => {
      assert.equal(isValidZipCode(''), false);
      assert.equal(isValidZipCode('123'), false);
      assert.equal(isValidZipCode('abcde'), false);
      assert.equal(isValidZipCode('9747'), false);
      assert.equal(isValidZipCode('974771'), false);
      assert.equal(isValidZipCode('97477-'), false);
      assert.equal(isValidZipCode('97477-12'), false);

      assert.equal(isValidZipCode('97477'), true);
      assert.equal(isValidZipCode('97477-1234'), true);
      assert.equal(isValidZipCode('10001'), true);
      assert.equal(isValidZipCode('30374'), true);
    });

    it('validates 2-letter US state codes', () => {
      assert.equal(isValidStateCode(''), false);
      assert.equal(isValidStateCode('O'), false);
      assert.equal(isValidStateCode('ORE'), false);
      assert.equal(isValidStateCode('Oregon'), false);
      assert.equal(isValidStateCode('12'), false);

      assert.equal(isValidStateCode('OR'), true);
      assert.equal(isValidStateCode('CA'), true);
      assert.equal(isValidStateCode('TX'), true);
      assert.equal(isValidStateCode('NY'), true);
      assert.equal(isValidStateCode('DC'), true);
    });

    it('validates calendar dates rejecting invalid dates and out-of-range years', () => {
      assert.equal(isValidCalendarDate(''), false);
      assert.equal(isValidCalendarDate('invalid'), false);
      assert.equal(isValidCalendarDate('2026-99-99'), false);
      assert.equal(isValidCalendarDate('1850-01-01'), false, 'Year before 1900 is out of bounds');
      assert.equal(isValidCalendarDate('2150-01-01'), false, 'Year after 2100 is out of bounds');

      assert.equal(isValidCalendarDate('2026-10-18'), true);
      assert.equal(isValidCalendarDate('2025-12-31'), true);
      assert.equal(isValidCalendarDate('1990-05-15'), true);
    });

    it('validates select dropdown options bounded to allowed values', () => {
      const selectField = securityDepositNotice.fields.find((f) => f.key === 'responseDays')!;
      assert.ok(selectField, 'responseDays field must exist');

      assert.equal(isValidSelectOption(selectField, ''), false);
      assert.equal(isValidSelectOption(selectField, 'invalid_period'), false);
      assert.equal(isValidSelectOption(selectField, '7 calendar days'), true);
      assert.equal(isValidSelectOption(selectField, '10 business days'), true);
      assert.equal(isValidSelectOption(selectField, '14 calendar days'), true);
    });

    it('enforces NAICS 713940 fitness blocker on recipient name', () => {
      const res = validateNoticeDraft(securityDepositNotice, {
        senderFullName: 'Jane Doe',
        senderAddressLine1: '123 Elm St',
        senderCity: 'Portland',
        senderState: 'OR',
        senderZip: '97201',
        recipientFormalName: 'Planet Fitness Gym Management LLC',
        recipientAddressLine1: '400 Main St',
        recipientCity: 'Austin',
        recipientState: 'TX',
        recipientZip: '78701',
        propertyState: 'TX',
        vacatedPremisesAddress: '402 Pine Street, Apt 3',
        moveOutDate: '2026-09-30',
        depositAmount: '$1,500.00',
        amountReceivedToDate: '$0.00',
        balanceRequested: '$1,500.00',
        basisForRequest: 'My records show I paid the deposit and have received no refund.',
        responseDays: '14 calendar days',
      });

      assert.equal(res.isValid, false, 'Fitness entity recipient must NOT be valid');
      assert.ok(
        res.fieldErrors['recipientFormalName']?.includes('NAICS 713940'),
        'Must flag NAICS 713940 error on recipient name'
      );
    });

    it('identifies first invalid field and reports accurate progress counts', () => {
      // Missing sender zip and invalid date
      const res = validateNoticeDraft(intentToVacateNotice, {
        senderFullName: 'Alex Rivera',
        senderAddressLine1: '742 Evergreen Terrace',
        senderCity: 'Springfield',
        senderState: 'OR',
        senderZip: '123', // INVALID ZIP
        recipientFormalName: 'Summit Management LLC',
        recipientAddressLine1: '100 Main St',
        recipientCity: 'Eugene',
        recipientState: 'OR',
        recipientZip: '97401',
        leasedPremisesAddress: '742 Evergreen Terrace, Apt 4B',
        leaseNoticePeriod: '30-Day',
        moveOutDate: 'not-a-date', // INVALID DATE
        forwardingAddress: '999 New Beginning Way',
      });

      assert.equal(res.isValid, false);
      assert.ok(res.missingOrInvalidFields.includes('senderZip'));
      assert.ok(res.missingOrInvalidFields.includes('moveOutDate'));
      assert.equal(res.firstInvalidFieldKey, 'senderZip', 'First invalid field must be senderZip');
      assert.ok(res.completedCount < res.totalCount, 'Completed count must be strictly less than total count');
      assert.equal(res.totalCount - res.completedCount, res.missingOrInvalidFields.length);
    });

    it('returns isValid: true when all required fields and addresses are valid', () => {
      const res = validateNoticeDraft(intentToVacateNotice, {
        senderFullName: 'Alex Rivera',
        senderAddressLine1: '742 Evergreen Terrace',
        senderCity: 'Springfield',
        senderState: 'OR',
        senderZip: '97477',
        recipientFormalName: 'Summit Management LLC',
        recipientAddressLine1: '100 Main St',
        recipientCity: 'Eugene',
        recipientState: 'OR',
        recipientZip: '97401',
        leasedPremisesAddress: '742 Evergreen Terrace, Apt 4B',
        leaseNoticePeriod: '30-Day',
        moveOutDate: '2026-11-30',
        forwardingAddress: '999 New Beginning Way, Springfield, OR 97477',
      });

      assert.equal(res.isValid, true);
      assert.equal(res.missingOrInvalidFields.length, 0);
      assert.equal(res.firstInvalidFieldKey, null);
      assert.equal(res.completedCount, res.totalCount);
    });

    it('validates currency format and cross-field deposit arithmetic in validateNoticeDraft (Sprint 0016 parity)', () => {
      const baseDepositDraft = {
        senderFullName: 'Marcus Vance',
        senderAddressLine1: '100 Austin Blvd',
        senderCity: 'Austin',
        senderState: 'TX',
        senderZip: '78701',
        recipientFormalName: 'Oakridge Properties Inc.',
        recipientAddressLine1: '200 Congress Ave',
        recipientCity: 'Austin',
        recipientState: 'TX',
        recipientZip: '78701',
        propertyState: 'TX',
        vacatedPremisesAddress: '402 Pine Street, Apt 3',
        moveOutDate: '2026-09-30',
        depositAmount: '1500',
        amountReceivedToDate: '500',
        balanceRequested: '1000',
        basisForRequest: 'My records show I paid the deposit and received only a partial refund.',
        responseDays: '14 calendar days',
      };

      const validRes = validateNoticeDraft(securityDepositNotice, baseDepositDraft);
      assert.equal(validRes.isValid, true, 'Unformatted valid numeric strings must pass draft validation');

      const invalidCurrencyRes = validateNoticeDraft(securityDepositNotice, {
        ...baseDepositDraft,
        depositAmount: 'fifteen hundred',
      });
      assert.equal(invalidCurrencyRes.isValid, false);
      assert.ok(invalidCurrencyRes.fieldErrors['depositAmount']?.includes('non-negative amount'));

      const excessiveBalanceRes = validateNoticeDraft(securityDepositNotice, {
        ...baseDepositDraft,
        balanceRequested: '1200', // exceeds 1500 - 500 = 1000
      });
      assert.equal(excessiveBalanceRes.isValid, false);
      assert.ok(
        excessiveBalanceRes.fieldErrors['balanceRequested']?.includes('cannot exceed the amount not yet returned'),
        'Must flag balanceRequested exceeding remaining unreturned deposit'
      );
    });
  });

  describe('3. Multi-Journey Journeys & Duplicate Entry Prevention', () => {
    it('handles landlord manual journey without duplicate fields', () => {
      const res = validateNoticeDraft(securityDepositNotice, {
        senderFullName: 'Marcus Vance',
        senderAddressLine1: '100 Austin Blvd',
        senderCity: 'Austin',
        senderState: 'TX',
        senderZip: '78701',
        recipientFormalName: 'Oakridge Properties Inc.',
        recipientAddressLine1: '200 Congress Ave',
        recipientCity: 'Austin',
        recipientState: 'TX',
        recipientZip: '78701',
        propertyState: 'TX',
        vacatedPremisesAddress: '402 Pine Street, Apt 3',
        moveOutDate: '2026-09-30',
        depositAmount: '$1,500.00',
        amountReceivedToDate: '$0.00',
        balanceRequested: '$1,500.00',
        basisForRequest: 'My records show I paid the deposit and have received no refund.',
        responseDays: '14 calendar days',
      });

      assert.equal(res.isValid, true);
    });

    it('handles bureau pre-addressed journey (?recipientId=cra_eqf) with automated recipient fields', () => {
      const resolved = resolveInitialWorkspaceDraft({
        notice: creditBureauDisputeNotice,
        initialValues: {},
        searchParams: new URLSearchParams('recipientId=cra_eqf'),
      });

      assert.equal(resolved.userValues.bureauEntityId, 'cra_eqf');
      assert.equal(resolved.userValues.recipientFormalName, 'Equifax Information Services LLC');
      assert.equal(resolved.userValues.recipientAddressLine1, 'P.O. Box 740256');
      assert.equal(resolved.userValues.recipientCity, 'Atlanta');
      assert.equal(resolved.userValues.recipientState, 'GA');
      assert.equal(resolved.userValues.recipientZip, '30374-0256');
      assert.ok(resolved.explicitKeys.has('bureauEntityId'));
      assert.ok(resolved.explicitKeys.has('recipientFormalName'));

      // Validate credit bureau with prefilled recipient and remaining fields
      const res = validateNoticeDraft(creditBureauDisputeNotice, {
        ...resolved.userValues,
        senderFullName: 'Taylor Morgan',
        senderAddressLine1: '500 Peachtree St',
        senderCity: 'Atlanta',
        senderState: 'GA',
        senderZip: '30308',
        senderDob: '1988-04-12',
        ssnLast4: '4321',
        furnisherName: 'Acme Bank NA',
        partialAccountNumber: 'XXXX-1234',
        disputeReason: 'Account does not belong to me / Identity discrepancy',
        factualExplanation: 'This account was opened fraudulently without my consent.',
      });

      assert.equal(res.isValid, true);
    });

    it('handles hardware OEM purpose journey (?recipientId=leg_sns) with automated legal department recipient', () => {
      const resolved = resolveInitialWorkspaceDraft({
        notice: preArbitrationDisputeNotice,
        initialValues: {},
        searchParams: new URLSearchParams('recipientId=leg_sns'),
      });

      assert.equal(resolved.userValues.recipientFormalName, 'Sonos, Inc. — Legal Department');
      assert.equal(resolved.userValues.recipientAddressLine1, '301 Coromar Drive');
      assert.equal(resolved.userValues.recipientCity, 'Goleta');
      assert.equal(resolved.userValues.recipientState, 'CA');
      assert.equal(resolved.userValues.recipientZip, '93117');
      assert.equal(resolved.selectedRecipientId, 'leg_sns');
    });
  });

  describe('4. Session-Scoped Draft Recovery & Strict Precedence Rule', () => {
    it('persists and recovers draft in sessionStorage under scoped key', () => {
      const slug = 'security-deposit-return-demand-letter';
      const key = getDraftStorageKey(securityDepositNotice.slug);

      assert.equal(key, 'docketstamp_draft_v2_security-deposit-accounting-request');

      saveNoticeDraft(slug, {
        userValues: {
          senderFullName: 'Recovered User',
          depositAmount: '$2,000.00',
        },
        selectedTier: 'certified_return_receipt',
        docketId: 'DS-2026-TEST99',
      });

      const loaded = loadNoticeDraft(slug);
      assert.ok(loaded);
      assert.equal(loaded?.slug, securityDepositNotice.slug);
      assert.ok(mockSessionStorage[key], 'New writes use the canonical session key');
      assert.equal(loaded?.userValues.senderFullName, 'Recovered User');
      assert.equal(loaded?.userValues.depositAmount, '$2,000.00');
      assert.equal(loaded?.selectedTier, 'certified_return_receipt');
      assert.equal(loaded?.docketId, 'DS-2026-TEST99');

      clearNoticeDraft(slug);
      assert.equal(loadNoticeDraft(slug), null);
    });

    it('recovers a legacy-slug draft on the canonical route without deleting the legacy copy', () => {
      const canonicalSlug = securityDepositNotice.slug;
      const legacySlug = securityDepositNotice.aliases?.[0];
      assert.ok(legacySlug);
      const legacyKey = getDraftStorageKey(legacySlug);
      const canonicalKey = getDraftStorageKey(canonicalSlug);
      const legacyRaw = JSON.stringify({
        slug: legacySlug,
        userValues: { senderFullName: 'Legacy Draft User', balanceRequested: '$800.00' },
        selectedTier: 'certified',
        savedAt: 123,
      });
      mockSessionStorage[legacyKey] = legacyRaw;

      const recovered = loadNoticeDraft(canonicalSlug);
      assert.equal(recovered?.slug, canonicalSlug);
      assert.equal(recovered?.userValues.senderFullName, 'Legacy Draft User');
      assert.equal(recovered?.userValues.balanceRequested, '$800.00');
      assert.equal(mockSessionStorage[legacyKey], legacyRaw, 'Legacy draft remains intact after migration');
      assert.equal(JSON.parse(mockSessionStorage[canonicalKey]).slug, canonicalSlug);
    });

    it('prefers an existing canonical draft and explicit URL values over legacy alias data', () => {
      const canonicalSlug = securityDepositNotice.slug;
      const legacySlug = securityDepositNotice.aliases?.[0];
      assert.ok(legacySlug);
      mockSessionStorage[getDraftStorageKey(legacySlug)] = JSON.stringify({
        slug: legacySlug,
        userValues: { senderFullName: 'Alias Draft User', moveOutDate: '2026-01-01' },
        selectedTier: 'certified',
        savedAt: 100,
      });
      saveNoticeDraft(canonicalSlug, {
        userValues: { senderFullName: 'Canonical Draft User', moveOutDate: '2026-02-02' },
        selectedTier: 'certified_return_receipt',
      });

      const resolved = resolveInitialWorkspaceDraft({
        notice: securityDepositNotice,
        searchParams: new URLSearchParams('field.moveOutDate=2026-03-03'),
      });
      assert.equal(resolved.userValues.senderFullName, 'Canonical Draft User');
      assert.equal(resolved.userValues.moveOutDate, '2026-03-03');
      assert.equal(resolved.selectedTier, 'certified_return_receipt');
      assert.equal(
        JSON.parse(mockSessionStorage[getDraftStorageKey(legacySlug)]).userValues.senderFullName,
        'Alias Draft User',
        'Canonical recovery does not delete the legacy draft'
      );
      clearNoticeDraft(canonicalSlug);
      assert.equal(loadNoticeDraft(canonicalSlug), null, 'Explicit reset removes canonical and legacy copies');
    });

    it('enforces strict precedence: explicit URL prefill (?recipientId=) overrides stale session recovery', () => {
      const slug = creditBureauDisputeNotice.slug;

      // 1. User previously drafted for Equifax (cra_eqf) in session
      saveNoticeDraft(slug, {
        userValues: {
          bureauEntityId: 'cra_eqf',
          recipientFormalName: 'Equifax Information Services LLC',
          recipientAddressLine1: 'P.O. Box 740256',
          recipientCity: 'Atlanta',
          recipientState: 'GA',
          recipientZip: '30374',
          senderFullName: 'Alex Rivera',
          senderAddressLine1: '742 Evergreen Terrace',
          senderCity: 'Springfield',
          senderState: 'OR',
          senderZip: '97477',
        },
        selectedRecipientId: 'cra_eqf',
        selectedTier: 'certified',
      });

      // 2. User now enters with explicit URL prefill for Experian (cra_exp)
      const resolved = resolveInitialWorkspaceDraft({
        notice: creditBureauDisputeNotice,
        searchParams: new URLSearchParams('recipientId=cra_exp'),
      });

      // Explicit URL recipient MUST override stale session recipient data
      assert.equal(
        resolved.userValues.bureauEntityId,
        'cra_exp',
        'Explicit URL bureau cra_exp must override stale session bureau cra_eqf'
      );
      assert.equal(
        resolved.userValues.recipientFormalName,
        'Experian National Consumer Assistance Center'
      );
      assert.equal(resolved.userValues.recipientCity, 'Allen');
      assert.equal(resolved.userValues.recipientState, 'TX');

      // But non-conflicting sender personal details from session ARE preserved
      assert.equal(
        resolved.userValues.senderFullName,
        'Alex Rivera',
        'Sender details from session must be preserved'
      );
      assert.equal(
        resolved.userValues.senderAddressLine1,
        '742 Evergreen Terrace'
      );
    });

    it('enforces that hydration NEVER overwrites subsequent user edits', () => {
      const docWorkspaceSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/DocumentWorkspace.tsx'),
        'utf8'
      );
      const hydrationSource = fs.readFileSync(
        path.join(process.cwd(), 'src/hooks/useAgentHydration.ts'),
        'utf8'
      );

      // Verify userEditedKeysRef is present in DocumentWorkspace
      assert.ok(
        docWorkspaceSource.includes('userEditedKeysRef'),
        'DocumentWorkspace must track user-edited keys via userEditedKeysRef'
      );
      assert.ok(
        docWorkspaceSource.includes('userEditedKeysRef.current.has(k)'),
        'Hydration sync effect must check userEditedKeysRef to protect user edits'
      );

      // Verify userEditedKeys is supported in useAgentHydration
      assert.ok(
        hydrationSource.includes('userEditedKeys'),
        'useAgentHydration must accept and respect userEditedKeys'
      );
    });
  });

  describe('5. Revision-Tied Signature & Address Invalidation', () => {
    it('invalidates signature upon editing any field value and prompts re-confirmation', () => {
      const docWorkspaceSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/DocumentWorkspace.tsx'),
        'utf8'
      );
      const drawerSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/GuidedFieldDrawer.tsx'),
        'utf8'
      );

      // Verify signature invalidation logic in DocumentWorkspace
      assert.ok(
        docWorkspaceSource.includes('if (isSignatureAdopted)'),
        'DocumentWorkspace must check isSignatureAdopted on field change'
      );
      assert.ok(
        docWorkspaceSource.includes('setIsSignatureAdopted(false)'),
        'Must reset isSignatureAdopted to false on edit'
      );
      assert.ok(
        docWorkspaceSource.includes('setSignatureInvalidatedByEdit(true)'),
        'Must flag signatureInvalidatedByEdit on edit'
      );

      // Verify re-review prompt banner in GuidedFieldDrawer
      assert.ok(
        drawerSource.includes('Letter details changed — please review your updated letter and re-adopt your signature.'),
        'GuidedFieldDrawer must display exact signature invalidation banner'
      );
    });

    it('invalidates address verification upon editing address fields', () => {
      const docWorkspaceSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/DocumentWorkspace.tsx'),
        'utf8'
      );

      assert.ok(
        docWorkspaceSource.includes("setVerificationStatus('unverified')"),
        'Must reset verificationStatus to unverified when address fields change'
      );
    });

    it('preserves exact statutory affirmation and UPL compliance disclosures verbatim', () => {
      const drawerSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/GuidedFieldDrawer.tsx'),
        'utf8'
      );

      const requiredAffirmation =
        'I affirm that I am the self-represented individual executing this notice on my own behalf, I understand DocketStamp is an automated self-help document preparation and USPS dispatch utility (not a law firm and does not provide legal advice), and I acknowledge that physical USPS mail dispatches are irreversible once submitted to the postal stream.';

      assert.ok(
        drawerSource.includes(requiredAffirmation),
        'GuidedFieldDrawer must preserve exact statutory affirmation checkbox text verbatim'
      );

      // Check UPL disclosures in guardrails
      assert.ok(
        UPL_COMPLIANCE_DISCLOSURE.includes('not a law firm, and does not provide legal representation or legal advice'),
        'UPL disclosure must state not a law firm'
      );
      assert.ok(
        STATUTORY_COMPLIANCE_DISCLOSURE.includes('automated self-help document preparation and USPS mailing utility'),
        'UPL disclosure must state self-help utility'
      );
    });
  });

  describe('6. Preview Token Clicks & Focus Navigation', () => {
    it('verifies DocumentWorkspace and GuidedFieldDrawer support token clicks and focus', () => {
      const docWorkspaceSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/DocumentWorkspace.tsx'),
        'utf8'
      );
      const drawerSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/GuidedFieldDrawer.tsx'),
        'utf8'
      );

      // Verify handleTokenClick sets activeFieldKey and opens mobile drawer
      assert.ok(
        docWorkspaceSource.includes('handleTokenClick'),
        'handleTokenClick must be defined'
      );
      assert.ok(
        docWorkspaceSource.includes("setMobileView('drawer')"),
        'handleTokenClick must switch mobileView to drawer'
      );

      // Verify mapping of address block clicks
      assert.ok(
        docWorkspaceSource.includes("targetKey = 'senderAddressLine1'"),
        'handleTokenClick must map senderFullAddress to senderAddressLine1'
      );
      assert.ok(
        docWorkspaceSource.includes("targetKey = 'recipientAddressLine1'"),
        'handleTokenClick must map recipientFullAddress to recipientAddressLine1'
      );

      // Verify data-field-key attributes in GuidedFieldDrawer
      assert.ok(
        drawerSource.includes('data-field-key={field.key}'),
        'GuidedFieldDrawer must annotate generated fields with their field key'
      );
      assert.ok(
        drawerSource.includes('data-field-key={field.key}'),
        'GuidedFieldDrawer must annotate generated fields with their field key'
      );
      assert.ok(
        drawerSource.includes('id="signature-adoption-control"'),
        'GuidedFieldDrawer must define id="signature-adoption-control"'
      );
      assert.ok(
        drawerSource.includes('data-testid="signature-input"'),
        'GuidedFieldDrawer must annotate signature input with data-testid="signature-input"'
      );
    });

    it('enforces Sprint 0016 mobile UX, inline CASS, auto-advance signature, and clickwrap invariants', () => {
      const docWorkspaceSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/DocumentWorkspace.tsx'),
        'utf8'
      );
      const drawerSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/GuidedFieldDrawer.tsx'),
        'utf8'
      );
      const checkoutSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/CheckoutModal.tsx'),
        'utf8'
      );

      // 1. Top-of-page nonfunctional CASS section removed from DocumentWorkspace
      assert.ok(
        !docWorkspaceSource.includes('aria-label="Mailing address verification"'),
        'DocumentWorkspace must not render top-of-page disabled CASS widgets'
      );

      // 2. Inline contextual CASS check and clickwrap links in GuidedFieldDrawer
      assert.ok(
        drawerSource.includes('USPS CASS Address Check'),
        'GuidedFieldDrawer must provide contextual USPS CASS address checks inside sender/recipient sections'
      );
      assert.ok(
        drawerSource.includes('/terms') && drawerSource.includes('/privacy') && drawerSource.includes('/return-policy'),
        'GuidedFieldDrawer affirmation card must include zero-click clickwrap links to Terms, Privacy, and Return Policy'
      );

      // 3. Auto-advance on Adopt & Sign Letter when draft is valid
      assert.ok(
        docWorkspaceSource.includes("transitionWorkflowStep('delivery')") && docWorkspaceSource.includes('setIsCheckoutOpen(true)'),
        'DocumentWorkspace must auto-advance to delivery & checkout when signature is adopted on a valid draft'
      );

      // 4. Multi-address CASS verification & synchronous draftRevision update in CheckoutModal
      assert.ok(
        checkoutSource.includes('verifyAndProceedWithAddresses') && checkoutSource.includes('resolvedAddressRolesRef'),
        'CheckoutModal must verify both sender and recipient addresses without revision desync'
      );
    });
  });
});
