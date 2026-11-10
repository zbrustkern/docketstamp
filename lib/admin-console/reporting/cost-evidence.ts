import crypto from 'node:crypto';
import { z } from 'zod';
import { PILOT_KEY } from '@/lib/acquisition';

/** Operator-reviewed amounts only. No credentials, customer fields or document URLs. */
export const CostEvidenceSchema = z.object({
  kind: z.enum(['supplier','processor','spend']),
  orderId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
  campaignKey: z.literal(PILOT_KEY).optional(),
  amountMinor: z.number().int().nonnegative().safe(), currency: z.literal('USD'),
  effectiveAt: z.string().datetime(), sourceRef: z.string().regex(/^[A-Za-z0-9_.:-]{1,160}$/),
  authority: z.enum(['actual','estimated']), coverage: z.enum(['complete','partial']),
  coverageStartUtc: z.string().datetime().optional(), coverageEndUtc: z.string().datetime().optional(),
}).strict().superRefine((v,ctx)=>{
  if (v.kind === 'spend') {
    if (!v.campaignKey || v.orderId || !v.coverageStartUtc || !v.coverageEndUtc || Date.parse(v.coverageStartUtc) >= Date.parse(v.coverageEndUtc) || v.effectiveAt !== v.coverageStartUtc) ctx.addIssue({code:'custom',message:'Spend requires campaign, a nonempty coverage interval, and effectiveAt equal to its start.'});
  } else if (!v.orderId || v.campaignKey || v.coverageStartUtc || v.coverageEndUtc) ctx.addIssue({code:'custom',message:'Order cost requires orderId, without campaign or interval.'});
});
export function costEvidenceId(row: z.infer<typeof CostEvidenceSchema>, environment: string) {
  return crypto.createHash('sha256').update(JSON.stringify([environment,row.kind,row.orderId || row.campaignKey,row.kind === 'spend' ? row.coverageStartUtc : row.sourceRef])).digest('hex');
}
