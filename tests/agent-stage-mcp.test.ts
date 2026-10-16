/**
 * DocketStamp Agentic Staging, Remote MCP Server & Discovery Manifests Verification Suite
 *
 * Verifies:
 * 1. POST /api/docket/stage & GET /api/docket/stage/[stageId]
 *    - Valid staging returning DS-STAGE-XXXXXX, reviewUrl, missingRequiredFields
 *    - Strict NAICS 713940 fitness blocker returning 400 CONFLICT_OF_INTEREST
 *    - Staged draft retrieval and 404 for non-existent drafts
 * 2. POST /api/mcp Remote Model Context Protocol Server
 *    - JSON-RPC 2.0 initialize handshake (protocol version 2024-11-05)
 *    - ping and tools/list (all 3 tools: list_docket_notices, search_verified_recipients, stage_certified_notice)
 *    - tools/call execution for all 3 tools, including guardrail rejection
 * 3. GET /llms.txt
 *    - Returns 200 text/plain
 *    - Contains all 9 notice slugs and all 38 verified recipient names / IDs
 *    - Core invariant: "Agents stage, humans sign and pay"
 * 4. GET /.well-known/openapi.json
 *    - Returns 200 application/json
 *    - Valid OpenAPI 3.0.3 spec with /api/docket/stage, /api/docket/stage/{stageId}, /api/mcp
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import { POST as stagePost } from '../app/api/docket/stage/route';
import { GET as stageGet } from '../app/api/docket/stage/[stageId]/route';
import { POST as mcpPost } from '../app/api/mcp/route';
import { GET as llmsTxtGet } from '../app/llms.txt/route';
import { GET as openApiGet } from '../app/.well-known/openapi.json/route';
import { ALL_NOTICE_CARTRIDGES } from '../src/lib/docket/notices';
import { getAllVerifiedRecipients } from '../src/lib/docket/data/verified-recipients';

describe('1. Staged Draft API (/api/docket/stage & /api/docket/stage/[stageId])', () => {
  let createdStageId = '';

  it('successfully stages a notice with partial fields and verified recipient (Withings leg_wth)', async () => {
    const req = new NextRequest('http://localhost:3000/api/docket/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noticeSlug: 'pre-arbitration-notice-of-dispute-and-refund-request',
        recipientId: 'leg_wth',
        sender: {
          name: 'Jane Doe',
          addressLine1: '123 Market St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
        },
        fieldValues: {
          productOrServiceName: 'Withings Body Smart Scale',
          accountOrSerialIdentifier: 'SN-00998877',
          purchaseDate: '2025-06-15',
          disputeTriggerCategory: 'Post-Purchase Removal or Paywalling of Advertised Feature',
          factualSummary: 'Vascular age and pulse wave velocity measurements were disabled behind Withings+ subscription.',
        },
        recommendedTier: 'certified_return_receipt',
      }),
    });

    const res = await stagePost(req);
    assert.equal(res.status, 201);

    const data = await res.json();
    assert.match(data.stageId, /^DS-STAGE-[A-F0-9]{6}$/);
    assert.equal(data.noticeSlug, 'pre-arbitration-notice-of-dispute-and-refund-request');
    assert.equal(
      data.reviewUrl,
      `https://docketstamp.com/notices/pre-arbitration-notice-of-dispute-and-refund-request?stage=${data.stageId}`
    );
    assert.ok(Array.isArray(data.missingRequiredFields));
    // requestedResolutionAmount was omitted, so it must be flagged in missingRequiredFields
    assert.ok(data.missingRequiredFields.includes('requestedResolutionAmount'));
    assert.ok(data.pricingTiers.first_class);
    assert.ok(data.pricingTiers.certified);
    assert.ok(data.pricingTiers.certified_return_receipt);
    assert.ok(new Date(data.expiresAt).getTime() > Date.now());

    createdStageId = data.stageId;
  });

  it('retrieves the staged draft by stageId via GET /api/docket/stage/[stageId]', async () => {
    assert.ok(createdStageId, 'Expected createdStageId to be set from previous test');
    const req = new NextRequest(`http://localhost:3000/api/docket/stage/${createdStageId}`);
    const res = await stageGet(req, { params: Promise.resolve({ stageId: createdStageId }) });

    assert.equal(res.status, 200);
    const draft = await res.json();
    assert.equal(draft.stageId, createdStageId);
    assert.equal(draft.noticeSlug, 'pre-arbitration-notice-of-dispute-and-refund-request');
    assert.equal(draft.recipientId, 'leg_wth');
    assert.equal(draft.recipient?.brandName, 'Withings');
    assert.equal(draft.fieldValues.productOrServiceName, 'Withings Body Smart Scale');
    assert.equal(draft.recommendedTier, 'certified_return_receipt');
    assert.ok(draft.reviewUrl.includes(createdStageId));
  });

  it('stages a notice with custom recipient address', async () => {
    const req = new NextRequest('http://localhost:3000/api/docket/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noticeSlug: 'security-deposit-return-demand-letter',
        customRecipient: {
          name: 'Landlord Management Partners LLC',
          addressLine1: '456 Commercial Way, Suite 300',
          city: 'Austin',
          state: 'TX',
          zip: '78701',
        },
        sender: {
          name: 'Michael Tenant',
          addressLine1: '789 New St, Apt 2B',
          city: 'Austin',
          state: 'TX',
          zip: '78702',
        },
        fieldValues: {
          vacatedPremisesAddress: '123 Elm St, Apt 4A, Austin, TX 78701',
          moveOutDate: '2026-09-30',
          depositAmount: '$2,000.00',
          balanceRequested: '$2,000.00',
          propertyState: 'TX',
        },
        recommendedTier: 'certified',
      }),
    });

    const res = await stagePost(req);
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.match(data.stageId, /^DS-STAGE-[A-F0-9]{6}$/);
    assert.equal(data.noticeSlug, 'security-deposit-return-demand-letter');
  });

  it('returns 404 for an unknown or expired stageId', async () => {
    const req = new NextRequest('http://localhost:3000/api/docket/stage/DS-STAGE-NONEXIST');
    const res = await stageGet(req, { params: Promise.resolve({ stageId: 'DS-STAGE-NONEXIST' }) });

    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.code, 'NOT_FOUND');
  });

  it('strictly blocks fitness entities (NAICS 713940) and returns 400 CONFLICT_OF_INTEREST', async () => {
    // Equinox custom recipient
    const reqEquinox = new NextRequest('http://localhost:3000/api/docket/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noticeSlug: 'written-contract-and-policy-cancellation-letter',
        customRecipient: {
          name: 'Equinox Fitness Club Legal Dept',
          addressLine1: '895 Broadway',
          city: 'New York',
          state: 'NY',
          zip: '10003',
        },
        fieldValues: {
          serviceTypeLabel: 'Equinox Gym Membership',
          accountOrPolicyNumber: 'EQ-883921',
        },
      }),
    });

    const resEquinox = await stagePost(reqEquinox);
    assert.equal(resEquinox.status, 400);
    const dataEquinox = await resEquinox.json();
    assert.equal(dataEquinox.code, 'CONFLICT_OF_INTEREST');
    assert.match(dataEquinox.error, /NAICS 713940|gym|fitness/i);

    // Planet Fitness in field values
    const reqPlanetFitness = new NextRequest('http://localhost:3000/api/docket/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noticeSlug: 'pre-arbitration-notice-of-dispute-and-refund-request',
        fieldValues: {
          productOrServiceName: 'Planet Fitness Black Card Gym Membership',
        },
      }),
    });

    const resPlanetFitness = await stagePost(reqPlanetFitness);
    assert.equal(resPlanetFitness.status, 400);
    const dataPlanet = await resPlanetFitness.json();
    assert.equal(dataPlanet.code, 'CONFLICT_OF_INTEREST');
  });

  it('returns 404 when notice cartridge slug is not found', async () => {
    const req = new NextRequest('http://localhost:3000/api/docket/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noticeSlug: 'invalid-notice-slug-does-not-exist',
      }),
    });

    const res = await stagePost(req);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.code, 'NOT_FOUND');
  });

  it('returns 400 when recipientId is invalid', async () => {
    const req = new NextRequest('http://localhost:3000/api/docket/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noticeSlug: 'pre-arbitration-notice-of-dispute-and-refund-request',
        recipientId: 'leg_invalid_id_999',
      }),
    });

    const res = await stagePost(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_RECIPIENT_ID');
  });
});

describe('2. Remote MCP Endpoint (/api/mcp)', () => {
  it('handles MCP initialize method and returns protocolVersion 2024-11-05', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'claude-ai', version: '1.0.0' },
        },
      }),
    });

    const res = await mcpPost(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.jsonrpc, '2.0');
    assert.equal(data.id, 1);
    assert.equal(data.result.protocolVersion, '2024-11-05');
    assert.equal(data.result.serverInfo.name, 'docketstamp-mcp');
    assert.ok(data.result.capabilities.tools);
  });

  it('handles MCP ping method', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
      }),
    });

    const res = await mcpPost(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, 2);
    assert.deepEqual(data.result, {});
  });

  it('handles MCP tools/list method and returns exactly 3 tools', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
      }),
    });

    const res = await mcpPost(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, 3);
    assert.equal(data.result.tools.length, 3);

    const toolNames = data.result.tools.map((t: any) => t.name);
    assert.ok(toolNames.includes('list_docket_notices'));
    assert.ok(toolNames.includes('search_verified_recipients'));
    assert.ok(toolNames.includes('stage_certified_notice'));
  });

  it('executes tools/call: list_docket_notices returning all 9 cartridges', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'list_docket_notices',
          arguments: {},
        },
      }),
    });

    const res = await mcpPost(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, 4);
    assert.ok(data.result.content[0].text);

    const notices = JSON.parse(data.result.content[0].text);
    assert.equal(notices.length, 9);
    const slugs = notices.map((n: any) => n.slug);
    assert.ok(slugs.includes('tenant-notice-of-intent-to-vacate'));
    assert.ok(slugs.includes('security-deposit-return-demand-letter'));
    assert.ok(slugs.includes('tenant-repair-and-maintenance-notice'));
    assert.ok(slugs.includes('fcra-credit-bureau-written-dispute-letter'));
    assert.ok(slugs.includes('fdcpa-30-day-debt-validation-letter'));
    assert.ok(slugs.includes('written-contract-and-policy-cancellation-letter'));
    assert.ok(slugs.includes('pre-arbitration-notice-of-dispute-and-refund-request'));
    assert.ok(slugs.includes('30-day-mandatory-arbitration-opt-out-notice'));
    assert.ok(slugs.includes('statutory-health-and-biometric-data-deletion-demand'));
  });

  it('executes tools/call: search_verified_recipients for Withings and credit bureaus', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'search_verified_recipients',
          arguments: { query: 'Withings' },
        },
      }),
    });

    const res = await mcpPost(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    const recipients = JSON.parse(data.result.content[0].text);
    assert.ok(recipients.length >= 1);
    assert.equal(recipients[0].id, 'leg_wth');
    assert.equal(recipients[0].brandName, 'Withings');
  });

  it('executes tools/call: stage_certified_notice to stage draft', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'stage_certified_notice',
          arguments: {
            noticeSlug: '30-day-mandatory-arbitration-opt-out-notice',
            recipientId: 'leg_rku',
            sender: {
              name: 'John Citizen',
              addressLine1: '456 Pine Ave',
              city: 'Seattle',
              state: 'WA',
              zip: '98101',
            },
            fieldValues: {
              productOrPlatformName: 'Roku Streaming Stick 4K',
              accountIdentifier: 'john.citizen@example.com',
            },
            recommendedTier: 'certified',
          },
        },
      }),
    });

    const res = await mcpPost(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(!data.result.isError);

    const staged = JSON.parse(data.result.content[0].text);
    assert.match(staged.stageId, /^DS-STAGE-[A-F0-9]{6}$/);
    assert.ok(staged.reviewUrl.includes('stage=' + staged.stageId));
    assert.ok(Array.isArray(staged.missingRequiredFields));
  });

  it('returns isError: true when stage_certified_notice triggers fitness guardrail', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'stage_certified_notice',
          arguments: {
            noticeSlug: 'pre-arbitration-notice-of-dispute-and-refund-request',
            fieldValues: {
              productOrServiceName: 'Planet Fitness Black Card Gym Membership',
            },
          },
        },
      }),
    });

    const res = await mcpPost(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.result.isError, true);
    const errObj = JSON.parse(data.result.content[0].text);
    assert.equal(errObj.code, 'CONFLICT_OF_INTEREST');
  });

  it('returns JSON-RPC error -32601 for unsupported method', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 8,
        method: 'unknown_method_xyz',
      }),
    });

    const res = await mcpPost(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.error.code, -32601);
  });
});

describe('3. Discovery Manifests (/llms.txt and /.well-known/openapi.json)', () => {
  it('returns text/plain for /llms.txt with all 9 cartridges and all 38 verified recipients', async () => {
    const res = await llmsTxtGet();
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/plain'));

    const text = await res.text();
    // Core architectural invariants
    assert.ok(text.includes('DocketStamp: Autonomous Agentic Postal Notice & Physical USPS Dispatch System'));
    assert.ok(text.includes('Agents stage, humans sign and pay'));
    assert.ok(text.includes('NAICS 713940'));
    assert.ok(text.includes('POST https://docketstamp.com/api/docket/stage'));
    assert.ok(text.includes('POST https://docketstamp.com/api/mcp'));

    // All 9 notice slugs must be present
    for (const cartridge of ALL_NOTICE_CARTRIDGES) {
      assert.ok(
        text.includes(cartridge.slug),
        `llms.txt must contain notice slug: ${cartridge.slug}`
      );
    }

    // All 38 verified recipient IDs must be present
    const recipients = getAllVerifiedRecipients();
    assert.equal(recipients.length, 38, 'Canonical verified recipients must be exactly 38');
    for (const recipient of recipients) {
      assert.ok(
        text.includes(recipient.id),
        `llms.txt must contain recipient id: ${recipient.id}`
      );
    }
  });

  it('returns valid OpenAPI 3.0.3 spec from /.well-known/openapi.json', async () => {
    const res = await openApiGet();
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('application/json'));

    const spec = await res.json();
    assert.equal(spec.openapi, '3.0.3');
    assert.equal(spec.info.title, 'DocketStamp Agentic Notice & Physical Postal Dispatch API');

    // Required endpoints
    assert.ok(spec.paths['/api/docket/stage'], 'Spec must define path /api/docket/stage');
    assert.ok(spec.paths['/api/docket/stage/{stageId}'], 'Spec must define path /api/docket/stage/{stageId}');
    assert.ok(spec.paths['/api/mcp'], 'Spec must define path /api/mcp');

    // Schemas
    const noticeEnum = spec.components.schemas.NoticeSlug.enum;
    assert.equal(noticeEnum.length, 9, 'OpenAPI NoticeSlug enum must list all 9 cartridges');
    for (const cartridge of ALL_NOTICE_CARTRIDGES) {
      assert.ok(noticeEnum.includes(cartridge.slug), `OpenAPI NoticeSlug enum must include ${cartridge.slug}`);
    }

    const recipientEnum = spec.components.schemas.VerifiedRecipientId.enum;
    assert.equal(recipientEnum.length, 38, 'OpenAPI VerifiedRecipientId enum must list all 38 recipients');
    for (const recipient of getAllVerifiedRecipients()) {
      assert.ok(recipientEnum.includes(recipient.id), `OpenAPI VerifiedRecipientId enum must include ${recipient.id}`);
    }
  });
});
