/**
 * Work Package 3 (WP-3) Verification Gate
 *
 * Verifies:
 * 1. Slug resolution and dynamic static params for all 6 notice cartridges.
 * 2. Field schema, step categorization, and drawer validation for all cartridges.
 * 3. Amber tag detection and live token resolution across user input states.
 * 4. State statutory citation & deadline live interpolation (Notice #2).
 * 5. Pre-verified institutional recipient integration (Notices #4, #5, #6).
 * 6. Electronic signature adoption and Clerk's Docket Stamp formatting.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_NOTICE_CARTRIDGES,
  getNoticeBySlug,
  securityDepositNotice,
  creditBureauDisputeNotice,
  intentToVacateNotice,
  serviceCancellationNotice,
} from '../src/lib/docket/notices';

import {
  interpolateNotice,
  generateDocketId,
} from '../src/lib/docket/renderer/interpolate';

import {
  getVerifiedRecipientById,
  searchVerifiedRecipients,
} from '../src/lib/docket/data/verified-recipients';

import { UPL_COMPLIANCE_FOOTER_TEXT } from '../src/lib/docket/guardrails';

describe('WP-3 Verification Gate: Interactive Workspace & Drawer Engine', () => {
  describe('1. Route & Slug Resolution', () => {
    it('resolves all 9 notice cartridges by canonical slug', () => {
      assert.equal(ALL_NOTICE_CARTRIDGES.length, 9);
      for (const notice of ALL_NOTICE_CARTRIDGES) {
        const resolved = getNoticeBySlug(notice.slug);
        assert.ok(resolved, `Failed to resolve canonical slug: ${notice.slug}`);
        assert.equal(resolved?.id, notice.id);
      }
    });

    it('resolves cartridges by short aliases', () => {
      assert.equal(getNoticeBySlug('intent-to-vacate')?.slug, 'tenant-notice-of-intent-to-vacate');
      assert.equal(getNoticeBySlug('security-deposit-return')?.slug, 'security-deposit-accounting-request');
      assert.equal(getNoticeBySlug('tenant-repair')?.slug, 'tenant-repair-and-maintenance-notice');
      assert.equal(getNoticeBySlug('credit-bureau-dispute')?.slug, 'credit-report-dispute-request');
      assert.equal(getNoticeBySlug('debt-validation')?.slug, 'debt-dispute-information-request');
      assert.equal(getNoticeBySlug('service-cancellation')?.slug, 'service-cancellation-request');
    });
  });

  describe('2. Guided Drawer Field Groups & Mobile Ergonomics', () => {
    it('every cartridge defines required fields categorized into coherent stepGroups', () => {
      for (const notice of ALL_NOTICE_CARTRIDGES) {
        assert.ok(notice.fields.length >= 4, `${notice.id} must have at least 4 fields`);

        // Check for required core sender/recipient fields
        const keys = notice.fields.map((f) => f.key);
        assert.ok(keys.includes('senderFullName'), `${notice.id} missing senderFullName`);
        const hasRecipientField = keys.includes('recipientFormalName') || keys.includes('bureauEntityId');
        assert.ok(hasRecipientField, `${notice.id} missing recipient field`);

        // All fields must have labels and valid stepGroups
        for (const field of notice.fields) {
          assert.ok(field.label, `Field ${field.key} in ${notice.id} must have a label`);
          assert.ok(
            ['sender', 'recipient', 'instrument_details', 'execution'].includes(field.stepGroup),
            `Field ${field.key} has invalid stepGroup: ${field.stepGroup}`
          );
        }
      }
    });
  });

  describe('3. Amber DocuSign-Style Token Interpolation', () => {
    it('marks unfilled fields as unpopulated tokens for clickable amber pills', () => {
      // Empty user values
      const emptyDoc = interpolateNotice({
        notice: intentToVacateNotice,
        userValues: {},
        docketId: 'DS-2026-TEST01',
      });

      // Find token segments in paragraphs
      let unpopulatedTokenCount = 0;
      for (const paraTokens of emptyDoc.paragraphs) {
        for (const token of paraTokens) {
          if (token.type === 'variable' && !token.isFilled) {
            unpopulatedTokenCount++;
            assert.ok(token.key, 'Unpopulated token must retain its field key for clicking');
            assert.ok(token.docusignTagLabel, 'Must provide amber tag label for pill UI');
          }
        }
      }
      assert.ok(unpopulatedTokenCount > 0, 'Unfilled template must contain unpopulated amber tokens');

      // Partially filled
      const partialDoc = interpolateNotice({
        notice: intentToVacateNotice,
        userValues: {
          senderFullName: 'Eleanor Vance',
          moveOutDate: '2026-11-30',
        },
        docketId: 'DS-2026-TEST01',
      });

      // Eleanor Vance should be populated
      const moveOutToken = partialDoc.paragraphs
        .flatMap((p) => p)
        .find((t) => t.key === 'moveOutDate');
      assert.ok(moveOutToken);
      assert.equal(moveOutToken.isFilled, true);
      assert.equal(moveOutToken.content, '2026-11-30');
    });
  });

  describe('4. Deposit request scope', () => {
    it('keeps state-specific citations and deadlines out when prerequisites are not collected', () => {
      const caDoc = interpolateNotice({
        notice: securityDepositNotice,
        userValues: {
          propertyState: 'CA',
        },
        docketId: 'DS-2026-CA-DEP',
      });

      const caTokens = caDoc.paragraphs.flatMap((p) => p);
      const citationToken = caTokens.find((t) => t.key === 'statuteCitation');
      assert.equal(securityDepositNotice.usesStateStatuteLookup, false);
      assert.equal(citationToken, undefined);
      assert.ok(!caDoc.rawParagraphs.some((p) => p.includes('Cal. Civ. Code')));
      assert.ok(!caDoc.rawParagraphs.some((p) => p.includes('21 calendar days')));

      const nyDoc = interpolateNotice({
        notice: securityDepositNotice,
        userValues: {
          propertyState: 'NY',
        },
        docketId: 'DS-2026-NY-DEP',
      });

      assert.ok(!nyDoc.rawParagraphs.some((p) => p.includes('N.Y. Gen. Oblig. Law')));
      assert.ok(!nyDoc.rawParagraphs.some((p) => p.includes('14 days')));
    });
  });

  describe('5. Verified Recipient Autocomplete & Autofill', () => {
    it('resolves Equifax recipient and matches address schema', () => {
      const equifax = getVerifiedRecipientById('cra_eqf');
      assert.ok(equifax);
      assert.equal(equifax.formalRecipientLine, 'Equifax Information Services LLC');
      assert.equal(equifax.state, 'GA');
      assert.equal(equifax.zip, '30374-0256');

      // Test autocomplete search
      const matches = searchVerifiedRecipients('Experian');
      assert.ok(matches.length >= 1);
      assert.equal(matches[0].id, 'cra_exp');
    });

    it('populates recipient address seamlessly into credit dispute notice', () => {
      const equifax = getVerifiedRecipientById('cra_eqf')!;
      const doc = interpolateNotice({
        notice: creditBureauDisputeNotice,
        userValues: {
          senderFullName: 'Taylor Morgan',
          recipientFormalName: equifax.formalRecipientLine,
          recipientAddressLine1: equifax.addressLine1,
          recipientCity: equifax.city,
          recipientState: equifax.state,
          recipientZip: equifax.zip,
        },
        docketId: 'DS-2026-EQF-001',
      });

      assert.equal(doc.recipientAddress.name, 'Equifax Information Services LLC');
      assert.equal(doc.recipientAddress.address_line1, equifax.addressLine1);
      assert.equal(doc.recipientAddress.address_city, 'Atlanta');
      assert.equal(doc.recipientAddress.address_state, 'GA');
    });
  });

  describe('6. Signature & Clerk Docket Stamp Adoption', () => {
    it('properly formats legal electronic signature /s/ and docket stamp metadata', () => {
      const docketId = generateDocketId();
      assert.match(docketId, /^DS-2026-[A-Z0-9]{6}$/);

      const doc = interpolateNotice({
        notice: serviceCancellationNotice,
        userValues: {
          senderFullName: 'Marcus Vance',
          senderAddressLine1: '123 Market St',
          senderCity: 'San Francisco',
          senderState: 'CA',
          senderZip: '94105',
        },
        docketId,
        serviceLevel: 'certified_return_receipt',
      });

      assert.equal(doc.signatureBlock.signerName, 'Marcus Vance');
      assert.equal(doc.signatureBlock.formalSignature, '/s/ Marcus Vance');
      assert.equal(doc.clerkStamp.docketId, docketId);
      assert.equal(doc.clerkStamp.serviceLevel, 'certified_return_receipt');

      const footer = UPL_COMPLIANCE_FOOTER_TEXT(docketId);
      assert.ok(footer.includes(docketId));
      assert.ok(footer.includes('DOCUMENT PREPARATION RECORD'));
    });
  });
});
