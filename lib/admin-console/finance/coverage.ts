import { firestoreDb } from '@/lib/firebase-admin';

type Run = {
  product?: string; environment?: string; provider?: string; providerAccountId?: string;
  providerMode?: string; status?: string; windowStartSeconds?: number; windowEndSeconds?: number;
  startingAfter?: string | null; nextCursor?: string | null; startedAt?: string; endedAt?: string;
  counts?: { unmatched?: number; quarantined?: number; fetched?: number };
};
export type PaymentCoverage = { complete: boolean; watermark: string | null; reason: string };

/** A final page alone does not prove coverage: every preceding cursor must exist. */
export function paymentCoverageFromRuns(runs: Run[], input: {
  environment: string; accountId: string; startUtc: string; endUtc: string; asOf: string;
  scanComplete: boolean;
}): PaymentCoverage {
  const missing = (reason: string): PaymentCoverage => ({ complete: false, watermark: null, reason });
  // Stripe event windows use whole seconds. Fractional projection timestamps do
  // not imply that another provider page exists within that same second.
  const start = Math.floor(Date.parse(input.startUtc) / 1000), end = Math.floor(Date.parse(input.endUtc) / 1000);
  const asOf = Date.parse(input.asOf);
  if (!input.scanComplete) return missing('RECONCILIATION_SCAN_INCOMPLETE');
  if (![start, end, asOf].every(Number.isFinite) || start >= end || end * 1000 > asOf) return missing('RECONCILIATION_WINDOW_INVALID');
  const mode = input.environment === 'production' ? 'live' : input.environment === 'staging' ? 'test' : 'unknown';
  if (mode === 'unknown') return missing('RECONCILIATION_MODE_UNKNOWN');
  const eligible = runs.filter(r => r.product === 'docketstamp' && r.environment === input.environment &&
    r.provider === 'stripe' && r.providerAccountId === input.accountId && r.providerMode === mode &&
    ['partial', 'complete'].includes(r.status || '') && Number.isInteger(r.windowStartSeconds) &&
    Number.isInteger(r.windowEndSeconds) && r.windowStartSeconds! < r.windowEndSeconds! &&
    Number.isFinite(Date.parse(r.startedAt || '')) && Number.isFinite(Date.parse(r.endedAt || '')) &&
    Date.parse(r.startedAt!) <= Date.parse(r.endedAt!) && Date.parse(r.endedAt!) <= asOf &&
    r.counts?.unmatched === 0 && r.counts?.quarantined === 0);
  const intervals: Array<{ start: number; end: number; at: string }> = [];
  for (const first of eligible.filter(r => !r.startingAfter)) {
    const chain = new Set<Run>(); let row: Run | undefined = first;
    while (row && !chain.has(row)) {
      chain.add(row);
      if (row.status === 'complete' && !row.nextCursor) {
        intervals.push({ start: first.windowStartSeconds!, end: first.windowEndSeconds!, at: row.endedAt! });
        break;
      }
      if (row.status !== 'partial' || !row.nextCursor) break;
      const current: Run = row;
      row = eligible.filter(r => r !== current && r.startingAfter === current.nextCursor &&
        r.windowStartSeconds === first.windowStartSeconds && r.windowEndSeconds === first.windowEndSeconds &&
        Date.parse(r.startedAt!) >= Date.parse(current.endedAt!))
        .sort((a, b) => Date.parse(b.endedAt!) - Date.parse(a.endedAt!))[0];
    }
  }
  let covered = start; let watermark: string | null = null;
  for (const interval of intervals.sort((a, b) => a.start - b.start)) {
    if (interval.end <= covered) continue;
    if (interval.start > covered) break;
    covered = interval.end;
    // A scan's completion time is not the timestamp through which it read data.
    watermark = new Date(covered * 1000).toISOString();
    if (covered >= end) return { complete: true, watermark, reason: 'PROVIDER_WINDOW_RECONCILED' };
  }
  return { complete: false, watermark, reason: 'PROVIDER_RECONCILIATION_INCOMPLETE' };
}

export async function readPaymentCoverage(environment: string, startUtc: string, endUtc: string, asOf: string): Promise<PaymentCoverage> {
  try {
    // Read one bounded window. Checkpoints lack a starting page and are excluded below.
    const snapshot = await firestoreDb.collection('reconciliation_runs_v1').where('environment', '==', environment).limit(1001).get();
    const runs = snapshot.docs.filter(d => !d.id.startsWith('checkpoint_')).map(d => d.data() as Run);
    return paymentCoverageFromRuns(runs, { environment, accountId: process.env.STRIPE_ACCOUNT_ID || 'stripe_platform_default', startUtc, endUtc, asOf, scanComplete: snapshot.docs.length < 1001 });
  } catch { return { complete: false, watermark: null, reason: 'PROVIDER_RECONCILIATION_UNAVAILABLE' }; }
}
