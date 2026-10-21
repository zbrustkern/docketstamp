import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchTemplateAvailability, isPublicAvailability } from '../src/lib/docket/availability-client';
import { checkoutErrorMessage, isTemplateAvailabilityError } from '../src/lib/docket/checkout-errors';
import { resolveInitialWorkspaceDraft } from '../src/lib/docket/draft-recovery';
import { getNoticeBySlug } from '../src/lib/docket/notices';

const payload = { revision: 2, templates: [{
  slug: 'security-deposit-return-demand-letter', title: 'Demand your security deposit back', category: 'tenant', contentDigest: 'a'.repeat(64),
  available: true, reason: null, reasonCode: null, requiresResidence: true, requiresProperty: true,
  residenceRules: [{ mode: 'blocklist', states: ['NC'] }], propertyRules: [{ mode: 'allowlist', states: ['CA'] }],
}] };

test('browser availability fetch avoids caches and rejects errors or malformed policy', async () => {
  assert.ok(isPublicAvailability(payload));
  let cache: unknown;
  const fetcher = (async (_url: unknown, init: RequestInit) => { cache = init.cache; return Response.json(payload); }) as typeof fetch;
  assert.deepEqual(await fetchTemplateAvailability(fetcher), payload);
  assert.equal(cache, 'no-store');
  for (const bad of [null, {}, { ...payload, revision: -1 }, { ...payload, templates: [{ ...payload.templates[0], reason: {} }] },
    { ...payload, templates: [{ ...payload.templates[0], residenceRules: [{ mode: 'allowlist', states: ['ZZ'] }] }] }]) {
    assert.equal(isPublicAvailability(bad), false);
    await assert.rejects(fetchTemplateAvailability((async () => Response.json(bad)) as typeof fetch), /check letter availability/);
  }
  await assert.rejects(fetchTemplateAvailability((async () => new Response('private diagnostic', { status: 503 })) as typeof fetch), /check letter availability/);
});

test('URL hydration preserves explicit residence separately from mailing and property states', () => {
  const notice = getNoticeBySlug('security-deposit-return-demand-letter')!;
  const resolved = resolveInitialWorkspaceDraft({ notice, searchParams: new URLSearchParams('consumerResidenceState=IL&propertyState=CA&field.recipientState=NC&senderState=TX') });
  assert.equal(resolved.userValues.consumerResidenceState, 'IL');
  assert.equal(resolved.userValues.propertyState, 'CA');
  assert.equal(resolved.userValues.recipientState, 'NC');
  assert.equal(resolved.userValues.senderState, 'TX');
});

test('checkout policy denials give a corrective action without leaking server content', () => {
  for (const code of ['TEMPLATE_ON_HOLD', 'REVIEW_REQUIRED', 'LOCATION_UNAVAILABLE', 'TEMPLATE_UNAVAILABLE']) {
    assert.equal(isTemplateAvailabilityError(code), true);
    assert.match(checkoutErrorMessage(code, 'CHECKOUT_UNAVAILABLE'), /Close checkout/);
  }
  assert.match(checkoutErrorMessage('LOCATION_REQUIRED', 'CHECKOUT_UNAVAILABLE'), /update your location/);
  assert.equal(isTemplateAvailabilityError('private server notes'), false);
  assert.doesNotMatch(checkoutErrorMessage('private server notes', 'CHECKOUT_UNAVAILABLE'), /private server/);
});
