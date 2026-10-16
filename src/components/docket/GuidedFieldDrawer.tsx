'use client';

/**
 * GuidedFieldDrawer: DocuSign-Style Interactive Field Execution Drawer
 *
 * Implements Section 3 of docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md:
 * - Stepped and grouped field input
 * - Smart 50-State statutory lookup for Notice #2
 * - Smart Verified Recipient autocomplete for Notices #4, #5, #6
 * - 16px base font inputs to prevent iOS Safari auto-zoom
 * - Signature & Stamp adoption step
 * - Mobile virtual keyboard clearance and view toggling
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  NoticeTemplateDefinition,
  NoticeFieldConfig,
  VerifiedRecipientEntry,
} from '@/lib/docket/types';
import { STATE_STATUTES, getStateStatute } from '@/lib/docket/data/state-statutes';
import {
  VERIFIED_RECIPIENTS,
  getVerifiedRecipientById,
  searchVerifiedRecipients,
} from '@/lib/docket/data/verified-recipients';
import { assertNonFitnessEntity, isFitnessEntity } from '@/lib/docket/guardrails';

export interface GuidedFieldDrawerProps {
  notice: NoticeTemplateDefinition;
  userValues: Record<string, string>;
  onChange: (key: string, value: string) => void;
  activeFieldKey: string | null;
  onFieldFocus: (key: string) => void;
  isSignatureAdopted: boolean;
  onAdoptSignature: (signerName: string) => void;
  onNextRequiredField: () => void;
  onCompleteDrawer: () => void;
}

export const GuidedFieldDrawer: React.FC<GuidedFieldDrawerProps> = ({
  notice,
  userValues,
  onChange,
  activeFieldKey,
  onFieldFocus,
  isSignatureAdopted,
  onAdoptSignature,
  onNextRequiredField,
  onCompleteDrawer,
}) => {
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
  const [recipientManualMode, setRecipientManualMode] = useState(false);
  const [signatureInput, setSignatureInput] = useState(
    userValues.senderFullName || userValues.tenantFullName || ''
  );
  const [fitnessWarning, setFitnessWarning] = useState<string | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>({});

  // Sync signature input if sender full name changes
  useEffect(() => {
    if (!signatureInput && userValues.senderFullName) {
      setSignatureInput(userValues.senderFullName);
    }
  }, [userValues.senderFullName, signatureInput]);

  // Focus active field when requested from paper tag click
  useEffect(() => {
    if (activeFieldKey && inputRefs.current[activeFieldKey]) {
      inputRefs.current[activeFieldKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      inputRefs.current[activeFieldKey]?.focus();
    }
  }, [activeFieldKey]);

  // Handle smart recipient selection for corporate / bureau notices
  const handleSelectVerifiedRecipient = (recipient: VerifiedRecipientEntry) => {
    try {
      assertNonFitnessEntity(recipient.brandName);
      setFitnessWarning(null);
    } catch {
      setFitnessWarning('Selected entity is in an excluded category.');
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

  // Handle state change for Notice #2 (Statutory security deposit)
  const handleStateChange = (stateCode: string) => {
    onChange('propertyState', stateCode);
    const statute = getStateStatute(stateCode);
    if (statute) {
      onChange('statuteCitation', statute.statuteCitation);
      onChange('statuteDeadline', statute.returnDeadlineLabel);
    }
  };

  // Group fields into intuitive sections
  const recipientFields = notice.fields.filter((f) => f.stepGroup === 'recipient');
  const detailFields = notice.fields.filter((f) => f.stepGroup === 'instrument_details');
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
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-mono uppercase tracking-widest text-sky-400 font-bold">
            GUIDED INSTRUMENT WORKSPACE
          </span>
          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
            {notice.category.toUpperCase()}
          </span>
        </div>
        <h2 className="text-base sm:text-lg font-bold text-slate-100 truncate">
          {notice.title}
        </h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
          {notice.shortDescription}
        </p>
      </div>

      {/* Drawer Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 pb-32">
        {/* SECTION 1: SENDER (THE EXECUTING PARTY) */}
        <div className="space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-sky-400 inline-flex items-center justify-center mr-2 text-[10px]">
                1
              </span>
              EXECUTING SENDER IDENTITY
            </h3>
          </div>

          {senderFields.map((field) => (
            <FieldInputRow
              key={field.key}
              field={field}
              value={userValues[field.key] || ''}
              isActive={activeFieldKey === field.key}
              onChange={(val) => {
                onChange(field.key, val);
                if (field.key === 'senderFullName') setSignatureInput(val);
              }}
              onFocus={() => onFieldFocus(field.key)}
              inputRef={(el) => (inputRefs.current[field.key] = el)}
            />
          ))}

          {/* Sender Physical Address Block */}
          <div className="grid grid-cols-1 gap-3 pt-1">
            <label className="text-xs font-medium text-slate-300">
              Sender Mailing Address (For USPS Return & Accounting)
            </label>
            <input
              type="text"
              placeholder="Street Address (e.g., 742 Evergreen Terrace)"
              value={userValues.senderAddressLine1 || userValues.leasedPremisesAddress || ''}
              onChange={(e) => onChange('senderAddressLine1', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500"
              autoComplete="address-line1"
            />
            <div className="grid grid-cols-6 gap-2">
              <input
                type="text"
                placeholder="City"
                value={userValues.senderCity || ''}
                onChange={(e) => onChange('senderCity', e.target.value)}
                className="col-span-3 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500"
                autoComplete="address-level2"
              />
              <select
                value={userValues.senderState || ''}
                onChange={(e) => onChange('senderState', e.target.value)}
                className="col-span-1 bg-slate-800 border border-slate-700 rounded px-1.5 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">ST</option>
                {Object.keys(STATE_STATUTES).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="ZIP"
                maxLength={10}
                value={userValues.senderZip || ''}
                onChange={(e) => onChange('senderZip', e.target.value)}
                className="col-span-2 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500"
                autoComplete="postal-code"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: RECIPIENT & VERIFIED LOOKUP */}
        <div className="space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-sky-400 inline-flex items-center justify-center mr-2 text-[10px]">
                2
              </span>
              DESTINATION RECIPIENT & JURISDICTION
            </h3>
          </div>

          {/* Institutional Recipient Selector for Notices #4, #5, #6 */}
          {notice.recipientMode.startsWith('verified') && (
            <div className="bg-slate-950/60 p-3.5 rounded border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-sky-400 font-bold">
                  PRE-VERIFIED INSTITUTIONAL RECIPIENTS
                </span>
                {notice.recipientMode !== 'verified_credit_bureau' && (
                  <button
                    type="button"
                    onClick={() => setRecipientManualMode(!recipientManualMode)}
                    className="text-[11px] text-slate-400 underline hover:text-white"
                  >
                    {recipientManualMode ? 'Use Autocomplete' : 'Enter Manually'}
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
                  Custom Manual Recipient Mode: Address will be CASS verified at checkout.
                </div>
              )}
            </div>
          )}

          {/* Fitness Conflict Alert */}
          {fitnessWarning && (
            <div className="bg-rose-950/80 border border-rose-600 p-3 rounded text-xs text-rose-200">
              {fitnessWarning}
            </div>
          )}

          {/* Standard Recipient Fields */}
          {recipientFields.map((field) => (
            <FieldInputRow
              key={field.key}
              field={field}
              value={userValues[field.key] || ''}
              isActive={activeFieldKey === field.key}
              onChange={(val) => {
                try {
                  assertNonFitnessEntity(val);
                  setFitnessWarning(null);
                } catch (err: any) {
                  setFitnessWarning(err.message);
                }
                onChange(field.key, val);
              }}
              onFocus={() => onFieldFocus(field.key)}
              inputRef={(el) => (inputRefs.current[field.key] = el)}
            />
          ))}

          {/* Manual Recipient Address Input (When not using bureau dropdown) */}
          {(recipientManualMode || notice.recipientMode === 'manual_landlord') && (
            <div className="space-y-3 pt-1">
              <label className="text-xs font-medium text-slate-300">
                Recipient Postal Address (Landlord / Corporate Office)
              </label>
              <input
                type="text"
                placeholder="Recipient Street Address (e.g., P.O. Box 740256 or 100 Main St)"
                value={userValues.recipientAddressLine1 || ''}
                onChange={(e) => onChange('recipientAddressLine1', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500"
              />
              <div className="grid grid-cols-6 gap-2">
                <input
                  type="text"
                  placeholder="City"
                  value={userValues.recipientCity || ''}
                  onChange={(e) => onChange('recipientCity', e.target.value)}
                  className="col-span-3 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500"
                />
                <select
                  value={userValues.recipientState || ''}
                  onChange={(e) => onChange('recipientState', e.target.value)}
                  className="col-span-1 bg-slate-800 border border-slate-700 rounded px-1.5 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">ST</option>
                  {Object.keys(STATE_STATUTES).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="ZIP"
                  maxLength={10}
                  value={userValues.recipientZip || ''}
                  onChange={(e) => onChange('recipientZip', e.target.value)}
                  className="col-span-2 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: INSTRUMENT PARAMETERS & STATUTORY DETAILS */}
        <div className="space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-sky-400 inline-flex items-center justify-center mr-2 text-[10px]">
                3
              </span>
              INSTRUMENT DETAILS & STATUTORY PROVISIONS
            </h3>
          </div>

          {detailFields.map((field) => {
            if (field.inputType === 'state_select' && notice.usesStateStatuteLookup) {
              return (
                <div key={field.key} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-200">
                      {field.label}
                    </label>
                    <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                      [ {field.docusignTagLabel} ]
                    </span>
                  </div>
                  <select
                    value={userValues[field.key] || ''}
                    onChange={(e) => handleStateChange(e.target.value)}
                    ref={(el) => { inputRefs.current[field.key] = el; }}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">-- Select Property State --</option>
                    {Object.values(STATE_STATUTES).map((st) => (
                      <option key={st.stateCode} value={st.stateCode}>
                        {st.stateName} ({st.returnDeadlineLabel})
                      </option>
                    ))}
                  </select>
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
                onChange={(val) => onChange(field.key, val)}
                onFocus={() => onFieldFocus(field.key)}
                inputRef={(el) => (inputRefs.current[field.key] = el)}
              />
            );
          })}
        </div>

        {/* SECTION 4: SIGNATURE & CLERK STAMP ADOPTION */}
        <div className="space-y-4 pt-2">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-sky-400 inline-flex items-center justify-center mr-2 text-[10px]">
                4
              </span>
              ELECTRONIC SIGNATURE & STAMP ADOPTION
            </h3>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-md space-y-3">
            <label className="text-xs font-semibold text-slate-200 block">
              Type Full Legal Name to Adopt Electronic Signature
            </label>
            <input
              type="text"
              placeholder="e.g., Alex M. Rivera"
              value={signatureInput}
              onChange={(e) => {
                setSignatureInput(e.target.value);
                onChange('senderFullName', e.target.value);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono placeholder-slate-600"
            />

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
                  if (signatureInput.trim()) {
                    onAdoptSignature(signatureInput.trim());
                  }
                }}
                disabled={!signatureInput.trim()}
                className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
                  isSignatureAdopted
                    ? 'bg-emerald-700 text-white'
                    : signatureInput.trim()
                    ? 'bg-sky-600 hover:bg-sky-500 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isSignatureAdopted ? 'Signature Adopted ✓' : 'Adopt & Stamp Instrument'}
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
            onClick={onNextRequiredField}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded text-xs font-bold uppercase tracking-wider transition border border-slate-700"
          >
            Next Required Field →
          </button>
          <button
            type="button"
            onClick={onCompleteDrawer}
            disabled={!isSignatureAdopted}
            className={`flex-1 py-3 rounded text-xs font-bold uppercase tracking-wider transition shadow-lg ${
              isSignatureAdopted
                ? 'bg-sky-600 hover:bg-sky-500 text-white'
                : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-800'
            }`}
          >
            Dispatch Notice →
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
  onChange: (val: string) => void;
  onFocus: () => void;
  inputRef: (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => void;
}

const FieldInputRow: React.FC<FieldInputRowProps> = ({
  field,
  value,
  isActive,
  onChange,
  onFocus,
  inputRef,
}) => {
  const isFilled = value.trim().length > 0;

  return (
    <div
      className={`p-3 rounded-md transition-all duration-150 space-y-1.5 ${
        isActive
          ? 'bg-slate-800/90 ring-1 ring-sky-500 border border-sky-500/50'
          : 'bg-slate-950/40 border border-slate-800/70 hover:border-slate-700'
      }`}
    >
      <div className="flex justify-between items-center">
        <label className="text-xs font-semibold text-slate-200">
          {field.label}
        </label>
        <span
          className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded uppercase ${
            isFilled
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}
        >
          {isFilled ? 'COMPLETED' : `[ ${field.docusignTagLabel} ]`}
        </span>
      </div>

      {field.helperText && (
        <p className="text-[11px] text-slate-400 font-sans leading-tight">
          {field.helperText}
        </p>
      )}

      {field.inputType === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          ref={inputRef}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
          rows={3}
          maxLength={field.maxLength || 220}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          ref={inputRef}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500 leading-normal"
        />
      ) : (
        <input
          type={field.inputType === 'date' ? 'date' : 'text'}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          ref={inputRef}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500"
        />
      )}
    </div>
  );
};
