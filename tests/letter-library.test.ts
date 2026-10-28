import test from 'node:test';
import assert from 'node:assert/strict';
import { getNoticeBySlug } from '../src/lib/docket/notices';
import { resolveInitialWorkspaceDraft } from '../src/lib/docket/draft-recovery';
import { evaluateTemplateAvailability, type PublicAvailabilityResponse } from '../src/lib/docket/template-policy';
import {
  buildCancellationStartingPointUrl,
  CANCELLATION_STARTING_POINTS,
  getAvailableLibraryLetters,
} from '../src/lib/docket/letter-library';
import { CHOOSER_LETTERS } from '../src/lib/docket/chooser-routing';

const cancellation = getNoticeBySlug('service-cancellation-request')!;

function availability(slugs: Array<[string, boolean]>): PublicAvailabilityResponse {
  return {
    revision: 1,
    templates: slugs.map(([slug, available]) => ({
      slug,
      title: slug,
      category: 'cancellation',
      contentDigest: 'a'.repeat(64),
      available,
      reasonCode: available ? null : 'TEMPLATE_UNAVAILABLE',
      reason: available ? null : 'This notice is not currently available.',
      requiresResidence: false,
      requiresProperty: false,
      residenceRules: [{ mode: 'all', states: [] }],
      propertyRules: [],
    })),
  };
}

test('cancellation starting points exactly mirror the current field options', () => {
  const field = cancellation.fields.find((item) => item.key === 'serviceTypeLabel');
  assert.ok(field?.options);
  assert.deepEqual(CANCELLATION_STARTING_POINTS, field.options);
  assert.equal(CANCELLATION_STARTING_POINTS.length, 6);
});

test('each allowed preset URL contains only the exact serviceTypeLabel prefill', () => {
  for (const { value } of CANCELLATION_STARTING_POINTS) {
    const href = buildCancellationStartingPointUrl(value);
    assert.ok(href);
    const url = new URL(href, 'https://docketstamp.test');
    assert.equal(url.pathname, '/notices/service-cancellation-request');
    assert.deepEqual(Array.from(url.searchParams.keys()), ['field.serviceTypeLabel']);
    assert.equal(url.searchParams.get('field.serviceTypeLabel'), value);
  }
  assert.equal(buildCancellationStartingPointUrl('Gym membership'), null);
  assert.equal(buildCancellationStartingPointUrl(''), null);
});

test('preset query hydrates the existing editable cancellation select without selecting other data', () => {
  const { value } = CANCELLATION_STARTING_POINTS[0];
  const href = buildCancellationStartingPointUrl(value)!;
  const url = new URL(href, 'https://docketstamp.test');
  const draft = resolveInitialWorkspaceDraft({ notice: cancellation, searchParams: url.searchParams });

  assert.equal(draft.userValues.serviceTypeLabel, value);
  assert.equal(draft.explicitKeys.has('serviceTypeLabel'), true);
  assert.equal(draft.selectedRecipientId, null);
  assert.equal(draft.selectedTier, cancellation.recommendedTier);
  assert.deepEqual(cancellation.fields.find((field) => field.key === 'serviceTypeLabel')?.options?.map((option) => option.value).includes(draft.userValues.serviceTypeLabel), true);
});

test('library letters require an explicit canonical available policy entry', () => {
  const allAvailable = availability(CHOOSER_LETTERS.map(({ slug }) => [slug, true]));
  assert.deepEqual(getAvailableLibraryLetters(allAvailable).map(({ slug }) => slug), CHOOSER_LETTERS.map(({ slug }) => slug));

  const partial = availability([
    [CHOOSER_LETTERS[0].slug, true],
    [CHOOSER_LETTERS[1].slug, false],
    ['unrecognized-template', true],
  ]);
  assert.deepEqual(getAvailableLibraryLetters(partial).map(({ slug }) => slug), [CHOOSER_LETTERS[0].slug]);
  assert.deepEqual(getAvailableLibraryLetters(availability([])), []);
  assert.deepEqual(getAvailableLibraryLetters(null), []);
});

test('prefilled cancellation values remain subject to current workspace location rules', () => {
  const value = CANCELLATION_STARTING_POINTS[0].value;
  const draft = resolveInitialWorkspaceDraft({
    notice: cancellation,
    searchParams: new URL(buildCancellationStartingPointUrl(value)!, 'https://docketstamp.test').searchParams,
  });
  const policyEntry = {
    slug: cancellation.slug,
    title: cancellation.title,
    category: cancellation.category,
    contentDigest: 'a'.repeat(64),
    available: true,
    reasonCode: null,
    reason: null,
    requiresResidence: true,
    requiresProperty: false,
    residenceRules: [{ mode: 'allowlist' as const, states: ['CA'] }],
    propertyRules: [],
  };

  assert.equal(draft.userValues.serviceTypeLabel, value);
  assert.equal(evaluateTemplateAvailability(policyEntry, draft.userValues).code, 'LOCATION_REQUIRED');
  assert.equal(evaluateTemplateAvailability(policyEntry, { ...draft.userValues, consumerResidenceState: 'CA' }).allowed, true);
});
