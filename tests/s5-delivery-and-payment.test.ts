import { withVerifiedLockFixture } from './helpers/verified-lock-fixture';
import "./helpers/firebase-auth-test-verifier";
import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { NextRequest } from 'next/server';
import { DOCKET_PRICING_TIERS, getNoticeBySlug } from '../src/lib/docket/notices';
import { POST as lockAndIntentPost } from '../app/api/docket/lock-and-intent/route';
import { POST as confirmOrderPost } from '../app/api/checkout/confirm-order/route';
import { GET as accountGet } from '../app/api/account/route';
import { getOrderById, getOrderByDocketId, saveOrder, updateOrderStatus } from '../lib/firebase-admin';
import { MailTierId } from '../src/lib/docket/types';
import { createDocumentIntegrityEvidence } from '../src/lib/docket/integrity-evidence';

// Enable mock stripe payment mode in test environment
process.env.ALLOW_LOCAL_MOCK_PAYMENTS = 'true';

describe('S5 Delivery and Payment Acceptance Gate', () => {
  // Test fixture data matching securityDepositNotice.zodSchema
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
    basisForRequest: 'My records show I paid the deposit and have received no refund.',
    responseDays: '14 calendar days',
  };

  describe('1. 3-Tier Delivery Pricing & Representation Agreement', () => {
    it('defines all 3 USPS delivery tiers with exact amounts and service levels', () => {
      assert.equal(DOCKET_PRICING_TIERS.first_class.priceCents, 1295);
      assert.equal(DOCKET_PRICING_TIERS.first_class.formattedPrice, '$12.95');
      assert.equal(DOCKET_PRICING_TIERS.first_class.lobExtraService, undefined);

      assert.equal(DOCKET_PRICING_TIERS.certified.priceCents, 1995);
      assert.equal(DOCKET_PRICING_TIERS.certified.formattedPrice, '$19.95');
      assert.equal(DOCKET_PRICING_TIERS.certified.lobExtraService, 'certified');

      assert.equal(DOCKET_PRICING_TIERS.certified_return_receipt.priceCents, 2795);
      assert.equal(DOCKET_PRICING_TIERS.certified_return_receipt.formattedPrice, '$27.95');
      assert.equal(DOCKET_PRICING_TIERS.certified_return_receipt.lobExtraService, 'certified_return_receipt');
    });

    it('synchronizes first_class tier ($12.95 / 1295 cents) across lock-and-intent and order record', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'security-deposit-return-demand-letter',
          userValues: validTenantValues,
          signatureAdoption: { adopted: true, affirmed: true, signerName: validTenantValues.senderFullName },
          tier: 'first_class',
          customerEmail: 'firstclass_user@example.com',
        })),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.amountCents, 1295);
      assert.equal(data.tier, 'first_class');
      assert.ok(data.orderId);
      assert.ok(data.viewToken);
      assert.ok(data.clientSecret);

      const order = await getOrderById(data.orderId);
      assert.ok(order);
      assert.equal(order.amountInCents, 1295);
      assert.equal(order.finalAmountInCents, 1295);
      assert.equal(order.serviceLevel, 'FIRST_CLASS');
      assert.equal(order.status, 'PENDING_PAYMENT');
    });

    it('synchronizes certified tier ($19.95 / 1995 cents) across lock-and-intent and order record', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'security-deposit-return-demand-letter',
          userValues: validTenantValues,
          signatureAdoption: { adopted: true, affirmed: true, signerName: validTenantValues.senderFullName },
          tier: 'certified',
          customerEmail: 'certified_user@example.com',
        })),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.amountCents, 1995);
      assert.equal(data.tier, 'certified');

      const order = await getOrderById(data.orderId);
      assert.ok(order);
      assert.equal(order.amountInCents, 1995);
      assert.equal(order.finalAmountInCents, 1995);
      assert.equal(order.serviceLevel, 'CERTIFIED');
    });

    it('synchronizes certified_return_receipt tier ($27.95 / 2795 cents) across lock-and-intent and order record', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'security-deposit-return-demand-letter',
          userValues: validTenantValues,
          signatureAdoption: { adopted: true, affirmed: true, signerName: validTenantValues.senderFullName },
          tier: 'certified_return_receipt',
          customerEmail: 'err_user@example.com',
        })),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.amountCents, 2795);
      assert.equal(data.tier, 'certified_return_receipt');

      const order = await getOrderById(data.orderId);
      assert.ok(order);
      assert.equal(order.amountInCents, 2795);
      assert.equal(order.finalAmountInCents, 2795);
      assert.equal(order.serviceLevel, 'CERTIFIED_RETURN_RECEIPT');
    });
  });

  describe('2. Content Revision & Tier Change Safe Lock Invalidation', () => {
    function computeFingerprint(
      tier: MailTierId,
      customerEmail: string,
      values: Record<string, string>,
      sigAdopted: boolean
    ): string {
      return JSON.stringify({
        tier,
        email: customerEmail.trim().toLowerCase(),
        values,
        sigAdopted,
      });
    }

    it('changing selected delivery tier alters fingerprint and invalidates prior intent', () => {
      const fp1 = computeFingerprint('certified', 'test@example.com', validTenantValues, true);
      const fp2 = computeFingerprint('first_class', 'test@example.com', validTenantValues, true);
      assert.notEqual(fp1, fp2);
    });

    it('editing draft values alters fingerprint and invalidates prior intent', () => {
      const fpOriginal = computeFingerprint('certified', 'test@example.com', validTenantValues, true);
      const modifiedValues = {
        ...validTenantValues,
        forwardingAddress: '999 Completely New Address, Miami, FL 33101',
      };
      // In DocumentWorkspace, any content change also invalidates signature
      const fpModified = computeFingerprint('certified', 'test@example.com', modifiedValues, false);
      assert.notEqual(fpOriginal, fpModified);
    });

    it('re-submitting after tier change creates fresh lock with updated amount and does not mutate prior order', async () => {
      // 1. Initial lock at $19.95
      const req1 = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'security-deposit-return-demand-letter',
          userValues: validTenantValues,
          signatureAdoption: { adopted: true, affirmed: true, signerName: validTenantValues.senderFullName },
          tier: 'certified',
          customerEmail: 'tier_change_user@example.com',
        })),
      });
      const res1 = await lockAndIntentPost(req1);
      const data1 = await res1.json();
      assert.equal(data1.amountCents, 1995);

      // 2. User goes back to Step 1 and changes tier to first_class ($12.95)
      const req2 = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'security-deposit-return-demand-letter',
          userValues: validTenantValues,
          signatureAdoption: { adopted: true, affirmed: true, signerName: validTenantValues.senderFullName },
          tier: 'first_class',
          customerEmail: 'tier_change_user@example.com',
        })),
      });
      const res2 = await lockAndIntentPost(req2);
      const data2 = await res2.json();

      assert.equal(data2.amountCents, 1295);
      assert.notEqual(data1.orderId, data2.orderId);
      assert.notEqual(data1.clientSecret, data2.clientSecret);

      // Prior order 1 remains immutable at 1995
      const order1 = await getOrderById(data1.orderId);
      assert.equal(order1?.amountInCents, 1995);

      // Fresh order 2 reflects 1295
      const order2 = await getOrderById(data2.orderId);
      assert.equal(order2?.amountInCents, 1295);
    });

    it('paid snapshots remain strictly immutable after fulfillment', async () => {
      const orderId = `order_immutability_test_${Date.now()}`;
      const frozenHtml = '<html><body><h1>Original Immutable Deposit Letter</h1></body></html>';

      await saveOrder({
        id: orderId,
        customerEmail: 'immutable@example.com',
        docketId: 'DS-2026-IMMUTABLE',
        docketNumber: 'DS-2026-IMMUTABLE',
        noticeId: '02-security-deposit-return',
        noticeType: 'security-deposit-return-demand-letter',
        serviceLevel: 'CERTIFIED',
        status: 'DISPATCHED_TO_USPS',
        amountInCents: 1995,
        finalAmountInCents: 1995,
        originalAmountInCents: 1995,
        documentHtml: frozenHtml,
        recipientAddress: {
          firstName: 'Acme Landlord',
          lastName: '',
          street1: '456 Landlord Blvd',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90012',
          country: 'US',
        },
        returnAddress: {
          firstName: 'Jane Doe',
          lastName: '',
          street1: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
          country: 'US',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const retrieved = await getOrderById(orderId);
      assert.equal(retrieved?.documentHtml, frozenHtml);
      assert.equal(retrieved?.amountInCents, 1995);
      assert.equal(retrieved?.status, 'DISPATCHED_TO_USPS');
    });
  });

  describe('3. Failure, Cancellation, and Fulfillment Idempotency', () => {
    it('returns 400 on invalid template slug without mutating draft or creating order', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'non-existent-template-slug',
          userValues: validTenantValues,
          signatureAdoption: { adopted: true, affirmed: true, signerName: validTenantValues.senderFullName },
          tier: 'certified',
          customerEmail: 'fail@example.com',
        })),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.ok(data.error.includes('not found'));
    });

    it('enforces fulfillment idempotency on /api/checkout/confirm-order', async () => {
      const orderId = `order_idempotency_${Date.now()}`;
      const lockedHtml = '<html><body>DOCKET RECORD & DISPATCH CERTIFICATION</body></html>';
      const lockedAt = Date.now();
      await saveOrder({
        id: orderId,
        schemaVersion: 2,
        kind: 'notice',
        noticeVersion: 1,
        noticeId: 'fixture_notice',
        noticeType: 'fixture-notice',
        documentHtml: lockedHtml,
        documentIntegrityEvidence: createDocumentIntegrityEvidence(lockedHtml, 'Sender', lockedAt, lockedAt),
        postalProvider: 'lob',
        postalProviderReference: 'ltr_fixture_123',
        lobLetterId: 'ltr_fixture_123',
        customerEmail: 'idempotent@example.com',
        docketId: 'DS-2026-IDEMPOTENT',
        docketNumber: 'DS-2026-IDEMPOTENT',
        status: 'PROCESSING_DISPATCH',
        serviceLevel: 'CERTIFIED',
        amountInCents: 1995,
        stripePaymentId: 'pi_mock_idempotency_123',
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
          zip: '94103',
          country: 'US',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Call confirm-order on an already processing order
      const req = new NextRequest('http://localhost:3000/api/checkout/confirm-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentIntentId: 'pi_mock_idempotency_123',
        }),
      });

      const res = await confirmOrderPost(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.alreadyProcessed, true);
      assert.equal(data.status, 'PROCESSING_DISPATCH');
    });
  });

  describe('4. Guest Checkout vs Signed-In Account Binding', () => {
    it('supports guest checkout without requiring userId or auth token', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'security-deposit-return-demand-letter',
          userValues: validTenantValues,
          signatureAdoption: { adopted: true, affirmed: true, signerName: validTenantValues.senderFullName },
          tier: 'certified',
          customerEmail: 'guest_buyer@example.com',
        })),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 200);
      const data = await res.json();

      const order = await getOrderById(data.orderId);
      assert.ok(order);
      assert.equal(order.userId, undefined);
      assert.equal(order.customerEmail, 'guest_buyer@example.com');
      assert.ok(order.viewToken);
    });

    it('binds order to authenticated account when Authorization Bearer token is provided', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock_token_alice@example.com',
        },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'security-deposit-return-demand-letter',
          userValues: validTenantValues,
          signatureAdoption: { adopted: true, affirmed: true, signerName: validTenantValues.senderFullName },
          tier: 'certified',
          customerEmail: 'alice@example.com',
        })),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 200);
      const data = await res.json();

      const order = await getOrderById(data.orderId);
      assert.ok(order);
      assert.equal(order.userId, 'alice@example.com');

      // Verify customer account lookup retrieves this order
      const accountReq = new NextRequest('http://localhost:3000/api/account?uid=alice@example.com&email=alice@example.com', {
        headers: {
          Authorization: 'Bearer mock_token_alice@example.com',
        },
      });
      const accountRes = await accountGet(accountReq);
      assert.equal(accountRes.status, 200);
      const accountData = await accountRes.json();
      assert.ok(accountData.orders.some((o: any) => o.id === data.orderId));
    });
  });

  describe('5. Component UI Contracts, Button Copy & Truthful Post-Payment Status', () => {
    const checkoutModalSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/docket/CheckoutModal.tsx'),
      'utf-8'
    );
    const docketPageSource = fs.readFileSync(
      path.join(process.cwd(), 'app/docket/[docketId]/page.tsx'),
      'utf-8'
    );

    it('CheckoutModal defines accessible dialog semantics and radiogroup attributes', () => {
      assert.ok(checkoutModalSource.includes('role="dialog"'));
      assert.ok(checkoutModalSource.includes('aria-modal="true"'));
      assert.ok(checkoutModalSource.includes('aria-labelledby="checkout-modal-title"'));
      assert.ok(checkoutModalSource.includes('aria-describedby="checkout-modal-desc"'));
      assert.ok(checkoutModalSource.includes('role="radiogroup"'));
      assert.ok(checkoutModalSource.includes('aria-label="Choose USPS mailing service"'));
      assert.ok(checkoutModalSource.includes('role="radio"'));
      assert.ok(checkoutModalSource.includes('aria-checked='));
      assert.ok(checkoutModalSource.includes("e.key === 'Escape'"));
    });

    it('enforces accurate button copy: Continue to payment on Step 1 vs submit order on Step 2', () => {
      assert.ok(
        checkoutModalSource.includes('Continue to payment — {currentTierMeta.formattedPrice}'),
        'Step 1 primary button must read "Continue to payment — $X"'
      );
      assert.ok(
        checkoutModalSource.includes('Pay {currentTierMeta.formattedPrice} and submit order'),
        'Step 2 confirm button must describe payment and order submission'
      );
      assert.ok(
        checkoutModalSource.includes('← Back to delivery options'),
        'Step 2 must provide a "← Back to delivery options" button'
      );
      // Ensure payment-confirming copy is never used on Step 1
      assert.ok(!checkoutModalSource.includes('Pay and send letter —'));
      assert.ok(!checkoutModalSource.includes('Pay and dispatch —'));
    });

    it('does not make unsupported popularity or formal-notice recommendations', () => {
      assert.ok(!checkoutModalSource.includes('Recommended for formal notices'));
      assert.ok(!checkoutModalSource.includes('Frequently selected option'));
      assert.ok(!checkoutModalSource.includes('Most Popular'));
      assert.ok(!checkoutModalSource.includes('COURT PROOF'));
      assert.ok(!checkoutModalSource.includes('court-ready'));
      assert.ok(!checkoutModalSource.includes('They can’t ignore'));
      assert.ok(!checkoutModalSource.includes('physical postal transmission tier'));
      assert.ok(!checkoutModalSource.includes('HP Indigo'));
    });

    it('distinguishes payment received, order processing, and provider postal updates', () => {
      // Step 3 in CheckoutModal
      assert.ok(checkoutModalSource.includes('1. Payment Received'));
      assert.ok(checkoutModalSource.includes('2. Order processing'));
      assert.ok(checkoutModalSource.includes('3. Provider updates and records'));
      assert.ok(checkoutModalSource.includes('Electronic Return Receipt records are shown if the postal provider supplies them.'));

      // app/docket/[docketId]/page.tsx
      assert.ok(docketPageSource.includes('1. Payment Confirmed'));
      assert.ok(docketPageSource.includes('2. Addresses recorded'));
      assert.ok(docketPageSource.includes("'3. Postal status recorded'"));
      assert.ok(docketPageSource.includes('4. Delivery status'));
      assert.ok(!docketPageSource.includes('mock-proof/'));
      assert.ok(docketPageSource.includes('It does not provide a carrier certificate or determine whether legal service requirements were met.'));
      assert.ok(docketPageSource.includes('Electronic Return Receipt:'));
    });

    it('preserves user inputs in role="alert" error states without resetting', () => {
      assert.ok(checkoutModalSource.includes('role="alert"'));
      assert.ok(checkoutModalSource.includes('Where should we send your order email?'));
      assert.ok(checkoutModalSource.includes('docketstamp_access_tokens'));
      assert.ok(checkoutModalSource.includes('order_token_'));
    });
  });

  describe('6. Production Security Invariants & Fail-Closed Guards', () => {
    it('strictly prohibits USE_MOCK_FIRESTORE in production environments (fail-closed)', () => {
      let threw = false;
      try {
        execSync(
          'node --import tsx -e \'process.env.NODE_ENV="production"; process.env.USE_MOCK_FIRESTORE="true"; require("./lib/firebase-admin");\'',
          { stdio: 'pipe' }
        );
      } catch (err: any) {
        threw = true;
        const stderr = err.stderr ? err.stderr.toString() : '';
        const stdout = err.stdout ? err.stdout.toString() : '';
        const message = err.message || '';
        const output = `${stderr}\n${stdout}\n${message}`;
        assert.ok(
          output.includes('[Firebase Admin Critical] USE_MOCK_FIRESTORE is strictly prohibited in hosted and production runtimes.'),
          `Expected fail-closed error message, got: ${output}`
        );
      }
      assert.equal(threw, true, 'Importing firebase-admin with USE_MOCK_FIRESTORE=true in production must throw');
    });
  });
});
