/**
 * Lob Programmatic Postal Dispatch API Client
 *
 * Unified canonical Lob fulfillment adapter re-exported from src/lib/fulfillment/lob.ts
 * to eliminate path-alias shadowing between lib/ and src/lib/.
 *
 * Implements USPS CASS Address Verification (/v1/us_verifications)
 * and USPS Physical Letter Dispatch (/v1/letters) supporting:
 * - Tier 1: first_class -> extra_service: undefined (USPS First-Class Mail $12.95)
 * - Tier 2: certified -> extra_service: 'certified' (USPS Certified Mail® $19.95)
 * - Tier 3: certified_return_receipt -> extra_service: 'certified_return_receipt' ($27.95)
 */

export * from '@/src/lib/fulfillment/lob';
