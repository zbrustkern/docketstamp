import assert from 'node:assert/strict';
import { test } from 'node:test';

test('review freshness, precedence, default projection, validation boundaries, and fail-closed reads', async () => {
  Object.assign(process.env, { NODE_ENV: 'test', USE_MOCK_FIRESTORE: 'true', ENVIRONMENT: 'staging' });
  const [{ firestoreDb }, policy, noticeModule] = await Promise.all([
    import('../lib/firebase-admin'),
    import('../lib/template-policy-store'),
    import('../src/lib/docket/notices'),
  ]);
  const policyRef = firestoreDb.collection('template_availability_v1').doc('policy_staging');
  await policyRef.delete();
  const runId = Date.now();
  try {
    const initial = await policy.getPolicyDocument();
    const slug = 'written-contract-and-policy-cancellation-letter';
    const notice = noticeModule.getNoticeBySlug(slug)!;
    const digest = policy.getNoticeContentDigest(notice);
    const { review: _initialReview, ...settings } = initial.templates[slug];

    // A missing policy entry projects through the future-template default and is paused.
    const missingEntry = { ...initial, templates: { ...initial.templates } };
    delete missingEntry.templates[slug];
    const missingProjection = policy.policyToPublicEntry(notice, missingEntry);
    assert.equal(missingProjection.available, false);
    assert.equal(missingProjection.reasonCode, 'TEMPLATE_UNAVAILABLE');

    await policyRef.set({ ...missingEntry, revision: 1 });
    assert.equal((await policy.getPublicTemplateAvailability()).templates.find(entry => entry.slug === slug)?.available, false,
      'a missing entry in persisted policy must not restore migration defaults');
    await policyRef.delete();

    const approvedMutation = {
      action: 'set_template' as const, requestId: `matrix-approved-${runId}`,
      reason: 'Exercise review freshness states.', expectedRevision: 0,
      slug, expectedContentDigest: digest,
      settings: { ...settings, requireCurrentReview: true },
      review: {
        status: 'approved' as const, reviewer: 'reviewer@example.test',
        reviewBy: new Date(Date.now() + 86400000).toISOString(),
        evidenceUrl: 'https://example.test/review-evidence', notes: 'Test review record.',
      },
    };
    assert.equal((await policy.commitTemplateMutation('owner@example.test', approvedMutation)).revision, 1);
    let publicEntry = (await policy.getPublicTemplateAvailability()).templates.find((entry) => entry.slug === slug)!;
    let adminEntry = (await policy.getAdminTemplatesResponse(true)).templates.find((entry) => entry.slug === slug)!;
    assert.equal(publicEntry.available, true);
    assert.equal(adminEntry.reviewCurrent, true);

    const stored = (await policyRef.get()).data() as import('../src/lib/docket/template-policy').TemplatePolicyDocument;
    const mutateReview = async (changes: Record<string, unknown>) => {
      const next = structuredClone((await policyRef.get()).data() as any);
      next.templates[slug].review = { ...next.templates[slug].review, ...changes };
      await policyRef.set(next);
    };
    assert.equal(stored.templates[slug].review.contentDigest, digest);

    await mutateReview({ reviewBy: new Date(Date.now() - 86400000).toISOString() });
    publicEntry = (await policy.getPublicTemplateAvailability()).templates.find((entry) => entry.slug === slug)!;
    assert.equal(publicEntry.reasonCode, 'REVIEW_REQUIRED');

    await mutateReview({
      reviewBy: new Date(Date.now() + 86400000).toISOString(),
      reviewedAt: new Date(Date.now() + 60000).toISOString(),
    });
    adminEntry = (await policy.getAdminTemplatesResponse(true)).templates.find((entry) => entry.slug === slug)!;
    assert.equal(adminEntry.reviewCurrent, false, 'a future review timestamp is not current');

    await mutateReview({ reviewedAt: new Date(Date.now() - 60000).toISOString(), contentDigest: '0'.repeat(64) });
    publicEntry = (await policy.getPublicTemplateAvailability()).templates.find((entry) => entry.slug === slug)!;
    assert.equal(publicEntry.reasonCode, 'REVIEW_REQUIRED', 'a review for an older content digest is stale');

    const hold = await policy.commitTemplateMutation('owner@example.test', {
      action: 'set_template', requestId: `matrix-hold-${runId}`, reason: 'Exercise hold precedence.',
      expectedRevision: 1, slug, expectedContentDigest: digest,
      settings: { ...settings, requireCurrentReview: true },
      review: { status: 'hold', reviewer: 'reviewer@example.test', reviewBy: null, evidenceUrl: '', notes: 'Held for review.' },
    });
    assert.equal(hold.revision, 2);
    const requireReview = await policy.commitTemplateMutation('owner@example.test', {
      action: 'set_global', requestId: `matrix-global-review-${runId}`, reason: 'Require current review globally.', expectedRevision: 2,
      global: { ...initial.global, requireCurrentReview: true },
    });
    assert.equal(requireReview.revision, 3);
    publicEntry = (await policy.getPublicTemplateAvailability()).templates.find((entry) => entry.slug === slug)!;
    assert.equal(publicEntry.reasonCode, 'TEMPLATE_ON_HOLD', 'hold takes precedence over review-required');

    const clearHold = await policy.commitTemplateMutation('owner@example.test', {
      action: 'set_template', requestId: `matrix-clear-hold-${runId}`, reason: 'Clear hold to test global review requirement.',
      expectedRevision: 3, slug, expectedContentDigest: digest,
      settings: { ...settings, requireCurrentReview: false },
      review: { status: 'unreviewed', reviewer: '', reviewBy: null, evidenceUrl: '', notes: '' },
    });
    assert.equal(clearHold.revision, 4);
    publicEntry = (await policy.getPublicTemplateAvailability()).templates.find((entry) => entry.slug === slug)!;
    assert.equal(publicEntry.reasonCode, 'REVIEW_REQUIRED', 'global review requirement applies to unreviewed templates');

    const pause = await policy.commitTemplateMutation('owner@example.test', {
      action: 'set_global', requestId: `matrix-global-pause-${runId}`, reason: 'Exercise global pause precedence.', expectedRevision: 4,
      global: { ...initial.global, enabled: false, requireCurrentReview: true },
    });
    assert.equal(pause.revision, 5);
    publicEntry = (await policy.getPublicTemplateAvailability()).templates.find((entry) => entry.slug === slug)!;
    assert.equal(publicEntry.reasonCode, 'TEMPLATE_UNAVAILABLE', 'global pause takes precedence over review state');

    const baseMutation = {
      action: 'set_template' as const, requestId: `matrix-validation-${runId}`,
      reason: 'Test mutation validation.', expectedRevision: 5,
      slug, expectedContentDigest: digest, settings,
    };
    const originalSource = settings.sources[0];
    assert.equal(policy.templateMutationSchema.safeParse({
      ...baseMutation,
      settings: { ...settings, sources: [{ ...originalSource, url: 'javascript:alert(1)' }] },
    }).success, false, 'source URLs must be HTTP(S)');
    assert.equal(policy.templateMutationSchema.safeParse({
      ...baseMutation,
      settings: { ...settings, sources: [{ ...originalSource, internalOnly: true }] },
    }).success, false, 'source records reject unknown properties');
    const structurallyValidButUnapproved = {
      ...baseMutation,
      review: {
        status: 'approved' as const, reviewer: '', reviewBy: new Date(Date.now() + 86400000).toISOString(),
        evidenceUrl: 'https://example.test/evidence', notes: '',
      },
    };
    assert.equal(policy.templateMutationSchema.safeParse(structurallyValidButUnapproved).success, true);
    assert.equal(policy.templateMutationSchema.safeParse({ ...structurallyValidButUnapproved, review: {
      ...structurallyValidButUnapproved.review, reviewBy: '2027-02-31',
    } }).success, false, 'rollover calendar dates are rejected');
    await assert.rejects(
      () => policy.commitTemplateMutation('owner@example.test', structurallyValidButUnapproved),
      /APPROVAL_REVIEW_INVALID/,
      'approval requires a named reviewer even when the payload shape is otherwise valid',
    );
    assert.equal(policy.templateMutationSchema.safeParse({
      ...baseMutation,
      review: {
        status: 'approved', reviewer: 'reviewer@example.test', reviewBy: new Date(Date.now() + 86400000).toISOString(),
        evidenceUrl: 'file:///private/review', notes: '',
      },
    }).success, false, 'approval evidence URL must use HTTP(S)');

    // Malformed persisted policy state fails public availability and stage creation closed.
    await policyRef.set({ poisoned: 'internal datastore diagnostic fixture' });
    const { GET: availabilityGet } = await import('../app/api/docket/availability/route');
    const unavailable = await availabilityGet();
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).code, 'AVAILABILITY_UNAVAILABLE');
    const { createStagedDraft } = await import('../app/api/docket/stage/stage-store');
    const existingStages = (await firestoreDb.collection('staged_drafts_v1').where('noticeSlug', '==', slug).get()).size;
    const stage = await createStagedDraft({ noticeSlug: slug, fieldValues: {} });
    assert.equal(stage.success, false);
    assert.equal(stage.success ? '' : stage.code, 'STORAGE_UNAVAILABLE');
    assert.equal((await firestoreDb.collection('staged_drafts_v1').where('noticeSlug', '==', slug).get()).size, existingStages);
  } finally {
    await policyRef.delete();
  }
});
