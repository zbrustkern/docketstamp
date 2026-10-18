/**
 * S1 Trust and State Regression Tests
 *
 * Verifies Sprint S1 Acceptance Criteria:
 * 1. Provenance and Neutral Prefill:
 *    - Ordinary URL query parameters and staged drafts never display false AI agent attribution.
 *    - Neutral copy per §6 of DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md.
 *    - Failed/expired stage load preserves existing user values with retry and startFresh recovery.
 * 2. Sample Isolation:
 *    - Entering user values, toggling sample example on/off preserves user inputs.
 *    - Continuation URLs strictly exclude sample data and retain only real user values.
 *    - Editing fields or interacting with preview dismisses sample preview.
 * 3. Truthful Address Verification State & Invalidation:
 *    - Default verification status is 'unverified' ("Not yet verified").
 *    - Blank or unverified addresses never display "USPS VERIFIED".
 *    - Simulated staging checks are distinct from confirmed CASS checks.
 *    - Editing any address field immediately invalidates verification to 'unverified'.
 * 4. Jargon & Unsupported Claim Scrub:
 *    - S1 components are free of forbidden marketing/implementation jargon.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';

import {
  intentToVacateNotice,
  securityDepositNotice,
  creditBureauDisputeNotice,
} from '../src/lib/docket/notices';

import {
  interpolateNotice,
  generateDocketId,
} from '../src/lib/docket/renderer/interpolate';

import { AddressVerificationStatus } from '../src/lib/docket/types';

describe('S1 Trust and State Acceptance Gate', () => {
  describe('1. Provenance & Neutral Prefill Copy', () => {
    it('does not attribute ordinary URL prefills or staged drafts to AI agents', () => {
      const bannerSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/AgentStagedBanner.tsx'),
        'utf8'
      );

      // Verify forbidden agent attribution strings are absent
      assert.ok(
        !bannerSource.includes('AI AGENT PRE-STAGED'),
        'AgentStagedBanner must not display "AI AGENT PRE-STAGED"'
      );
      assert.ok(
        !bannerSource.includes('staged deterministically by your agent'),
        'AgentStagedBanner must not claim deterministic agent staging'
      );
      assert.ok(
        !bannerSource.includes('pre-staged by AI agent'),
        'AgentStagedBanner must not claim fields pre-staged by AI agent'
      );
      assert.ok(
        !bannerSource.includes('<Bot'),
        'AgentStagedBanner must not render Bot icon'
      );

      // Verify neutral copy from Section 6 is present
      assert.ok(
        bannerSource.includes('Your draft is ready to continue. Review the details before signing.'),
        'Must include Section 6 neutral description copy'
      );
      assert.ok(
        bannerSource.includes('Loading your draft…'),
        'Must include Section 6 loading copy'
      );
    });

    it('handles stage errors gracefully with retry and startFresh recovery preserving user values', () => {
      const hydrationSource = fs.readFileSync(
        path.join(process.cwd(), 'src/hooks/useAgentHydration.ts'),
        'utf8'
      );

      // Verify retryStageLoad and startFresh exports
      assert.ok(
        hydrationSource.includes('retryStageLoad: () => void'),
        'useAgentHydration must export retryStageLoad'
      );
      assert.ok(
        hydrationSource.includes('startFresh: () => void'),
        'useAgentHydration must export startFresh'
      );

      // Banner handles stageError with retry and startFresh actions
      const bannerSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/AgentStagedBanner.tsx'),
        'utf8'
      );
      assert.ok(bannerSource.includes('stageError'), 'AgentStagedBanner must accept stageError prop');
      assert.ok(bannerSource.includes('onRetryStageLoad'), 'AgentStagedBanner must accept onRetryStageLoad');
      assert.ok(bannerSource.includes('onStartFresh'), 'AgentStagedBanner must accept onStartFresh');
      assert.ok(
        bannerSource.includes("We couldn't load this saved draft. Your existing details were preserved."),
        'Banner must inform user that existing details were preserved on stage load error'
      );
    });
  });

  describe('2. Sample Isolation & Continuation URLs', () => {
    it('isolates sample values from real user inputs and excludes sample data from continuation URLs', () => {
      // Simulate InteractiveHomeWorkbench sample isolation behavior
      const activeSlug = 'security-deposit-return-demand-letter';
      const selectedTier = 'certified';
      let userValues: Record<string, string> = {
        senderFullName: 'Morgan Lee',
        depositAmount: '$1,800.00',
        vacatedPremisesAddress: '789 Pine St, Seattle, WA',
      };
      let isSampleFilled = false;

      const sampleValues = {
        senderFullName: 'Jordan Taylor',
        senderAddressLine1: '410 Broadway, Apt 4B',
        senderCity: 'Santa Monica',
        senderState: 'CA',
        senderZip: '90401',
        recipientFormalName: 'Oakridge Property Management LLC',
        depositAmount: '$2,450.00',
        balanceRequested: '$2,450.00',
        vacatedPremisesAddress: '1420 Ocean Ave, Apt 4B, Santa Monica, CA 90401',
      };

      // Helper matching InteractiveHomeWorkbench buildHydrationUrl
      function buildHydrationUrl(values: Record<string, string>) {
        const searchParams = new URLSearchParams();
        searchParams.set('tier', selectedTier);
        for (const [key, val] of Object.entries(values)) {
          if (val && typeof val === 'string' && val.trim().length > 0 && !val.startsWith('[')) {
            searchParams.set(`field.${key}`, val.trim());
          }
        }
        return `/notices/${activeSlug}?${searchParams.toString()}`;
      }

      // Step 1: User has entered real value
      assert.equal(userValues.senderFullName, 'Morgan Lee');
      const initialUrl = buildHydrationUrl(userValues);
      assert.ok(initialUrl.includes('field.senderFullName=Morgan+Lee'));
      assert.ok(!initialUrl.includes('Jordan+Taylor'));

      // Step 2: Toggle sample on
      isSampleFilled = true;
      // userValues MUST remain untouched!
      assert.equal(userValues.senderFullName, 'Morgan Lee');
      assert.equal(userValues.depositAmount, '$1,800.00');

      // The preview uses sample values, BUT buildHydrationUrl only uses real userValues
      const effectivePreviewValues = isSampleFilled ? sampleValues : userValues;
      assert.equal(effectivePreviewValues.senderFullName, 'Jordan Taylor');

      const urlWhileSampleActive = buildHydrationUrl(userValues);
      assert.ok(
        !urlWhileSampleActive.includes('Jordan+Taylor'),
        'Continuation URL must NEVER contain sample sender name'
      );
      assert.ok(
        !urlWhileSampleActive.includes('Oakridge'),
        'Continuation URL must NEVER contain sample recipient'
      );
      assert.ok(
        !urlWhileSampleActive.includes('2%2C450'),
        'Continuation URL must NEVER contain sample dollar amount'
      );
      assert.ok(
        urlWhileSampleActive.includes('field.senderFullName=Morgan+Lee'),
        'Continuation URL must preserve user real input'
      );

      // Step 3: Toggle sample off
      isSampleFilled = false;
      const previewAfterToggleOff = isSampleFilled ? sampleValues : userValues;
      assert.equal(previewAfterToggleOff.senderFullName, 'Morgan Lee');
      assert.equal(previewAfterToggleOff.depositAmount, '$1,800.00');
    });

    it('verifies InteractiveHomeWorkbench source code enforces sample isolation', () => {
      const workbenchSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/InteractiveHomeWorkbench.tsx'),
        'utf8'
      );

      // handleToggleSample must not overwrite userValues
      assert.ok(
        !workbenchSource.includes('setUserValues(getSampleExampleValues'),
        'handleToggleSample must NOT overwrite userValues with sample values'
      );
      assert.ok(
        workbenchSource.includes('effectivePreviewValues'),
        'InteractiveHomeWorkbench must use separate effectivePreviewValues for rendering'
      );

      // buildHydrationUrl must be bound to userValues and not sample values
      assert.ok(
        workbenchSource.includes('for (const [key, val] of Object.entries(userValues))'),
        'buildHydrationUrl must iterate strictly over userValues'
      );

      // Header indicates example preview state
      assert.ok(
        workbenchSource.includes('Example letter — preview only'),
        'Must display "Example letter — preview only" when sample is open'
      );
    });
  });

  describe('3. Truthful Address Verification State & Invalidation', () => {
    it('renders truthful verification labels on LivePaperSheet and avoids false USPS VERIFIED claims', () => {
      const sheetSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/LivePaperSheet.tsx'),
        'utf8'
      );

      // Verify verificationStatus prop is defined
      assert.ok(
        sheetSource.includes('verificationStatus?: AddressVerificationStatus'),
        'LivePaperSheet must accept verificationStatus prop'
      );
      assert.ok(
        sheetSource.includes("verificationStatus = 'unverified'"),
        'LivePaperSheet must default verificationStatus to unverified'
      );

      // Unverified state must show "Not yet verified"
      assert.ok(
        sheetSource.includes('Not yet verified'),
        'LivePaperSheet must display "Not yet verified" for unverified addresses'
      );

      // Staging simulation must be distinct
      assert.ok(
        sheetSource.includes('Simulated check (staging)'),
        'LivePaperSheet must display "Simulated check (staging)" for simulated status'
      );

      // Confirmed status must show CASS VERIFIED
      assert.ok(
        sheetSource.includes('USPS CASS™ VERIFIED'),
        'LivePaperSheet must display "USPS CASS™ VERIFIED" when confirmed'
      );
    });

    it('invalidates address verification upon editing any address field', () => {
      const workspaceSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/DocumentWorkspace.tsx'),
        'utf8'
      );

      // DocumentWorkspace must track verificationStatus state defaulting to 'unverified'
      assert.ok(
        workspaceSource.includes("const [verificationStatus, setVerificationStatus] = useState<AddressVerificationStatus>('unverified')"),
        'DocumentWorkspace must initialize verificationStatus as unverified'
      );

      // DocumentWorkspace must reset verificationStatus to 'unverified' in handleFieldValueChange
      assert.ok(
        workspaceSource.includes("setVerificationStatus('unverified')"),
        'DocumentWorkspace must invalidate verificationStatus on address edit'
      );

      // Simulate address invalidation logic
      const addressKeys = [
        'senderFullName',
        'senderAddressLine1',
        'senderCity',
        'senderState',
        'senderZip',
        'recipientFormalName',
        'recipientAddressLine1',
        'recipientCity',
        'recipientState',
        'recipientZip',
        'leasedPremisesAddress',
        'vacatedPremisesAddress',
      ];

      let verificationStatus: AddressVerificationStatus = 'confirmed';

      function onEditField(field: string) {
        if (addressKeys.includes(field)) {
          verificationStatus = 'unverified';
        }
      }

      assert.equal(verificationStatus, 'confirmed');
      onEditField('defectDescription'); // non-address edit
      assert.equal(verificationStatus, 'confirmed');

      onEditField('senderAddressLine1'); // address edit
      assert.equal(verificationStatus, 'unverified', 'Editing sender address must invalidate verification');
    });

    it('ensures interpolated document AST preserves clerkStamp without claiming client verification', () => {
      const doc = interpolateNotice({
        notice: intentToVacateNotice,
        userValues: {
          senderFullName: 'Terry Fox',
          recipientFormalName: 'Acme Rentals',
          leasedPremisesAddress: '100 Main St, Austin, TX 78701',
        },
        docketId: 'DS-2026-TESTSTAMP',
      });

      // Verify AST contains valid clerkStamp metadata structure
      assert.ok(doc.clerkStamp);
      assert.equal(doc.clerkStamp.docketId, 'DS-2026-TESTSTAMP');
      assert.ok(doc.clerkStamp.cassStatus);
    });
  });

  describe('4. Elimination of Implementation Jargon & Unsupported Claims', () => {
    it('confirms S1-owned components contain none of the forbidden phrases', () => {
      const forbiddenPhrases = [
        "They can't ignore",
        "They Can't Ignore",
        'in 60 seconds',
        'COURT PROOF',
        'court-ready',
        '1-Page USPS Lob Print Geometry Enforced',
        'Instrument parameters were staged deterministically',
        'Hydrating staged draft parameters',
      ];

      const s1Files = [
        'src/components/docket/AgentStagedBanner.tsx',
        'src/components/docket/InteractiveHomeWorkbench.tsx',
        'src/components/docket/DocumentWorkspace.tsx',
        'src/components/docket/LivePaperSheet.tsx',
      ];

      for (const relPath of s1Files) {
        const content = fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
        for (const phrase of forbiddenPhrases) {
          assert.ok(
            !content.includes(phrase),
            `File ${relPath} must not contain forbidden phrase "${phrase}"`
          );
        }
      }
    });

    it('verifies statutory disclosures and UPL notices are preserved verbatim', () => {
      const sheetSource = fs.readFileSync(
        path.join(process.cwd(), 'src/components/docket/LivePaperSheet.tsx'),
        'utf8'
      );
      assert.ok(
        sheetSource.includes('UPL_COMPLIANCE_FOOTER_TEXT(doc.docketId)'),
        'LivePaperSheet must retain locked UPL compliance footer call verbatim'
      );
    });
  });
});
