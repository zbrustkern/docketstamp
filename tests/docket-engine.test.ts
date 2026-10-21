/**
 * DocketStamp Domain Logic & Architecture Test Suite
 *
 * Verifies:
 * 1. Master TypeScript Contracts & Notice Cartridge Registry (6/6 notices)
 * 2. Runtime Guardrails: NAICS 713940 Fitness Blocker & UPL Disclosures
 * 3. 50-State + DC Statutory Security Deposit Registry
 * 4. 30+ Pre-Verified Institutional Recipient Registry
 * 5. Document Interpolation Engine (AST, Conditionals, Tokenization)
 * 6. Lob 8.5x11 USPS Clear Zone HTML Shell Generator
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
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
  assertNotFitnessEntity,
  isFitnessEntity,
  FitnessEntityProhibitedError,
  UPL_COMPLIANCE_DISCLOSURE,
  CLERK_DOCKET_REGISTRY_TITLE,
} from '../src/lib/docket/guardrails';

import {
  getStateStatute,
  getAllStateStatutes,
  formatStatuteCitation,
} from '../src/lib/docket/data/state-statutes';

import {
  getAllVerifiedRecipients,
  getVerifiedRecipientById,
  searchVerifiedRecipients,
  getVerifiedRecipientsByCategory,
} from '../src/lib/docket/data/verified-recipients';

import {
  interpolateDocument,
  generateDocketId,
} from '../src/lib/docket/renderer/interpolate';

import { renderLobHtmlShell } from '../src/lib/docket/renderer/lob-html-shell';

describe('1. Master Notice Cartridge Registry', () => {
  it('registers all 9 notice cartridges', () => {
    const all = getAllNotices();
    assert.equal(all.length, 9, 'Must contain exactly 9 cartridges');
  });

  it('resolves cartridges by URL slug', () => {
    assert.ok(getNoticeBySlug('intent-to-vacate'));
    assert.ok(getNoticeBySlug('security-deposit-return'));
    assert.ok(getNoticeBySlug('tenant-repair-request'));
    assert.ok(getNoticeBySlug('credit-bureau-dispute'));
    assert.ok(getNoticeBySlug('debt-validation-request'));
    assert.ok(getNoticeBySlug('service-policy-cancellation'));
    assert.ok(getNoticeBySlug('pre-arbitration-notice-of-dispute-and-refund-request'));
    assert.ok(getNoticeBySlug('30-day-mandatory-arbitration-opt-out-notice'));
    assert.ok(getNoticeBySlug('statutory-health-and-biometric-data-deletion-demand'));
  });

  it('resolves cartridges by internal ID', () => {
    assert.ok(getNoticeById('tenant-vacate-notice'));
    assert.ok(getNoticeById('security-deposit-demand'));
    assert.ok(getNoticeById('repair-maintenance-demand'));
    assert.ok(getNoticeById('fcra-credit-dispute'));
    assert.ok(getNoticeById('fdcpa-debt-validation'));
    assert.ok(getNoticeById('service-cancellation'));
    assert.ok(getNoticeById('pre-arbitration-notice-of-dispute-and-refund-request'));
    assert.ok(getNoticeById('30-day-mandatory-arbitration-opt-out-notice'));
    assert.ok(getNoticeById('statutory-health-and-biometric-data-deletion-demand'));

    // Verify canonical or alias slug matches
    assert.ok(getNoticeById('tenant-vacate-notice')?.slug.includes('vacate'));
    assert.ok(getNoticeById('security-deposit-demand')?.slug.includes('security-deposit'));
    assert.ok(getNoticeById('repair-maintenance-demand')?.slug.includes('repair'));
    assert.ok(getNoticeById('fcra-credit-dispute')?.slug.includes('credit'));
    assert.ok(getNoticeById('fdcpa-debt-validation')?.slug.includes('debt-validation'));
    assert.ok(getNoticeById('service-cancellation')?.slug.includes('cancellation'));
    assert.ok(getNoticeById('pre-arbitration-notice-of-dispute-and-refund-request')?.slug.includes('pre-arbitration'));
    assert.ok(getNoticeById('30-day-mandatory-arbitration-opt-out-notice')?.slug.includes('arbitration-opt-out'));
    assert.ok(getNoticeById('statutory-health-and-biometric-data-deletion-demand')?.slug.includes('biometric'));
  });

  it('guarantees every cartridge defines valid fields, schema, and paragraphs', () => {
    const all = getAllNotices();
    for (const notice of all) {
      assert.ok(notice.id, `Notice ${notice.slug} missing id`);
      assert.ok(notice.slug, `Notice ${notice.id} missing slug`);
      assert.ok(notice.title, `Notice ${notice.slug} missing title`);
      assert.ok(notice.documentHeaderTitle, `Notice ${notice.slug} missing documentHeaderTitle`);
      assert.ok(notice.reLineTemplate, `Notice ${notice.slug} missing reLineTemplate`);
      assert.ok(notice.recommendedTier, `Notice ${notice.slug} missing recommendedTier`);
      assert.ok(notice.fields.length > 0, `Notice ${notice.slug} must have fields`);
      assert.ok(notice.bodyParagraphs.length > 0, `Notice ${notice.slug} must have paragraphs`);
      assert.ok(notice.zodSchema, `Notice ${notice.slug} must have zod schema`);

      // Verify every field has a DocuSign tag label
      for (const field of notice.fields) {
        assert.ok(field.docusignTagLabel, `Field ${field.key} in ${notice.slug} missing docusignTagLabel`);
        assert.ok(field.stepGroup, `Field ${field.key} in ${notice.slug} missing stepGroup`);
      }
    }
  });
});

describe('2. Runtime Guardrails: NAICS 713940 Fitness Blocker', () => {
  it('blocks NAICS 713940 strictly', () => {
    assert.throws(
      () => assertNotFitnessEntity('Acme Corp', '713940'),
      FitnessEntityProhibitedError
    );
  });

  it('blocks prohibited gym and fitness keywords in entity names', () => {
    const forbidden = [
      'Equinox Holdings LLC',
      'Planet Fitness Franchise',
      'Gold\'s Gym International',
      'LA Fitness / Fitness International',
      'Anytime Fitness LLC',
      'CrossFit Downtown',
      'Orange Theory Fitness',
      'Lifetime Fitness Club',
      'Brooklyn Boxing Gym',
      'Elite Pilates Studio',
    ];

    for (const name of forbidden) {
      assert.throws(
        () => assertNotFitnessEntity(name),
        FitnessEntityProhibitedError,
        `Expected ${name} to be prohibited`
      );
      assert.equal(isFitnessEntity(name), true);
    }
  });

  it('permits non-fitness entities without error', () => {
    const allowed = [
      'Equifax Information Services LLC',
      'Portfolio Recovery Associates',
      'Comcast Cable Communications',
      'ADT Security Services',
      'State Farm Mutual Automobile Insurance',
      'Oakridge Property Management',
      'Withings Inc. — Legal & Consumer Dispute Dept.',
      'Withings Body Smart Scale',
      'LG Electronics USA, Inc.',
      'Generac / ecobee Inc.',
      'Samsung Electronics America, Inc.',
      'Canon U.S.A., Inc.',
      'Sonos, Inc.',
      'Roku, Inc.',
      'Tesla, Inc.',
      'Garmin Fitness Watch',
    ];

    for (const name of allowed) {
      assert.doesNotThrow(() => assertNotFitnessEntity(name));
      assert.equal(isFitnessEntity(name), false);
    }
  });

  it('preserves UPL compliance disclosures', () => {
    assert.ok(UPL_COMPLIANCE_DISCLOSURE.includes('self-help document preparation'));
    assert.ok(UPL_COMPLIANCE_DISCLOSURE.includes('not a law firm'));
    assert.ok(CLERK_DOCKET_REGISTRY_TITLE.includes('DOCKETSTAMP'));
  });
});

describe('3. 50-State + DC Statutory Security Deposit Registry', () => {
  it('covers all 50 states plus District of Columbia (51 total)', () => {
    const statutes = getAllStateStatutes();
    assert.equal(statutes.length, 51, 'Must contain 50 states + DC');
  });

  it('returns valid statutory metadata for key states', () => {
    const ca = getStateStatute('CA');
    assert.ok(ca);
    assert.equal(ca.returnDeadlineDays, 21);
    assert.ok(ca.statuteCitation.includes('Cal. Civ. Code § 1950.5'));

    const tx = getStateStatute('TX');
    assert.ok(tx);
    assert.equal(tx.returnDeadlineDays, 30);
    assert.ok(tx.statuteCitation.includes('Tex. Prop. Code'));
    assert.ok(tx.statuteCitation.includes('92.109'));

    const ny = getStateStatute('NY');
    assert.ok(ny);
    assert.equal(ny.returnDeadlineDays, 14);
    assert.ok(ny.statuteCitation.includes('N.Y. Gen. Oblig. Law § 7-108'));

    const fl = getStateStatute('FL');
    assert.ok(fl);
    assert.equal(fl.returnDeadlineDays, 15);
  });

  it('formats statutory citations reliably', () => {
    const formatted = formatStatuteCitation('TX');
    assert.ok(formatted.includes('Tex. Prop. Code'));
    assert.ok(formatted.includes('30'));
  });
});

describe('4. Pre-Verified Institutional Recipient Registry', () => {
  it('contains 38+ pre-verified institutional recipients', () => {
    const recipients = getAllVerifiedRecipients();
    assert.ok(recipients.length >= 38, `Expected at least 38 verified entities, found ${recipients.length}`);
  });

  it('includes the Big 4 credit reporting agencies', () => {
    assert.ok(getVerifiedRecipientById('bureau-equifax'));
    assert.ok(getVerifiedRecipientById('bureau-experian'));
    assert.ok(getVerifiedRecipientById('bureau-transunion'));
    assert.ok(getVerifiedRecipientById('bureau-innovis'));
  });

  it('includes major debt collection buyers', () => {
    assert.ok(getVerifiedRecipientById('debt-pra'));
    assert.ok(getVerifiedRecipientById('debt-midland'));
    assert.ok(getVerifiedRecipientById('debt-cavalry'));
    assert.ok(getVerifiedRecipientById('debt-tsi'));
  });

  it('includes tech hardware general counsel legal departments', () => {
    assert.ok(getVerifiedRecipientById('leg_wth'));
    assert.ok(getVerifiedRecipientById('leg_ecb'));
    assert.ok(getVerifiedRecipientById('leg_lg'));
    assert.ok(getVerifiedRecipientById('leg_sam'));
    assert.ok(getVerifiedRecipientById('leg_cnn'));
    assert.ok(getVerifiedRecipientById('leg_sns'));
    assert.ok(getVerifiedRecipientById('leg_rku'));
    assert.ok(getVerifiedRecipientById('leg_tsl'));
    assert.ok(getVerifiedRecipientById('legal-roku'));
  });

  it('filters by category accurately', () => {
    const bureaus = getVerifiedRecipientsByCategory('CREDIT_BUREAU');
    assert.ok(bureaus.length >= 3);

    const collectors = getVerifiedRecipientsByCategory('COLLECTION_AGENCY');
    assert.ok(collectors.length >= 9);

    const telecom = getVerifiedRecipientsByCategory('TELECOM');
    assert.ok(telecom.length >= 4);

    const techHardware = getVerifiedRecipientsByCategory('tech_hardware_legal');
    assert.equal(techHardware.length, 8);

    const techHardwareLegacy = getVerifiedRecipientsByCategory('TECH_HARDWARE');
    assert.equal(techHardwareLegacy.length, 8);
  });

  it('searches by name, department, or location', () => {
    const xfinity = searchVerifiedRecipients('comcast');
    assert.ok(xfinity.length > 0);
    assert.ok(xfinity[0].id === 'tel_cmcst' || xfinity[0].id === 'tel-comcast');

    const adt = searchVerifiedRecipients('ADT');
    assert.ok(adt.length > 0);
    assert.ok(adt[0].id === 'srv_adt' || adt[0].id === 'sec-adt');

    const withings = searchVerifiedRecipients('withings');
    assert.ok(withings.length > 0);
    assert.equal(withings[0].id, 'leg_wth');

    const roku = searchVerifiedRecipients('roku');
    assert.ok(roku.length > 0);
    assert.equal(roku[0].id, 'leg_rku');
  });
});

describe('5. Document Interpolation Engine', () => {
  it('interpolates tokens and handles unfilled variables as DocuSign tags', () => {
    const userValues = {
      tenantFullName: 'Jane Doe',
      rentalPropertyAddress: '123 Main St, Apt 4B',
      rentalCity: 'Austin',
      rentalState: 'TX',
      rentalZip: '78701',
      // Notice: moveOutDate is deliberately omitted to test unfilled token
    };

    const doc = interpolateDocument({
      notice: intentToVacateNotice,
      userValues,
    });

    assert.ok(doc.docketId.startsWith('DS-2026-'));
    assert.equal(doc.headerTitle, intentToVacateNotice.documentHeaderTitle);
    assert.ok(doc.reLine.includes('123 Main St'));

    // Check paragraph tokens for unfilled vacate token
    const allTokens = doc.paragraphs.flat();
    const vacateToken = allTokens.find((t) => t.key === 'moveOutDate' || t.key === 'effectiveVacateDate');
    assert.ok(vacateToken);
    assert.equal(vacateToken.type, 'variable');
    assert.equal(vacateToken.isFilled, false);
    assert.ok(vacateToken.docusignTagLabel?.includes('DATE'));
  });

  it('merges 50-state statutory lookups when usesStateStatuteLookup is true', () => {
    const userValues = {
      tenantFullName: 'Marcus Vance',
      landlordOrManagerName: 'Oakridge Properties LLC',
      rentalPropertyAddress: '402 Pine Street',
      rentalState: 'TX',
      surrenderDate: 'September 1, 2026',
      depositAmount: '$1,850.00',
      forwardingAddress: '8800 Research Blvd, Austin, TX 78758',
    };

    const doc = interpolateDocument({
      notice: securityDepositNotice,
      userValues,
    });

    // Check raw paragraphs for injected Texas statute
    assert.ok(doc.rawParagraphs.some((p) => p.includes('Tex. Prop. Code')));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('$1,850.00')));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('This requested response period does not change any statutory deadline')));
    assert.ok(!doc.rawParagraphs.some((p) => /\b30 days\b|statuteDeadline/i.test(p)));
  });

  it('interpolates Cartridge 07 Pre-Arbitration Dispute notice accurately', () => {
    const userValues = {
      senderFullName: 'Morgan L. Vance',
      recipientFormalName: 'Withings Inc. — Legal & Consumer Dispute Dept.',
      productOrServiceName: 'Withings Body Scan Smart Scale',
      accountOrSerialIdentifier: 'morgan@example.com / SN-94820184',
      purchaseDate: '2026-01-15',
      disputeTriggerCategory: 'Post-Purchase Removal or Paywalling of Advertised Feature',
      factualSummary: 'ECG vascular age feature advertised at time of purchase was placed behind an unexpected monthly subscription paywall.',
      requestedResolutionAmount: '$399.95',
    };

    const doc = interpolateDocument({
      notice: preArbitrationDisputeNotice,
      userValues,
      docketId: 'DS-2026-DISPUTE1',
      serviceLevel: 'certified_return_receipt',
    });

    assert.equal(doc.headerTitle, 'FORMAL DEMAND FOR REFUND OR FEATURE RESTORATION');
    assert.ok(doc.reLine.includes('Withings Body Scan Smart Scale'));
    assert.ok(doc.reLine.includes('SN-94820184'));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('Morgan L. Vance')));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('Post-Purchase Removal or Paywalling of Advertised Feature')));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('$399.95')));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('I request a written response within 30 days of receipt')));
    assert.ok(!doc.rawParagraphs.some((p) => /mandatory informal dispute resolution provisions|within thirty \(30\) days/i.test(p)));

    // Test Zod schema validation
    assert.doesNotThrow(() => preArbitrationDisputeNotice.zodSchema.parse(userValues));

    // Test fitness blocker inside schema refinement
    assert.throws(
      () => preArbitrationDisputeNotice.zodSchema.parse({
        ...userValues,
        recipientFormalName: 'Equinox Holdings LLC',
      }),
      FitnessEntityProhibitedError
    );
  });

  it('interpolates Cartridge 08 Arbitration Opt-Out notice accurately', () => {
    const userValues = {
      senderFullName: 'Jordan E. Blake',
      recipientFormalName: 'Roku, Inc. — General Counsel & Arbitration Opt-Out',
      productOrPlatformName: 'Roku Smart OS Platform',
      accountIdentifier: 'jordan.blake@example.com',
      termsEffectiveOrPurchaseDate: '2026-03-01',
    };

    const doc = interpolateDocument({
      notice: arbitrationOptOutNotice,
      userValues,
      docketId: 'DS-2026-OPTOUT1',
      serviceLevel: 'certified',
    });

    assert.equal(doc.headerTitle, 'FORMAL WRITTEN NOTICE OF OPT-OUT FROM ARBITRATION AND CLASS WAIVER');
    assert.ok(doc.reLine.includes('Roku Smart OS Platform'));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('Jordan E. Blake')));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('jordan.blake@example.com')));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('I elect to opt out of mandatory arbitration and any associated class-action waiver to the extent the governing agreement permits')));
    assert.ok(!doc.rawParagraphs.some((p) => /timely postmarked|retain all rights|court or regulatory agency/i.test(p)));

    // Test Zod schema validation
    assert.doesNotThrow(() => arbitrationOptOutNotice.zodSchema.parse(userValues));

    // Test fitness blocker inside schema refinement
    assert.throws(
      () => arbitrationOptOutNotice.zodSchema.parse({
        ...userValues,
        recipientFormalName: 'Planet Fitness Franchise',
      }),
      FitnessEntityProhibitedError
    );
  });

  it('interpolates Cartridge 09 Biometric Privacy Deletion notice accurately', () => {
    const userValues = {
      senderFullName: 'Devon R. Kessler',
      recipientFormalName: 'Withings Inc. — Privacy & Data Protection',
      accountEmailOrId: 'devon.kessler@example.com',
      deviceOrAppCategory: 'Connected Health & Biometric Sensor Device',
      applicablePrivacyFramework: 'Applicable State Consumer Data & Biometric Privacy Statutes (including CCPA/CPRA, MHMDA, TDPSA, and BIPA)',
    };

    const doc = interpolateDocument({
      notice: biometricPrivacyDeletionNotice,
      userValues,
      docketId: 'DS-2026-ERASURE1',
      serviceLevel: 'certified',
    });

    assert.equal(doc.headerTitle, 'DEMAND FOR DELETION OF PERSONAL DATA');
    assert.ok(doc.reLine.includes('devon.kessler@example.com'));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('Devon R. Kessler')));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('Connected Health & Biometric Sensor Device')));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('to the extent applicable law covers my account and request')));
    assert.ok(doc.rawParagraphs.some((p) => p.includes('If you retain any data, explain what is retained and why')));
    assert.ok(!doc.rawParagraphs.some((p) => /CCPA\/CPRA|complete and permanent deletion|applicable statutory response period/i.test(p)));

    // Test Zod schema validation
    assert.doesNotThrow(() => biometricPrivacyDeletionNotice.zodSchema.parse(userValues));

    // Test fitness blocker inside schema refinement
    assert.throws(
      () => biometricPrivacyDeletionNotice.zodSchema.parse({
        ...userValues,
        recipientFormalName: 'Gold\'s Gym International',
      }),
      FitnessEntityProhibitedError
    );
  });
});

describe('6. Lob 8.5x11 Physical Letter HTML Shell Generator', () => {
  it('generates court-ready 8.5x11 HTML with Clerk Docket Stamp and UPL footer', () => {
    const userValues = {
      tenantFullName: 'Alex Rivera',
      landlordOrManagerName: 'Summit Properties',
      rentalPropertyAddress: '742 Evergreen Terrace',
      rentalCity: 'Springfield',
      rentalState: 'OR',
      rentalZip: '97477',
      currentLeaseEndDate: 'November 30, 2026',
      effectiveVacateDate: 'November 30, 2026',
      forwardingAddress: 'PO Box 99, Eugene, OR 97401',
    };

    const doc = interpolateDocument({
      notice: intentToVacateNotice,
      userValues,
      docketId: 'DS-2026-TEST1',
      serviceLevel: 'certified',
    });

    const html = renderLobHtmlShell(doc);

    // Verify 8.5x11 CSS page setup
    assert.ok(html.includes('size: 8.5in 11in'));

    // Verify Clerk's Docket Stamp block
    assert.ok(html.includes('DOCKETSTAMP™') && html.includes('DISPATCH REGISTRY'));
    assert.ok(html.includes('DS-2026-TEST1'));
    assert.ok(html.includes('USPS CERTIFIED'));
    assert.ok(html.includes('ADDRESS VERIFICATION NOT CONFIRMED'));
    assert.ok(!html.includes('CASS™ VERIFIED'), 'No verified address claim without verification evidence');

    // Verify RE Line and formal signature
    assert.ok(html.includes('742 Evergreen Terrace'));
    assert.ok(html.includes('/s/ Alex Rivera'));

    // Verify Mandatory UPL statutory footer
    assert.ok(html.includes('DocketStamp is an automated self-help document preparation') || html.includes('DocketStamp is a self-help document preparation'));
  });
});
