import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateTemplateAvailability, PublicTemplateAvailability } from '../src/lib/docket/template-policy';

const base: PublicTemplateAvailability = {
  slug: 'tenant-repair-request', title: 'Repair', category: 'tenant', contentDigest: 'a'.repeat(64),
  available: true, reasonCode: null, reason: null, requiresResidence: false, requiresProperty: false,
  residenceRules: [{ mode: 'all', states: [] }], propertyRules: [],
};

test('all-mode is available without location but rejects malformed supplied residence', () => {
  assert.equal(evaluateTemplateAvailability(base, {}).allowed, true);
  assert.equal(evaluateTemplateAvailability(base, { consumerResidenceState: 'ZZ' }).code, 'INVALID_LOCATION');
  assert.equal(evaluateTemplateAvailability(base, { consumerResidenceState: 3 as unknown as string }).code, 'INVALID_LOCATION');
});

test('restricted rules request both explicit residence and property and intersect allowlists', () => {
  const restricted = {
    ...base,
    requiresResidence: true,
    requiresProperty: true,
    residenceRules: [{ mode: 'allowlist' as const, states: ['CA', 'NY'] }, { mode: 'blocklist' as const, states: ['NY'] }],
    propertyRules: [{ mode: 'allowlist' as const, states: ['CA'] }],
  };
  const missing = evaluateTemplateAvailability(restricted, {});
  assert.equal(missing.code, 'LOCATION_REQUIRED');
  assert.deepEqual(missing.requiredFields, ['consumerResidenceState', 'propertyState']);
  assert.equal(evaluateTemplateAvailability(restricted, { consumerResidenceState: 'NY', propertyState: 'CA' }).code, 'LOCATION_UNAVAILABLE');
  assert.equal(evaluateTemplateAvailability(restricted, { consumerResidenceState: 'CA', propertyState: 'CA' }).allowed, true);
});

test('unavailable decision wins before location and empty allowlist denies every state', () => {
  assert.equal(evaluateTemplateAvailability({ ...base, available: false, reasonCode: 'TEMPLATE_ON_HOLD', reason: 'This notice is not currently available.' }, {}).code, 'TEMPLATE_ON_HOLD');
  const empty = { ...base, residenceRules: [{ mode: 'allowlist' as const, states: [] }] };
  assert.equal(evaluateTemplateAvailability(empty, {}).code, 'LOCATION_UNAVAILABLE');
  assert.equal(evaluateTemplateAvailability(empty, { consumerResidenceState: 'CA' }).code, 'LOCATION_UNAVAILABLE');
});
