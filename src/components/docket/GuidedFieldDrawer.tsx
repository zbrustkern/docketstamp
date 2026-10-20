'use client';

/**
 * GuidedFieldDrawer: Interactive Customer Field Drawer
 *
 * Implements Sprint S4 requirements conforming to Sections 7.4, 7.5, and 7.6 of
 * docs/DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md:
 * - Customer-facing display title alongside formal document title
 * - Customer-friendly 3-stage progression indicator:
 *   1. Letter details -> 2. Review and sign -> 3. Delivery and payment
 * - Plain section labels:
 *   "Your details", "Recipient details", "Letter details", "Review and sign"
 * - Visible "Reset draft" action to clear session draft
 * - Inline field validation messages and input highlight on blur / primary action
 * - Focus and scroll to first invalid field or signature adoption control (#signature-adoption-control)
 * - Revision-tied signature invalidation banner ("Letter details changed — please review your updated letter and re-adopt your signature.")
 * - Verbatim statutory affirmation and UPL disclosures
 * - Primary action reads "Choose delivery and pay" when valid and signed
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  NoticeTemplateDefinition,
  NoticeFieldConfig,
  VerifiedRecipientEntry,
} from '@/lib/docket/types';
import { STATE_STATUTES, getStateStatute } from '@/lib/docket/data/state-statutes';
import {
  searchVerifiedRecipients,
} from '@/lib/docket/data/verified-recipients';
import { assertNonFitnessEntity, isFitnessEntity } from '@/lib/docket/guardrails';
import { getChooserLetterBySlug } from '@/lib/docket/chooser-routing';
import { DraftValidationResult } from '@/lib/docket/draft-recovery';
import { PostalAddressFields } from './PostalAddressFields';
import type { AddressPart, PostalCodeLookup } from './address-intake';

export interface GuidedFieldDrawerProps {
  notice: NoticeTemplateDefinition;
  userValues: Record<string, string>;
  onChange: (key: string, value: string) => void;
  activeFieldKey: string | null;
  onFieldFocus: (key: string) => void;
  isSignatureAdopted: boolean;
  isAffirmed: boolean;
  onAffirmationChange: (affirmed: boolean) => void;
  signatureInvalidatedByEdit?: boolean;
  validation: DraftValidationResult;
  onAdoptSignature: (signerName: string) => void;
  onNextRequiredField: () => void;
  onReviewLetter: () => void;
  onCompleteDrawer: () => void;
  onResetDraft: () => void;
  postalCodeLookup?: PostalCodeLookup;
}

export const GuidedFieldDrawer: React.FC<GuidedFieldDrawerProps> = ({
  notice,
  userValues,
  onChange,
  activeFieldKey,
  onFieldFocus,
  isSignatureAdopted,
  isAffirmed,
  onAffirmationChange,
  signatureInvalidatedByEdit = false,
  validation,
  onAdoptSignature,
  onNextRequiredField,
  onReviewLetter,
  onCompleteDrawer,
  onResetDraft,
  postalCodeLookup,
}) => {
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
  const [recipientManualMode, setRecipientManualMode] = useState(false);
  const [signatureInput, setSignatureInput] = useState(
    userValues.senderFullName || userValues.tenantFullName || ''
  );
  const [fitnessWarning, setFitnessWarning] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(() => new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);

  const inputRefs = useRef<Record<string, HTMLElement | null>>({});

  const displayTitle = getChooserLetterBySlug(notice.slug)?.displayTitle || notice.title;
  const formalTitle = notice.documentHeaderTitle || notice.title;

  // Determine current progression stage
  const currentStage = !validation.isValid
    ? 1
    : !isSignatureAdopted
    ? 2
    : 3;

  // Sync signature input if sender full name changes and not manually overridden
  useEffect(() => {
    if (!signatureInput && userValues.senderFullName) {
      setSignatureInput(userValues.senderFullName);
    }
  }, [userValues.senderFullName, signatureInput]);

  // Focus active field when requested from paper tag click, URL focus, or error focus
  useEffect(() => {
    if (activeFieldKey) {
      if (activeFieldKey === 'signature') {
        const sigEl = document.getElementById('signature-adoption-control');
        if (sigEl) {
          sigEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const sigInput = document.querySelector('[data-testid="signature-input"]') as HTMLInputElement;
        if (sigInput) {
          sigInput.focus();
        }
        return;
      }

      const el =
        inputRefs.current[activeFieldKey] ||
        (document.querySelector(`[data-field-key="${activeFieldKey}"]`) as HTMLElement | null);

      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if ('focus' in el && typeof (el as HTMLElement).focus === 'function') {
          (el as HTMLElement).focus();
        }
      }
    }
  }, [activeFieldKey]);

  const markTouched = (key: string) => {
    setTouchedFields((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const addressErrorFor = (key: string) =>
    showAllErrors || touchedFields.has(key) ? validation.fieldErrors[key] : undefined;

  // Handle smart recipient selection for corporate / bureau notices
  const handleSelectVerifiedRecipient = (recipient: VerifiedRecipientEntry) => {
    try {
      assertNonFitnessEntity(recipient.brandName);
      setFitnessWarning(null);
    } catch {
      setFitnessWarning(
        'DocketStamp does not prepare or mail gym, health club, or fitness studio cancellation letters (NAICS 713940).'
      );
      return;
    }

    onChange('recipientFormalName', recipient.formalRecipientLine || recipient.brandName);
    onChange('recipientAddressLine1', recipient.addressLine1);
    onChange('recipientCity', recipient.city);
    onChange('recipientState', recipient.state);
    onChange('recipientZip', recipient.zip);
    if (notice.slug.includes('credit-bureau')) {
      onChange('bureauEntityId', recipient.id);
    }
  };

  // Handle state change for statutory security deposit
  const handleStateChange = (stateCode: string) => {
    onChange('propertyState', stateCode);
    const statute = getStateStatute(stateCode);
    if (statute) {
      onChange('statuteCitation', statute.statuteCitation);
      onChange('statuteDeadline', statute.returnDeadlineLabel);
    }
  };

  const handlePrimaryActionClick = () => {
    if (!validation.isValid) {
      setShowAllErrors(true);
      onNextRequiredField();
    } else if (!isSignatureAdopted) {
      onNextRequiredField();
    } else {
      onCompleteDrawer();
    }
  };

  // Tenant property location is separate from sender and recipient mail routes.
  const isTenantNotice = notice.category === 'tenant';
  const propertyAddressField = isTenantNotice
    ? notice.fields.find((field) =>
        ['leasedPremisesAddress', 'vacatedPremisesAddress'].includes(field.key)
      )
    : undefined;
  const propertyStateField = isTenantNotice
    ? notice.fields.find((field) => field.key === 'propertyState')
    : undefined;

  // Group fields into sections
  const recipientFields = notice.fields.filter((f) => f.stepGroup === 'recipient');
  const detailFields = notice.fields.filter(
    (f) =>
      (f.stepGroup === 'instrument_details' || !['recipient', 'sender'].includes(f.stepGroup)) &&
      f.key !== propertyAddressField?.key &&
      f.key !== propertyStateField?.key
  );
  const senderFields = notice.fields.filter((f) => f.stepGroup === 'sender');

  const filteredRecipients = notice.recipientMode.startsWith('verified')
    ? searchVerifiedRecipients(recipientSearchQuery)
    : [];

  return (
    <div
      className="bg-slate-900 border-l border-slate-800 text-white flex flex-col h-full w-full max-w-full md:max-w-[460px] shadow-2xl relative"
      data-testid="guided-field-drawer"
    >
      {/* Drawer Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold">
            Letter Preparation
          </span>
          <button
            type="button"
            onClick={onResetDraft}
            className="text-[11px] text-slate-400 hover:text-rose-400 transition underline font-mono"
            title="Clear all saved draft details"
          >
            Reset draft
          </button>
        </div>

        <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">
          {displayTitle}
        </h2>
        {displayTitle !== notice.title && (
          <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">
            {notice.title}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
          {notice.shortDescription}
        </p>

        {/* 3-Stage Progression Indicator */}
        <nav aria-label="Letter preparation stages" className="mt-3 pt-3 border-t border-slate-800">
          <ol className="flex items-center justify-between text-xs font-mono">
            <li
              className={`flex items-center gap-1.5 ${
                currentStage === 1
                  ? 'text-sky-400 font-bold'
                  : currentStage > 1
                  ? 'text-emerald-400 font-medium'
                  : 'text-slate-500'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStage === 1
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                    : currentStage > 1
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {currentStage > 1 ? '✓' : '1'}
              </span>
              <span>1. Letter details</span>
            </li>
            <span className="text-slate-700 text-xs">→</span>
            <li
              className={`flex items-center gap-1.5 ${
                currentStage === 2
                  ? 'text-sky-400 font-bold'
                  : currentStage > 2
                  ? 'text-emerald-400 font-medium'
                  : 'text-slate-500'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStage === 2
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                    : currentStage > 2
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {currentStage > 2 ? '✓' : '2'}
              </span>
              <span>2. Review & sign</span>
            </li>
            <span className="text-slate-700 text-xs">→</span>
            <li
              className={`flex items-center gap-1.5 ${
                currentStage === 3
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-500'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStage === 3
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                3
              </span>
              <span>3. Delivery</span>
            </li>
          </ol>
        </nav>
      </div>

      {/* Drawer Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 pb-32">
        {isTenantNotice && propertyAddressField && (
          <section className="space-y-4" data-testid="rental-property-section">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-sky-400 inline-flex items-center justify-center mr-2 text-[10px]">1</span>
                Rental property address
              </h3>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Enter the rental location for this notice. It is separate from your sender mailing address and the recipient&apos;s delivery destination.
              </p>
            </div>
            <PostalAddressFields
              role="rentalProperty"
              values={userValues}
              propertyAddressKey={propertyAddressField.key}
              primaryField={propertyAddressField}
              stateField={propertyStateField}
              activeFieldKey={activeFieldKey}
              onFieldFocus={onFieldFocus}
              onFieldBlur={markTouched}
              errorFor={addressErrorFor}
              postalCodeLookup={postalCodeLookup}
              onChange={onChange}
              onPartChange={(part: AddressPart, key, value) => {
                if (part === 'state') handleStateChange(value);
                else onChange(key, value);
              }}
            />
            {propertyStateField && userValues[propertyStateField.key] && (
              <div className="bg-sky-950/50 border border-sky-800 p-2.5 rounded text-[11px] text-sky-300 space-y-1 font-mono">
                <div><strong>PROPERTY STATUTE:</strong> {getStateStatute(userValues[propertyStateField.key])?.statuteCitation}</div>
                <div><strong>RETURN DEADLINE:</strong> {getStateStatute(userValues[propertyStateField.key])?.returnDeadlineLabel}</div>
                <div className="text-[10px] text-slate-400 font-sans">
                  This selection describes the rental property jurisdiction. It does not set your residence or mailing address.
                </div>
                <div className="text-[10px] text-slate-400 font-sans">
                  {getStateStatute(userValues[propertyStateField.key])?.statutoryNuance}
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION 1: SENDER (Your details) */}
        <div className="space-y-4">
          <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-sky-400 inline-flex items-center justify-center mr-2 text-[10px]">
                {isTenantNotice ? '2' : '1'}
              </span>
              Your details
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Sender & Return Address</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            This is the sender&apos;s mailing and USPS return address. It may differ from the rental property and from a forwarding address.
          </p>

          {senderFields.map((field) => (
            <FieldInputRow
              key={field.key}
              field={field}
              value={userValues[field.key] || ''}
              isActive={activeFieldKey === field.key}
              error={
                showAllErrors || touchedFields.has(field.key)
                  ? validation.fieldErrors[field.key]
                  : undefined
              }
              onChange={(val) => {
                onChange(field.key, val);
                if (field.key === 'senderFullName') setSignatureInput(val);
              }}
              onFocus={() => onFieldFocus(field.key)}
              onBlur={() => markTouched(field.key)}
              inputRef={(el) => (inputRefs.current[field.key] = el)}
            />
          ))}

          <PostalAddressFields
            role="senderMailing"
            values={userValues}
            activeFieldKey={activeFieldKey}
            onFieldFocus={onFieldFocus}
            onFieldBlur={markTouched}
            errorFor={addressErrorFor}
            postalCodeLookup={postalCodeLookup}
            onChange={onChange}
          />
        </div>

        {/* SECTION 2: RECIPIENT (Recipient details) */}
        <div className="space-y-4">
          <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-sky-400 inline-flex items-center justify-center mr-2 text-[10px]">
                {isTenantNotice ? '3' : '2'}
              </span>
              Recipient details
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Destination Address</span>
          </div>

          {/* Institutional Recipient Selector for verified notices */}
          {notice.recipientMode.startsWith('verified') && (
            <div className="bg-slate-950/60 p-3.5 rounded border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-sky-400 font-bold">
                  Verified recipients
                </span>
                {notice.recipientMode !== 'verified_credit_bureau' && (
                  <button
                    type="button"
                    onClick={() => setRecipientManualMode(!recipientManualMode)}
                    className="text-[11px] text-slate-400 underline hover:text-white"
                  >
                    {recipientManualMode ? 'Use autocomplete' : 'Enter manually'}
                  </button>
                )}
              </div>

              {!recipientManualMode ? (
                <>
                  <input
                    type="text"
                    placeholder="Search verified corporate recipient (e.g. Equifax, ADT, Xfinity)..."
                    value={recipientSearchQuery}
                    onChange={(e) => setRecipientSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {filteredRecipients.slice(0, 8).map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => handleSelectVerifiedRecipient(rec)}
                        className={`w-full text-left p-2 rounded text-xs transition border flex justify-between items-center ${
                          userValues.recipientFormalName === rec.formalRecipientLine ||
                          userValues.bureauEntityId === rec.id
                            ? 'bg-sky-950/80 border-sky-600 text-white'
                            : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-100">{rec.brandName}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[240px]">
                            {rec.formalRecipientLine} &bull; {rec.city}, {rec.state}
                          </div>
                        </div>
                        <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-sky-400 font-mono">
                          VERIFIED
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-xs text-amber-400/90 font-sans">
                  Manual recipient address mode active. Address will be verified before dispatch.
                </div>
              )}
            </div>
          )}

          {/* Fitness Warning Banner */}
          {fitnessWarning && (
            <div className="bg-rose-950/80 border border-rose-600 p-3 rounded text-xs text-rose-200">
              {fitnessWarning}
            </div>
          )}

          {/* Recipient Notice Fields */}
          {recipientFields.map((field) => (
            <FieldInputRow
              key={field.key}
              field={field}
              value={userValues[field.key] || ''}
              isActive={activeFieldKey === field.key}
              error={
                showAllErrors || touchedFields.has(field.key)
                  ? validation.fieldErrors[field.key]
                  : undefined
              }
              onChange={(val) => {
                if (isFitnessEntity(val)) {
                  setFitnessWarning(
                    'DocketStamp does not prepare or mail gym, health club, or fitness studio cancellation letters (NAICS 713940).'
                  );
                } else {
                  setFitnessWarning(null);
                }
                onChange(field.key, val);
              }}
              onFocus={() => onFieldFocus(field.key)}
              onBlur={() => markTouched(field.key)}
              inputRef={(el) => (inputRefs.current[field.key] = el)}
            />
          ))}

          {/* Manual Recipient Address Input (When not using bureau dropdown) */}
          {(recipientManualMode || notice.recipientMode === 'manual_landlord') && (
            <div className="space-y-3 pt-1">
              <p className="text-[11px] leading-relaxed text-slate-400">
                Use the recipient&apos;s mailing destination. It may differ from both the rental property and your sender return address.
              </p>
              <PostalAddressFields
                role="recipientDestination"
                values={userValues}
                activeFieldKey={activeFieldKey}
                onFieldFocus={onFieldFocus}
                onFieldBlur={markTouched}
                errorFor={addressErrorFor}
                postalCodeLookup={postalCodeLookup}
                onChange={onChange}
              />
            </div>
          )}
        </div>

        {/* SECTION 3: LETTER DETAILS */}
        <div className="space-y-4">
          <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-sky-400 inline-flex items-center justify-center mr-2 text-[10px]">
                {isTenantNotice ? '4' : '3'}
              </span>
              Letter details
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Template Terms</span>
          </div>

          {detailFields.map((field) => {
            if (field.inputType === 'state_select' && notice.usesStateStatuteLookup) {
              const fieldError =
                showAllErrors || touchedFields.has(field.key)
                  ? validation.fieldErrors[field.key]
                  : undefined;

              return (
                <div
                  key={field.key}
                  data-field-key={field.key}
                  className="space-y-1.5 p-3 rounded-md bg-slate-950/40 border border-slate-800/70"
                >
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-200">
                      {field.label}
                    </label>
                    <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                      [ {field.docusignTagLabel} ]
                    </span>
                  </div>
                  <select
                    data-field-key={field.key}
                    value={userValues[field.key] || ''}
                    onChange={(e) => handleStateChange(e.target.value)}
                    onFocus={() => onFieldFocus(field.key)}
                    onBlur={() => markTouched(field.key)}
                    ref={(el) => { inputRefs.current[field.key] = el; }}
                    className={`w-full bg-slate-800 border rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      fieldError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-700'
                    }`}
                  >
                    <option value="">-- Select Property State --</option>
                    {Object.values(STATE_STATUTES).map((st) => (
                      <option key={st.stateCode} value={st.stateCode}>
                        {st.stateName} ({st.returnDeadlineLabel})
                      </option>
                    ))}
                  </select>
                  {fieldError && (
                    <p className="text-[11px] text-rose-400 font-sans mt-1">
                      {fieldError}
                    </p>
                  )}
                  {userValues[field.key] && (
                    <div className="bg-sky-950/50 border border-sky-800 p-2.5 rounded text-[11px] text-sky-300 space-y-1 font-mono">
                      <div>
                        <strong>CITATION:</strong> {getStateStatute(userValues[field.key])?.statuteCitation}
                      </div>
                      <div>
                        <strong>DEADLINE:</strong> {getStateStatute(userValues[field.key])?.returnDeadlineLabel}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {getStateStatute(userValues[field.key])?.statutoryNuance}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <FieldInputRow
                key={field.key}
                field={field}
                value={userValues[field.key] || ''}
                isActive={activeFieldKey === field.key}
                error={
                  showAllErrors || touchedFields.has(field.key)
                    ? validation.fieldErrors[field.key]
                    : undefined
                }
                onChange={(val) => onChange(field.key, val)}
                onFocus={() => onFieldFocus(field.key)}
                onBlur={() => markTouched(field.key)}
                inputRef={(el) => (inputRefs.current[field.key] = el)}
              />
            );
          })}
        </div>

        {/* SECTION 4: REVIEW AND SIGN (#signature-adoption-control) */}
        <div id="signature-adoption-control" className="space-y-4 pt-2">
          <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-sky-400 inline-flex items-center justify-center mr-2 text-[10px]">
                {isTenantNotice ? '5' : '4'}
              </span>
              Review and sign
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Legal Execution</span>
          </div>

          {/* Signature Invalidation Alert Banner */}
          {signatureInvalidatedByEdit && (
            <div className="bg-amber-950/80 border border-amber-600/80 text-amber-200 px-3.5 py-2.5 rounded text-xs flex items-start gap-2">
              <span className="text-amber-400 font-bold">!</span>
              <span>
                Letter details changed — please review your updated letter and re-adopt your signature.
              </span>
            </div>
          )}

          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-md space-y-3">
            <label className="text-xs font-semibold text-slate-200 block">
              Type Full Legal Name to Adopt Electronic Signature
            </label>
            <input
              type="text"
              data-testid="signature-input"
              data-field-key="signature"
              placeholder="e.g., Alex M. Rivera"
              value={signatureInput}
              onChange={(e) => {
                setSignatureInput(e.target.value);
                onChange('senderFullName', e.target.value);
              }}
              onFocus={() => onFieldFocus('signature')}
              ref={(el) => { inputRefs.current['signature'] = el; }}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono placeholder-slate-600"
            />

            {/* Self-Representation & Irreversibility Affirmation Checkbox (Preserved verbatim) */}
            <label className="flex items-start gap-3 p-3 bg-slate-900 rounded border border-slate-800 text-xs text-slate-300 cursor-pointer hover:bg-slate-850 transition">
              <input
                type="checkbox"
                checked={isAffirmed}
                onChange={(e) => onAffirmationChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-800 text-sky-600 focus:ring-sky-500 focus:ring-offset-slate-900 cursor-pointer shrink-0"
              />
              <span className="leading-relaxed select-none">
                I affirm that I am the self-represented individual executing this notice on my own behalf, I understand DocketStamp is an automated self-help document preparation and USPS dispatch utility (not a law firm and does not provide legal advice), and I acknowledge that physical USPS mail dispatches are irreversible once submitted to the postal stream.
              </span>
            </label>

            <div className="p-3 bg-slate-900 rounded border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-mono text-slate-500">
                  Electronic Signature Line
                </div>
                <div className="text-base font-mono font-bold text-sky-400">
                  {signatureInput.trim() ? `/s/ ${signatureInput.trim()}` : '/s/ [Type Name Above]'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (signatureInput.trim() && isAffirmed) {
                    onAdoptSignature(signatureInput.trim());
                  }
                }}
                disabled={!signatureInput.trim() || !isAffirmed}
                className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
                  isSignatureAdopted
                    ? 'bg-emerald-700 text-white'
                    : signatureInput.trim() && isAffirmed
                    ? 'bg-sky-600 hover:bg-sky-500 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isSignatureAdopted ? 'Signature Adopted ✓' : 'Adopt & Sign Letter'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer Sticky Bottom CTA */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/95 sticky bottom-0 z-20 backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={isSignatureAdopted ? onReviewLetter : onNextRequiredField}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded text-xs font-bold uppercase tracking-wider transition border border-slate-700"
          >
            {!validation.isValid
              ? 'Next detail →'
              : !isSignatureAdopted
              ? 'Review and sign →'
              : 'Review letter →'}
          </button>
          <button
            type="button"
            onClick={handlePrimaryActionClick}
            className={`flex-1 py-3 rounded text-xs font-bold uppercase tracking-wider transition shadow-lg ${
              !validation.isValid
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : !isSignatureAdopted
                ? 'bg-sky-600 hover:bg-sky-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {!validation.isValid
              ? 'Complete required details'
              : !isSignatureAdopted
              ? 'Review and sign'
              : 'Choose delivery and pay →'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface FieldInputRowProps {
  field: NoticeFieldConfig;
  value: string;
  isActive: boolean;
  error?: string;
  onChange: (val: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  inputRef: (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => void;
}

const FieldInputRow: React.FC<FieldInputRowProps> = ({
  field,
  value,
  isActive,
  error,
  onChange,
  onFocus,
  onBlur,
  inputRef,
}) => {
  const isFilled = value.trim().length > 0 && !value.startsWith('[');

  return (
    <div
      data-field-key={field.key}
      className={`p-3 rounded-md transition-all duration-150 space-y-1.5 ${
        isActive
          ? 'bg-slate-800/90 ring-1 ring-sky-500 border border-sky-500/50'
          : error
          ? 'bg-rose-950/30 border border-rose-800/80 ring-1 ring-rose-500/40'
          : 'bg-slate-950/40 border border-slate-800/70 hover:border-slate-700'
      }`}
    >
      <div className="flex justify-between items-center">
        <label className="text-xs font-semibold text-slate-200">
          {field.label}
        </label>
        <span
          className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded uppercase ${
            isFilled && !error
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : error
              ? 'bg-rose-950 text-rose-300 border border-rose-700'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}
        >
          {isFilled && !error ? 'COMPLETED' : `[ ${field.docusignTagLabel} ]`}
        </span>
      </div>

      {field.helperText && (
        <p className="text-[11px] text-slate-400 font-sans leading-tight">
          {field.key === 'forwardingAddress'
            ? field.helperText + ' This may differ from your sender mailing / return address.'
            : field.helperText}
        </p>
      )}

      {field.inputType === 'select' ? (
        <select
          data-field-key={field.key}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          ref={inputRef}
          className={`w-full bg-slate-800 border rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 ${
            error ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-700'
          }`}
        >
          <option value="">-- Select Option --</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.inputType === 'textarea_short' ? (
        <textarea
          data-field-key={field.key}
          rows={3}
          maxLength={field.maxLength || 220}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          ref={inputRef}
          className={`w-full bg-slate-800 border rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500 leading-normal ${
            error ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-700'
          }`}
        />
      ) : (
        <input
          data-field-key={field.key}
          type={field.inputType === 'date' ? 'date' : 'text'}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          ref={inputRef}
          className={`w-full bg-slate-800 border rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500 ${
            error ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-700'
          }`}
        />
      )}

      {error && (
        <p className="text-[11px] text-rose-400 font-sans mt-1">
          {error}
        </p>
      )}
    </div>
  );
};
