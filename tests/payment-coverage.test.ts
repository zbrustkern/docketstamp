import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentCoverageFromRuns } from '../lib/admin-console/finance/coverage';

const input = { environment: 'production', accountId: 'acct_fixture', startUtc: '2026-11-01T00:00:00Z', endUtc: '2026-11-02T00:00:00Z', asOf: '2026-11-03T00:00:00Z', scanComplete: true };
const base = { product: 'docketstamp', environment: 'production', provider: 'stripe', providerAccountId: 'acct_fixture', providerMode: 'live', windowStartSeconds: Date.parse(input.startUtc)/1000, windowEndSeconds: Date.parse(input.endUtc)/1000, startedAt: '2026-11-02T01:00:00Z', endedAt: '2026-11-02T01:01:00Z', counts: {unmatched: 0, quarantined: 0, fetched: 0} };
test('only a fully traversed provider window proves zero-payment coverage', () => {
  assert.equal(paymentCoverageFromRuns([{...base, status:'complete', startingAfter:null, nextCursor:null}],input).complete,true);
  const fractional = paymentCoverageFromRuns([{...base,status:'complete'}], {...input,endUtc:'2026-11-02T00:00:00.999Z'});
  assert.equal(fractional.complete,true);
  assert.equal(fractional.watermark,'2026-11-02T00:00:00.000Z');
  assert.equal(paymentCoverageFromRuns([{...base,status:'complete',startingAfter:'page1'}],input).complete,false);
  const first={...base,status:'partial',nextCursor:'page1'};
  const last={...base,status:'complete',startingAfter:'page1',startedAt:'2026-11-02T01:02:00Z',endedAt:'2026-11-02T01:03:00Z'};
  assert.equal(paymentCoverageFromRuns([first,last],input).complete,true);
  assert.equal(paymentCoverageFromRuns([{...first,counts:{unmatched:1,quarantined:0}},last],input).complete,false);
});
test('wrong mode/account, future evidence, gaps and truncated scans fail closed', () => {
  const row={...base,status:'complete'};
  for(const change of [{providerMode:'test'},{providerAccountId:'other'},{endedAt:'2026-11-04T00:00:00Z'},{windowStartSeconds:base.windowStartSeconds+1},{counts:{unmatched:0,quarantined:1}}]) {
    assert.equal(paymentCoverageFromRuns([{...row,...change}],input).complete,false);
  }
  assert.equal(paymentCoverageFromRuns([row],{...input,scanComplete:false}).complete,false);
  assert.equal(paymentCoverageFromRuns([],input).complete,false);
});
