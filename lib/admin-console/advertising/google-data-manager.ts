import { z } from 'zod';
import { isGoogleDeliveryEnabled, type GoogleAdsDestination } from './destination';
import { getApprovedGoogleDestination } from './destination';

const ClickIdSchema = z.string().regex(/^[A-Za-z0-9_.~-]{1,255}$/);
const ConversionSchema = z.object({
  gclid: ClickIdSchema,
  transactionId: z.string().regex(/^[a-f0-9]{40}$/),
  eventTimestamp: z.string().datetime({ offset: true }),
  conversionValue: z.number().positive().finite(),
  currency: z.literal('USD'),
}).strict();
const AdjustmentSchema = ConversionSchema.extend({ conversionValue: z.number().nonnegative().finite() });

export function buildGoogleDataManagerRequest(destination: GoogleAdsDestination, conversion: z.infer<typeof ConversionSchema>) {
  const row = ConversionSchema.parse(conversion);
  return {
    destinations: [{
      operatingAccount: { accountType: 'GOOGLE_ADS', accountId: destination.accountId },
      loginAccount: { accountType: 'GOOGLE_ADS', accountId: destination.loginAccountId },
      productDestinationId: destination.conversionActionId,
    }],
    encoding: 'HEX',
    consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_DENIED' },
    events: [{
      adIdentifiers: { gclid: row.gclid },
      conversionValue: row.conversionValue,
      currency: row.currency,
      eventTimestamp: row.eventTimestamp,
      transactionId: row.transactionId,
      eventSource: 'WEB',
    }],
    validateOnly: false,
  } as const;
}

/** A zero value represents a fully refunded purchase; transactionId remains the original conversion ID. */
export function buildGoogleDataManagerRefundAdjustment(destination: GoogleAdsDestination, adjustment: z.infer<typeof AdjustmentSchema>) {
  const row = AdjustmentSchema.parse(adjustment);
  return {
    destinations: [{
      operatingAccount: { accountType: 'GOOGLE_ADS', accountId: destination.accountId },
      loginAccount: { accountType: 'GOOGLE_ADS', accountId: destination.loginAccountId },
      productDestinationId: destination.conversionActionId,
    }],
    encoding: 'HEX',
    consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_DENIED' },
    events: [{
      adIdentifiers: { gclid: row.gclid },
      conversionValue: row.conversionValue,
      currency: row.currency,
      eventTimestamp: row.eventTimestamp,
      transactionId: row.transactionId,
      eventSource: 'WEB',
    }],
    validateOnly: false,
  } as const;
}

export type GoogleDataManagerResult = { status: 'disabled' | 'submitted' | 'unknown' | 'retryable_failure' | 'permanent_failure'; diagnosticCode?: 'CONFIG_MISSING' | 'PROVIDER_TIMEOUT' | 'PROVIDER_REJECTED'; requestId?: string };

/** Bounded Data Manager API adapter. It is inert unless a code-reviewed destination and server kill switch are present. */
export async function sendGoogleDataManagerConversion(input: {
  destination: GoogleAdsDestination;
  conversion: z.infer<typeof ConversionSchema>;
  accessToken?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<GoogleDataManagerResult> {
  if (!isGoogleDeliveryEnabled(input.destination)) return { status: 'disabled', diagnosticCode: 'CONFIG_MISSING' };
  const approved = getApprovedGoogleDestination(process.env.GOOGLE_ADS_DESTINATION_KEY);
  if (!approved || approved.key !== input.destination.key || approved.accountId !== input.destination.accountId || approved.loginAccountId !== input.destination.loginAccountId || approved.conversionActionId !== input.destination.conversionActionId || approved.conversionName !== input.destination.conversionName) return { status: 'disabled', diagnosticCode: 'CONFIG_MISSING' };
  const accessToken = input.accessToken || process.env.GOOGLE_DATA_MANAGER_ACCESS_TOKEN;
  if (!accessToken || accessToken.length > 4096) return { status: 'disabled', diagnosticCode: 'CONFIG_MISSING' };
  const payload = buildGoogleDataManagerRequest(input.destination, input.conversion);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(10_000, Math.max(1000, input.timeoutMs || 5000)));
  try {
    const response = await (input.fetchImpl || fetch)('https://datamanager.googleapis.com/v1/events:ingest', {
      method: 'POST', signal: controller.signal,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { status: response.status === 429 || response.status >= 500 ? 'retryable_failure' : 'permanent_failure', diagnosticCode: 'PROVIDER_REJECTED' };
    let requestId: string | undefined;
    try {
      const result = await response.json() as Record<string, unknown>;
      if (typeof result.requestId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(result.requestId)) requestId = result.requestId;
    } catch { /* HTTP success without a readable processing receipt remains accepted only as submission. */ }
    return { status: 'submitted', requestId };
  } catch (error) {
    return { status: 'unknown', diagnosticCode: (error as Error)?.name === 'AbortError' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_REJECTED' };
  } finally { clearTimeout(timeout); }
}
