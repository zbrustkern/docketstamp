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
  it('registers all 6 initial notice cartridges', () => {
    const all = getAllNotices();
    assert.equal(all.length, 6, 'Must contain exactly 6 cartridges');
  });

  it('resolves cartridges by URL slug', () => {
    assert.ok(getNoticeBySlug('intent-to-vacate'));
    assert.ok(getNoticeBySlug('security-deposit-return'));
    assert.ok(getNoticeBySlug('tenant-repair-request'));
    assert.ok(getNoticeBySlug('credit-bureau-dispute'));
    assert.ok(getNoticeBySlug('debt-validation-request'));
    assert.ok(getNoticeBySlug('service-policy-cancellation'));
  });

  it('resolves cartridges by internal ID', () => {
    assert.equal(getNoticeById('tenant-vacate-notice')?.slug, 'intent-to-vacate');
    assert.equal(getNoticeById('security-deposit-demand')?.slug, 'security-deposit-return');
    assert.equal(getNoticeById('repair-maintenance-demand')?.slug, 'tenant-repair-request');
    assert.equal(getNoticeById('fcra-credit-dispute')?.slug, 'credit-bureau-dispute');
    assert.equal(getNoticeById('fdcpa-debt-validation')?.slug, 'debt-validation-request');
    assert.equal(getNoticeById('service-cancellation')?.slug, 'service-policy-cancellation');
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
    assert.ok(ca.statutoryCitation.includes('Cal. Civ. Code § 1950.5'));

    const tx = getStateStatute('TX');
    assert.ok(tx);
    assert.equal(tx.returnDeadlineDays, 30);
    assert.ok(tx.statutoryCitation.includes('Tex. Prop. Code'));
    assert.ok(tx.statutoryCitation.includes('92.109'));

    const ny = getStateStatute('NY');
    assert.ok(ny);
    assert.equal(ny.returnDeadlineDays, 14);
    assert.ok(ny.statutoryCitation.includes('N.Y. Gen. Oblig. Law § 7-108'));

    const fl = getStateStatute('FL');
    assert.ok(fl);
    assert.equal(fl.returnDeadlineDays, 15);
  });

  it('formats statutory citations reliably', () => {
    const formatted = formatStatuteCitation('TX');
    assert.ok(formatted.includes('Tex. Prop. Code'));
    assert.ok(formatted.includes('30-Day Statutory Deadline'));
  });
});

describe('4. Pre-Verified Institutional Recipient Registry', () => {
  it('contains 30+ pre-verified institutional recipients', () => {
    const recipients = getAllVerifiedRecipients();
    assert.ok(recipients.length >= 30, `Expected at least 30 verified entities, found ${recipients.length}`);
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

  it('filters by category accurately', () => {
    const bureaus = getVerifiedRecipientsByCategory('CREDIT_BUREAU');
    assert.equal(bureaus.length, 4);

    const collectors = getVerifiedRecipientsByCategory('COLLECTION_AGENCY');
    assert.ok(collectors.length >= 9);

    const telecom = getVerifiedRecipientsByCategory('TELECOM');
    assert.ok(telecom.length >= 4);
  });

  it('searches by name, department, or location', () => {
    const xfinity = searchVerifiedRecipients('comcast');
    assert.ok(xfinity.length > 0);
    assert.equal(xfinity[0].id, 'tel-comcast');

    const adt = searchVerifiedRecipients('ADT');
    assert.ok(adt.length > 0);
    assert.equal(adt[0].id, 'sec-adt');
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
      // Notice: effectiveVacateDate is deliberately omitted to test unfilled token
    };

    const doc = interpolateDocument({
      notice: intentToVacateNotice,
      userValues,
    });

    assert.ok(doc.docketId.startsWith('DS-2026-'));
    assert.equal(doc.headerTitle, intentToVacateNotice.documentHeaderTitle);
    assert.ok(doc.reLine.includes('123 Main St'));

    // Check first paragraph tokens
    const firstParaTokens = doc.paragraphs[0];
    const vacateToken = firstParaTokens.find((t) => t.key === 'effectiveVacateDate');
    assert.ok(vacateToken);
    assert.equal(vacateToken.type, 'variable');
    assert.equal(vacateToken.isFilled, false);
    assert.equal(vacateToken.docusignTagLabel, 'VACATE / SURRENDER DATE');
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
    const firstPara = doc.rawParagraphs[0];
    assert.ok(firstPara.includes('Tex. Prop. Code'));
    assert.ok(firstPara.includes('$1,850.00'));

    const secondPara = doc.rawParagraphs[1];
    assert.ok(secondPara.includes('30 calendar days'));
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
    assert.ok(html.includes('0.625in'));

    // Verify Clerk's Docket Stamp block
    assert.ok(html.includes('DOCKETSTAMP™ DISPATCH REGISTRY'));
    assert.ok(html.includes('DS-2026-TEST1'));
    assert.ok(html.includes('USPS CERTIFIED MAIL®'));
    assert.ok(html.includes('CASS ADDRESS VERIFIED'));

    // Verify RE Line and formal signature
    assert.ok(html.includes('742 Evergreen Terrace'));
    assert.ok(html.includes('/s/ Alex Rivera'));

    // Verify Mandatory 8pt UPL statutory footer
    assert.ok(html.includes('DocketStamp is a self-help document preparation'));
    assert.ok(html.includes('WESTERN AMALGAMATED'));
  });
});
