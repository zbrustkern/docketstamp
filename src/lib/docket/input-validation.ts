import { NoticeTemplateDefinition, PostalAddress, DocketAddress } from './types';
import { STATE_STATUTES } from './data/state-statutes';
import { SERVER_DERIVED_NOTICE_KEYS } from './derived-fields';

const STATE_CODES = new Set(Object.keys(STATE_STATUTES));
const US_ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_PATTERN = /^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;

const COMMON_USER_ADDRESS_FIELDS: Record<string, { maxLength: number; kind: 'text' | 'state' | 'zip' }> = {
  rentalPropertyAddressLine2: { maxLength: 60, kind: 'text' },
  rentalPropertyCity: { maxLength: 80, kind: 'text' },
  propertyState: { maxLength: 2, kind: 'state' },
  rentalPropertyZip: { maxLength: 10, kind: 'zip' },
  senderAddressLine1: { maxLength: 120, kind: 'text' },
  senderAddressLine2: { maxLength: 120, kind: 'text' },
  senderCity: { maxLength: 80, kind: 'text' },
  senderState: { maxLength: 2, kind: 'state' },
  senderZip: { maxLength: 10, kind: 'zip' },
  recipientAddressLine1: { maxLength: 120, kind: 'text' },
  recipientAddressLine2: { maxLength: 120, kind: 'text' },
  recipientCity: { maxLength: 80, kind: 'text' },
  recipientState: { maxLength: 2, kind: 'state' },
  recipientZip: { maxLength: 10, kind: 'zip' },
};

const ADDRESS_COMPONENTS = [
  { canonical: 'name', aliases: ['name'], maxLength: 100 },
  { canonical: 'company', aliases: ['company'], maxLength: 120 },
  { canonical: 'addressLine1', aliases: ['addressLine1', 'address_line1'], maxLength: 120 },
  { canonical: 'addressLine2', aliases: ['addressLine2', 'address_line2'], maxLength: 120 },
  { canonical: 'city', aliases: ['city', 'address_city'], maxLength: 80 },
  { canonical: 'state', aliases: ['state', 'address_state'], maxLength: 2, kind: 'state' as const },
  { canonical: 'zip', aliases: ['zip', 'address_zip'], maxLength: 10, kind: 'zip' as const },
] as const;

export type NoticeInputIssue = {
  path: string;
  message: string;
};

export type ValidatedNoticeInput = {
  success: true;
  userValues: Record<string, string>;
  senderAddress: Partial<PostalAddress | DocketAddress>;
  recipientAddress: Partial<PostalAddress | DocketAddress>;
} | {
  success: false;
  issues: NoticeInputIssue[];
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Returns the exact value in cents, or null when the string is not currency. */
export function parseCurrencyToCents(value: string): number | null {
  const normalized = value.trim();
  if (!CURRENCY_PATTERN.test(normalized)) return null;

  const numeric = normalized.replace(/^\$/, '').replace(/,/g, '');
  const [whole, fraction = ''] = numeric.split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

function validateState(value: string, path: string, issues: NoticeInputIssue[]) {
  if (value && !STATE_CODES.has(value.toUpperCase())) {
    issues.push({ path, message: 'Choose a supported U.S. state or District of Columbia.' });
  }
}

function validateZip(value: string, path: string, issues: NoticeInputIssue[]) {
  if (value && !US_ZIP_PATTERN.test(value)) {
    issues.push({ path, message: 'Enter a 5-digit ZIP Code or ZIP+4.' });
  }
}

function sanitizeAddress(
  input: unknown,
  path: string,
  issues: NoticeInputIssue[]
): Partial<PostalAddress | DocketAddress> {
  if (input === undefined || input === null) return {};
  if (!isPlainRecord(input)) {
    issues.push({ path, message: 'Address must be an object.' });
    return {};
  }

  const result: Record<string, string> = {};
  for (const component of ADDRESS_COMPONENTS) {
    const provided = component.aliases
      .filter((alias) => Object.prototype.hasOwnProperty.call(input, alias))
      .map((alias) => ({ alias, value: input[alias] }));
    if (provided.length === 0) continue;

    const chosen = provided[0];
    if (provided.some(({ value }) => value !== chosen.value)) {
      issues.push({ path: `${path}.${component.canonical}`, message: 'Address fields conflict.' });
      continue;
    }
    if (typeof chosen.value !== 'string') {
      issues.push({ path: `${path}.${component.canonical}`, message: 'Address values must be text.' });
      continue;
    }

    const value = chosen.value.trim();
    if (value.length > component.maxLength) {
      issues.push({ path: `${path}.${component.canonical}`, message: `Must be ${component.maxLength} characters or fewer.` });
      continue;
    }
    if (component.canonical === 'state') validateState(value, `${path}.state`, issues);
    if (component.canonical === 'zip') validateZip(value, `${path}.zip`, issues);
    if (value) result[component.canonical] = component.canonical === 'state' ? value.toUpperCase() : value;
  }

  return result as Partial<PostalAddress | DocketAddress>;
}

/**
 * Validate the template's schema values and preserve only explicitly allowed
 * factual inputs. Unknown and derived keys are discarded before interpolation.
 */
export function validateNoticeInput(
  notice: NoticeTemplateDefinition,
  rawValues: unknown,
  rawSenderAddress?: unknown,
  rawRecipientAddress?: unknown
): ValidatedNoticeInput {
  if (!isPlainRecord(rawValues)) {
    return { success: false, issues: [{ path: 'userValues', message: 'Enter the required document fields.' }] };
  }

  const parsed = notice.zodSchema.safeParse(rawValues);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'userValues',
        message: issue.message,
      })),
    };
  }

  const issues: NoticeInputIssue[] = [];
  const trimmedValues = Object.fromEntries(
    Object.entries(parsed.data as Record<string, unknown>).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ])
  );
  let normalizedParsed: ReturnType<typeof notice.zodSchema.safeParse>;
  try {
    normalizedParsed = notice.zodSchema.safeParse(trimmedValues);
  } catch {
    return { success: false, issues: [{ path: 'userValues', message: 'Document fields failed validation.' }] };
  }
  if (!normalizedParsed.success) {
    return {
      success: false,
      issues: normalizedParsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'userValues',
        message: issue.message,
      })),
    };
  }

  const parsedValues = normalizedParsed.data as Record<string, unknown>;
  const fieldConfig = new Map(notice.fields.map((field) => [field.key, field]));
  const userValues: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(parsedValues)) {
    if (SERVER_DERIVED_NOTICE_KEYS.has(key)) continue;
    if (typeof rawValue !== 'string') {
      issues.push({ path: key, message: 'Document values must be text.' });
      continue;
    }
    const value = rawValue.trim();
    const field = fieldConfig.get(key);
    const maxLength = field?.maxLength ?? (key === 'recipientFormalName' ? 80 : 120);
    if (value.length > maxLength) {
      issues.push({ path: key, message: `Must be ${maxLength} characters or fewer.` });
      continue;
    }
    if (field?.inputType === 'date' && !isValidIsoDate(value)) {
      issues.push({ path: key, message: 'Enter a real date in YYYY-MM-DD format.' });
    }
    if (field?.inputType === 'currency' && parseCurrencyToCents(value) === null) {
      issues.push({ path: key, message: 'Enter a non-negative amount with no more than two decimal places.' });
    }
    if (field?.inputType === 'state_select') validateState(value, key, issues);
    userValues[key] = field?.inputType === 'state_select' ? value.toUpperCase() : value;
  }

  for (const [key, config] of Object.entries(COMMON_USER_ADDRESS_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(rawValues, key)) continue;
    const rawValue = rawValues[key];
    if (typeof rawValue !== 'string') {
      issues.push({ path: key, message: 'Address values must be text.' });
      continue;
    }
    const value = rawValue.trim();
    if (value.length > config.maxLength) {
      issues.push({ path: key, message: `Must be ${config.maxLength} characters or fewer.` });
      continue;
    }
    if (config.kind === 'state') validateState(value, key, issues);
    if (config.kind === 'zip') validateZip(value, key, issues);
    userValues[key] = config.kind === 'state' ? value.toUpperCase() : value;
  }

  // The tenant address UI collects property components separately, while the
  // current notice schemas expose one property-address token. Preserve the
  // street, unit, locality, jurisdiction, and ZIP in that rendered value.
  const propertyAddressKey = ['leasedPremisesAddress', 'vacatedPremisesAddress']
    .find((key) => Object.prototype.hasOwnProperty.call(userValues, key));
  if (propertyAddressKey) {
    const line1 = userValues[propertyAddressKey];
    const line2 = userValues.rentalPropertyAddressLine2 || '';
    const city = userValues.rentalPropertyCity || '';
    const state = userValues.propertyState || '';
    const zip = userValues.rentalPropertyZip || '';
    if (line2 || city || state || zip) {
      const locality = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      const fullAddress = [line1, line2, locality].filter(Boolean).join(', ');
      if (fullAddress.length > 250) {
        issues.push({ path: propertyAddressKey, message: 'The complete property address must be 250 characters or fewer.' });
      } else {
        userValues[propertyAddressKey] = fullAddress;
      }
    }
  }

  // State jurisdiction is a legal selector; it must resolve to an actual
  // supported table entry before statutory language can be generated.
  if (notice.usesStateStatuteLookup) {
    const stateKey = ['leasedPremisesState', 'vacatedPremisesState', 'propertyState', 'rentalState', 'state']
      .find((key) => typeof userValues[key] === 'string' && userValues[key].trim());
    if (!stateKey || !STATE_CODES.has(userValues[stateKey].trim().toUpperCase())) {
      issues.push({ path: stateKey || 'propertyState', message: 'Choose a supported property jurisdiction.' });
    } else {
      userValues[stateKey] = userValues[stateKey].trim().toUpperCase();
    }
  }

  const currencyValues = new Map<string, number>();
  for (const field of notice.fields) {
    if (field.inputType !== 'currency' || !userValues[field.key]) continue;
    const cents = parseCurrencyToCents(userValues[field.key]);
    if (cents !== null) currencyValues.set(field.key, cents);
  }
  const deposit = currencyValues.get('depositAmount');
  const received = currencyValues.get('amountReceivedToDate');
  const requested = currencyValues.get('balanceRequested');
  if (deposit !== undefined && received !== undefined && received > deposit) {
    issues.push({ path: 'amountReceivedToDate', message: 'The amount returned cannot exceed the original deposit entered.' });
  }
  if (deposit !== undefined && received !== undefined && requested !== undefined && requested > Math.max(0, deposit - received)) {
    issues.push({ path: 'balanceRequested', message: 'The requested balance cannot exceed the amount not yet returned.' });
  }

  const senderAddress = sanitizeAddress(rawSenderAddress, 'senderAddress', issues);
  const recipientAddress = sanitizeAddress(rawRecipientAddress, 'recipientAddress', issues);

  if (issues.length > 0) return { success: false, issues };
  return { success: true, userValues, senderAddress, recipientAddress };
}
