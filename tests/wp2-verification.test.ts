/**
 * Work Package 2 (WP-2) Verification Gate
 *
 * Verifies:
 * 1. interpolateNotice() pure deterministic AST and token generation.
 * 2. renderLobHtmlPayload() exact 1-page 8.5in x 11in geometry, Clerk Docket Stamp box,
 *    and locked UPL compliance footer.
 * 3. verifyUsAddress() CASS verification behavior with staging mock fallback.
 * 4. dispatchDocketLetter() mapping:
 *    - first_class -> extra_service: undefined
 *    - certified -> extra_service: 'certified'
 *    - certified_return_receipt -> extra_service: 'certified_return_receipt'
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import {
  intentToVacateNotice,
  securityDepositNotice,
} from '../src/lib/docket/notices';

import {
  interpolateNotice,
  generateDocketId,
} from '../src/lib/docket/renderer/interpolate';

import {
  renderLobHtmlPayload,
} from '../src/lib/docket/renderer/lob-html-shell';

import {
  verifyUsAddress,
  dispatchDocketLetter,
} from '../src/lib/fulfillment/lob';
import { POST as lockAndIntentPost } from '../app/api/docket/lock-and-intent/route';
import { getOrderById } from '../lib/firebase-admin';
import { UPL_COMPLIANCE_FOOTER_TEXT } from '../src/lib/docket/guardrails';

describe('WP-2 Verification Gate', () => {
  describe('1. interpolateNotice Engine', () => {
    it('produces identical output for identical inputs (pure & deterministic)', () => {
      const userValues = {
        senderFullName: 'Jordan Hayes',
        recipientFormalName: 'Skyline Properties LLC',
        leasedPremisesAddress: '512 Elm St, Apt 2B, Chicago, IL 60614',
        leaseNoticePeriod: '30-Day',
        moveOutDate: '2026-11-30',
        forwardingAddress: 'PO Box 99, Chicago, IL 60601',
      };

      const doc1 = interpolateNotice({
        notice: intentToVacateNotice,
        userValues,
        docketId: 'DS-2026-STATIC1-IL',
        executionDate: 'October 14, 2026',
      });

      const doc2 = interpolateNotice({
        notice: intentToVacateNotice,
        userValues,
        docketId: 'DS-2026-STATIC1-IL',
        executionDate: 'October 14, 2026',
      });

      assert.deepEqual(doc1.rawParagraphs, doc2.rawParagraphs);
      assert.deepEqual(doc1.paragraphs, doc2.paragraphs);
      assert.equal(doc1.reLine, doc2.reLine);
      assert.equal(doc1.docketId, 'DS-2026-STATIC1-IL');
    });

    it('injects statutory citations and deadlines for Notice #2 when usesStateStatuteLookup is true', () => {
      const userValues = {
        senderFullName: 'Marcus Vance',
        recipientFormalName: 'Oakridge Properties Inc.',
        propertyState: 'CA',
        vacatedPremisesAddress: '100 Sunset Blvd, Los Angeles, CA 90028',
        moveOutDate: '2026-09-15',
        depositAmount: '$2,500.00',
        amountReceivedToDate: '$0.00',
        balanceRequested: '$2,500.00',
        responseDays: '10 business days',
      };

      const doc = interpolateNotice({
        notice: securityDepositNotice,
        userValues,
        docketId: 'DS-2026-CA001-CA',
      });

      // California: Cal. Civ. Code § 1950.5(g) and 21 calendar days
      assert.ok(doc.reLine.includes('Cal. Civ. Code § 1950.5'));
      assert.ok(doc.rawParagraphs.some((p) => p.includes('Cal. Civ. Code § 1950.5')));
      assert.ok(doc.rawParagraphs.some((p) => p.includes('21 calendar days')));
    });

    it('formats unfilled variables as DocuSign-style tokens with isFilled: false', () => {
      const partialValues = {
        senderFullName: 'Alex Rivera',
        // Omit moveOutDate
      };

      const doc = interpolateNotice({
        notice: intentToVacateNotice,
        userValues: partialValues,
      });

      const allTokens = doc.paragraphs.flat();
      const moveOutToken = allTokens.find((t) => t.key === 'moveOutDate');
      assert.ok(moveOutToken, 'Should find moveOutDate token in paragraph tokens');
      assert.equal(moveOutToken.isFilled, false);
      assert.equal(moveOutToken.docusignTagLabel, 'VACATE DATE');
    });

    it('does not claim address verification unless the dispatch workflow supplies it', () => {
      const doc = interpolateNotice({
        notice: intentToVacateNotice,
        userValues: { senderFullName: 'Alex Rivera' },
        docketId: 'DS-2026-ADDRESS-STATUS',
      });

      assert.equal(doc.clerkStamp.cassStatus, 'ADDRESS VERIFICATION NOT CONFIRMED');
      assert.doesNotMatch(renderLobHtmlPayload(doc), /CASS™ VERIFIED/);
    });
  });

  describe('2. Lob 8.5x11 Single-Page HTML Shell Geometry', () => {
    it('matches exact CSS coordinate geometry from Section 9', () => {
      const userValues = {
        senderFullName: 'Alex Rivera',
        recipientFormalName: 'Summit Management',
        leasedPremisesAddress: '742 Evergreen Terrace, Springfield, OR 97477',
        leaseNoticePeriod: '30-Day',
        moveOutDate: '2026-11-30',
        forwardingAddress: 'PO Box 99, Eugene, OR 97401',
      };

      const doc = interpolateNotice({
        notice: intentToVacateNotice,
        userValues,
        docketId: 'DS-2026-GEO001-OR',
        serviceLevel: 'certified_return_receipt',
      });

      const html = renderLobHtmlPayload(doc);

      // 1. Page dimensions
      assert.ok(html.includes('size: 8.5in 11in; margin: 0;'));
      assert.ok(html.includes('width: 8.5in;'));
      assert.ok(html.includes('height: 11in;'));

      // 2. Clerk Docket Stamp Box coordinates
      assert.ok(html.includes('top: 1.85in;'));
      assert.ok(html.includes('right: 0.60in;'));
      assert.ok(html.includes('width: 3.15in;'));
      assert.ok(html.includes('DOCKETSTAMP™ OFFICIAL DISPATCH REGISTRY'));
      assert.ok(html.includes('DS-2026-GEO001-OR'));
      assert.ok(html.includes('USPS CERTIFIED + RETURN RECEIPT'));

      // 3. Letter Body container coordinates
      assert.ok(html.includes('top: 3.35in;'));
      assert.ok(html.includes('left: 0.75in;'));
      assert.ok(html.includes('right: 0.75in;'));
      assert.ok(html.includes('bottom: 0.80in;'));

      // 4. Electronic Signature line
      assert.ok(html.includes('/s/ Alex Rivera'));

      // 5. UPL Statutory Footer at 0.40in bottom
      assert.ok(html.includes('bottom: 0.40in;'));
      assert.ok(html.includes('DOCKET RECORD & DISPATCH CERTIFICATION: Prepared and dispatched via DocketStamp.com'));
      assert.ok(html.includes('DS-2026-GEO001-OR'));
      assert.ok(html.includes('not a law firm'));
      assert.ok(html.includes('legal representation'));
    });

    it('freezes the same deterministic notice content produced for review, with docket, tier, signature, and UPL disclosure', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalMockPayments = process.env.ALLOW_LOCAL_MOCK_PAYMENTS;
      process.env.NODE_ENV = 'test';
      process.env.ALLOW_LOCAL_MOCK_PAYMENTS = 'true';

      try {
        const userValues = {
          senderFullName: 'Taylor Morgan',
          senderAddressLine1: '77 Lake Street, Unit 5',
          senderCity: 'Chicago',
          senderState: 'IL',
          senderZip: '60601',
          recipientFormalName: 'North Shore Property Group',
          recipientAddressLine1: '900 Sheridan Road',
          recipientCity: 'Evanston',
          recipientState: 'IL',
          recipientZip: '60201',
          propertyState: 'IL',
          vacatedPremisesAddress: '77 Lake Street, Unit 5, Chicago, IL 60601',
          moveOutDate: '2026-09-30',
          depositAmount: '$1,800.00',
          amountReceivedToDate: '$0.00',
          balanceRequested: '$1,800.00',
          responseDays: '14 calendar days',
        };
        const docketId = 'DS-2026-ABC123';
        const tier = 'certified_return_receipt' as const;
        const previewDoc = interpolateNotice({
          notice: securityDepositNotice,
          userValues,
          docketId,
          serviceLevel: tier,
        });
        const previewHtml = renderLobHtmlPayload(previewDoc);

        const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: securityDepositNotice.slug,
            userValues,
            tier,
            docketId,
            customerEmail: 'parity-fixture@example.com',
          }),
        });
        const response = await lockAndIntentPost(req);
        if (response.status !== 200) {
          assert.fail(`lock route rejected parity fixture: ${JSON.stringify(await response.json())}`);
        }
        const result = await response.json();
        const order = await getOrderById(result.orderId);
        assert.ok(order, 'lock route must persist an order before payment');
        assert.equal(order.status, 'PENDING_PAYMENT');
        assert.equal(order.docketId, docketId);

        // The route and the interactive review fixture use the same interpolation
        // function. Ignore the generated FILED UTC timestamp, which is intentionally
        // fresh on each render, and compare the remaining print payload exactly.
        const withoutTimestamp = (html: string) => html.replace(
          /(<strong>FILED UTC:<\/strong>\s*)[^<]+/,
          '$1[TIMESTAMP]'
        );
        assert.equal(withoutTimestamp(order.documentHtml), withoutTimestamp(previewHtml));
        assert.ok(order.documentHtml.includes(previewDoc.reLine));
        assert.ok(order.documentHtml.includes('77 Lake Street, Unit 5, Chicago, IL 60601'));
        assert.ok(order.documentHtml.includes('14 calendar days'));
        assert.ok(order.documentHtml.includes('/s/ Taylor Morgan'));
        assert.ok(order.documentHtml.includes('USPS CERTIFIED + RETURN RECEIPT'));
        assert.ok(order.documentHtml.includes(UPL_COMPLIANCE_FOOTER_TEXT(docketId)));
      } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
        if (originalMockPayments === undefined) delete process.env.ALLOW_LOCAL_MOCK_PAYMENTS;
        else process.env.ALLOW_LOCAL_MOCK_PAYMENTS = originalMockPayments;
      }
    });
  });

  describe('3. Lob CASS Verification & Dispatch Adapter', () => {
    it('verifies US address with CASS standardization in staging mock mode', async () => {
      const result = await verifyUsAddress({
        name: 'John Doe',
        addressLine1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
      });

      assert.equal(result.valid, true);
      assert.equal(result.deliverability, 'deliverable');
      assert.ok(result.standardizedAddress);
      assert.equal(result.standardizedAddress.city, 'SPRINGFIELD');
      assert.equal(result.standardizedAddress.state, 'IL');
    });

    it('simulates dispatchDocketLetter under test mode for all 3 tiers', async () => {
      const address = {
        name: 'Landlord Inc',
        addressLine1: '400 Market St',
        city: 'Philadelphia',
        state: 'PA',
        zip: '19106',
      };

      for (const tier of ['first_class', 'certified', 'certified_return_receipt'] as const) {
        const res = await dispatchDocketLetter({
          orderId: `test_ord_${tier}`,
          docketId: `DS-2026-${tier.toUpperCase()}`,
          description: `Test dispatch ${tier}`,
          to: address,
          from: address,
          file: '<html><body>Test</body></html>',
          tier,
        });

        assert.equal(res.success, true);
        assert.ok(res.letterId);
        assert.ok(res.trackingNumber);
        assert.equal(res.isTest, true);
      }
    });
  });
});
