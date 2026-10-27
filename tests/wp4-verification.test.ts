import { withVerifiedLockFixture } from './helpers/verified-lock-fixture';
/**
 * Work Package 4 (WP-4) Verification Gate
 *
 * Verifies:
 * 1. /api/docket/lock-and-intent endpoint validation, fitness blocker, and pricing tiers.
 * 2. Invariant 5: Freeze-before-pay database snapshot integrity.
 * 3. Idempotent order fulfillment via processPaidOrder and Lob letter dispatch adapter.
 * 4. Docket registry lookup by docketId and locked UPL compliance certification.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import { POST as lockAndIntentPost } from '../app/api/docket/lock-and-intent/route';
import { processPaidOrder } from '../lib/order-processor';
import { getOrderById, getOrderByDocketId } from '../lib/firebase-admin';
import { UPL_COMPLIANCE_FOOTER_TEXT } from '../src/lib/docket/guardrails';

describe('WP-4 Verification Gate: Checkout Wiring, Snapshot Integrity & Status Page', () => {
  const originalEnv = { ...process.env };

  before(() => {
    process.env.ALLOW_LOCAL_MOCK_PAYMENTS = 'true';
    Object.assign(process.env, { NODE_ENV: 'test' });
    process.env.LOB_ENV = 'staging_mock_cass';
  });

  after(() => {
    process.env = originalEnv;
  });

  describe('1. /api/docket/lock-and-intent Route Validation & Pricing', () => {
    it('rejects requests with missing notice slug', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userValues: {},
        }),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.includes('slug'));
    });

    it('enforces Invariant 1: strictly rejects NAICS 713940 fitness entities', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'written-contract-and-policy-cancellation-letter',
          userValues: {
            senderFullName: 'David Miller',
            senderAddressLine1: '456 Oak St',
            senderCity: 'Chicago',
            senderState: 'IL',
            senderZip: '60614',
            recipientFormalName: 'Planet Fitness Headquarters',
            recipientAddressLine1: '400 Executive Center Dr',
            recipientCity: 'West Palm Beach',
            recipientState: 'FL',
            recipientZip: '33401',
            accountOrPolicyNumber: 'PF-99128',
            serviceTypeLabel: 'Gym Membership',
            effectiveCancellationDate: '2026-11-01',
            servicePropertyAddress: '456 Oak St, Chicago, IL',
          },
        })),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.code, 'CONFLICT_OF_INTEREST');
      assert.equal(json.category, 'PROHIBITED_NAICS_713940');
    });

    it('enforces 3-tier pricing model: First-Class ($12.95 / 1295c)', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'tenant-notice-of-intent-to-vacate',
          tier: 'first_class',
          customerEmail: 'tenant@example.com',
          signatureAdoption: { adopted: true, affirmed: true, signerName: 'Jordan Hayes' },
          userValues: {
            senderFullName: 'Jordan Hayes',
            senderAddressLine1: '512 Elm St, Apt 2B',
            senderCity: 'Chicago',
            senderState: 'IL',
            senderZip: '60614',
            recipientFormalName: 'Skyline Properties LLC',
            recipientAddressLine1: '100 N LaSalle St',
            recipientCity: 'Chicago',
            recipientState: 'IL',
            recipientZip: '60602',
            leasedPremisesAddress: '512 Elm St, Apt 2B, Chicago, IL 60614',
            leaseNoticePeriod: '30-Day',
            moveOutDate: '2026-11-30',
            forwardingAddress: 'PO Box 99, Chicago, IL 60601',
          },
        })),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.amountCents, 1295);
      assert.equal(json.tier, 'first_class');
      assert.ok(json.orderId);
      assert.ok(json.viewToken);
      assert.match(json.docketId, /^DS-2026-[A-Z0-9]{6}$/);
    });

    it('enforces 3-tier pricing model: Certified Mail ($19.95 / 1995c)', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'security-deposit-return-demand-letter',
          tier: 'certified',
          customerEmail: 'tenant@example.com',
          signatureAdoption: { adopted: true, affirmed: true, signerName: 'Sarah Connor' },
          userValues: {
            senderFullName: 'Sarah Connor',
            senderAddressLine1: '100 Main St',
            senderCity: 'Los Angeles',
            senderState: 'CA',
            senderZip: '90001',
            recipientFormalName: 'Sunset Management Inc',
            recipientAddressLine1: '200 Sunset Blvd',
            recipientCity: 'Los Angeles',
            recipientState: 'CA',
            recipientZip: '90028',
            vacatedPremisesAddress: '100 Main St, Los Angeles, CA 90001',
            propertyState: 'CA',
            moveOutDate: '2026-09-01',
            depositAmount: '$2,000.00',
            amountReceivedToDate: '$0.00',
            balanceRequested: '$2,000.00',
            basisForRequest: 'My records show I paid this deposit and have received no refund.',
            responseDays: '10 business days',
          },
        })),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.amountCents, 1995);
      assert.equal(json.tier, 'certified');
    });

    it('enforces 3-tier pricing model: Certified + Return Receipt ($27.95 / 2795c)', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'fcra-credit-bureau-written-dispute-letter',
          tier: 'certified_return_receipt',
          customerEmail: 'consumer@example.com',
          signatureAdoption: { adopted: true, affirmed: true, signerName: 'Taylor Morgan' },
          userValues: {
            senderFullName: 'Taylor Morgan',
            senderAddressLine1: '789 Pine St',
            senderCity: 'Atlanta',
            senderState: 'GA',
            senderZip: '30301',
            recipientFormalName: 'Equifax Information Services LLC',
            recipientAddressLine1: 'PO Box 740256',
            recipientCity: 'Atlanta',
            recipientState: 'GA',
            recipientZip: '30374-0256',
            bureauEntityId: 'cra_eqf',
            senderDob: '1985-05-12',
            ssnLast4: '4321',
            furnisherName: 'Acme Bank Credit Services',
            partialAccountNumber: 'XXXX-9876',
            disputeReason: 'Account status (late payment / charge-off) is inaccurate',
            factualExplanation: 'This account was paid on time as agreed.',
          },
        })),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.amountCents, 2795);
      assert.equal(json.tier, 'certified_return_receipt');
    });
  });

  describe('2. Invariant 5: Freeze-Before-Pay Snapshot Persistence', () => {
    it('persists frozen document HTML in database order BEFORE payment completion', async () => {
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'tenant-notice-of-intent-to-vacate',
          tier: 'certified',
          customerEmail: 'snapshot-audit@example.com',
          signatureAdoption: { adopted: true, affirmed: true, signerName: 'Arthur Dent' },
          userValues: {
            senderFullName: 'Arthur Dent',
            senderAddressLine1: '42 Country Lane',
            senderCity: 'Cottington',
            senderState: 'MA',
            senderZip: '01002',
            recipientFormalName: 'Magrathea Land Corp',
            recipientAddressLine1: '1 Galaxy Way',
            recipientCity: 'Boston',
            recipientState: 'MA',
            recipientZip: '02108',
            leasedPremisesAddress: '42 Country Lane, Cottington, MA 01002',
            leaseNoticePeriod: '30-Day',
            moveOutDate: '2026-11-30',
            forwardingAddress: 'PO Box 42, Boston, MA 02101',
          },
        })),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 200);
      const json = await res.json();

      // Retrieve snapshot from database
      const order = await getOrderById(json.orderId);
      assert.ok(order, 'Order must exist in database');
      assert.equal(order.status, 'PENDING_PAYMENT');
      assert.equal(order.docketId, json.docketId);
      assert.ok(order.documentHtml, 'documentHtml must be saved on order record');

      // Verify exact HTML contents
      assert.ok(order.documentHtml.includes(json.docketId), 'Must include docketId in Clerk stamp');
      assert.ok(order.documentHtml.includes('Arthur Dent'), 'Must include signer name in frozen payload');
      assert.ok(order.documentHtml.includes('/s/ Arthur Dent'), 'Must include electronic signature in frozen payload');
      assert.ok(order.documentHtml.includes('DOCUMENT PREPARATION RECORD'), 'Must include the self-help disclosure');
    });
  });

  describe('3. Order Fulfillment & Lob Postal Dispatch Execution', () => {
    it('atomically transitions order and dispatches via Lob under test mode', async () => {
      // Create pending order
      const lockReq = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'tenant-notice-of-intent-to-vacate',
          tier: 'certified_return_receipt',
          customerEmail: 'fulfillment-test@example.com',
          signatureAdoption: { adopted: true, affirmed: true, signerName: 'Jordan Hayes' },
          userValues: {
            senderFullName: 'Jordan Hayes',
            senderAddressLine1: '512 Elm St, Apt 2B',
            senderCity: 'Chicago',
            senderState: 'IL',
            senderZip: '60614',
            recipientFormalName: 'Skyline Properties LLC',
            recipientAddressLine1: '100 N LaSalle St',
            recipientCity: 'Chicago',
            recipientState: 'IL',
            recipientZip: '60602',
            leasedPremisesAddress: '512 Elm St, Apt 2B, Chicago, IL 60614',
            leaseNoticePeriod: '30-Day',
            moveOutDate: '2026-11-30',
            forwardingAddress: 'PO Box 99, Chicago, IL 60601',
          },
        })),
      });

      const lockRes = await lockAndIntentPost(lockReq);
      const lockData = await lockRes.json();
      const orderId = lockData.orderId;

      // Simulate payment success and fulfill order
      const fulfillmentResult = await processPaidOrder(
        orderId,
        'pi_mock_successful_payment',
        'fulfillment-test@example.com',
        { paymentMode: 'local_mock', isTest: true }
      );

      assert.equal(fulfillmentResult.success, true);
      assert.equal(fulfillmentResult.status, 'PROCESSING_DISPATCH');

      // Verify database record has updated tracking metadata
      const fulfilledOrder = await getOrderById(orderId);
      assert.ok(fulfilledOrder);
      assert.equal(fulfilledOrder.status, 'PROCESSING_DISPATCH');
      assert.ok(fulfilledOrder.lobLetterId, 'lobLetterId must be recorded');
      assert.ok(fulfilledOrder.lobTrackingNumber, 'lobTrackingNumber must be recorded');
      assert.ok(fulfilledOrder.lobTrackingUrl, 'lobTrackingUrl must be recorded');

      // Test idempotency: re-processing the order should safely drop duplicate dispatch
      const duplicateResult = await processPaidOrder(
        orderId,
        'pi_mock_successful_payment',
        'fulfillment-test@example.com',
        { paymentMode: 'local_mock', isTest: true }
      );

      assert.equal(duplicateResult.success, true);
      assert.equal(duplicateResult.alreadyProcessed, true);
    });
  });

  describe('4. Docket Registry Lookup & Compliance', () => {
    it('retrieves order by docketId and validates compliance disclosure', async () => {
      // Create and fulfill order
      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'tenant-notice-of-intent-to-vacate',
          tier: 'certified',
          customerEmail: 'registry-lookup@example.com',
          signatureAdoption: { adopted: true, affirmed: true, signerName: 'Jordan Hayes' },
          userValues: {
            senderFullName: 'Jordan Hayes',
            senderAddressLine1: '512 Elm St, Apt 2B',
            senderCity: 'Chicago',
            senderState: 'IL',
            senderZip: '60614',
            recipientFormalName: 'Skyline Properties LLC',
            recipientAddressLine1: '100 N LaSalle St',
            recipientCity: 'Chicago',
            recipientState: 'IL',
            recipientZip: '60602',
            leasedPremisesAddress: '512 Elm St, Apt 2B, Chicago, IL 60614',
            leaseNoticePeriod: '30-Day',
            moveOutDate: '2026-11-30',
            forwardingAddress: 'PO Box 99, Chicago, IL 60601',
          },
        })),
      });

      const res = await lockAndIntentPost(req);
      const data = await res.json();
      const docketId = data.docketId;

      // Lookup by docketId
      const record = await getOrderByDocketId(docketId);
      assert.ok(record, 'Order must be resolvable by docketId');
      assert.equal(record.docketId, docketId);

      // Verify UPL text
      const uplText = UPL_COMPLIANCE_FOOTER_TEXT(docketId);
      assert.ok(uplText.includes(docketId));
      assert.ok(uplText.includes('DocketStamp.com'));
      assert.ok(uplText.includes('does not provide legal representation or legal advice'));
    });
  });
});
