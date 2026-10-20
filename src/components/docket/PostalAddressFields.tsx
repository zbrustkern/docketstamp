'use client';

import React, { useEffect, useRef, useState } from 'react';
import { STATE_STATUTES } from '@/lib/docket/data/state-statutes';
import type { NoticeFieldConfig } from '@/lib/docket/types';
import type {
  AddressPart,
  AddressRole,
  PostalCodeLookup,
  PostalCodeSuggestionState,
} from './address-intake';
import {
  EMPTY_POSTAL_CODE_SUGGESTION,
  applyPostalCodeSuggestion,
  failPostalCodeLookup,
  finishPostalCodeLookup,
  getAddressFieldKey,
  getAddressFieldValues,
  normalizeUsZip,
  startPostalCodeLookup,
} from './address-intake';

interface PostalAddressFieldsProps {
  role: AddressRole;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  errorFor?: (key: string) => string | undefined;
  onFieldBlur?: (key: string) => void;
  onPartChange?: (part: AddressPart, key: string, value: string) => void;
  onFieldFocus?: (key: string) => void;
  primaryField?: NoticeFieldConfig;
  stateField?: NoticeFieldConfig;
  activeFieldKey?: string | null;
  propertyAddressKey?: string;
  postalCodeLookup?: PostalCodeLookup;
}

const ROLE_COPY: Record<AddressRole, { noun: string; stateLabel: string }> = {
  rentalProperty: { noun: 'rental property', stateLabel: 'Rental property state' },
  senderMailing: { noun: 'sender mailing', stateLabel: 'Sender mailing state' },
  recipientDestination: { noun: 'recipient destination', stateLabel: 'Recipient destination state' },
};

export const PostalAddressFields: React.FC<PostalAddressFieldsProps> = ({
  role,
  values,
  onChange,
  errorFor,
  onFieldBlur,
  onPartChange,
  onFieldFocus,
  primaryField,
  stateField,
  activeFieldKey,
  propertyAddressKey,
  postalCodeLookup,
}) => {
  const address = getAddressFieldValues(values, role, propertyAddressKey);
  const roleCopy = ROLE_COPY[role];
  const [suggestionState, setSuggestionState] = useState<PostalCodeSuggestionState>(
    EMPTY_POSTAL_CODE_SUGGESTION
  );
  const editRevisionRef = useRef(0);
  const requestIdRef = useRef(0);
  const currentAddressRef = useRef(address);
  currentAddressRef.current = address;
  const inputRefs = useRef<Partial<Record<AddressPart, HTMLInputElement | HTMLSelectElement>>>({});

  useEffect(() => {
    const activePart = (['line1', 'line2', 'city', 'state', 'zip'] as AddressPart[]).find(
      (part) => activeFieldKey === getAddressFieldKey(role, part, propertyAddressKey)
    );
    const activeInput = activePart ? inputRefs.current[activePart] : null;
    if (activeInput) {
      activeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      activeInput.focus();
    }
  }, [activeFieldKey, propertyAddressKey, role]);

  useEffect(() => {
    const zip = normalizeUsZip(address.zip);
    if (!zip) {
      setSuggestionState(EMPTY_POSTAL_CODE_SUGGESTION);
      return;
    }

    if (!postalCodeLookup) {
      setSuggestionState({
        requestId: ++requestIdRef.current,
        zip,
        editRevision: editRevisionRef.current,
        status: 'unavailable',
        suggestion: null,
      });
      return;
    }

    const requestId = ++requestIdRef.current;
    const editRevision = editRevisionRef.current;
    setSuggestionState(startPostalCodeLookup(requestId, zip, editRevision));

    Promise.resolve().then(() => postalCodeLookup(zip)).then(
      (locations) => {
        const currentZip = normalizeUsZip(currentAddressRef.current.zip) || '';
        setSuggestionState((current) =>
          finishPostalCodeLookup(current, {
            requestId,
            zip,
            editRevision,
            currentZip,
            currentEditRevision: editRevisionRef.current,
            locations,
          })
        );
      },
      () => {
        const currentZip = normalizeUsZip(currentAddressRef.current.zip) || '';
        setSuggestionState((current) =>
          failPostalCodeLookup(current, {
            requestId,
            zip,
            currentZip,
            editRevision,
            currentEditRevision: editRevisionRef.current,
          })
        );
      }
    );

    return () => {
      // Invalidate late responses when ZIP, role, or lookup adapter changes.
      requestIdRef.current += 1;
    };
  }, [address.zip, postalCodeLookup]);

  const commitPart = (part: AddressPart, value: string) => {
    editRevisionRef.current += 1;
    setSuggestionState(EMPTY_POSTAL_CODE_SUGGESTION);
    const key = getAddressFieldKey(role, part, propertyAddressKey);
    if (onPartChange) onPartChange(part, key, value);
    else onChange(key, value);
  };

  const handleUseSuggestion = () => {
    const suggestion = applyPostalCodeSuggestion({
      state: suggestionState,
      currentZip: normalizeUsZip(address.zip) || '',
      currentEditRevision: editRevisionRef.current,
      currentCity: address.city,
      currentState: address.state,
    });
    if (!suggestion) return;
    commitPart('city', suggestion.city);
    commitPart('state', suggestion.state.toUpperCase());
  };

  const primaryKey = getAddressFieldKey(role, 'line1', propertyAddressKey);
  const fieldShell = (isActive: boolean, hasError: boolean) =>
    `w-full bg-slate-800 border rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500 ${
      hasError ? 'border-rose-500 ring-1 ring-rose-500/50' : isActive ? 'border-sky-500' : 'border-slate-700'
    }`;

  const renderError = (key: string) => {
    const error = errorFor?.(key);
    return error ? <p className="mt-1 text-[11px] text-rose-400" role="alert">{error}</p> : null;
  };

  return (
    <div className="space-y-3" data-testid={`${role}-address-fields`}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`${role}-line1`} className="text-xs font-medium text-slate-300">
            {primaryField?.label || `${roleCopy.noun} street address`}
          </label>
          {primaryField && (
            <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              [ {primaryField.docusignTagLabel} ]
            </span>
          )}
        </div>
        {primaryField?.helperText && (
          <p className="text-[11px] text-slate-400 leading-tight">{primaryField.helperText}</p>
        )}
        <input
          id={`${role}-line1`}
          type="text"
          ref={(element) => { inputRefs.current.line1 = element || undefined; }}
          aria-label={`${roleCopy.noun} street address`}
          value={address.line1}
          maxLength={primaryField?.maxLength || 100}
          placeholder={
            role === 'rentalProperty'
              ? 'Street address (e.g., 742 Evergreen Terrace)'
              : role === 'senderMailing'
              ? 'Sender mailing / return street address'
              : 'Landlord or management mailing street address'
          }
          onChange={(event) => commitPart('line1', event.target.value)}
          onFocus={() => onFieldFocus?.(primaryKey)}
          onBlur={() => onFieldBlur?.(primaryKey)}
          autoComplete="address-line1"
          className={fieldShell(activeFieldKey === primaryKey, Boolean(errorFor?.(primaryKey)))}
        />
        {renderError(primaryKey)}
      </div>

      <input
        type="text"
        ref={(element) => { inputRefs.current.line2 = element || undefined; }}
        aria-label={`${roleCopy.noun} unit, apartment, or suite`}
        value={address.line2}
        maxLength={60}
        onChange={(event) => commitPart('line2', event.target.value)}
        onFocus={() => onFieldFocus?.(getAddressFieldKey(role, 'line2', propertyAddressKey))}
        onBlur={() => onFieldBlur?.(getAddressFieldKey(role, 'line2', propertyAddressKey))}
        placeholder="Unit, apartment, or suite (optional)"
        autoComplete="address-line2"
        className={fieldShell(
          activeFieldKey === getAddressFieldKey(role, 'line2', propertyAddressKey),
          Boolean(errorFor?.(getAddressFieldKey(role, 'line2', propertyAddressKey)))
        )}
      />
      {renderError(getAddressFieldKey(role, 'line2', propertyAddressKey))}

      {stateField && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`${role}-state`} className="text-[10px] leading-tight text-slate-300">
            Rental property state · {stateField.label}
          </label>
          <span className="text-[8px] font-mono text-amber-300 whitespace-nowrap">
            [ {stateField.docusignTagLabel} ]
          </span>
        </div>
      )}
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-5 space-y-1">
          <input
            type="text"
            ref={(element) => { inputRefs.current.city = element || undefined; }}
            aria-label={`${roleCopy.noun} city`}
            value={address.city}
            onChange={(event) => commitPart('city', event.target.value)}
            onFocus={() => onFieldFocus?.(getAddressFieldKey(role, 'city', propertyAddressKey))}
            onBlur={() => onFieldBlur?.(getAddressFieldKey(role, 'city', propertyAddressKey))}
            placeholder="City"
            autoComplete="address-level2"
            className={fieldShell(
              activeFieldKey === getAddressFieldKey(role, 'city', propertyAddressKey),
              Boolean(errorFor?.(getAddressFieldKey(role, 'city', propertyAddressKey)))
            )}
          />
          {renderError(getAddressFieldKey(role, 'city', propertyAddressKey))}
        </div>
        <div className="col-span-3 space-y-1">
          <select
            id={`${role}-state`}
            ref={(element) => { inputRefs.current.state = element || undefined; }}
            aria-label={roleCopy.stateLabel}
            value={address.state}
            onChange={(event) => commitPart('state', event.target.value)}
            onFocus={() => onFieldFocus?.(getAddressFieldKey(role, 'state', propertyAddressKey))}
            onBlur={() => onFieldBlur?.(getAddressFieldKey(role, 'state', propertyAddressKey))}
            autoComplete="address-level1"
            className={`w-full px-1.5 ${fieldShell(
              activeFieldKey === getAddressFieldKey(role, 'state', propertyAddressKey),
              Boolean(errorFor?.(getAddressFieldKey(role, 'state', propertyAddressKey)))
            )}`}
          >
            <option value="">ST</option>
            {Object.keys(STATE_STATUTES).map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          {renderError(getAddressFieldKey(role, 'state', propertyAddressKey))}
        </div>
        <div className="col-span-4 space-y-1">
          <input
            type="text"
            ref={(element) => { inputRefs.current.zip = element || undefined; }}
            aria-label={`${roleCopy.noun} ZIP code`}
            value={address.zip}
            maxLength={10}
            onChange={(event) => commitPart('zip', event.target.value)}
            onFocus={() => onFieldFocus?.(getAddressFieldKey(role, 'zip', propertyAddressKey))}
            onBlur={() => onFieldBlur?.(getAddressFieldKey(role, 'zip', propertyAddressKey))}
            placeholder="ZIP"
            autoComplete="postal-code"
            inputMode="numeric"
            className={fieldShell(
              activeFieldKey === getAddressFieldKey(role, 'zip', propertyAddressKey),
              Boolean(errorFor?.(getAddressFieldKey(role, 'zip', propertyAddressKey)))
            )}
          />
          {renderError(getAddressFieldKey(role, 'zip', propertyAddressKey))}
        </div>
      </div>

      {suggestionState.status === 'unavailable' && (
        <p className="text-[11px] text-slate-400" role="status">
          Enter city and state manually. ZIP-only suggestions are not configured.
        </p>
      )}
      {suggestionState.status === 'loading' && (
        <p className="text-[11px] text-slate-400" role="status">Checking ZIP suggestion…</p>
      )}
      {suggestionState.status === 'unknown' && (
        <p className="text-[11px] text-slate-400" role="status">
          No single city and state suggestion is available for this ZIP. Enter them manually.
        </p>
      )}
      {suggestionState.status === 'ambiguous' && (
        <p className="text-[11px] text-slate-400" role="status">
          This ZIP may map to multiple cities. Enter the city and state shown on this address manually.
        </p>
      )}
      {suggestionState.status === 'error' && (
        <p className="text-[11px] text-slate-400" role="status">
          ZIP suggestions are unavailable right now. Enter city and state manually.
        </p>
      )}
      {suggestionState.status === 'suggestion' && suggestionState.suggestion && (
        address.city.trim() || address.state.trim() ? (
          <p className="text-[11px] text-slate-400" role="status">
            Existing city/state values are preserved. Edit them manually if needed.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded border border-sky-800 bg-sky-950/50 p-2.5">
            <div>
              <p className="text-[11px] text-sky-200" role="status">
                Postal city/state suggestion: {suggestionState.suggestion.city}, {suggestionState.suggestion.state}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-slate-400">
                Postal location only. Confirm it matches this address. A ZIP does not establish residence or legal jurisdiction. Data by{' '}
                <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="underline">
                  GeoNames (CC BY 4.0)
                </a>.
              </p>
              {role === 'rentalProperty' && (
                <p className="mt-1 text-[10px] leading-snug text-slate-400">
                  Using this suggestion also sets the property state used in state-specific notice details. Verify it before continuing.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleUseSuggestion}
              className="shrink-0 rounded bg-sky-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-600"
            >
              {role === 'rentalProperty' ? 'Use for this property' : 'Use for this address'}
            </button>
          </div>
        )
      )}
    </div>
  );
};
