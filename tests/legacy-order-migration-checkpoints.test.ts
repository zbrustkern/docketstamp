import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLegacyOrderMigration } from '../lib/legacy-order-migration';

const records = [
  { id: 'a', handwryttenOrderId: 'historical-only', customerEmail: 'private@example.test', documentHtml: '<p>immutable</p>' },
  { id: 'b', lobLetterId: 'ltr_explicit' },
];

test('checkpoints bind to an unchanged source inventory and run identity', () => {
  const source = JSON.stringify(records);
  const first = planLegacyOrderMigration({ records, runId: 'fixture-run', batchSize: 1 });
  assert.equal(first.checkpoint.complete, false);
  const done = planLegacyOrderMigration({ records: [...records].reverse(), runId: 'fixture-run', priorManifest: first, batchSize: 1 });
  assert.equal(done.checkpoint.complete, true);
  assert.equal(done.changes.length, 2);
  assert.equal(JSON.stringify(records), source);
  assert.doesNotMatch(JSON.stringify(done), /private@example|immutable/);
  assert.throws(() => planLegacyOrderMigration({ records, runId: 'different-run', priorManifest: first }), /SOURCE_MISMATCH/);
  assert.throws(() => planLegacyOrderMigration({ records: records.map((r, i) => i ? r : { ...r, documentHtml: 'changed' }), runId: 'fixture-run', priorManifest: first }), /SOURCE_MISMATCH/);
});

test('ambiguous IDs, invalid batches and unknown resume IDs cannot silently skip inventory records', () => {
  assert.throws(() => planLegacyOrderMigration({ records: [...records, records[0]], runId: 'fixture' }), /DUPLICATE_RECORD_ID/);
  assert.throws(() => planLegacyOrderMigration({ records: [{}], runId: 'fixture' }), /RECORD_ID_REQUIRED/);
  for (const batchSize of [0, -1, 2.5, NaN, Infinity, 501]) {
    assert.throws(() => planLegacyOrderMigration({ records, runId: 'fixture', batchSize }), /BATCH_SIZE_INVALID/);
  }
  assert.throws(() => planLegacyOrderMigration({ records, runId: 'fixture', afterOrderId: 'unknown' }), /CHECKPOINT_ID_UNKNOWN/);
});

 test('resume cannot override saved cursor to skip an inventory record', () => {
 const inventory = [...records, { id: 'c', lobLetterId: 'ltr_c' }];
 const first = planLegacyOrderMigration({ records: inventory, runId: 'cursor', batchSize: 1 });
 assert.throws(() => planLegacyOrderMigration({ records: inventory, runId: 'cursor', priorManifest: first, afterOrderId: 'b' }), /CURSOR_MISMATCH/);
 const done = planLegacyOrderMigration({ records: inventory, runId: 'cursor', priorManifest: first });
 assert.deepEqual(done.processedOrderIds, ['a', 'b', 'c']);
 assert.equal(done.checkpoint.complete, true);
});
