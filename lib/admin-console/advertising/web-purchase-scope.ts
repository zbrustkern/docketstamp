import type { Order } from '@/lib/types';

// Eligibility is based on the service purchased. Never inspect letter text for ad measurement.
// Sensitive health/biometric, credit-bureau, and debt-collection notices are excluded.
const eligibleNotices = new Set([
  'security-deposit-return-demand-letter',
  'tenant-notice-of-intent-to-vacate',
  'tenant-repair-and-maintenance-notice',
  'written-contract-and-policy-cancellation-letter',
  'pre-arbitration-notice-of-dispute-and-refund-request',
  '30-day-mandatory-arbitration-opt-out-notice',
]);

export function usesEnhancedWebMeasurement(order: Pick<Order, 'noticeId' | 'marketingConsentEvidence'>) {
  const consent = order.marketingConsentEvidence;
  if (!consent || consent.gpc || consent.status === 'denied' || consent.status === 'withdrawn') return false;
  return eligibleNotices.has(order.noticeId || '');
}
