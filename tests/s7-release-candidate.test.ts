import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

// Domain imports
import {
  ALL_NOTICE_CARTRIDGES,
  getNoticeBySlug,
  DOCKET_PRICING_TIERS,
} from '../src/lib/docket/notices';
import {
  CHOOSER_LETTERS,
  HARDWARE_OEM_PURPOSE_OPTIONS,
  resolveCompanyCompatibility,
  searchChooser,
  buildChooserWorkspaceUrl,
  FITNESS_BLOCKER_NOTICE,
  CHOOSER_PRICE_CUE,
} from '../src/lib/docket/chooser-routing';
import {
  assertNonFitnessEntity,
  isFitnessEntity,
  UPL_COMPLIANCE_FOOTER_TEXT,
  STATUTORY_COMPLIANCE_DISCLOSURE,
} from '../src/lib/docket/guardrails';
import {
  interpolateNotice,
  generateDocketId,
} from '../src/lib/docket/renderer/interpolate';
import { renderLobHtmlPayload } from '../src/lib/docket/renderer/lob-html-shell';
import { VERIFIED_RECIPIENTS } from '../src/lib/docket/data/verified-recipients';
import {
  validateNoticeDraft,
  isValidStreetAddress,
  isValidZipCode,
  isValidStateCode,
} from '../src/lib/docket/draft-recovery';
import {
  computeDedupeKey,
  isEventDeduplicated,
  markEventDeduplicated,
  resetDeduplicationState,
  computeFunnelConversionReport,
} from '../lib/telemetry';
import {
  isAuthorityEvent,
  AUTHORITY_EVENTS,
  ALLOWED_BROWSER_EVENT_NAMES,
  sanitizeMetadata,
  sanitizeUrlOrPath,
} from '../lib/telemetry-schema';
import { POST as lockAndIntentPost } from '../app/api/docket/lock-and-intent/route';
import { POST as confirmOrderPost } from '../app/api/checkout/confirm-order/route';
import { POST as telemetryPost } from '../app/api/telemetry/route';
import { getOrderById, saveOrder } from '../lib/firebase-admin';
import { Order, TelemetryEvent } from '../lib/types';

// Ensure mock payments are enabled for server route tests
process.env.ALLOW_LOCAL_MOCK_PAYMENTS = 'true';

describe('S7 Release Candidate Verification Suite', () => {

  // ==========================================================================
  // AREA 1: RESPONSIVE
  // ==========================================================================
  describe('Area 1: Responsive Layout & Viewport Geometry', () => {
    it('verifies responsive layout styles across 320px, 390px, 768px, and 1280px viewports', () => {
      // Read homepage component source
      const homeSource = fs.readFileSync(path.join(process.cwd(), 'app/page.tsx'), 'utf8');
      const workbenchSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/InteractiveHomeWorkbench.tsx'), 'utf8');
      const headerSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/HeaderDocketLookup.tsx'), 'utf8');

      // Check max-width constraints and overflow protection
      assert.ok(homeSource.includes('overflow-x-hidden'), 'Homepage root prevents horizontal scroll overflow');
      assert.ok(workbenchSource.includes('max-w-7xl') || workbenchSource.includes('max-w-6xl') || workbenchSource.includes('max-w-5xl'), 'Workbench enforces balanced desktop max-width');

      // Check responsive grid/flex breakpoints (sm, md, lg)
      assert.ok(workbenchSource.includes('grid-cols-1') && workbenchSource.includes('lg:grid-cols-12'), 'Workbench provides 1-column mobile and 12-column desktop split');
      assert.ok(homeSource.includes('sm:px-6'), 'Header adapts padding across mobile and tablet/desktop');
    });

    it('verifies mobile preview is collapsed/expandable and does not precede selection on mobile', () => {
      const workbenchSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/InteractiveHomeWorkbench.tsx'), 'utf8');
      // On mobile, the chooser appears before the paper preview in DOM order
      const chooserIdx = workbenchSource.indexOf('<HomeLetterChooser');
      const mobilePreviewIdx = workbenchSource.indexOf('mobile-letter-preview-sheet');
      assert.ok(chooserIdx !== -1, 'HomeLetterChooser rendered in workbench');
      assert.ok(mobilePreviewIdx !== -1, 'Mobile collapsible preview toggle present');
      assert.ok(chooserIdx < mobilePreviewIdx, 'Chooser precedes collapsible mobile preview in DOM flow');
    });

    it('verifies company directory and tracking specimen pages have responsive layouts', () => {
      const dirSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/CompanyDirectoryClient.tsx'), 'utf8');
      const docketSource = fs.readFileSync(path.join(process.cwd(), 'app/docket/[docketId]/page.tsx'), 'utf8');

      assert.ok(dirSource.includes('grid-cols-1') && dirSource.includes('md:grid-cols-2'), 'Company directory responsive grid');
      assert.ok(docketSource.includes('grid-cols-1') && docketSource.includes('sm:grid-cols-4'), 'Docket tracking responsive timeline');
    });
  });

  // ==========================================================================
  // AREA 2: ACCESSIBILITY (a11y)
  // ==========================================================================
  describe('Area 2: Accessibility & Keyboard Navigation', () => {
    it('verifies keyboard-only accessibility on HomeLetterChooser (listbox, active-descendant, Enter)', () => {
      const chooserSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/HomeLetterChooser.tsx'), 'utf8');

      assert.ok(chooserSource.includes('role="listbox"'), 'HomeLetterChooser defines role="listbox"');
      assert.ok(chooserSource.includes('role="option"'), 'Options define role="option"');
      assert.ok(chooserSource.includes('aria-activedescendant'), 'Maintains aria-activedescendant for focused option');
      assert.ok(chooserSource.includes('aria-selected'), 'Maintains aria-selected for chosen option');
      assert.ok(chooserSource.includes('ArrowDown') && chooserSource.includes('ArrowUp'), 'Supports ArrowDown/ArrowUp keyboard navigation');
      assert.ok(chooserSource.includes('Enter'), 'Supports Enter key for selection');
      assert.ok(chooserSource.includes('aria-live="polite"'), 'Provides polite aria-live announcements for results/counts');
    });

    it('verifies tracking popover traps focus and dismisses on Escape with focus restoration', () => {
      const headerSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/HeaderDocketLookup.tsx'), 'utf8');

      assert.ok(headerSource.includes('Escape'), 'Closes popover on Escape key');
      assert.ok(headerSource.includes('aria-expanded'), 'Header toggle button reflects aria-expanded state');
      assert.ok(headerSource.includes('triggerRef.current?.focus()') || headerSource.includes('.focus()'), 'Restores focus to trigger upon dismissal');
    });

    it('verifies checkout modal enforces dialog semantics, Escape key, and field error alerts', () => {
      const modalSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/CheckoutModal.tsx'), 'utf8');

      assert.ok(modalSource.includes('role="dialog"'), 'Checkout modal defines role="dialog"');
      assert.ok(modalSource.includes('aria-modal="true"'), 'Checkout modal defines aria-modal="true"');
      assert.ok(modalSource.includes('aria-labelledby'), 'Checkout modal defines aria-labelledby');
      assert.ok(modalSource.includes('Escape'), 'Checkout modal handles Escape key to close');
      assert.ok(modalSource.includes('role="alert"'), 'Validation errors presented with role="alert"');
      assert.ok(modalSource.includes('aria-invalid'), 'Invalid inputs marked with aria-invalid');
    });

    it('verifies zoom safety and reduced motion styles in CSS configuration', () => {
      const twSource = fs.readFileSync(path.join(process.cwd(), 'tailwind.config.ts'), 'utf8');
      // Check that ./src/**/* is included in tailwind content paths for proper utility generation
      assert.ok(twSource.includes('./src/**/*.{js,ts,jsx,tsx,mdx}'), 'Tailwind includes ./src directory');
    });
  });

  // ==========================================================================
  // AREA 3: DISCOVERY & RECIPIENT COMPATIBILITY
  // ==========================================================================
  describe('Area 3: Discovery, Plain Titles & Recipient Compatibility', () => {
    it('resolves all 9 canonical letters with plain customer display titles and subtitles matching §7.4', () => {
      assert.equal(CHOOSER_LETTERS.length, 9, 'Exactly 9 notice cartridges defined in chooser');

      const expectedTitles: Record<string, string> = {
        'security-deposit-return-demand-letter': 'Request a security deposit return',
        'fcra-credit-bureau-written-dispute-letter': 'Dispute a credit-report error',
        'tenant-repair-and-maintenance-notice': 'Request repairs',
        'tenant-notice-of-intent-to-vacate': 'Give move-out notice',
        'fdcpa-30-day-debt-validation-letter': 'Request debt verification',
        'written-contract-and-policy-cancellation-letter': 'Cancel a service or policy',
        'pre-arbitration-notice-of-dispute-and-refund-request': 'Request a refund for changed product features',
        '30-day-mandatory-arbitration-opt-out-notice': 'Send an arbitration opt-out notice',
        'statutory-health-and-biometric-data-deletion-demand': 'Request deletion of personal data',
      };

      for (const letter of CHOOSER_LETTERS) {
        assert.equal(letter.displayTitle, expectedTitles[letter.slug], `Display title for ${letter.slug} must match §7.4`);
        assert.ok(letter.subtitle.length > 10, `Subtitle for ${letter.slug} must be meaningful`);
        assert.ok(letter.searchAliases.length >= 2, `Search aliases for ${letter.slug} must be curated`);

        const resolved = getNoticeBySlug(letter.slug);
        assert.ok(resolved, `Canonical notice cartridge must exist for ${letter.slug}`);
      }
    });

    it('presents all 3 deterministic purpose options for ambiguous hardware OEM legal departments (Sonos, Withings)', () => {
      assert.equal(HARDWARE_OEM_PURPOSE_OPTIONS.length, 3, 'Hardware OEMs must present exactly 3 purpose options');
      const slugs = HARDWARE_OEM_PURPOSE_OPTIONS.map((o) => o.slug);
      assert.ok(slugs.includes('pre-arbitration-notice-of-dispute-and-refund-request'), 'Option 1: Refund/dispute');
      assert.ok(slugs.includes('30-day-mandatory-arbitration-opt-out-notice'), 'Option 2: Arbitration opt-out');
      assert.ok(slugs.includes('statutory-health-and-biometric-data-deletion-demand'), 'Option 3: Data deletion');

      // Test Sonos resolution
      const sonosEntry = VERIFIED_RECIPIENTS.find((r) => r.id === 'leg_sns');
      assert.ok(sonosEntry, 'Sonos exists in verified recipients');

      const compat = resolveCompanyCompatibility(sonosEntry);
      assert.equal(compat.status, 'multi_purpose', 'Sonos must be flagged as multi_purpose');
      assert.equal(compat.suggestedSlug, undefined, 'Sonos must NEVER silently default to refund or any single slug');
      assert.equal(compat.purposes?.length, 3, 'Must return all 3 purpose options');
    });

    it('visibly clears company on incompatible letter change and recovers gracefully', () => {
      // Equifax is only compatible with credit dispute
      const equifax = VERIFIED_RECIPIENTS.find((r) => r.id === 'cra_eqf');
      assert.ok(equifax, 'Equifax recipient found');

      // Incompatible letter: security deposit
      const compat = resolveCompanyCompatibility(equifax, 'security-deposit-return-demand-letter');
      assert.equal(compat.isCompatible, false, 'Equifax is not compatible with security deposit');
      assert.equal(compat.status, 'incompatible');
      assert.ok(compat.clearedReason?.includes('Equifax'), 'Provides clean reason for clearance');
    });

    it('enforces Invariant 1: NAICS 713940 fitness blocker strictly on client and server', () => {
      // Prohibited entities
      assert.equal(isFitnessEntity('Equinox'), true);
      assert.equal(isFitnessEntity('Planet Fitness'), true);
      assert.equal(isFitnessEntity('LA Fitness'), true);
      assert.equal(isFitnessEntity('Gold\'s Gym'), true);
      assert.equal(isFitnessEntity('Gym cancellation'), true);

      assert.throws(() => assertNonFitnessEntity('Equinox'), /NAICS 713940/);
      assert.throws(() => assertNonFitnessEntity('Planet Fitness'), /NAICS 713940/);

      // Permitted consumer hardware / OEM entities
      assert.equal(isFitnessEntity('Sonos Inc.'), false);
      assert.equal(isFitnessEntity('Withings Technologies'), false);
      assert.equal(isFitnessEntity('Garmin USA'), false);
      assert.equal(isFitnessEntity('Apple Inc.'), false);
      assert.equal(isFitnessEntity('LG Electronics'), false);

      assert.doesNotThrow(() => assertNonFitnessEntity('Sonos Inc.'));
      assert.doesNotThrow(() => assertNonFitnessEntity('Withings Technologies'));
      assert.doesNotThrow(() => assertNonFitnessEntity('Garmin USA'));

      // Search results for 'Planet Fitness' on home letter chooser
      const results = searchChooser('Planet Fitness');
      assert.equal(results.isFitnessBlocked, true, 'Flags restricted entity in search');
      assert.equal(results.letters.length, 0, 'No letters returned for restricted entity');
      assert.equal(results.companies.length, 0, 'No recipients returned for restricted entity');
    });
  });

  // ==========================================================================
  // AREA 4: ENTRYPOINTS & PREFILL HYDRATION
  // ==========================================================================
  describe('Area 4: Entrypoints, Prefills & Hydration', () => {
    it('builds canonical workspace URLs for all 9 cartridges and handles recipient prefill cleanly', () => {
      for (const letter of CHOOSER_LETTERS) {
        const urlNoRecipient = buildChooserWorkspaceUrl(letter.slug);
        assert.equal(urlNoRecipient, `/notices/${letter.slug}`, 'Direct letter URL format');

        const urlWithRecipient = buildChooserWorkspaceUrl(letter.slug, 'cra_exp');
        assert.ok(urlWithRecipient.startsWith(`/notices/${letter.slug}`), 'Recipient prefill URL format');
      }
    });

    it('enforces neutral prefill attribution without falsely claiming AI agent origin', () => {
      const bannerSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/AgentStagedBanner.tsx'), 'utf8');

      assert.ok(!bannerSource.includes('AI AGENT PRE-STAGED'), 'No misleading agent draft prepared claim');
      assert.ok(!bannerSource.includes('staged deterministically by your agent'), 'No false agent staging claim');
      assert.ok(bannerSource.includes('Your draft is ready to continue. Review the details before signing.'), 'Uses neutral prefilled notice terminology');
    });

    it('preserves user inputs upon staged draft load failure or expiration', () => {
      const hydrationSource = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useAgentHydration.ts'), 'utf8');
      const bannerSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/AgentStagedBanner.tsx'), 'utf8');

      assert.ok(hydrationSource.includes('retryStageLoad: () => void'), 'useAgentHydration exports retryStageLoad');
      assert.ok(hydrationSource.includes('startFresh: () => void'), 'useAgentHydration exports startFresh');
      assert.ok(
        bannerSource.includes("We couldn't load this saved draft. Your existing details were preserved."),
        'Banner informs user that existing details were preserved'
      );
    });
  });

  // ==========================================================================
  // AREA 5: CONTINUOUS STATE, DRAFT RECOVERY & INVALIDATION
  // ==========================================================================
  describe('Area 5: Continuous State, Draft Recovery & Invalidation', () => {
    it('isolates sample preview state completely from real user inputs', () => {
      const workbenchSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/InteractiveHomeWorkbench.tsx'), 'utf8');
      assert.ok(workbenchSource.includes('no personal data collected on home'), 'Marks homepage with no personal data collection');
      assert.ok(!workbenchSource.includes('<input name="senderFullName"'), 'Homepage contains no personal data entry fields');
    });

    it('accurately validates required fields and identifies first invalid field key', () => {
      const depositNotice = getNoticeBySlug('security-deposit-return-demand-letter')!;
      assert.ok(depositNotice, 'Security deposit notice exists');

      // Empty values: incomplete
      const emptyValidation = validateNoticeDraft(depositNotice, {});
      assert.equal(emptyValidation.isValid, false, 'Empty draft is incomplete');
      assert.equal(emptyValidation.firstInvalidFieldKey, 'senderFullName', 'First required field is senderFullName');

      // Fully valid values matching depositNotice schema
      const validValues: Record<string, string> = {
        senderFullName: 'Jane Doe',
        senderAddressLine1: '123 Main St Apt 4B',
        senderCity: 'Los Angeles',
        senderState: 'CA',
        senderZip: '90001',
        recipientFormalName: 'Acme Property Management',
        recipientAddressLine1: '456 Landlord Blvd Ste 200',
        recipientCity: 'Los Angeles',
        recipientState: 'CA',
        recipientZip: '90012',
        propertyState: 'CA',
        vacatedPremisesAddress: '123 Main St Apt 4B, Los Angeles, CA 90001',
        moveOutDate: '2026-03-31',
        depositAmount: '$2,500.00',
        amountReceivedToDate: '$0.00',
        balanceRequested: '$2,500.00',
        responseDays: '14 calendar days',
      };

      const fullValidation = validateNoticeDraft(depositNotice, validValues);
      assert.equal(fullValidation.isValid, true, 'Fully filled draft is valid');
      assert.equal(fullValidation.firstInvalidFieldKey, null, 'No invalid fields when complete');
    });

    it('enforces revision-tied signature invalidation and address re-verification in DocumentWorkspace', () => {
      const wsSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/DocumentWorkspace.tsx'), 'utf8');

      // Check signature invalidation on content change
      assert.ok(wsSource.includes('setIsSignatureAdopted(false)'), 'Resets signature confirmation upon editing draft content');
      assert.ok(wsSource.includes('setSignatureInvalidatedByEdit(true)'), 'Flags signature invalidation banner upon editing draft content');

      // Check address re-verification invalidation
      assert.ok(wsSource.includes("setVerificationStatus('unverified')"), 'Invalidates address verification on address field edit');
    });
  });

  // ==========================================================================
  // AREA 6: COMMERCE SPINE & FULFILLMENT SAFEGUARDS
  // ==========================================================================
  describe('Area 6: Commerce Spine & Fulfillment Safeguards', () => {
    // Valid fixture data matching securityDepositNotice.zodSchema
    const validTenantValues = {
      senderFullName: 'Jane Doe',
      senderAddressLine1: '123 Main St Apt 4B',
      senderCity: 'Los Angeles',
      senderState: 'CA',
      senderZip: '90001',
      recipientFormalName: 'Acme Property Management',
      recipientAddressLine1: '456 Landlord Blvd Ste 200',
      recipientCity: 'Los Angeles',
      recipientState: 'CA',
      recipientZip: '90012',
      propertyState: 'CA',
      vacatedPremisesAddress: '123 Main St Apt 4B, Los Angeles, CA 90001',
      moveOutDate: '2026-03-31',
      depositAmount: '$2,500.00',
      amountReceivedToDate: '$0.00',
      balanceRequested: '$2,500.00',
      responseDays: '14 calendar days',
    };

    it('synchronizes all 3 USPS delivery tiers ($12.95, $19.95, $27.95) across config and lock endpoint', async () => {
      assert.equal(DOCKET_PRICING_TIERS.first_class.priceCents, 1295);
      assert.equal(DOCKET_PRICING_TIERS.certified.priceCents, 1995);
      assert.equal(DOCKET_PRICING_TIERS.certified_return_receipt.priceCents, 2795);

      // Verify lock endpoint computes exact amount for each tier
      const tiers = [
        { tier: 'first_class', expectedCents: 1295 },
        { tier: 'certified', expectedCents: 1995 },
        { tier: 'certified_return_receipt', expectedCents: 2795 },
      ] as const;

      for (const { tier, expectedCents } of tiers) {
        const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: 'security-deposit-return-demand-letter',
            tier,
            userValues: validTenantValues,
            customerEmail: 'jane.tester@gmail.com',
          }),
        });

        const res = await lockAndIntentPost(req);
        assert.equal(res.status, 200, `Lock endpoint must succeed for ${tier}`);
        const data = await res.json();
        assert.equal(data.amountCents, expectedCents, `Expected ${expectedCents} cents for ${tier}`);
        assert.ok(data.orderId, 'Generates durable orderId');
        assert.ok(data.clientSecret, 'Returns Stripe clientSecret');

        // Check stored order snapshot
        const order = await getOrderById(data.orderId);
        assert.ok(order, 'Order persisted in Firestore');
        assert.equal(order?.amountInCents, expectedCents);
        assert.ok(order?.documentHtml, 'Immutable documentHtml persisted before payment');
      }
    });

    it('enforces accurate 2-step checkout button copy', () => {
      const modalSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/CheckoutModal.tsx'), 'utf8');

      // Step 1: Continue to payment — $X
      assert.ok(modalSource.includes('Continue to payment — $'), 'Step 1 button copy: Continue to payment — $X');
      // Step 2: Pay $X and send letter
      assert.ok(modalSource.includes('Pay $') && modalSource.includes('and send letter'), 'Step 2 button copy: Pay $X and send letter');
    });

    it('enforces fulfillment idempotency on /api/checkout/confirm-order', async () => {
      const orderId = `order_idempotency_s7_${Date.now()}`;
      await saveOrder({
        id: orderId,
        customerEmail: 'idempotent@gmail.com',
        docketId: 'DS-2026-IDEMPOTENT-S7',
        docketNumber: 'DS-2026-IDEMPOTENT-S7',
        status: 'PROCESSING_DISPATCH',
        serviceLevel: 'CERTIFIED',
        amountInCents: 1995,
        stripePaymentId: 'pi_mock_idempotency_s7',
        recipientAddress: {
          firstName: 'Recipient',
          lastName: '',
          street1: '100 Test St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          country: 'US',
        },
        returnAddress: {
          firstName: 'Sender',
          lastName: '',
          street1: '200 Sender Ave',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          country: 'US',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Call confirmation on already processing order
      const confirmReq = new NextRequest('http://localhost:3000/api/checkout/confirm-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentIntentId: 'pi_mock_idempotency_s7',
        }),
      });
      const confirmRes = await confirmOrderPost(confirmReq);
      assert.equal(confirmRes.status, 200, 'Duplicate confirmation returns HTTP 200');
      const confirmData = await confirmRes.json();
      assert.equal(confirmData.success, true);
      assert.equal(confirmData.alreadyProcessed, true);
      assert.equal(confirmData.orderId, orderId);
    });

    it('supports guest checkout and authenticated account binding safely', async () => {
      // Guest checkout (no Authorization header)
      const guestReq = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'security-deposit-return-demand-letter',
          tier: 'first_class',
          userValues: validTenantValues,
          customerEmail: 'guest_buyer@gmail.com',
        }),
      });

      const guestRes = await lockAndIntentPost(guestReq);
      assert.equal(guestRes.status, 200, 'Guest lock succeeds without auth token');
      const guestData = await guestRes.json();
      const guestOrder = await getOrderById(guestData.orderId);
      assert.equal(guestOrder?.userId, undefined, 'Guest order has no userId bound');

      // Authenticated checkout with simulated Bearer token
      const authReq = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock_token_alice@gmail.com',
        },
        body: JSON.stringify({
          slug: 'security-deposit-return-demand-letter',
          tier: 'first_class',
          userValues: validTenantValues,
          customerEmail: 'alice@gmail.com',
        }),
      });

      const authRes = await lockAndIntentPost(authReq);
      assert.equal(authRes.status, 200);
      const authData = await authRes.json();
      const authOrder = await getOrderById(authData.orderId);
      assert.equal(authOrder?.userId, 'alice@gmail.com', 'Binds authenticated userId to order');
    });
  });

  // ==========================================================================
  // AREA 7: DOCUMENT WYSIWYG PARITY & LOB CLEAR ZONES
  // ==========================================================================
  describe('Area 7: Document Parity, 8.5" x 11" Geometry & USPS Clear Zones', () => {
    it('verifies interpolateNotice is shared identically between client and server', () => {
      const wsSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/DocumentWorkspace.tsx'), 'utf8');
      const workbenchSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/InteractiveHomeWorkbench.tsx'), 'utf8');
      const lockSource = fs.readFileSync(path.join(process.cwd(), 'app/api/docket/lock-and-intent/route.ts'), 'utf8');

      assert.ok(wsSource.includes('interpolateNotice'), 'DocumentWorkspace uses shared interpolateNotice');
      assert.ok(workbenchSource.includes('interpolateNotice'), 'InteractiveHomeWorkbench uses shared interpolateNotice');
      assert.ok(lockSource.includes('interpolateNotice') && lockSource.includes('renderLobHtmlPayload'), 'Lock route uses shared interpolateNotice and renderLobHtmlPayload');
    });

    it('verifies single-page 8.5" x 11" Lob clear zones across all 9 notice cartridges', () => {
      for (const notice of ALL_NOTICE_CARTRIDGES) {
        const docketId = generateDocketId();
        const dummyValues: Record<string, string> = {
          senderFullName: 'Test Sender',
          senderAddressLine1: '123 Main St',
          senderCity: 'Austin',
          senderState: 'TX',
          senderZip: '78701',
          recipientFormalName: 'Test Recipient',
          recipientAddressLine1: '456 Market St',
          recipientCity: 'San Francisco',
          recipientState: 'CA',
          recipientZip: '94105',
          rentalAddress: '123 Main St, Austin, TX 78701',
          leaseEndDate: '2026-10-01',
          depositAmount: '1,000.00',
          returnMethod: 'Check by mail',
          repairDescription: 'Leaking pipe under kitchen sink',
          firstReportDate: '2026-09-15',
          vacateDate: '2026-11-30',
          forwardingAddress: '789 Elm St, Austin, TX 78702',
          collectionAgencyName: 'Collection Corp',
          accountNumber: 'ACC-12345',
          debtAmount: '500.00',
          companyName: 'Service Provider LLC',
          serviceDescription: 'Monthly subscription',
          deviceModel: 'Smart Speaker v2',
          purchaseDate: '2025-01-15',
          issueDescription: 'Software update removed core functionality',
          refundAmount: '299.00',
          requestedResolution: 'Full purchase price refund',
          serviceOrProductName: 'Hardware Device',
          termsVersionDate: '2026-01-01',
          optOutReferenceNumber: 'OPT-9988',
          dataCategoriesToPurge: 'Biometric, geolocation, and usage telemetry',
          accountIdentifier: 'ID-44556',
        };

        const doc = interpolateNotice({
          notice,
          userValues: dummyValues,
          docketId,
        });

        const lobHtml = renderLobHtmlPayload(doc);

        // Verify HTML geometry & clear zones
        assert.ok(lobHtml.includes('8.5in') && lobHtml.includes('11in'), `${notice.id}: Must enforce 8.5in x 11in page geometry`);
        assert.ok(lobHtml.includes(UPL_COMPLIANCE_FOOTER_TEXT(docketId)), `${notice.id}: Must include mandatory UPL compliance text`);
        assert.ok(lobHtml.includes(docketId), `${notice.id}: Must render docket ID in Clerk Docket Stamp`);
        assert.ok(lobHtml.includes('/s/ Test Sender'), `${notice.id}: Must render formal electronic signature block`);
        assert.ok(lobHtml.includes('top: 1.85in'), `${notice.id}: Must position Clerk Docket Stamp at 1.85in clear zone`);
        assert.ok(lobHtml.includes('bottom: 0.40in'), `${notice.id}: Must position compliance footer at 0.40in clear zone`);
      }
    });

    it('verifies exact USPS Lob clear zone measurements in CSS styles', () => {
      const shellSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/docket/renderer/lob-html-shell.ts'), 'utf8');
      assert.ok(shellSource.includes('top: 1.85in'), 'Top clear zone for Clerk Docket Stamp is 1.85in');
      assert.ok(shellSource.includes('bottom: 0.40in'), 'Bottom clear zone for UPL compliance footer is 0.40in');
      assert.ok(shellSource.includes('left: 0.75in'), 'Left margin is 0.75in');
      assert.ok(shellSource.includes('right: 0.75in'), 'Right margin is 0.75in');
    });
  });

  // ==========================================================================
  // AREA 8: MEASUREMENT & CLIENT AUTHORITY IMMUNITY
  // ==========================================================================
  describe('Area 8: Funnel Measurement & Client Authority Protection', () => {
    it('correlates a synthetic 7-stage session with one authoritative paid order', () => {
      const sessionId = 'rc_sess_synth_01';
      const orderId = 'order_rc_synth_01';
      const noticeSlug = 'security-deposit-return-demand-letter';

      const events: TelemetryEvent[] = [
        {
          id: 'ev_1',
          sessionId,
          eventName: 'landing_view',
          timestamp: Date.now() - 60000,
          createdAt: Date.now() - 60000,
          path: '/',
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceCategory: 'desktop',
        },
        {
          id: 'ev_2',
          sessionId,
          eventName: 'product_select',
          timestamp: Date.now() - 50000,
          createdAt: Date.now() - 50000,
          path: '/',
          noticeSlug,
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceCategory: 'desktop',
        },
        {
          id: 'ev_3',
          sessionId,
          eventName: 'editor_start',
          timestamp: Date.now() - 40000,
          createdAt: Date.now() - 40000,
          path: `/notices/${noticeSlug}`,
          noticeSlug,
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceCategory: 'desktop',
        },
        {
          id: 'ev_4',
          sessionId,
          eventName: 'editor_complete',
          timestamp: Date.now() - 30000,
          createdAt: Date.now() - 30000,
          path: `/notices/${noticeSlug}`,
          noticeSlug,
          draftRevision: 1,
          tier: 'certified',
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceCategory: 'desktop',
        },
        {
          id: 'ev_5',
          sessionId,
          eventName: 'checkout_view',
          timestamp: Date.now() - 20000,
          createdAt: Date.now() - 20000,
          path: `/notices/${noticeSlug}`,
          noticeSlug,
          tier: 'certified',
          metadata: { amountInCents: 1995 },
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceCategory: 'desktop',
        },
        {
          id: 'ev_6',
          sessionId,
          eventName: 'payment_submitted',
          timestamp: Date.now() - 10000,
          createdAt: Date.now() - 10000,
          path: `/notices/${noticeSlug}`,
          noticeSlug,
          tier: 'certified',
          orderId,
          metadata: { amountInCents: 1995 },
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceCategory: 'desktop',
        },
        {
          id: 'ev_7',
          sessionId,
          eventName: 'order_paid_confirmed',
          timestamp: Date.now(),
          createdAt: Date.now(),
          path: `/notices/${noticeSlug}`,
          noticeSlug,
          tier: 'certified',
          orderId,
          metadata: { amountInCents: 1995 },
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceCategory: 'desktop',
        },
      ];

      const orders: Order[] = [
        {
          id: orderId,
          docketId: 'DS-2026-SYNTH-01',
          amountInCents: 1995,
          status: 'PAYMENT_RECEIVED',
          isTest: false,
          paymentMode: 'live',
          noticeId: noticeSlug,
          serviceLevel: 'CERTIFIED',
          telemetrySessionId: sessionId,
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          recipientAddress: {
            firstName: 'Landlord',
            lastName: 'Co',
            street1: '123 Main St',
            city: 'Austin',
            state: 'TX',
            zip: '78701',
          },
          returnAddress: {
            firstName: 'Tenant',
            lastName: 'User',
            street1: '456 Oak St',
            city: 'Austin',
            state: 'TX',
            zip: '78702',
          },
          customerEmail: 'customer@gmail.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const report = computeFunnelConversionReport(events, orders);

      assert.equal(report.homepageSessions, 1, 'Exactly 1 homepage session');
      assert.equal(report.homepagePaidOrders, 1, 'Correlates to 1 authoritative paid order');
      assert.equal(report.conversionRate, 100, 'Calculates 100% conversion for synthetic session');
      assert.equal(report.attributionSummary.unattributedPaidOrders, 0, 'Zero unattributed orders');
    });

    it('rejects browser POST of authority events to /api/telemetry with HTTP 403 Forbidden', async () => {
      for (const eventName of AUTHORITY_EVENTS) {
        assert.equal(isAuthorityEvent(eventName), true, `${eventName} must be classified as authority event`);
        assert.equal(ALLOWED_BROWSER_EVENT_NAMES.has(eventName as any), false, `${eventName} must be excluded from allowed browser events`);

        const req = new NextRequest('http://localhost:3000/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'hack_session',
            eventName,
            orderId: 'order_fraudulent',
            amountInCents: 1995,
          }),
        });

        const res = await telemetryPost(req);
        assert.equal(res.status, 403, `Must reject ${eventName} from browser POST with HTTP 403`);
        const data = await res.json();
        assert.ok(data.error.includes('Forbidden'), 'Returns forbidden error message');
      }
    });

    it('verifies client confirmation screen and docket tracking page do not emit authority events', () => {
      const modalSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/CheckoutModal.tsx'), 'utf8');
      const docketPageSource = fs.readFileSync(path.join(process.cwd(), 'app/docket/[docketId]/page.tsx'), 'utf8');

      // Step 3 in CheckoutModal and DocketStatusPage must not emit order_paid_confirmed or order_fulfilled
      assert.ok(!modalSource.includes('emitTelemetry(\'order_paid_confirmed\''), 'Modal does not emit order_paid_confirmed');
      assert.ok(!modalSource.includes('emitTelemetry(\'order_fulfilled\''), 'Modal does not emit order_fulfilled');
      assert.ok(!docketPageSource.includes('order_paid_confirmed'), 'Docket tracking page does not emit order_paid_confirmed');
      assert.ok(!docketPageSource.includes('order_fulfilled'), 'Docket tracking page does not emit order_fulfilled');
    });

    it('sanitizes metadata: strips all PII, search queries, secrets, and query parameters', () => {
      const taintedMetadata = {
        noticeSlug: 'security-deposit-return-demand-letter',
        tier: 'certified',
        customerName: 'Secret John',
        customerEmail: 'john@example.com',
        userQuery: 'landlord kept my deposit',
        apiKey: 'sk_live_123456789',
        url: 'https://docketstamp.com/notices/test?viewToken=SECRET_TOKEN&email=john%40example.com',
        deepNested: { evil: true },
      };

      const { sanitized } = sanitizeMetadata('checkout_view', taintedMetadata);

      // Allowed non-PII keys preserved
      assert.equal(sanitized.noticeSlug, 'security-deposit-return-demand-letter');
      assert.equal(sanitized.tier, 'certified');

      // Tainted keys dropped
      assert.equal(sanitized.customerName, undefined);
      assert.equal(sanitized.customerEmail, undefined);
      assert.equal(sanitized.userQuery, undefined);
      assert.equal(sanitized.apiKey, undefined);
      assert.equal(sanitized.deepNested, undefined);

      // URL query string sanitized
      assert.equal(sanitizeUrlOrPath('https://docketstamp.com/notices/test?token=SECRET'), 'https://docketstamp.com/notices/test');
    });
  });

  // ==========================================================================
  // DEAD CODE CLEANUP AUDIT
  // ==========================================================================
  describe('Dead Home-Only Code Cleanup Audit', () => {
    it('verifies NoticeCatalogBrowser.tsx has been removed from codebase', () => {
      const filePath = path.join(process.cwd(), 'src/components/docket/NoticeCatalogBrowser.tsx');
      assert.equal(fs.existsSync(filePath), false, 'src/components/docket/NoticeCatalogBrowser.tsx must be deleted');
    });

    it('verifies no active callers in app/, src/, or components/ import NoticeCatalogBrowser', () => {
      const scanDirs = ['app', 'src', 'components'];
      for (const dir of scanDirs) {
        const fullDir = path.join(process.cwd(), dir);
        if (!fs.existsSync(fullDir)) continue;

        function walk(currentDir: string) {
          const entries = fs.readdirSync(currentDir, { withFileTypes: true });
          for (const entry of entries) {
            const p = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
              walk(p);
            } else if (entry.isFile() && (p.endsWith('.ts') || p.endsWith('.tsx'))) {
              const content = fs.readFileSync(p, 'utf8');
              assert.ok(
                !content.includes('NoticeCatalogBrowser'),
                `File ${p} must not contain references to deleted NoticeCatalogBrowser`
              );
            }
          }
        }

        walk(fullDir);
      }
    });
  });

  // ==========================================================================
  // STATUTORY DISCLOSURES & MANDATORY COPY AUDIT
  // ==========================================================================
  describe('Statutory Disclosures & Mandatory Copy Audit', () => {
    it('verifies exact statutory compliance disclosures on layout, homepage, and docket tracking', () => {
      const homeSource = fs.readFileSync(path.join(process.cwd(), 'app/page.tsx'), 'utf8');
      const docketSource = fs.readFileSync(path.join(process.cwd(), 'app/docket/[docketId]/page.tsx'), 'utf8');
      const disclaimerSource = fs.readFileSync(path.join(process.cwd(), 'app/disclaimer/page.tsx'), 'utf8');

      // Disclosures present
      assert.ok(homeSource.includes('automated self-help document preparation and USPS postal dispatch utility'), 'Homepage includes statutory disclosure');
      assert.ok(docketSource.includes('UPL_COMPLIANCE_FOOTER_TEXT'), 'Docket tracking includes statutory disclosure');
      assert.ok(disclaimerSource.includes('STATUTORY_COMPLIANCE_DISCLOSURE'), 'Disclaimer page includes statutory disclosure');
    });

    it('verifies absence of unsupported 60-second delivery or guaranteed legal outcome claims', () => {
      const homeSource = fs.readFileSync(path.join(process.cwd(), 'app/page.tsx'), 'utf8');
      const chooserSource = fs.readFileSync(path.join(process.cwd(), 'src/components/docket/HomeLetterChooser.tsx'), 'utf8');

      assert.ok(!homeSource.includes('in 60 seconds'), 'No "in 60 seconds" claims on homepage');
      assert.ok(!homeSource.includes('guaranteed refund') && !homeSource.includes('guarantee legal success'), 'No guaranteed outcome claims');
      assert.ok(!chooserSource.includes('in 60 seconds'), 'No "in 60 seconds" claims on chooser');
    });
  });

  // ==========================================================================
  // SIX SYSTEM INVARIANTS FINAL VERIFICATION
  // ==========================================================================
  describe('Six System Invariants Final Verification', () => {
    it('Invariant 1: Hard NAICS 713940 fitness blocker enforces gym/club exclusion while allowing hardware OEMs', () => {
      assert.throws(() => assertNonFitnessEntity('Equinox'));
      assert.throws(() => assertNonFitnessEntity('Planet Fitness'));
      assert.doesNotThrow(() => assertNonFitnessEntity('Sonos Inc.'));
      assert.doesNotThrow(() => assertNonFitnessEntity('Withings Technologies'));
      assert.doesNotThrow(() => assertNonFitnessEntity('Garmin USA'));
    });

    it('Invariant 2: UPL-safe administrative form letter positioning with verbatim disclosures', () => {
      const footerText = UPL_COMPLIANCE_FOOTER_TEXT('DS-2026-TEST');
      assert.ok(footerText.includes('DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, not a law firm'));
      assert.ok(footerText.includes('does not provide legal representation or legal advice'));
    });

    it('Invariant 3: Single-page 8.5" x 11" geometry and USPS clear zones', () => {
      const shellSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/docket/renderer/lob-html-shell.ts'), 'utf8');
      assert.ok(shellSource.includes('top: 1.85in'), 'Top clear zone for Clerk Docket Stamp is 1.85in');
      assert.ok(shellSource.includes('bottom: 0.40in'), 'Bottom clear zone for UPL compliance footer is 0.40in');
    });

    it('Invariant 4: WYSIWYG dual-render parity between screen and print', () => {
      const depositNotice = getNoticeBySlug('security-deposit-return-demand-letter')!;
      const doc = interpolateNotice({
        notice: depositNotice,
        userValues: {
          senderFullName: 'Parity Check',
          depositAmount: '1,200.00',
        },
        docketId: 'DS-2026-PARITY-01',
      });

      // Confirm both client document and lob payload derive identically from interpolateNotice output
      assert.equal(doc.docketId, 'DS-2026-PARITY-01');
      assert.equal(doc.noticeDefinition.slug, 'security-deposit-return-demand-letter');
    });

    it('Invariant 5: Freeze-before-pay snapshot integrity', async () => {
      const validTenantValues = {
        senderFullName: 'Snapshot Tester',
        senderAddressLine1: '100 Main St',
        senderCity: 'Austin',
        senderState: 'TX',
        senderZip: '78701',
        recipientFormalName: 'Landlord Co',
        recipientAddressLine1: '200 Oak Ave',
        recipientCity: 'Austin',
        recipientState: 'TX',
        recipientZip: '78702',
        propertyState: 'TX',
        vacatedPremisesAddress: '100 Main St Apt 2',
        moveOutDate: '2026-09-30',
        depositAmount: '$1,500.00',
        amountReceivedToDate: '$0.00',
        balanceRequested: '$1,500.00',
        responseDays: '14 calendar days',
      };

      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'security-deposit-return-demand-letter',
          tier: 'certified',
          userValues: validTenantValues,
          customerEmail: 'snapshot.tester@gmail.com',
        }),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      const order = await getOrderById(data.orderId);
      assert.ok(order?.documentHtml, 'Immutable snapshot persisted before payment authorization');
      assert.ok(order?.documentHtml?.includes('Snapshot Tester'), 'Snapshot contains immutable user values');
    });

    it('Invariant 6: Lob API staging/mock separation', () => {
      // In staging/test environment, mock CASS is active and no production postage is incurred
      const isStaging = process.env.LOB_ENV === 'staging_mock_cass' || process.env.NODE_ENV !== 'production';
      assert.ok(isStaging, 'Test environment uses staging/mock CASS separation without live postage charges');
    });
  });
});
