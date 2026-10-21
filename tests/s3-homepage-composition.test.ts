import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  STATUTORY_COMPLIANCE_DISCLOSURE,
  UPL_COMPLIANCE_FOOTER_TEXT,
} from '../src/lib/docket/guardrails';
import { DOCKET_PRICING_TIERS } from '../src/lib/docket/notices';

describe('S3 Homepage Composition Acceptance Gate', () => {
  const rootDir = process.cwd();
  const pageSource = fs.readFileSync(path.join(rootDir, 'app/page.tsx'), 'utf8');
  const workbenchSource = fs.readFileSync(
    path.join(rootDir, 'src/components/docket/InteractiveHomeWorkbench.tsx'),
    'utf8'
  );
  const chooserSource = fs.readFileSync(
    path.join(rootDir, 'src/components/docket/HomeLetterChooser.tsx'),
    'utf8'
  );
  const headerLookupSource = fs.readFileSync(
    path.join(rootDir, 'src/components/docket/HeaderDocketLookup.tsx'),
    'utf8'
  );
  const layoutSource = fs.readFileSync(path.join(rootDir, 'app/layout.tsx'), 'utf8');

  describe('1. Baseline Hero Copy & Information Architecture', () => {
    it('renders exact §6 hero headline and subheadline in InteractiveHomeWorkbench', () => {
      assert.ok(
        workbenchSource.includes('Make it formal. We’ll print and mail it.'),
        'Hero must render the approved formal-letter headline'
      );
      assert.ok(
        workbenchSource.includes(
          'Demand your deposit back, dispute an error, or send a cancellation notice. Prepare and review your letter, then send it by USPS. Certified Mail available.'
        ),
        'Hero must render the approved customer action and USPS copy'
      );
    });

    it('renders sticky navigation header with compact brand, links, and utilities', () => {
      assert.ok(pageSource.includes('DOCKETSTAMP'), 'Header must render brand mark');
      assert.ok(pageSource.includes('USPS Certified Mail® Service'), 'Header must render service tagline');
      assert.ok(pageSource.includes('href="#how-it-works"'), 'Header must link to #how-it-works');
      assert.ok(pageSource.includes('href="#pricing"'), 'Header must link to #pricing');
      assert.ok(pageSource.includes('href="#faq"'), 'Header must link to #faq');
      assert.ok(pageSource.includes('href="/companies"'), 'Header must link to /companies');
      assert.ok(pageSource.includes('<HeaderDocketLookup />'), 'Header must mount HeaderDocketLookup');
      assert.ok(pageSource.includes('<HeaderUserNav />'), 'Header must mount HeaderUserNav');
    });

    it('preserves all useful legacy hash anchors on homepage', () => {
      assert.ok(pageSource.includes('id="workbench"') || workbenchSource.includes('id="workbench"'));
      assert.ok(pageSource.includes('id="how-it-works"'));
      assert.ok(pageSource.includes('id="pricing"'));
      assert.ok(pageSource.includes('id="faq"'));
      assert.ok(pageSource.includes('id="notice-catalog"'));
      assert.ok(pageSource.includes('id="verified-directory"'));
    });

    it('renders the 3-step process strip per §8', () => {
      assert.ok(pageSource.includes('1. Choose your letter'));
      assert.ok(pageSource.includes('2. Add your details and review'));
      assert.ok(pageSource.includes('3. We print and mail via USPS'));
      assert.ok(pageSource.includes('Pick from 9 formal notice templates'));
      assert.ok(pageSource.includes('review the exact single-page 8.5'));
      assert.ok(pageSource.includes('USPS First-Class or Certified Mail®'));
    });

    it('sources informational pricing strictly from DOCKET_PRICING_TIERS and eliminates Most Popular', () => {
      assert.ok(pageSource.includes('DOCKET_PRICING_TIERS.first_class.formattedPrice'));
      assert.ok(pageSource.includes('DOCKET_PRICING_TIERS.certified.formattedPrice'));
      assert.ok(pageSource.includes('DOCKET_PRICING_TIERS.certified_return_receipt.formattedPrice'));
      assert.equal(DOCKET_PRICING_TIERS.first_class.formattedPrice, '$12.95');
      assert.equal(DOCKET_PRICING_TIERS.certified.formattedPrice, '$19.95');
      assert.equal(DOCKET_PRICING_TIERS.certified_return_receipt.formattedPrice, '$27.95');

      // Elimination of unbacked "Most Popular" badge on homepage
      assert.ok(
        !pageSource.includes('Most Popular'),
        'Homepage pricing must NOT claim "Most Popular" without purchase evidence'
      );
      assert.ok(
        pageSource.includes('Recommended for Legal Notices') || pageSource.includes('Recommended'),
        'Template recommendation may be labeled Recommended'
      );
    });

    it('renders verified FAQ section covering all required topics per §8', () => {
      assert.ok(pageSource.includes('What is included in the price?'));
      assert.ok(pageSource.includes('How does USPS Certified Mail® differ from First-Class Mail?'));
      assert.ok(pageSource.includes('Do I need an account to send a letter?'));
      assert.ok(pageSource.includes('guest checkout'));
      assert.ok(pageSource.includes('How do pre-addressed corporate recipients work?'));
      assert.ok(pageSource.includes('Is DocketStamp a law firm?'));
      assert.ok(pageSource.includes('not a law firm'));
      assert.ok(pageSource.includes('Can I review my letter before paying?'));
    });

    it('renders complete footer navigation and verbatim statutory disclosures', () => {
      const requiredLinks = [
        '/companies',
        '/privacy',
        '/terms',
        '/disclaimer',
        '/return-policy',
        '/docket/DS-2026-88419-X',
        '/account',
        '/llms.txt',
        '/admin',
      ];
      for (const link of requiredLinks) {
        assert.ok(pageSource.includes(`href="${link}"`), `Footer must link to ${link}`);
      }

      assert.ok(
        pageSource.includes('{STATUTORY_COMPLIANCE_DISCLOSURE}'),
        'Footer must render STATUTORY_COMPLIANCE_DISCLOSURE verbatim'
      );
      assert.ok(
        pageSource.includes('UPL_COMPLIANCE_FOOTER_TEXT'),
        'Footer must render UPL_COMPLIANCE_FOOTER_TEXT verbatim'
      );
    });
  });

  describe('2. Elimination of Duplicated Selection Surfaces & Personal Inputs on Home', () => {
    it('eliminates personal-data input fields from homepage', () => {
      const forbiddenInputs = [
        'name="senderFullName"',
        'name="senderAddressLine1"',
        'name="depositAmount"',
        'name="vacatedPremisesAddress"',
        'name="leasedPremisesAddress"',
        'name="accountOrPolicyNumber"',
        'workbench-input-',
      ];
      for (const input of forbiddenInputs) {
        assert.ok(
          !workbenchSource.includes(input),
          `InteractiveHomeWorkbench must NOT contain personal input ${input}`
        );
        assert.ok(
          !pageSource.includes(input),
          `app/page.tsx must NOT contain personal input ${input}`
        );
      }
    });

    it('eliminates Popular chips, category filter tabs, template select dropdown, and duplicate card catalog', () => {
      assert.ok(!workbenchSource.includes('POPULAR_SCENARIO_CHIPS'), 'No popular chips on home');
      assert.ok(!workbenchSource.includes('NOTICE_CATEGORIES'), 'No category tabs on home');
      assert.ok(!workbenchSource.includes('handleFilterChange'), 'No category filter on home');
      assert.ok(!workbenchSource.includes('notice-template-select'), 'No template dropdown on home');
      assert.ok(!pageSource.includes('<NoticeCatalogBrowser'), 'No duplicate catalog browser on home');
    });

    it('eliminates interactive tier selection from homepage', () => {
      assert.ok(
        !workbenchSource.includes('handleTierChange') && !workbenchSource.includes('setSelectedTier('),
        'InteractiveHomeWorkbench must not contain interactive homepage tier buttons'
      );
    });

    it('mounts single unified discovery surface HomeLetterChooser in hero', () => {
      assert.ok(
        workbenchSource.includes('<HomeLetterChooser'),
        'InteractiveHomeWorkbench must mount HomeLetterChooser'
      );
    });
  });

  describe('3. Compact Closed-by-Default Header Tracking Utility', () => {
    it('is closed by default and displays compact "Track a letter" button', () => {
      assert.ok(
        headerLookupSource.includes('const [isOpen, setIsOpen] = useState(false)'),
        'HeaderDocketLookup must initialize isOpen to false (closed by default)'
      );
      assert.ok(
        headerLookupSource.includes('aria-expanded={isOpen}'),
        'Header tracking button must set aria-expanded'
      );
      assert.ok(
        headerLookupSource.includes('Track a letter'),
        'Header tracking button must display "Track a letter"'
      );
    });

    it('renders accessible dialog popover with Docket ID input, Track button, and specimen link', () => {
      assert.ok(headerLookupSource.includes('role="dialog"'), 'Popover must use role="dialog"');
      assert.ok(headerLookupSource.includes('id="header-tracking-popover"'));
      assert.ok(
        headerLookupSource.includes('placeholder="Track Docket ID (DS-2026-...)"'),
        'Must use placeholder "Track Docket ID (DS-2026-...)"'
      );
      assert.ok(
        headerLookupSource.includes('href="/docket/DS-2026-88419-X"'),
        'Must link to specimen tracking record /docket/DS-2026-88419-X'
      );
      assert.ok(
        headerLookupSource.includes('Track') && headerLookupSource.includes('type="submit"'),
        'Must render Track submit button'
      );
    });

    it('handles Escape key and outside click to close tracking popover', () => {
      assert.ok(headerLookupSource.includes("e.key === 'Escape'"), 'Must handle Escape key to close');
      assert.ok(headerLookupSource.includes('handleClickOutside'), 'Must handle outside click to close');
    });
  });

  describe('4. Shared-Renderer Preview Parity & Mobile Expandable Disclosure', () => {
    it('uses shared interpolateNotice and LivePaperSheet for previews', () => {
      assert.ok(
        workbenchSource.includes('interpolateNotice({'),
        'Workbench must use shared interpolateNotice engine'
      );
      assert.ok(
        workbenchSource.includes('<LivePaperSheet'),
        'Workbench must render actual LivePaperSheet'
      );
      assert.ok(
        workbenchSource.includes('verificationStatus="unverified"'),
        'Preview must honestly reflect verificationStatus="unverified"'
      );
      assert.ok(
        workbenchSource.includes('isSignatureAdopted={false}'),
        'Preview must honestly reflect isSignatureAdopted={false}'
      );
    });

    it('displays "Example letter — preview only" in initial unselected state', () => {
      assert.ok(
        workbenchSource.includes('Example letter — preview only'),
        'Must display "Example letter — preview only" when no letter is selected'
      );
      assert.ok(
        workbenchSource.includes('SAMPLE_PREVIEW_VALUES'),
        'Must isolate sample preview values'
      );
    });

    it('displays "Letter preview — add your details next" when letter is selected', () => {
      assert.ok(
        workbenchSource.includes('Letter preview — add your details next'),
        'Must display "Letter preview — add your details next" when letter is selected'
      );
    });

    it('renders expandable preview disclosure on mobile (< lg)', () => {
      assert.ok(
        workbenchSource.includes('aria-controls="mobile-letter-preview-sheet"'),
        'Mobile preview button must control mobile-letter-preview-sheet'
      );
      assert.ok(
        workbenchSource.includes('aria-expanded={isMobilePreviewOpen}'),
        'Mobile preview button must declare aria-expanded'
      );
      assert.ok(
        workbenchSource.includes('selectedSlug ? \'Preview selected letter\' : \'Preview example letter\''),
        'Mobile button text reflects unselected vs selected state'
      );
      assert.ok(
        workbenchSource.includes('lg:hidden'),
        'Mobile expandable disclosure must be scoped to mobile viewports'
      );
      assert.ok(
        workbenchSource.includes('hidden lg:block'),
        'Desktop preview must be hidden on mobile so chooser precedes preview'
      );
    });

    it('navigates to workspace on preview token click', () => {
      assert.ok(
        workbenchSource.includes('handleTokenClick'),
        'Workbench must handle token clicks'
      );
      assert.ok(
        workbenchSource.includes('buildHydrationUrl(fieldKey)'),
        'Token click must build hydration URL with focus parameter'
      );
    });
  });

  describe('5. Elimination of Unsupported Claims & Implementation Jargon', () => {
    it('verifies none of the forbidden phrases exist across all S3 files', () => {
      const forbiddenPhrases = [
        'in 60 seconds',
        '60 Seconds',
        "They can't ignore",
        "They Can't Ignore",
        'COURT PROOF',
        'court-ready',
        '1-Page USPS Lob Print Geometry Enforced',
        'Instrument parameters were staged deterministically',
        'Hydrating staged draft parameters',
      ];

      const s3Files = [
        { name: 'app/page.tsx', content: pageSource },
        { name: 'app/layout.tsx', content: layoutSource },
        { name: 'src/components/docket/InteractiveHomeWorkbench.tsx', content: workbenchSource },
        { name: 'src/components/docket/HeaderDocketLookup.tsx', content: headerLookupSource },
      ];

      for (const file of s3Files) {
        for (const phrase of forbiddenPhrases) {
          assert.ok(
            !file.content.includes(phrase),
            `File ${file.name} must NOT contain forbidden phrase "${phrase}"`
          );
        }
      }
    });
  });

  describe('6. WebMCP Declarative Form & Viewport Layout Contract', () => {
    it('preserves toolname="stage_homepage_notice" declarative WebMCP contract on Continue form', () => {
      assert.ok(
        chooserSource.includes('toolname: \'stage_homepage_notice\'') ||
          chooserSource.includes('toolname="stage_homepage_notice"'),
        'HomeLetterChooser Continue button must be wrapped in stage_homepage_notice WebMCP form'
      );
    });

    it('enforces compact listbox max-height in HomeLetterChooser for 1280x720 viewport fit', () => {
      assert.ok(
        chooserSource.includes('max-h-[220px]') || chooserSource.includes('max-h-[240px]'),
        'Chooser listbox must have compact max-height (<=240px) to guarantee rect.bottom <= 720'
      );
    });

    it('verifies tailwind.config.ts scans ./src directory for responsive classes', () => {
      const tailwindConfigSource = fs.readFileSync(path.join(rootDir, 'tailwind.config.ts'), 'utf8');
      assert.ok(
        tailwindConfigSource.includes('./src/**/*.{js,ts,jsx,tsx,mdx}'),
        'tailwind.config.ts content array must include "./src/**/*.{js,ts,jsx,tsx,mdx}"'
      );
    });
  });
});
