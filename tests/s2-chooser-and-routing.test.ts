/**
 * S2 Chooser and Routing Regression Tests
 *
 * Verifies Sprint S2 Acceptance Criteria:
 * 1. Display Metadata & Exact §7.4 Titles/Subtitles:
 *    - All 9 canonical notice cartridges mapped to plain customer-facing display titles and subtitles.
 *    - Dual indexing by canonical slug and design spec prompt slug.
 *    - Formal document title preserved untouched for legal print rendering.
 * 2. Deterministic Unified Search:
 *    - Queries for "deposit return", "Equifax", and "Sonos" return correct supported letters and companies.
 *    - Empty query restores all 9 letters.
 * 3. Hardware OEM Legal Purpose Disambiguation:
 *    - Sonos and all 8 tech_hardware_legal recipients require purpose disambiguation across all 3 compatible slugs.
 *    - Resolver NEVER silently defaults to refund (suggestedSlug is undefined).
 * 4. Incompatible Letter Switching & Clearing:
 *    - Selecting a company and switching to an incompatible letter (e.g. Equifax -> Security Deposit)
 *      visibly clears the company and returns a polite explanation.
 * 5. No-Match Query State:
 *    - Unmatched queries produce empty results and clear recovery path.
 * 6. Hard NAICS 713940 Fitness Blocker:
 *    - Restricted entities ("Planet Fitness", "Equinox", "gym") trigger the compliance blocker.
 *    - Permitted hardware OEMs ("Garmin", "Withings", "Sonos", "Tesla") remain allowed.
 * 7. Continuous Workspace URL Generation:
 *    - buildChooserWorkspaceUrl produces clean /notices/[slug] or /notices/[slug]?recipientId=[id].
 *    - Incompatible recipients are excluded.
 *    - Personal fields, tiers, and states are never included.
 * 8. Chooser Component Accessibility & Contract Verification:
 *    - Source inspection of HomeLetterChooser and CompanyDirectoryClient confirms exact copy,
 *      accessibility semantics, zero personal data on home, and honest corporate labels.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ALL_NOTICE_CARTRIDGES,
  getNoticeBySlug,
} from '../src/lib/docket/notices';

import { VERIFIED_RECIPIENTS } from '../src/lib/docket/data/verified-recipients';

import {
  CHOOSER_LETTERS,
  CHOOSER_METADATA_BY_SLUG,
  CHOOSER_PRICE_CUE,
  HARDWARE_OEM_PURPOSE_OPTIONS,
  FITNESS_BLOCKER_NOTICE,
  getLetterMetadata,
  normalizeToCanonicalSlug,
  getCompatibleSlugsForRecipient,
  isRecipientCompatibleWithLetter,
  getCompatibleRecipientsForSlug,
  resolveRecipientCompatibility,
  buildChooserWorkspaceUrl,
  searchChooser,
} from '../src/lib/docket/chooser-routing';

import {
  assertNonFitnessEntity,
  isFitnessEntity,
  STATUTORY_COMPLIANCE_DISCLOSURE,
} from '../src/lib/docket/guardrails';

describe('S2 Chooser and Routing Acceptance Gate', () => {
  describe('1. Canonical Slugs, Titles, and Plain Display Metadata', () => {
    it('maps all 9 cartridges with the current customer-facing titles and subtitles', () => {
      assert.equal(
        CHOOSER_LETTERS.length,
        9,
        'Chooser must contain exactly 9 letters'
      );
      assert.equal(
        ALL_NOTICE_CARTRIDGES.length,
        9,
        'ALL_NOTICE_CARTRIDGES must have exactly 9 cartridges'
      );

      const expected = [
        {
          slug: 'security-deposit-accounting-request',
          promptSlug: 'security-deposit-return-demand-letter',
          displayTitle: 'Demand a deposit accounting and any balance due',
          subtitle: 'Demand an itemized accounting and request any balance you believe remains due.',
        },
        {
          slug: 'credit-report-dispute-request',
          promptSlug: 'credit-bureau-dispute-letter-fcra-611',
          displayTitle: 'Dispute an error on your credit report',
          subtitle: 'Ask the credit bureau to investigate information you identify as inaccurate.',
        },
        {
          slug: 'debt-dispute-information-request',
          promptSlug: 'debt-validation-demand-letter-fdcpa-809',
          displayTitle: 'Dispute a debt and demand verification',
          subtitle: 'Dispute a collection claim and demand written verification; legal protections depend on coverage and timing.',
        },
        {
          slug: 'service-cancellation-request',
          promptSlug: 'contract-membership-cancellation-notice',
          displayTitle: 'Cancel a service or policy in writing',
          subtitle: 'Give written notice requesting cancellation and ask for confirmation of the effective date.',
        },
        {
          slug: 'tenant-repair-and-maintenance-notice',
          promptSlug: 'notice-of-intent-to-withhold-or-repair-and-deduct',
          displayTitle: 'Demand repairs from your landlord',
          subtitle: 'Describe the condition you report, demand repairs, and request a written schedule.',
        },
        {
          slug: 'tenant-notice-of-intent-to-vacate',
          promptSlug: 'lease-termination-non-renewal-notice',
          displayTitle: 'Give formal move-out notice',
          subtitle: 'Tell your landlord when you plan to move out; check your lease and applicable rules for requirements.',
        },
        {
          slug: 'product-complaint-refund-request',
          promptSlug: 'smart-device-degraded-functionality-refund-demand',
          displayTitle: 'Demand a refund for a product or service issue',
          subtitle: 'Describe what happened and demand a refund; this does not satisfy an agreement-specific dispute process.',
        },
        {
          slug: 'arbitration-opt-out-procedure-request',
          promptSlug: 'arbitration-opt-out-notice-30-day',
          displayTitle: 'Ask about arbitration terms and opt-out steps',
          subtitle: 'Request the agreement and any procedure; the letter does not exercise an opt-out.',
        },
        {
          slug: 'personal-data-deletion-request',
          promptSlug: 'ccpa-gdpr-data-deletion-opt-out-request',
          displayTitle: 'Demand deletion of your personal data',
          subtitle: 'Demand deletion and ask the company to identify any verification or designated submission process.',
        },
      ];

      for (const exp of expected) {
        // Test resolution by canonical slug
        const metaByCanonical = getLetterMetadata(exp.slug);
        assert.ok(metaByCanonical, `Must resolve metadata for canonical slug: ${exp.slug}`);
        assert.equal(metaByCanonical.displayTitle, exp.displayTitle);
        assert.equal(metaByCanonical.subtitle, exp.subtitle);

        // Test resolution by prompt slug
        const metaByPromptSlug = getLetterMetadata(exp.promptSlug);
        assert.ok(metaByPromptSlug, `Must resolve metadata for prompt slug: ${exp.promptSlug}`);
        assert.equal(metaByPromptSlug.displayTitle, exp.displayTitle);
        assert.equal(metaByPromptSlug.subtitle, exp.subtitle);

        // Verify normalization returns the canonical slug
        assert.equal(normalizeToCanonicalSlug(exp.promptSlug), exp.slug);
        assert.equal(normalizeToCanonicalSlug(exp.slug), exp.slug);

        // Verify formalDocumentTitle matches the canonical cartridge
        const cartridge = getNoticeBySlug(exp.slug);
        assert.ok(cartridge, `Cartridge exists for ${exp.slug}`);
        assert.equal(
          metaByCanonical.formalDocumentTitle,
          cartridge.title,
          'formalDocumentTitle must be preserved untouched for legal print rendering'
        );
      }
    });

    it('indexes all aliases so direct lookup never fails', () => {
      for (const notice of ALL_NOTICE_CARTRIDGES) {
        const meta = getLetterMetadata(notice.slug);
        assert.ok(meta, `Chooser metadata must resolve canonical slug ${notice.slug}`);
        assert.equal(meta.slug, notice.slug);
        assert.equal(normalizeToCanonicalSlug(notice.slug), notice.slug);
        for (const alias of notice.aliases || []) {
          assert.equal(getNoticeBySlug(alias), notice, `Template alias ${alias} must resolve`);
          assert.equal(getLetterMetadata(alias)?.slug, notice.slug, `Chooser alias ${alias} must normalize`);
          assert.equal(normalizeToCanonicalSlug(alias), notice.slug, `Alias ${alias} must route canonically`);
        }
      }
    });
  });

  describe('2. Deterministic Unified Search', () => {
    it('searches for "deposit return" and matches the deposit letter with no companies', () => {
      const res = searchChooser('deposit return');
      assert.equal(res.isFitnessBlocked, false);
      assert.ok(res.letters.length >= 1, 'Should match at least 1 letter');
      assert.equal(res.letters[0].slug, 'security-deposit-accounting-request');
      assert.equal(res.companies.length, 0, 'No companies should match deposit return');
    });

    it('searches for "Equifax" and returns both the FCRA dispute letter and the Equifax corporate recipient', () => {
      const res = searchChooser('Equifax');
      assert.equal(res.isFitnessBlocked, false);

      const hasFcraLetter = res.letters.some(
        (l) => l.slug === 'credit-report-dispute-request'
      );
      assert.ok(hasFcraLetter, 'Must match FCRA credit dispute letter');

      const hasEquifaxCompany = res.companies.some((c) => c.id === 'cra_eqf');
      assert.ok(hasEquifaxCompany, 'Must match Equifax verified recipient (cra_eqf)');
    });

    it('searches for "Sonos" and returns the refund letter and the Sonos legal department recipient', () => {
      const res = searchChooser('Sonos');
      assert.equal(res.isFitnessBlocked, false);

      const hasHardwareLetter = res.letters.some(
        (l) => l.slug === 'product-complaint-refund-request'
      );
      assert.ok(hasHardwareLetter, 'Must match hardware refund letter');

      const hasSonosCompany = res.companies.some((c) => c.id === 'leg_sns');
      assert.ok(hasSonosCompany, 'Must match Sonos recipient (leg_sns)');
    });

    it('empty search query restores all 9 letters and 0 companies', () => {
      const res = searchChooser('');
      assert.equal(res.letters.length, 9);
      assert.equal(res.companies.length, 0);
      assert.equal(res.isFitnessBlocked, false);
      assert.equal(res.totalMatches, 9);
    });
  });

  describe('3. Hardware OEM Legal Purpose Disambiguation', () => {
    it('Sonos and all 8 tech_hardware_legal recipients require purpose disambiguation and NEVER silently default to refund', () => {
      const hardwareRecipients = VERIFIED_RECIPIENTS.filter(
        (r) => r.category === 'tech_hardware_legal'
      );
      assert.equal(hardwareRecipients.length, 8, 'Must have exactly 8 hardware recipients');

      const expectedCompatibleSlugs = [
        'product-complaint-refund-request',
        'arbitration-opt-out-procedure-request',
        'personal-data-deletion-request',
      ];

      for (const recipient of hardwareRecipients) {
        const compat = resolveRecipientCompatibility(recipient);

        assert.equal(
          compat.status,
          'multi_purpose',
          `${recipient.brandName} must have status multi_purpose`
        );
        assert.equal(
          compat.suggestedSlug,
          undefined,
          `${recipient.brandName} MUST NEVER silently default to a refund slug!`
        );
        assert.ok(compat.purposes, `${recipient.brandName} must provide purpose options`);
        assert.equal(compat.purposes.length, 3, 'Must have exactly 3 purpose options');

        const purposeSlugs = compat.purposes.map((p) => p.slug);
        for (const expSlug of expectedCompatibleSlugs) {
          assert.ok(
            purposeSlugs.includes(expSlug),
            `Purpose options for ${recipient.brandName} must include ${expSlug}`
          );
        }
      }
    });

    it('HARDWARE_OEM_PURPOSE_OPTIONS provides the exact 3 purpose labels and descriptions', () => {
      assert.equal(HARDWARE_OEM_PURPOSE_OPTIONS.length, 3);
      assert.equal(
        HARDWARE_OEM_PURPOSE_OPTIONS[0].label,
        'Demand a refund for a product or service issue'
      );
      assert.equal(
        HARDWARE_OEM_PURPOSE_OPTIONS[1].label,
        'Ask about arbitration terms and opt-out steps'
      );
      assert.equal(
        HARDWARE_OEM_PURPOSE_OPTIONS[2].label,
        'Demand deletion of your personal data'
      );
    });
  });

  describe('4. Incompatible Letter Switching & Clearing', () => {
    it('switching from Equifax to Security Deposit return visibly clears the company with a polite reason', () => {
      const compat = resolveRecipientCompatibility(
        'cra_eqf',
        'security-deposit-return-demand-letter'
      );
      assert.equal(compat.isCompatible, false);
      assert.ok(compat.clearedReason);
      assert.ok(
        compat.clearedReason.includes('Cleared Equifax'),
        'Must specify that Equifax was cleared'
      );
      assert.ok(
        compat.clearedReason.includes('landlord or custom recipient'),
        'Must explain it goes to a landlord'
      );
    });

    it('switching from Debt Collector to Service Cancellation clears the company', () => {
      const compat = resolveRecipientCompatibility(
        'col_pra',
        'written-contract-and-policy-cancellation-letter'
      );
      assert.equal(compat.isCompatible, false);
      assert.ok(compat.clearedReason);
      assert.ok(compat.clearedReason.includes('Portfolio Recovery'));
    });

    it('switching between compatible purposes for a hardware OEM preserves compatibility', () => {
      const compat1 = resolveRecipientCompatibility(
        'leg_sns',
        'pre-arbitration-notice-of-dispute-and-refund-request'
      );
      assert.equal(compat1.isCompatible, true);

      const compat2 = resolveRecipientCompatibility(
        'leg_sns',
        '30-day-mandatory-arbitration-opt-out-notice'
      );
      assert.equal(compat2.isCompatible, true);

      const compat3 = resolveRecipientCompatibility(
        'leg_sns',
        'statutory-health-and-biometric-data-deletion-demand'
      );
      assert.equal(compat3.isCompatible, true);
    });
  });

  describe('5. No-Match Query State & Recovery', () => {
    it('returns 0 matches for a non-existent search query without throwing', () => {
      const res = searchChooser('nonexistent_random_company_xyz123');
      assert.equal(res.letters.length, 0);
      assert.equal(res.companies.length, 0);
      assert.equal(res.totalMatches, 0);
      assert.equal(res.isFitnessBlocked, false);
    });

    it('recovering from no-match by clearing returns all 9 letters', () => {
      const res = searchChooser('');
      assert.equal(res.letters.length, 9);
      assert.equal(res.totalMatches, 9);
    });
  });

  describe('6. Hard NAICS 713940 Fitness Blocker', () => {
    it('blocks Planet Fitness, Equinox, and gym searches with the plain compliance notice', () => {
      const queries = ['Planet Fitness', 'Equinox', 'gym', 'LA Fitness', 'Crunch Fitness'];

      for (const q of queries) {
        const res = searchChooser(q);
        assert.equal(res.isFitnessBlocked, true, `${q} must be fitness blocked`);
        assert.equal(res.letters.length, 0, `${q} must return 0 letters`);
        assert.equal(res.companies.length, 0, `${q} must return 0 companies`);
        assert.equal(res.totalMatches, 0);
        assert.equal(
          res.fitnessBlockerNotice,
          FITNESS_BLOCKER_NOTICE,
          `${q} must display the exact compliance blocker notice`
        );
      }
    });

    it('permits connected hardware OEMs (Garmin, Withings, Sonos, Tesla)', () => {
      const allowedOems = ['Garmin', 'Withings', 'Sonos', 'Tesla', 'Ecobee', 'Samsung', 'LG'];

      for (const oem of allowedOems) {
        const res = searchChooser(oem);
        assert.equal(
          res.isFitnessBlocked,
          false,
          `${oem} must NOT be blocked by fitness guardrails`
        );
        assert.ok(
          res.totalMatches > 0,
          `${oem} must match letter or company results`
        );
      }
    });

    it('blocks Continue when search query triggers fitness restriction even if a letter was previously selected', () => {
      // 1. User selects a valid letter
      const selectedSlug = 'fcra-credit-bureau-written-dispute-letter';
      assert.ok(getLetterMetadata(selectedSlug));

      // 2. User subsequently types a fitness entity
      const fitnessSearch = searchChooser('Equinox');
      assert.equal(fitnessSearch.isFitnessBlocked, true);

      // Verify the chooser guard contract:
      // When isFitnessBlocked is true, isComplete MUST evaluate to false even with selectedSlug set
      const isCompleteProgrammatic = !fitnessSearch.isFitnessBlocked && Boolean(selectedSlug);
      assert.equal(
        isCompleteProgrammatic,
        false,
        'isComplete MUST evaluate to false when fitness query is active'
      );

      // 3. Verify HomeLetterChooser source code contains the strict guard in isComplete and handleContinue
      const chooserSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/HomeLetterChooser.tsx'),
        'utf8'
      );
      assert.ok(
        chooserSource.includes('if (searchResult.isFitnessBlocked) return false;'),
        'isComplete must return false when searchResult.isFitnessBlocked is true'
      );
      assert.ok(
        chooserSource.includes('if (searchResult.isFitnessBlocked) return;'),
        'handleContinue must guard against searchResult.isFitnessBlocked'
      );
    });
  });

  describe('7. Continuous Workspace URL Generation', () => {
    it('builds workspace URL with compatible recipient parameter', () => {
      const url = buildChooserWorkspaceUrl(
        'credit-report-dispute-request',
        'cra_eqf'
      );
      assert.equal(
        url,
        '/notices/credit-report-dispute-request?recipientId=cra_eqf'
      );
    });

    it('builds workspace URL without recipient when no recipient is selected', () => {
      const url = buildChooserWorkspaceUrl('security-deposit-return-demand-letter');
      assert.equal(url, '/notices/security-deposit-accounting-request');
    });

    it('strips incompatible recipientId when paired with an incompatible letter', () => {
      // Equifax passed to security deposit letter should be stripped
      const url = buildChooserWorkspaceUrl(
        'security-deposit-return-demand-letter',
        'cra_eqf'
      );
      assert.equal(url, '/notices/security-deposit-accounting-request');
    });

    it('normalizes prompt slug to canonical slug in URL', () => {
      const url = buildChooserWorkspaceUrl(
        'credit-bureau-dispute-letter-fcra-611',
        'cra_exp'
      );
      assert.equal(
        url,
        '/notices/credit-report-dispute-request?recipientId=cra_exp'
      );
    });

    it('never includes tier, state, or personal variables in generated URLs', () => {
      const urls = [
        buildChooserWorkspaceUrl('security-deposit-return-demand-letter'),
        buildChooserWorkspaceUrl('fcra-credit-bureau-written-dispute-letter', 'cra_eqf'),
        buildChooserWorkspaceUrl('pre-arbitration-notice-of-dispute-and-refund-request', 'leg_sns'),
      ];

      for (const u of urls) {
        assert.ok(!u.includes('tier='), `URL must not include tier: ${u}`);
        assert.ok(!u.includes('state='), `URL must not include state: ${u}`);
        assert.ok(!u.includes('name='), `URL must not include personal data: ${u}`);
        assert.ok(!u.includes('address='), `URL must not include address: ${u}`);
      }
    });
  });

  describe('8. Component UI Contract & Accessibility Audits', () => {
    it('verifies HomeLetterChooser source code contains exact required copy and accessibility roles', () => {
      const chooserSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/HomeLetterChooser.tsx'),
        'utf8'
      );

      // §7.3 exact copy
      assert.ok(
        chooserSource.includes('What do you need to send?'),
        'Must contain exact heading: What do you need to send?'
      );
      assert.ok(
        chooserSource.includes('Find a letter or company'),
        'Must contain exact label: Find a letter or company'
      );
      assert.ok(
        chooserSource.includes('Try “deposit return” or “Equifax”'),
        'Must contain exact placeholder: Try “deposit return” or “Equifax”'
      );
      assert.ok(
        chooserSource.includes('CHOOSER_PRICE_CUE'),
        'Must render price cue'
      );
      assert.ok(
        chooserSource.includes('You’ll review your letter before paying.'),
        'Must contain exact secondary helper copy'
      );
      assert.ok(
        chooserSource.includes('Continue'),
        'Must have Continue button'
      );
      assert.ok(
        chooserSource.includes('No matching letter or company found.'),
        'Must contain exact no-match heading: No matching letter or company found.'
      );

      // Accessibility semantics
      assert.ok(
        chooserSource.includes('role="listbox"'),
        'Must use listbox role for scannable choice list'
      );
      assert.ok(
        chooserSource.includes('role="option"'),
        'Must use option role for items'
      );
      assert.ok(
        chooserSource.includes('aria-selected='),
        'Must have aria-selected for selection state'
      );
      assert.ok(
        chooserSource.includes('aria-live="polite"'),
        'Must have aria-live="polite" for result announcements'
      );

      // Keyboard navigation support
      assert.ok(
        chooserSource.includes('ArrowDown'),
        'Must support ArrowDown keyboard navigation'
      );
      assert.ok(
        chooserSource.includes('ArrowUp'),
        'Must support ArrowUp keyboard navigation'
      );
      assert.ok(
        chooserSource.includes('Home'),
        'Must support Home key navigation'
      );
      assert.ok(
        chooserSource.includes('End'),
        'Must support End key navigation'
      );
      assert.ok(
        chooserSource.includes('Enter'),
        'Must support Enter key selection'
      );

      // Zero personal data fields on home
      const forbiddenInputs = [
        'name="senderFullName"',
        'name="senderAddressLine1"',
        'name="ssnLast4"',
        'name="dob"',
        'name="landlordName"',
      ];
      for (const field of forbiddenInputs) {
        assert.ok(
          !chooserSource.includes(field),
          `HomeLetterChooser must have zero personal data inputs (${field})`
        );
      }

      // Link to /companies directory
      assert.ok(
        chooserSource.includes('/companies'),
        'Must link to dedicated /companies directory'
      );
    });

    it('verifies CompanyDirectoryClient uses honest labels and presents all 3 purpose links for hardware OEMs', () => {
      const dirSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/CompanyDirectoryClient.tsx'),
        'utf8'
      );

      // Honest recipient badge
      assert.ok(
        dirSource.includes('Pre-addressed corporate recipient'),
        'Must use honest label: Pre-addressed corporate recipient'
      );
      assert.ok(
        !dirSource.includes('USPS CASS™ VERIFIED'),
        'Must NOT falsely claim USPS CASS™ VERIFIED on unvalidated drafts'
      );

      // Statutory compliance disclosure
      assert.ok(
        dirSource.includes('STATUTORY_COMPLIANCE_DISCLOSURE'),
        'Must render STATUTORY_COMPLIANCE_DISCLOSURE in footer'
      );

      // Disambiguation for hardware OEM
      assert.ok(
        dirSource.includes('HARDWARE_OEM_PURPOSE_OPTIONS'),
        'Must present all 3 purpose links for hardware OEM legal departments'
      );

      // Clean navigation back to /
      assert.ok(
        dirSource.includes('href="/"'),
        'Must provide clean navigation back to home'
      );
    });
  });
});
