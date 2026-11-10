import { z } from 'zod';
import { PILOT_KEY } from '@/lib/acquisition';

/** Campaign identities are code controlled. URL campaign text is never an import identity. */
export const GOOGLE_CAMPAIGNS = {
  [PILOT_KEY]: {
    key: PILOT_KEY,
    platformId: '24457739017',
    label: 'Security deposit demand pilot',
    currency: 'USD',
    timezone: 'America/Chicago',
    source: 'google_ads_export',
  },
} as const;

export type RegisteredCampaignKey = keyof typeof GOOGLE_CAMPAIGNS;
export const CampaignKeySchema = z.string().refine(
  (key): key is RegisteredCampaignKey => Object.hasOwn(GOOGLE_CAMPAIGNS, key),
  'Campaign key is not registered',
);

export function getRegisteredCampaign(key: string) {
  return Object.hasOwn(GOOGLE_CAMPAIGNS, key)
    ? GOOGLE_CAMPAIGNS[key as RegisteredCampaignKey]
    : null;
}

export function listRegisteredCampaigns() {
  return Object.values(GOOGLE_CAMPAIGNS);
}
