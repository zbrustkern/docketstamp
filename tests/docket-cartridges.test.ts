/**
 * DocketStamp Cartridges & Physical Geometry Verification Suite
 *
 * Verifies:
 * 1. Master Notice Cartridge Registry Integrity (All 9 cartridges: slugs 01–09, schemas, and aliases).
 * 2. 1-Page Lob 8.5in x 11in Letter Shell & Maximum Character Length Geometry Stress Test.
 *    - Clerk Docket Stamp registry box
 *    - USPS clear zones (top certified banner & window envelopes)
 *    - Locked UPL compliance footer
 *    - Balanced HTML tags and single-page overflow bounds
 * 3. Runtime Guardrail Compliance: NAICS 713940 Fitness Blocker vs Hardware OEMs.
 * 4. Pre-Verified Institutional Recipient Registry (Exact count: 38, with all 8 tech hardware legal entities).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_NOTICE_CARTRIDGES,
  NOTICE_REGISTRY,
  getAllNotices,
  getNoticeBySlug,
  getNoticeById,
  intentToVacateNotice,
  securityDepositNotice,
  tenantRepairNotice,
  creditBureauDisputeNotice,
  debtValidationNotice,
  serviceCancellationNotice,
  preArbitrationDisputeNotice,
  arbitrationOptOutNotice,
  biometricPrivacyDeletionNotice,
} from '../src/lib/docket/notices';

import {
  assertNonFitnessEntity,
  ConflictOfInterestError,
  UPL_COMPLIANCE_FOOTER_TEXT,
} from '../src/lib/docket/guardrails';

import {
  getAllVerifiedRecipients,
  getVerifiedRecipientById,
  searchVerifiedRecipients,
  getVerifiedRecipientsByCategory,
  VERIFIED_RECIPIENTS,
} from '../src/lib/docket/data/verified-recipients';

import {
  interpolateDocument,
  generateDocketId,
} from '../src/lib/docket/renderer/interpolate';

import {
  renderLobHtmlShell,
  renderLobHtmlPayload,
} from '../src/lib/docket/renderer/lob-html-shell';

describe('1. Master Notice Cartridge Registry Integrity (Cartridges 01–09)', () => {
  const EXPECTED_CARTRIDGE_SLUGS = [
    'tenant-notice-of-intent-to-vacate',
    'security-deposit-return-demand-letter',
    'tenant-repair-and-maintenance-notice',
    'fcra-credit-bureau-written-dispute-letter',
    'fdcpa-30-day-debt-validation-letter',
    'written-contract-and-policy-cancellation-letter',
    'pre-arbitration-notice-of-dispute-and-refund-request',
    '30-day-mandatory-arbitration-opt-out-notice',
    'statutory-health-and-biometric-data-deletion-demand',
  ];

  it('contains exactly 9 cartridges in ALL_NOTICE_CARTRIDGES', () => {
    assert.equal(ALL_NOTICE_CARTRIDGES.length, 9, 'Must contain exactly 9 notice cartridges');
    assert.equal(getAllNotices().length, 9, 'getAllNotices() must return 9 cartridges');
  });

  it('contains all 9 canonical slugs in NOTICE_REGISTRY', () => {
    for (const slug of EXPECTED_CARTRIDGE_SLUGS) {
      assert.ok(NOTICE_REGISTRY[slug], `NOTICE_REGISTRY must contain slug: ${slug}`);
    }
  });

  it('resolves all 9 cartridges individually via getNoticeBySlug', () => {
    assert.equal(getNoticeBySlug('tenant-notice-of-intent-to-vacate')?.id, intentToVacateNotice.id);
    assert.equal(getNoticeBySlug('security-deposit-return-demand-letter')?.id, securityDepositNotice.id);
    assert.equal(getNoticeBySlug('tenant-repair-and-maintenance-notice')?.id, tenantRepairNotice.id);
    assert.equal(getNoticeBySlug('fcra-credit-bureau-written-dispute-letter')?.id, creditBureauDisputeNotice.id);
    assert.equal(getNoticeBySlug('fdcpa-30-day-debt-validation-letter')?.id, debtValidationNotice.id);
    assert.equal(getNoticeBySlug('written-contract-and-policy-cancellation-letter')?.id, serviceCancellationNotice.id);
    assert.equal(getNoticeBySlug('pre-arbitration-notice-of-dispute-and-refund-request')?.id, preArbitrationDisputeNotice.id);
    assert.equal(getNoticeBySlug('30-day-mandatory-arbitration-opt-out-notice')?.id, arbitrationOptOutNotice.id);
    assert.equal(getNoticeBySlug('statutory-health-and-biometric-data-deletion-demand')?.id, biometricPrivacyDeletionNotice.id);
  });

  it('resolves all cartridges by primary ID and aliases via getNoticeById and getNoticeBySlug', () => {
    // Primary IDs
    assert.ok(getNoticeById('tenant-vacate-notice'));
    assert.ok(getNoticeById('security-deposit-demand'));
    assert.ok(getNoticeById('repair-maintenance-demand'));
    assert.ok(getNoticeById('fcra-credit-dispute'));
    assert.ok(getNoticeById('fdcpa-debt-validation'));
    assert.ok(getNoticeById('service-cancellation'));
    assert.ok(getNoticeById('pre-arbitration-notice-of-dispute-and-refund-request'));
    assert.ok(getNoticeById('30-day-mandatory-arbitration-opt-out-notice'));
    assert.ok(getNoticeById('statutory-health-and-biometric-data-deletion-demand'));

    // Aliases
    assert.ok(getNoticeBySlug('intent-to-vacate'));
    assert.ok(getNoticeBySlug('security-deposit-return'));
    assert.ok(getNoticeBySlug('tenant-repair-request'));
    assert.ok(getNoticeBySlug('credit-bureau-dispute'));
    assert.ok(getNoticeBySlug('debt-validation-request'));
    assert.ok(getNoticeBySlug('service-policy-cancellation'));
    assert.ok(getNoticeBySlug('pre-arbitration-dispute'));
    assert.ok(getNoticeBySlug('arbitration-opt-out'));
    assert.ok(getNoticeBySlug('biometric-privacy-deletion'));
  });

  it('validates structural contract of every cartridge', () => {
    for (const cartridge of ALL_NOTICE_CARTRIDGES) {
      assert.ok(cartridge.id, `Cartridge must define id (${cartridge.slug})`);
      assert.ok(cartridge.slug, `Cartridge must define slug (${cartridge.id})`);
      assert.ok(cartridge.title, `Cartridge ${cartridge.slug} must have title`);
      assert.ok(cartridge.shortDescription, `Cartridge ${cartridge.slug} must have shortDescription`);
      assert.ok(cartridge.documentHeaderTitle, `Cartridge ${cartridge.slug} must have documentHeaderTitle`);
      assert.ok(cartridge.reLineTemplate, `Cartridge ${cartridge.slug} must have reLineTemplate`);
      assert.ok(cartridge.recommendedTier, `Cartridge ${cartridge.slug} must have recommendedTier`);
      assert.ok(cartridge.recipientMode, `Cartridge ${cartridge.slug} must have recipientMode`);
      assert.ok(Array.isArray(cartridge.bodyParagraphs) && cartridge.bodyParagraphs.length > 0, `Cartridge ${cartridge.slug} must define bodyParagraphs`);
      assert.ok(Array.isArray(cartridge.fields) && cartridge.fields.length > 0, `Cartridge ${cartridge.slug} must define fields`);
      assert.ok(cartridge.zodSchema, `Cartridge ${cartridge.slug} must define zodSchema`);

      // Verify each field contract
      for (const field of cartridge.fields) {
        assert.ok(field.key, `Field in ${cartridge.slug} must define key`);
        assert.ok(field.label, `Field ${field.key} in ${cartridge.slug} must define label`);
        assert.ok(field.docusignTagLabel, `Field ${field.key} in ${cartridge.slug} must define docusignTagLabel`);
        assert.ok(field.inputType, `Field ${field.key} in ${cartridge.slug} must define inputType`);
      }
    }
  });

  it('does not claim unprovided attachments and grounds tenant statements in entered facts', () => {
    for (const cartridge of ALL_NOTICE_CARTRIDGES) {
      assert.equal(
        'enclosuresLine' in cartridge,
        false,
        `${cartridge.slug} must not list attachments that DocketStamp does not collect`,
      );
      assert.ok(
        cartridge.bodyParagraphs.every((paragraph) => !/\benclosures?\s*:/i.test(paragraph)),
        `${cartridge.slug} must not assert that an attachment is enclosed`,
      );
    }

    assert.match(
      intentToVacateNotice.bodyParagraphs[1],
      /I intend to surrender possession on or before {{moveOutDate}}/,
    );
    assert.doesNotMatch(intentToVacateNotice.bodyParagraphs[1], /written notice provisions|governing lease agreement/i);
    assert.match(
      securityDepositNotice.bodyParagraphs[0],
      /My move-out date was {{moveOutDate}}/,
    );
    assert.doesNotMatch(securityDepositNotice.bodyParagraphs[0], /keys|access devices|surrendered/i);
  });
});

describe('2. 1-Page Lob 8.5in x 11in Letter Shell & Maximum Character Length Stress Test', () => {
  // Helper to build a string of exactly maxLen characters
  function makeMaxString(maxLen: number, prefix: string = 'Test'): string {
    if (maxLen <= prefix.length) return prefix.slice(0, maxLen);
    const filler = ' Abc Def Ghi Jkl Mno Pqr Stu Vwx Yz 1234567890';
    let res = prefix + ' ';
    while (res.length < maxLen) {
      res += filler;
    }
    return res.slice(0, maxLen).trim();
  }

  // Tag balancer check
  function assertHtmlTagsBalanced(html: string, contextSlug: string) {
    const pairedTags = ['html', 'head', 'style', 'body', 'div', 'p', 'strong', 'span'];
    for (const tag of pairedTags) {
      const openMatches = html.match(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi')) || [];
      const closeMatches = html.match(new RegExp(`</${tag}>`, 'gi')) || [];
      assert.equal(
        openMatches.length,
        closeMatches.length,
        `Unbalanced <${tag}> tag in rendered HTML for notice ${contextSlug}: found ${openMatches.length} opening vs ${closeMatches.length} closing`
      );
    }
  }

  it('renders all 9 cartridges within strict 1-page geometry under maximum length inputs', () => {
    for (const cartridge of ALL_NOTICE_CARTRIDGES) {
      // Build maximum length field values based on cartridge metadata
      const maxUserValues: Record<string, string> = {
        senderFullName: makeMaxString(65, 'Jane Alexandria Consumer'),
        senderFullAddress: makeMaxString(90, '789 Grand Boulevard, Penthouse 14B, San Francisco, CA 94105'),
        senderAddressLine1: makeMaxString(45, '789 Grand Boulevard, Penthouse 14B'),
        senderCity: makeMaxString(25, 'San Francisco'),
        senderState: 'CA',
        senderZip: '94105',
        recipientFormalName: makeMaxString(75, 'Acme Global Technology & Consumer Services Legal Dept'),
        recipientFullAddress: makeMaxString(90, '100 North Technology Way, Floor 12, San Jose, CA 95110'),
        recipientAddressLine1: makeMaxString(45, '100 North Technology Way, Floor 12'),
        recipientCity: makeMaxString(25, 'San Jose'),
        recipientState: 'CA',
        recipientZip: '95110',
        propertyState: 'CA',
        rentalState: 'CA',
        leasedPremisesState: 'CA',
      };

      for (const field of cartridge.fields) {
        const maxLen = field.maxLength || 60;
        if (field.inputType === 'select' && field.options && field.options.length > 0) {
          maxUserValues[field.key] = field.options[0].value;
        } else if (field.inputType === 'currency') {
          maxUserValues[field.key] = '$9,999.99';
        } else if (field.inputType === 'date') {
          maxUserValues[field.key] = '2026-10-16';
        } else if (field.key === 'ssnLast4') {
          maxUserValues[field.key] = '9876';
        } else {
          maxUserValues[field.key] = makeMaxString(maxLen, `Sample ${field.label}`);
        }
      }

      // Interpolate document with max values
      const docketId = `DS-2026-TEST${Math.floor(10 + Math.random() * 89)}`;
      const interpolated = interpolateDocument({
        notice: cartridge,
        userValues: maxUserValues,
        docketId,
        serviceLevel: cartridge.recommendedTier,
        cassStatus: 'USPS CASS™ VERIFIED / DPV CONFIRMED',
        executionDate: 'October 16, 2026',
        senderAddress: {
          name: maxUserValues.senderFullName,
          addressLine1: maxUserValues.senderAddressLine1,
          city: maxUserValues.senderCity,
          state: maxUserValues.senderState,
          zip: maxUserValues.senderZip,
        },
        recipientAddress: {
          name: maxUserValues.recipientFormalName,
          addressLine1: maxUserValues.recipientAddressLine1,
          city: maxUserValues.recipientCity,
          state: maxUserValues.recipientState,
          zip: maxUserValues.recipientZip,
        },
      });

      assert.equal(interpolated.docketId, docketId);
      assert.ok(interpolated.rawParagraphs.length > 0);

      // Render physical HTML shell
      const html = renderLobHtmlShell(interpolated);
      assert.ok(html.length > 500, `Rendered HTML for ${cartridge.slug} should not be empty`);

      // 1. Page Geometry & CSS Constraints
      assert.ok(
        html.includes('@page { size: 8.5in 11in; margin: 0; }'),
        `Cartridge ${cartridge.slug} must define 8.5in x 11in @page rule`
      );
      assert.ok(
        html.includes('width: 8.5in;') && html.includes('height: 11in;') && html.includes('overflow: hidden;'),
        `Cartridge ${cartridge.slug} must enforce fixed 8.5x11in overflow:hidden body bounds`
      );

      // 2. Clerk's Docket Stamp
      assert.ok(
        html.includes('docket-stamp-box'),
        `Cartridge ${cartridge.slug} must contain docket-stamp-box class`
      );
      assert.ok(
        html.includes('DOCKETSTAMP™ OFFICIAL DISPATCH REGISTRY'),
        `Cartridge ${cartridge.slug} must contain official dispatch registry header`
      );
      assert.ok(
        html.includes(docketId),
        `Cartridge ${cartridge.slug} must display docket identifier in stamp`
      );

      // 3. USPS Clear Zones
      assert.ok(
        html.includes('top: 1.85in;') && html.includes('right: 0.60in;') && html.includes('width: 3.15in;'),
        `Cartridge ${cartridge.slug} docket stamp must clear USPS window envelope area`
      );
      assert.ok(
        html.includes('top: 3.35in;') && html.includes('left: 0.75in;') && html.includes('bottom: 0.80in;'),
        `Cartridge ${cartridge.slug} letter-body-container must start at top: 3.35in to clear top certified banner`
      );

      // 4. Locked UPL Compliance Footer
      assert.ok(
        html.includes('compliance-footer'),
        `Cartridge ${cartridge.slug} must contain compliance-footer class`
      );
      assert.ok(
        html.includes(UPL_COMPLIANCE_FOOTER_TEXT(docketId)),
        `Cartridge ${cartridge.slug} must contain verbatim UPL compliance disclosure text`
      );
      assert.ok(
        html.includes('bottom: 0.40in;'),
        `Cartridge ${cartridge.slug} compliance footer must be locked at bottom: 0.40in`
      );

      // 5. Signature Block
      assert.ok(
        html.includes('/s/ ' + maxUserValues.senderFullName),
        `Cartridge ${cartridge.slug} must render formal /s/ signature line`
      );

      // 6. Balanced HTML Tags
      assertHtmlTagsBalanced(html, cartridge.slug);
    }
  });
});

describe('3. Runtime Guardrail Compliance: NAICS 713940 Blocker vs Hardware OEMs', () => {
  it('strictly blocks prohibited gym & fitness club entities (Equinox, Planet Fitness, etc.)', () => {
    // String names
    assert.throws(
      () => assertNonFitnessEntity('Equinox'),
      (err: any) => err instanceof ConflictOfInterestError && err.message.includes('NAICS 713940')
    );

    assert.throws(
      () => assertNonFitnessEntity('Planet Fitness'),
      (err: any) => err instanceof ConflictOfInterestError && err.message.includes('NAICS 713940')
    );

    assert.throws(
      () => assertNonFitnessEntity('LA Fitness Sports Club'),
      (err: any) => err instanceof ConflictOfInterestError
    );

    assert.throws(
      () => assertNonFitnessEntity('Orange Theory Fitness LLC'),
      (err: any) => err instanceof ConflictOfInterestError
    );

    assert.throws(
      () => assertNonFitnessEntity('Crunch Fitness Headquarters'),
      (err: any) => err instanceof ConflictOfInterestError
    );

    assert.throws(
      () => assertNonFitnessEntity('24 Hour Fitness USA, LLC'),
      (err: any) => err instanceof ConflictOfInterestError
    );

    // Object representations with NAICS code
    assert.throws(
      () => assertNonFitnessEntity({ company: 'Equinox Holding Inc', naicsCode: '713940' }),
      (err: any) => err instanceof ConflictOfInterestError
    );

    assert.throws(
      () => assertNonFitnessEntity({ brandName: 'Local Crossfit Gym', naics: '713940' }),
      (err: any) => err instanceof ConflictOfInterestError
    );
  });

  it('strictly permits consumer electronics and hardware OEMs without throwing', () => {
    assert.doesNotThrow(() => {
      assertNonFitnessEntity('Withings Body Smart Scale');
    });

    assert.doesNotThrow(() => {
      assertNonFitnessEntity('Withings Inc. Legal Department');
    });

    assert.doesNotThrow(() => {
      assertNonFitnessEntity('LG Electronics');
    });

    assert.doesNotThrow(() => {
      assertNonFitnessEntity('LG Electronics USA, Inc. — Legal Notice');
    });

    assert.doesNotThrow(() => {
      assertNonFitnessEntity('Samsung Electronics America, Inc.');
    });

    assert.doesNotThrow(() => {
      assertNonFitnessEntity('Ecobee Technologies Inc.');
    });

    assert.doesNotThrow(() => {
      assertNonFitnessEntity('Canon U.S.A., Inc. Legal Division');
    });

    assert.doesNotThrow(() => {
      assertNonFitnessEntity('Sonos, Inc. Legal Counsel');
    });

    assert.doesNotThrow(() => {
      assertNonFitnessEntity('Roku, Inc. Mandatory Arbitration Opt-Out');
    });

    assert.doesNotThrow(() => {
      assertNonFitnessEntity('Tesla, Inc. Legal Department');
    });

    assert.doesNotThrow(() => {
      assertNonFitnessEntity({ brandName: 'Withings', product: 'Body Scan Scale' });
    });
  });
});

describe('4. Pre-Verified Institutional Recipient Registry (Exact Count 38 & Tech Hardware Legal)', () => {
  it('contains exactly 38 pre-verified institutional recipients in canonical registry', () => {
    const all = getAllVerifiedRecipients();
    assert.equal(all.length, 38, `Expected exactly 38 verified entities, found ${all.length}`);
    assert.equal(VERIFIED_RECIPIENTS.length, 38, `VERIFIED_RECIPIENTS array must have length 38`);
  });

  it('contains all 8 tech hardware legal recipients (leg_wth through leg_tsl)', () => {
    const expectedHardwareIds = [
      { id: 'leg_wth', brand: 'Withings' },
      { id: 'leg_ecb', brand: 'Ecobee' },
      { id: 'leg_lg', brand: 'LG' },
      { id: 'leg_sam', brand: 'Samsung' },
      { id: 'leg_cnn', brand: 'Canon' },
      { id: 'leg_sns', brand: 'Sonos' },
      { id: 'leg_rku', brand: 'Roku' },
      { id: 'leg_tsl', brand: 'Tesla' },
    ];

    for (const item of expectedHardwareIds) {
      const recipient = getVerifiedRecipientById(item.id);
      assert.ok(recipient, `Recipient with ID ${item.id} must be found`);
      assert.equal(recipient.category, 'tech_hardware_legal');
      assert.ok(
        recipient.brandName.toLowerCase().includes(item.brand.toLowerCase()),
        `Recipient ${item.id} brandName should match ${item.brand}`
      );
      assert.ok(recipient.formalRecipientLine, `Recipient ${item.id} must have formalRecipientLine`);
      assert.ok(recipient.addressLine1, `Recipient ${item.id} must have addressLine1`);
      assert.ok(recipient.city, `Recipient ${item.id} must have city`);
      assert.ok(recipient.state, `Recipient ${item.id} must have state`);
      assert.ok(recipient.zip, `Recipient ${item.id} must have zip`);
      assert.ok(recipient.requiredIdentifiersHint, `Recipient ${item.id} must have requiredIdentifiersHint`);
    }
  });

  it('accurately discovers tech hardware recipients via searchVerifiedRecipients', () => {
    const withings = searchVerifiedRecipients('Withings');
    assert.ok(withings.length >= 1);
    assert.equal(withings[0].id, 'leg_wth');

    const ecobee = searchVerifiedRecipients('ecobee');
    assert.ok(ecobee.length >= 1);
    assert.equal(ecobee[0].id, 'leg_ecb');

    const lg = searchVerifiedRecipients('LG');
    assert.ok(lg.length >= 1);
    assert.equal(lg[0].id, 'leg_lg');

    const samsung = searchVerifiedRecipients('samsung');
    assert.ok(samsung.length >= 1);
    assert.equal(samsung[0].id, 'leg_sam');

    const canon = searchVerifiedRecipients('canon');
    assert.ok(canon.length >= 1);
    assert.equal(canon[0].id, 'leg_cnn');

    const sonos = searchVerifiedRecipients('sonos');
    assert.ok(sonos.length >= 1);
    assert.equal(sonos[0].id, 'leg_sns');

    const roku = searchVerifiedRecipients('roku');
    assert.ok(roku.length >= 1);
    assert.equal(roku[0].id, 'leg_rku');

    const tesla = searchVerifiedRecipients('tesla');
    assert.ok(tesla.length >= 1);
    assert.equal(tesla[0].id, 'leg_tsl');
  });

  it('filters exactly 8 recipients under tech_hardware_legal category', () => {
    const hwRecipients = getVerifiedRecipientsByCategory('tech_hardware_legal');
    assert.equal(hwRecipients.length, 8, 'Must return exactly 8 tech hardware legal recipients');

    const legacyHw = getVerifiedRecipientsByCategory('TECH_HARDWARE');
    assert.equal(legacyHw.length, 8, 'Legacy category alias TECH_HARDWARE must return 8 recipients');
  });

  it('guarantees every single verified recipient passes assertNonFitnessEntity', () => {
    for (const recipient of getAllVerifiedRecipients()) {
      assert.doesNotThrow(() => {
        assertNonFitnessEntity(recipient.brandName);
        assertNonFitnessEntity(recipient.formalRecipientLine);
      }, `Recipient ${recipient.id} (${recipient.brandName}) failed non-fitness guardrail`);
    }
  });
});
