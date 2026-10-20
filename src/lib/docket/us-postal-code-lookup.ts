import postalCodeRows from './data/us-postal-code-locations.json';
import { STATE_STATUTES } from './data/state-statutes';

export interface UsPostalCityState {
  city: string;
  state: string;
}

export type UsPostalCodeRow = readonly [zip: string, city: string, state: string];

const selectableStateCodes = new Set(Object.keys(STATE_STATUTES));

/** Build an immutable ZIP index while preserving every distinct postal city/state. */
export function createUsPostalCodeLookup(rows: readonly UsPostalCodeRow[]) {
  const locationsByZip = new Map<string, UsPostalCityState[]>();

  for (const [zip, city, state] of rows) {
    const stateCode = state.trim().toUpperCase();
    if (!selectableStateCodes.has(stateCode)) continue;

    const locations = locationsByZip.get(zip) || [];
    if (!locations.some((location) => location.city === city && location.state === stateCode)) {
      locations.push({ city, state: stateCode });
      locationsByZip.set(zip, locations);
    }
  }

  return (zipInput: string): UsPostalCityState[] => {
    const match = zipInput.trim().match(/^(\d{5})(?:-\d{4})?$/);
    if (!match) return [];

    // Return copies so callers cannot mutate the shared snapshot index.
    return (locationsByZip.get(match[1]) || []).map((location) => ({ ...location }));
  };
}

// The dataset builder emits exactly three values per row; JSON modules infer
// nested arrays as string[][], so retain the generated tuple contract here.
const bundledRows = postalCodeRows as unknown as UsPostalCodeRow[];
export const lookupUsPostalCode = createUsPostalCodeLookup(bundledRows);
