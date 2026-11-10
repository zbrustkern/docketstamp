import crypto from 'node:crypto';
import { z } from 'zod';
import { CampaignKeySchema } from '@/lib/admin-console/advertising/campaigns';
import { getRegisteredCampaign } from '@/lib/admin-console/advertising/campaigns';
import { localDateKey, localMidnightUtc } from './scope';

/** Operator-reviewed amounts only. No credentials, customer fields or document URLs. */
export const CostEvidenceSchema = z.object({
  kind: z.enum(['supplier','processor','spend']),
  orderId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
  campaignKey: CampaignKeySchema.optional(),
  amountMinor: z.number().int().nonnegative().safe(), currency: z.literal('USD'),
  impressions: z.number().int().nonnegative().safe().optional(), clicks: z.number().int().nonnegative().safe().optional(),
  revision: z.number().int().positive().max(1000).default(1),
  effectiveAt: z.string().datetime(), sourceRef: z.string().regex(/^[A-Za-z0-9_.:-]{1,160}$/),
  authority: z.enum(['actual','estimated']), coverage: z.enum(['complete','partial']),
  coverageStartUtc: z.string().datetime().optional(), coverageEndUtc: z.string().datetime().optional(),
}).strict().superRefine((v,ctx)=>{
  if (v.kind === 'spend') {
    if (!v.campaignKey || v.orderId || !v.coverageStartUtc || !v.coverageEndUtc || Date.parse(v.coverageStartUtc) >= Date.parse(v.coverageEndUtc) || v.effectiveAt !== v.coverageStartUtc) ctx.addIssue({code:'custom',message:'Spend requires a registered campaign, a nonempty coverage interval, and effectiveAt equal to its start.'});
    if (v.clicks !== undefined && v.impressions !== undefined && v.clicks > v.impressions) ctx.addIssue({code:'custom',message:'Clicks cannot exceed impressions.'});
    const campaign=v.campaignKey?getRegisteredCampaign(v.campaignKey):null;
    if(campaign&&v.coverageStartUtc&&v.coverageEndUtc){
      const date=localDateKey(new Date(v.coverageStartUtc),campaign.timezone);
      const expectedStart=localMidnightUtc(date,campaign.timezone);
      const [year,month,day]=date.split('-').map(Number);
      const nextDate=new Date(Date.UTC(year,month-1,day+1)).toISOString().slice(0,10);
      const expectedEnd=localMidnightUtc(nextDate,campaign.timezone);
      if(v.coverageStartUtc!==expectedStart||Date.parse(v.coverageEndUtc)>Date.parse(expectedEnd)||(v.coverage==='complete'&&v.coverageEndUtc!==expectedEnd))ctx.addIssue({code:'custom',message:'Campaign spend must cover one registered campaign local day; partial rows may end earlier.'});
    }
  } else if (!v.orderId || v.campaignKey || v.coverageStartUtc || v.coverageEndUtc) ctx.addIssue({code:'custom',message:'Order cost requires orderId, without campaign or interval.'});
});
export function costEvidenceId(row: z.infer<typeof CostEvidenceSchema>, environment: string) {
  const spendIdentity = row.revision === 1 ? row.coverageStartUtc : [row.coverageStartUtc,row.revision];
  const orderCostIdentity = row.revision === 1 ? row.sourceRef : [row.sourceRef,row.revision];
  return crypto.createHash('sha256').update(JSON.stringify([environment,row.kind,row.orderId || row.campaignKey,row.kind === 'spend' ? spendIdentity : orderCostIdentity])).digest('hex');
}
