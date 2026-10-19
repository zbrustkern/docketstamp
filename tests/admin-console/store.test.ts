import assert from 'node:assert/strict';
import { firestoreDb, isFirestoreMock } from '../../lib/firebase-admin';

async function run() {
  assert.equal(isFirestoreMock, true);
  const col = firestoreDb.collection('offline_store_checks');
  await col.doc('a').set({ id: 'a', group: 'x', value: 1 });
  await col.doc('b').set({ id: 'b', group: 'y', value: 2 });
  await col.doc('c').set({ id: 'c', group: 'x', value: 3 });
  const result = await col.where('group', '==', 'x').where('value', '>=', 2).orderBy('value').limit(1).get();
  assert.deepEqual(result.docs.map(d => d.id), ['c']);
  const page = await col.orderBy('id').startAfter('a').limit(1).get();
  assert.deepEqual(page.docs.map(d => d.id), ['b']);
  await assert.rejects(firestoreDb.runTransaction(async tx => {
    tx.set(col.doc('rollback'), { value: 10 });
    throw new Error('crash before commit');
  }), /crash/);
  assert.equal((await col.doc('rollback').get()).exists, false);
  await col.doc('counter').set({ n: 0 });
  await Promise.all(Array.from({ length: 20 }, () => firestoreDb.runTransaction(async tx => {
    const snap = await tx.get(col.doc('counter'));
    tx.update(col.doc('counter'), { n: snap.data()!.n + 1 });
  })));
  assert.equal((await col.doc('counter').get()).data()!.n, 20);
  console.log('Mock transaction rollback, concurrency and composable query tests passed. This is not emulator evidence.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
