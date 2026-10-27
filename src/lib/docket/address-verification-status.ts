import type { AddressProviderMode } from './address-verification-client';

/**
 * Return honest preparation-record wording only when both mailing addresses
 * have current evidence. Staging/local modes are never presented as USPS CASS.
 */
export function addressVerificationStatusLabel(providerModes: Array<AddressProviderMode | undefined>): string {
  if (providerModes.length !== 2 || providerModes.some((mode) => !mode)) {
    return 'ADDRESS VERIFICATION NOT CONFIRMED';
  }
  if (providerModes.every((mode) => mode === 'live_cass')) return 'USPS CASS VERIFIED';
  if (providerModes.some((mode) => mode === 'staging_mock_cass')) return 'ADDRESS CHECK SIMULATED (STAGING)';
  if (providerModes.some((mode) => mode === 'local_mock')) return 'ADDRESS CHECK SIMULATED (LOCAL)';
  return 'ADDRESS VERIFICATION NOT CONFIRMED';
}
