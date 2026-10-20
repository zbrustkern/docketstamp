import type { NoticeTemplateDefinition } from '@/lib/docket/types';

export type AddressRole = 'rentalProperty' | 'senderMailing' | 'recipientDestination';
export type AddressPart = 'line1' | 'line2' | 'city' | 'state' | 'zip';

export interface PostalCityState {
  city: string;
  state: string;
}

export type PostalCodeLookup = (zip: string) => Promise<PostalCityState[]>;

export type PostalCodeSuggestionState = {
  requestId: number;
  zip: string;
  editRevision: number;
  status: 'idle' | 'loading' | 'suggestion' | 'unknown' | 'ambiguous' | 'error' | 'unavailable';
  suggestion: PostalCityState | null;
};

export const EMPTY_POSTAL_CODE_SUGGESTION: PostalCodeSuggestionState = {
  requestId: 0,
  zip: '',
  editRevision: 0,
  status: 'idle',
  suggestion: null,
};

const BASE_ADDRESS_KEYS: Record<AddressRole, Record<AddressPart, string>> = {
  rentalProperty: {
    line1: 'leasedPremisesAddress',
    line2: 'rentalPropertyAddressLine2',
    city: 'rentalPropertyCity',
    state: 'propertyState',
    zip: 'rentalPropertyZip',
  },
  senderMailing: {
    line1: 'senderAddressLine1',
    line2: 'senderAddressLine2',
    city: 'senderCity',
    state: 'senderState',
    zip: 'senderZip',
  },
  recipientDestination: {
    line1: 'recipientAddressLine1',
    line2: 'recipientAddressLine2',
    city: 'recipientCity',
    state: 'recipientState',
    zip: 'recipientZip',
  },
};

export function getAddressFieldKey(
  role: AddressRole,
  part: AddressPart,
  propertyAddressKey?: string
): string {
  if (role === 'rentalProperty' && part === 'line1' && propertyAddressKey) {
    return propertyAddressKey;
  }
  return BASE_ADDRESS_KEYS[role][part];
}

export function getAddressFieldValues(
  values: Record<string, string>,
  role: AddressRole,
  propertyAddressKey?: string
): Record<AddressPart, string> {
  return {
    line1: values[getAddressFieldKey(role, 'line1', propertyAddressKey)] || '',
    line2: values[getAddressFieldKey(role, 'line2', propertyAddressKey)] || '',
    city: values[getAddressFieldKey(role, 'city', propertyAddressKey)] || '',
    state: values[getAddressFieldKey(role, 'state', propertyAddressKey)] || '',
    zip: values[getAddressFieldKey(role, 'zip', propertyAddressKey)] || '',
  };
}

export function normalizeUsZip(zip: string): string | null {
  const match = zip.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match?.[1] || null;
}

export function startPostalCodeLookup(
  requestId: number,
  zip: string,
  editRevision: number
): PostalCodeSuggestionState {
  return { requestId, zip, editRevision, status: 'loading', suggestion: null };
}

/**
 * Resolve a ZIP-only lookup without applying any address fields. A response is
 * ignored when another ZIP request or a manual edit happened while it was in flight.
 */
export function finishPostalCodeLookup(
  state: PostalCodeSuggestionState,
  input: {
    requestId: number;
    zip: string;
    editRevision: number;
    currentZip: string;
    currentEditRevision: number;
    locations: PostalCityState[];
  }
): PostalCodeSuggestionState {
  if (
    state.requestId !== input.requestId ||
    state.zip !== input.zip ||
    input.currentZip !== input.zip ||
    input.currentEditRevision !== input.editRevision
  ) {
    return state;
  }

  const uniqueLocations = input.locations.filter(
    (location, index, all) =>
      Boolean(location.city.trim() && location.state.trim()) &&
      all.findIndex(
        (candidate) =>
          candidate.city.trim().toLowerCase() === location.city.trim().toLowerCase() &&
          candidate.state.trim().toUpperCase() === location.state.trim().toUpperCase()
      ) === index
  );

  if (uniqueLocations.length === 0) {
    return { ...state, status: 'unknown', suggestion: null };
  }
  if (uniqueLocations.length > 1) {
    return { ...state, status: 'ambiguous', suggestion: null };
  }
  return { ...state, status: 'suggestion', suggestion: uniqueLocations[0] };
}

export function failPostalCodeLookup(
  state: PostalCodeSuggestionState,
  input: {
    requestId: number;
    zip: string;
    currentZip: string;
    editRevision: number;
    currentEditRevision: number;
  }
): PostalCodeSuggestionState {
  if (
    state.requestId !== input.requestId ||
    state.zip !== input.zip ||
    input.currentZip !== input.zip ||
    input.currentEditRevision !== input.editRevision
  ) {
    return state;
  }
  return { ...state, status: 'error', suggestion: null };
}

/** Return a suggested city/state only when both user-entered fields are empty. */
export function applyPostalCodeSuggestion(input: {
  state: PostalCodeSuggestionState;
  currentZip: string;
  currentEditRevision: number;
  currentCity: string;
  currentState: string;
}): PostalCityState | null {
  if (
    input.state.status !== 'suggestion' ||
    !input.state.suggestion ||
    input.state.zip !== input.currentZip ||
    input.state.editRevision !== input.currentEditRevision ||
    input.currentCity.trim() ||
    input.currentState.trim()
  ) {
    return null;
  }
  return input.state.suggestion;
}

/**
 * Keep required-field completion and staged-draft focus in the same order as
 * the tenant address UI: rental property, sender, recipient, remaining details.
 */
export function getGuidedFieldsInVisualOrder(
  notice: NoticeTemplateDefinition
) {
  if (notice.category !== 'tenant') return notice.fields;

  const propertyAddressKeys = new Set(
    ['leasedPremisesAddress', 'vacatedPremisesAddress'].filter((key) =>
      notice.fields.some((field) => field.key === key)
    )
  );
  const propertyStateExists = notice.fields.some((field) => field.key === 'propertyState');
  const propertyFields = notice.fields.filter(
    (field) => propertyAddressKeys.has(field.key) || field.key === 'propertyState'
  );
  const senderFields = notice.fields.filter((field) => field.stepGroup === 'sender');
  const recipientFields = notice.fields.filter((field) => field.stepGroup === 'recipient');
  const remainingFields = notice.fields.filter(
    (field) =>
      !propertyAddressKeys.has(field.key) &&
      field.key !== 'propertyState' &&
      field.stepGroup !== 'sender' &&
      field.stepGroup !== 'recipient'
  );

  // Property address must be focused before property-state statute selection.
  if (propertyStateExists) {
    propertyFields.sort((left, right) => {
      if (left.key === 'propertyState') return 1;
      if (right.key === 'propertyState') return -1;
      return notice.fields.indexOf(left) - notice.fields.indexOf(right);
    });
  }

  return [...propertyFields, ...senderFields, ...recipientFields, ...remainingFields];
}
