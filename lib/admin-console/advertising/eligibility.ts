import { CLICK_EVIDENCE_MS, clickDigest, type AcquisitionSnapshot, type RawClick } from '@/lib/acquisition';
import { getRegisteredCampaign } from './campaigns';
import type { MarketingConsentEvidence } from './consent';
import crypto from 'node:crypto';

export const GOOGLE_CLICK_RETENTION_MS = CLICK_EVIDENCE_MS;
export const GOOGLE_OFFLINE_SUPPORTED_IDENTIFIER = 'gclid' as const;
export interface GoogleConversionCandidate {
  order: {
    id: string; environment?: string; paymentMode?: string; stripePaymentId?: string; paymentFactId?: string; isTest?: boolean; isComp?: boolean; isFounderTest?: boolean;
    paymentMethod?: string; finalAmountInCents?: number; amountInCents?: number;
    acquisitionV2?: AcquisitionSnapshot; marketingConsentEvidence?: MarketingConsentEvidence;
  };
  paymentFact: { product?: string; environment?: string; provider?: string; providerAccountId?: string; providerObjectId?: string; factId?: string; kind: string; verification: string; providerMode: string; amountMinor: number; currency: string; effectiveAt: string; orderId?: string; classification?: { primary?: string } };
  click?: RawClick;
  consent?: MarketingConsentEvidence;
  now?: number;
  environment?: 'local' | 'staging' | 'production';
  destinationApproved?: boolean;
}

export type GoogleEligibilityReason =
  | 'TEST_OR_NONLIVE_PAYMENT' | 'UNVERIFIED_PAYMENT' | 'ORDER_MISMATCH' | 'INVALID_AMOUNT'
  | 'CURRENCY_UNSUPPORTED' | 'CONSENT_REQUIRED' | 'PRIVACY_SIGNAL' | 'CLICK_MISSING'
  | 'CLICK_TYPE_UNSUPPORTED' | 'CLICK_EXPIRED' | 'CLICK_MISMATCH' | 'CAMPAIGN_UNREGISTERED'
  | 'DESTINATION_UNAPPROVED' | 'REFUNDED_OR_ADJUSTED' | 'PAYMENT_PROVIDER_UNSUPPORTED' | 'PAYMENT_BINDING_MISMATCH';

export function evaluateGoogleConversionEligibility(input: GoogleConversionCandidate) {
  const reasons: GoogleEligibilityReason[] = [];
  const order = input.order;
  const fact = input.paymentFact;
  const now = input.now ?? Date.now();
  const amount = order.finalAmountInCents ?? order.amountInCents;
  if (input.environment !== 'production' || order.paymentMode !== 'live' || order.environment && order.environment !== input.environment || fact.environment !== input.environment || fact.product !== 'docketstamp' || fact.classification?.primary !== 'customer' || order.isTest || order.isComp || order.isFounderTest || order.paymentMethod === 'PROMO_CODE' || order.paymentMethod === 'STUDIO_COMP') reasons.push('TEST_OR_NONLIVE_PAYMENT');
  if (fact.kind !== 'capture' || fact.verification !== 'verified' || fact.providerMode !== 'live') reasons.push('UNVERIFIED_PAYMENT');
  if (fact.provider !== 'stripe' || typeof fact.providerAccountId !== 'string' || !fact.providerAccountId || process.env.STRIPE_ACCOUNT_ID && fact.providerAccountId !== process.env.STRIPE_ACCOUNT_ID) reasons.push('PAYMENT_PROVIDER_UNSUPPORTED');
  if (!order.stripePaymentId || fact.providerObjectId !== order.stripePaymentId || !order.paymentFactId || fact.factId !== order.paymentFactId) reasons.push('PAYMENT_BINDING_MISMATCH');
  if (fact.orderId !== order.id) reasons.push('ORDER_MISMATCH');
  if (!Number.isSafeInteger(amount) || amount! <= 0 || amount !== fact.amountMinor) reasons.push('INVALID_AMOUNT');
  if (fact.currency !== 'USD') reasons.push('CURRENCY_UNSUPPORTED');
  const paidAt = Date.parse(fact.effectiveAt);
  if (!Number.isFinite(paidAt) || paidAt > now) reasons.push('UNVERIFIED_PAYMENT');
  const consent = input.consent || order.marketingConsentEvidence;
  if (!consent || consent.status !== 'granted' || !consent.grantId || consent.version !== 1 || !consent.sessionBinding) reasons.push('CONSENT_REQUIRED');
  if (consent?.gpc) reasons.push('PRIVACY_SIGNAL');
  const consentAt = Date.parse(consent?.recordedAt || '');
  if (!Number.isFinite(consentAt) || consentAt > paidAt || !/^[a-f0-9]{64}$/.test(consent?.sessionBinding || '')) reasons.push('CONSENT_REQUIRED');
  if (!input.click) reasons.push('CLICK_MISSING');
  else {
    if (input.click.type !== GOOGLE_OFFLINE_SUPPORTED_IDENTIFIER) reasons.push('CLICK_TYPE_UNSUPPORTED');
    const observed = Date.parse(input.click.observedAt), expires = Date.parse(input.click.expiresAt);
    if (!/^[A-Za-z0-9_.~-]{1,255}$/.test(input.click.value) || !Number.isFinite(observed) || !Number.isFinite(expires) || observed > paidAt || expires <= now || expires > observed + GOOGLE_CLICK_RETENTION_MS || paidAt < observed) reasons.push('CLICK_EXPIRED');
    const touches = [order.acquisitionV2?.currentSession].filter(Boolean);
    const digestMatches = touches.some(touch => touch?.source === 'google' && touch.medium === 'cpc' && touch.clicks.some(e => e.type === 'gclid' && e.digest === clickDigest(input.click!.value) && e.expiresAt === input.click!.expiresAt));
    if (!digestMatches) reasons.push('CLICK_MISMATCH');
    const campaignId = order.acquisitionV2?.currentSession?.campaignId;
    if (!campaignId || !getRegisteredCampaign(`google:cpc:${campaignId}`)) reasons.push('CAMPAIGN_UNREGISTERED');
  }
  if (input.destinationApproved !== true) reasons.push('DESTINATION_UNAPPROVED');
  const uniqueReasons = [...new Set(reasons)];
  if (uniqueReasons.length === 0 && input.click) return {
      eligible: true as const,
      reasons: [] as GoogleEligibilityReason[],
      click: input.click,
      transactionId: crypto.createHash('sha256').update(`docketstamp:google:${input.environment}:${order.id}`).digest('hex').slice(0, 40),
      eventTimestamp: fact.effectiveAt,
      conversionValue: Number((fact.amountMinor / 100).toFixed(2)),
      currency: fact.currency,
      campaignKey: `google:cpc:${order.acquisitionV2!.currentSession!.campaignId}`,
      consentGrantId: consent!.grantId,
      consentSessionBinding: consent!.sessionBinding,
    };
  return { eligible: false as const, reasons: uniqueReasons };
}

/** Staging/QA support uses synthetic input only and cannot bypass live eligibility in production code. */
export function evaluateSyntheticFixtureEligibility(input: {
  environment: 'local' | 'staging' | 'production';
  fixture: true; clickType?: string; consent?: boolean; clickExpiresAt?: number; now?: number;
}) {
  const reasons: string[] = [];
  if (input.fixture !== true || input.environment === 'production') reasons.push('FIXTURE_NOT_ALLOWED');
  if (input.consent !== true) reasons.push('CONSENT_REQUIRED');
  if (input.clickType !== 'gclid') reasons.push('CLICK_TYPE_UNSUPPORTED');
  if (!input.clickExpiresAt || input.clickExpiresAt <= (input.now ?? Date.now())) reasons.push('CLICK_EXPIRED');
  return { eligible: reasons.length === 0, reasons };
}
