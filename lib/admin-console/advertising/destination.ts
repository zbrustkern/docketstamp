import { z } from 'zod';
import { serverEnvironment } from '@/lib/admin-console/commands/access';

/** Empty until a DocketStamp-owned UPLOAD_CLICKS action is independently reviewed and added here. */
export interface GoogleAdsDestination {
  key: string; accountId: string; loginAccountId: string; conversionActionId: string;
  conversionName: string; approved: true;
}
export const APPROVED_GOOGLE_DESTINATIONS: Readonly<Record<string, GoogleAdsDestination>> = {};
export const GoogleDestinationKeySchema = z.string().refine(
  key => Object.hasOwn(APPROVED_GOOGLE_DESTINATIONS, key),
  'Google destination is not approved for DocketStamp',
);
export type GoogleDestinationKey = keyof typeof APPROVED_GOOGLE_DESTINATIONS;
export function getApprovedGoogleDestination(key: string | undefined) {
  if (!key || !Object.hasOwn(APPROVED_GOOGLE_DESTINATIONS, key)) return null;
  const destination = APPROVED_GOOGLE_DESTINATIONS[key as GoogleDestinationKey];
  return process.env.GOOGLE_ADS_OFFLINE_EXPORT_ENABLED === 'true' && destination.approved === true ? destination : null;
}
export function isGoogleDeliveryEnabled(destination?: GoogleAdsDestination) {
  const approved = getApprovedGoogleDestination(process.env.GOOGLE_ADS_DESTINATION_KEY);
  return serverEnvironment() === 'production' && process.env.GOOGLE_ADS_OFFLINE_API_ENABLED === 'true' && Boolean(approved && destination && approved.key === destination.key && approved.accountId === destination.accountId && approved.loginAccountId === destination.loginAccountId && approved.conversionActionId === destination.conversionActionId && approved.conversionName === destination.conversionName);
}
