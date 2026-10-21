import assert from 'node:assert/strict';
import { test } from 'node:test';

test('versioned template policy defaults, review freshness, CAS/idempotency, and atomic stage gate', async () => {
  Object.assign(process.env, { NODE_ENV: 'test', USE_MOCK_FIRESTORE: 'true', ENVIRONMENT: 'staging' });
  const [{ firestoreDb }, policy] = await Promise.all([
    import('../lib/firebase-admin'),
    import('../lib/template-policy-store'),
  ]);
  const ref = firestoreDb.collection('template_availability_v1').doc('policy_staging');
  await ref.delete();
  const initial = await policy.getPolicyDocument();
  assert.equal(initial.revision, 0);
  assert.equal(Object.keys(initial.templates).length, 9);
  assert.equal(initial.templates[initial.templates && Object.keys(initial.templates)[0]].enabled, true);

  const slug = 'written-contract-and-policy-cancellation-letter';
  const notice = (await import('../src/lib/docket/notices')).getNoticeBySlug(slug)!;
  const contentDigest = policy.getNoticeContentDigest(notice);
  const runId = Date.now().toString();
  const preRestrictionStageId = `DS-STAGE-PRE-RESTRICTION-${runId}`;
  const preRestrictionStage = await policy.createStagedDraftUnderPolicy({
    stageId: preRestrictionStageId, noticeSlug: slug, fieldValues: {},
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  }, slug, {});
  assert.equal(preRestrictionStage.ok, true);
  const settings: import('../src/lib/docket/template-policy').TemplateSettings = {
    enabled: true, requireCurrentReview: true,
    residence: { mode: 'allowlist' as const, states: ['CA'] },
    property: { mode: 'all' as const, states: [] },
    sources: [{ kind: 'original' as const, title: 'Original deterministic template', url: '', jurisdiction: 'United States', retrievedAt: '', reuseStatus: 'unverified' as const, notes: '' }],
  };
  const mutation = {
    action: 'set_template' as const, requestId: `policy-test-0001-${runId}`, reason: 'Exercise current review requirement.',
    expectedRevision: 0, slug, expectedContentDigest: contentDigest, settings,
  };
  const saved = await policy.commitTemplateMutation('owner@example.test', mutation);
  assert.equal(saved.revision, 1);
  assert.equal((await policy.commitTemplateMutation('owner@example.test', mutation)).duplicate, true);
  await assert.rejects(() => policy.commitTemplateMutation('owner@example.test', { ...mutation, reason: 'different payload' }), /REQUEST_ID_CONFLICT/);
  assert.equal((await policy.getPolicyDocument()).revision, 1);
  assert.equal((await policy.checkTemplateAvailability(slug, { consumerResidenceState: 'CA' })).decision.code, 'REVIEW_REQUIRED');
  assert.equal((await policy.checkTemplateAvailability(slug, { consumerResidenceState: 'TX' })).decision.code, 'REVIEW_REQUIRED');

  const reviewMutation = {
    ...mutation, requestId: `policy-test-0002-${runId}`, expectedRevision: 1,
    review: { status: 'approved' as const, reviewer: 'operator@example.test', reviewBy: new Date(Date.now() + 86400000).toISOString(), evidenceUrl: 'https://example.test/review', notes: 'Operator-recorded review fixture.' },
  };
  assert.equal((await policy.commitTemplateMutation('owner@example.test', reviewMutation)).revision, 2);
  assert.equal((await policy.checkTemplateAvailability(slug, { consumerResidenceState: 'CA' })).decision.allowed, true);
  assert.equal((await policy.checkTemplateAvailability(slug, { consumerResidenceState: 'TX' })).decision.code, 'LOCATION_UNAVAILABLE');
  await assert.rejects(() => policy.commitTemplateMutation('owner@example.test', { ...reviewMutation, requestId: `policy-test-0003-${runId}`, expectedRevision: 1 }), /STALE_REVISION/);
  await assert.rejects(() => policy.commitTemplateMutation('owner@example.test', { ...reviewMutation, requestId: `policy-test-0004-${runId}`, expectedRevision: 2, expectedContentDigest: '0'.repeat(64) }), /STALE_CONTENT_DIGEST/);

  const deniedStage = await policy.createStagedDraftUnderPolicy({ stageId: 'DS-STAGE-POLICY-DENY', expiresAt: new Date(Date.now() + 3600000).toISOString() }, slug, {});
  assert.equal(deniedStage.ok, false);
  assert.equal((await firestoreDb.collection('staged_drafts_v1').doc('DS-STAGE-POLICY-DENY').get()).exists, false);
  const allowedStage = await policy.createStagedDraftUnderPolicy({ stageId: 'DS-STAGE-POLICY-ALLOW', expiresAt: new Date(Date.now() + 3600000).toISOString() }, slug, { consumerResidenceState: 'CA' });
  assert.equal(allowedStage.ok, true);
  assert.equal((await firestoreDb.collection('staged_drafts_v1').doc('DS-STAGE-POLICY-ALLOW').get()).data()?.policyRevision, 2);

  const { retrieveStagedDraft } = await import('../app/api/docket/stage/stage-store');
  const hydrated = await retrieveStagedDraft(preRestrictionStageId, { consumerResidenceState: 'CA' });
  assert.equal(hydrated.ok, true);
  assert.equal(hydrated.ok && hydrated.draft.fieldValues.consumerResidenceState, 'CA');
  assert.equal((await firestoreDb.collection('staged_drafts_v1').doc(preRestrictionStageId).get()).data()?.fieldValues?.consumerResidenceState, undefined);
  const oldStageId = `DS-STAGE-OLD-${runId}`;
  await firestoreDb.collection('staged_drafts_v1').doc(oldStageId).set({
    stageId: oldStageId, noticeSlug: slug, fieldValues: {}, createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  assert.equal((await retrieveStagedDraft(oldStageId)).code, 'LOCATION_REQUIRED');
  const resumed = await retrieveStagedDraft(oldStageId, { consumerResidenceState: 'CA' });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.ok && resumed.draft.policyNexus?.consumerResidenceState, 'CA');
  assert.equal((await retrieveStagedDraft(oldStageId, { consumerResidenceState: 'ZZ' })).code, 'INVALID_LOCATION');

  const depositStageId = `DS-STAGE-DEPOSIT-${runId}`;
  await firestoreDb.collection('staged_drafts_v1').doc(depositStageId).set({
    stageId: depositStageId, noticeSlug: 'security-deposit-return-demand-letter',
    fieldValues: { propertyState: 'TX' }, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  assert.equal((await retrieveStagedDraft(depositStageId, { propertyState: 'CA' })).code, 'PROPERTY_STATE_CONFLICT');

  const beforePauseId = `DS-STAGE-BEFORE-PAUSE-${runId}`;
  const beforePause = await policy.createStagedDraftUnderPolicy({ stageId: beforePauseId, expiresAt: new Date(Date.now() + 3600000).toISOString() }, slug, { consumerResidenceState: 'CA' });
  assert.equal(beforePause.ok, true);
  const pause = await policy.commitTemplateMutation('owner@example.test', {
    action: 'set_global', requestId: `policy-test-pause-${runId}`, reason: 'Exercise the serialized stage/pause cutoff.', expectedRevision: 2,
    global: { enabled: false, requireCurrentReview: false, residence: { mode: 'all', states: [] }, property: { mode: 'all', states: [] } },
  });
  assert.equal(pause.revision, 3);
  assert.equal((await firestoreDb.collection('staged_drafts_v1').doc(beforePauseId).get()).data()?.policyRevision, 2);
  const afterPause = await policy.createStagedDraftUnderPolicy({ stageId: `DS-STAGE-AFTER-PAUSE-${runId}`, expiresAt: new Date(Date.now() + 3600000).toISOString() }, slug, { consumerResidenceState: 'CA' });
  assert.equal(afterPause.ok, false);
  assert.equal(afterPause.ok ? '' : afterPause.decision.code, 'TEMPLATE_UNAVAILABLE');
  console.log('Template policy defaults, review gating, transaction CAS/idempotency and stage cutoff passed. This uses the local mock, not emulator evidence.');
});
