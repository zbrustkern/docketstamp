import type { PostalCodeLookup } from './address-intake';
import { normalizeUsZip } from './address-intake';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Query the first-party local GeoNames snapshot with only a normalized ZIP.
 * The street address and other form data are never included in this request.
 */
export function createPostalCodeLookup(fetcher: FetchLike): PostalCodeLookup {
  return async (zipInput) => {
    const zip = normalizeUsZip(zipInput);
    if (!zip) return [];

    const response = await fetcher(`/api/address/postal-code?zip=${encodeURIComponent(zip)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Local ZIP suggestion lookup failed.');

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('locations' in payload)) {
      throw new Error('Local ZIP suggestion response was invalid.');
    }

    const locations = (payload as { locations?: unknown }).locations;
    if (!Array.isArray(locations)) throw new Error('Local ZIP suggestion response was invalid.');

    return locations.filter(
      (location): location is { city: string; state: string } =>
        Boolean(
          location &&
          typeof location === 'object' &&
          'city' in location &&
          'state' in location &&
          typeof location.city === 'string' &&
          location.city.trim() &&
          typeof location.state === 'string' &&
          location.state.trim()
        )
    );
  };
}

export const lookupPostalCodeLocally: PostalCodeLookup = createPostalCodeLookup(fetch);
