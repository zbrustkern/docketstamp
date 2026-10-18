'use client';

/**
 * LivePaperSheet: High-Fidelity 8.5" x 11" Paper Document Preview
 *
 * Implements the physical document sheet preview on the Midnight Slate workspace:
 * - 8.5in x 11in proportional aspect ratio
 * - Top-right Clerk's Docket Stamp box with live ink stamp state
 * - Interactive FROM / TO address blocks and paragraph tokens:
 *   - Unfilled tokens render as clickable Amber DocuSign action tags
 *   - Filled tokens render as interactive highlighted pills so users always see they can be edited
 * - /s/ Full Name electronic signature block
 * - Locked 6.8pt UPL statutory footer at bottom
 */

import React from 'react';
import { InterpolatedDocument, MailTierId } from '@/lib/docket/types';
import { UPL_COMPLIANCE_FOOTER_TEXT } from '@/lib/docket/guardrails';

export interface LivePaperSheetProps {
  doc: InterpolatedDocument;
  onTokenClick: (fieldKey: string) => void;
  activeFieldKey?: string | null;
  isSignatureAdopted?: boolean;
  selectedTier?: MailTierId;
}

export const LivePaperSheet: React.FC<LivePaperSheetProps> = ({
  doc,
  onTokenClick,
  activeFieldKey,
  isSignatureAdopted = false,
  selectedTier = 'certified',
}) => {
  const tierLabels: Record<MailTierId, string> = {
    first_class: 'USPS FIRST-CLASS MAIL®',
    certified: 'USPS CERTIFIED MAIL®',
    certified_return_receipt: 'USPS CERTIFIED + RETURN RECEIPT',
  };

  const hasSenderName = Boolean(
    doc.senderAddress.name &&
      doc.senderAddress.name.trim().length > 0 &&
      !doc.senderAddress.name.startsWith('[')
  );
  const hasRecipientName = Boolean(
    doc.recipientAddress.name &&
      doc.recipientAddress.name.trim().length > 0 &&
      !doc.recipientAddress.name.startsWith('[')
  );

  return (
    <div
      className="relative w-full max-w-[850px] min-h-[1040px] bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300 p-6 sm:p-10 md:p-12 font-serif select-text flex flex-col justify-between overflow-hidden"
      data-testid="live-paper-sheet"
      style={{
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Top Address Zone & Official Dispatch Stamp */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 pt-1">
          {/* Top-Left Return & Destination Address Block (Clickable to Edit) */}
          <div className="text-xs font-sans text-slate-700 leading-snug space-y-2.5 flex-1">
            {/* FROM BLOCK */}
            <div className="group">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                FROM (SENDER):
              </span>
              <button
                type="button"
                onClick={() => onTokenClick('senderFullName')}
                className={`text-left rounded px-1.5 py-0.5 -ml-1.5 transition border ${
                  activeFieldKey === 'senderFullName'
                    ? 'bg-amber-100 border-amber-500 text-slate-950 ring-2 ring-amber-400/50'
                    : hasSenderName
                    ? 'bg-sky-50/80 border-sky-300/80 hover:bg-amber-50 hover:border-amber-400 text-slate-900'
                    : 'bg-[#FEF3C7] border-[#D97706] text-[#92400E] font-mono text-[11px] font-bold uppercase'
                }`}
                title="Click to edit your name and return address"
              >
                {hasSenderName ? (
                  <span className="font-semibold">{doc.senderAddress.name}</span>
                ) : (
                  <span>[ REQUIRED: YOUR FULL NAME ]</span>
                )}
              </button>
              {doc.senderAddress.address_line1 ? (
                <div
                  onClick={() => onTokenClick('senderFullAddress')}
                  className="text-[11px] text-slate-600 mt-0.5 cursor-pointer hover:text-slate-900"
                >
                  {doc.senderAddress.address_line1}
                  {doc.senderAddress.address_city && `, ${doc.senderAddress.address_city}`}
                  {doc.senderAddress.address_state && `, ${doc.senderAddress.address_state}`}{' '}
                  {doc.senderAddress.address_zip || ''}
                </div>
              ) : null}
            </div>

            {/* TO BLOCK */}
            <div className="group pt-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                TO (RECIPIENT):
              </span>
              <button
                type="button"
                onClick={() => onTokenClick('recipientFormalName')}
                className={`text-left rounded px-1.5 py-0.5 -ml-1.5 transition border ${
                  activeFieldKey === 'recipientFormalName'
                    ? 'bg-amber-100 border-amber-500 text-slate-950 ring-2 ring-amber-400/50'
                    : hasRecipientName
                    ? 'bg-sky-50/80 border-sky-300/80 hover:bg-amber-50 hover:border-amber-400 text-slate-900'
                    : 'bg-[#FEF3C7] border-[#D97706] text-[#92400E] font-mono text-[11px] font-bold uppercase'
                }`}
                title="Click to edit recipient or company name"
              >
                {hasRecipientName ? (
                  <span className="font-semibold">{doc.recipientAddress.name}</span>
                ) : (
                  <span>[ REQUIRED: LANDLORD OR COMPANY NAME ]</span>
                )}
              </button>
              {doc.recipientAddress.address_line1 ? (
                <div
                  onClick={() => onTokenClick('recipientFullAddress')}
                  className="text-[11px] text-slate-600 mt-0.5 cursor-pointer hover:text-slate-900"
                >
                  {doc.recipientAddress.address_line1}
                  {doc.recipientAddress.address_city && `, ${doc.recipientAddress.address_city}`}
                  {doc.recipientAddress.address_state && `, ${doc.recipientAddress.address_state}`}{' '}
                  {doc.recipientAddress.address_zip || ''}
                </div>
              ) : null}
            </div>
          </div>

          {/* Top-Right Official Dispatch Stamp Box */}
          <div
            className={`border-[1.5px] border-slate-900 p-3 bg-slate-50 font-mono text-[10px] leading-snug uppercase rounded-sm shadow-sm transition-all duration-300 w-full sm:w-[275px] shrink-0 ${
              isSignatureAdopted
                ? 'ring-2 ring-emerald-600/30 bg-emerald-50/40 border-slate-900'
                : 'border-slate-800'
            }`}
          >
            <div className="font-bold text-[10px] tracking-wider border-b border-slate-800 pb-1 mb-1.5 text-center text-slate-900 flex items-center justify-between">
              <span>DOCKETSTAMP™ DISPATCH RECORD</span>
              {isSignatureAdopted && (
                <span className="text-[9px] px-1 bg-emerald-700 text-white font-bold rounded">
                  STAMPED
                </span>
              )}
            </div>
            <div className="grid grid-cols-[76px_1fr] gap-x-1 py-0.5">
              <span className="text-slate-600">DOCKET ID:</span>
              <span className="font-bold text-slate-950 font-mono tracking-tight">
                {doc.docketId}
              </span>
            </div>
            <div className="grid grid-cols-[76px_1fr] gap-x-1 py-0.5">
              <span className="text-slate-600">DATE:</span>
              <span className="text-slate-800">{doc.signatureBlock.executionDate}</span>
            </div>
            <div className="grid grid-cols-[76px_1fr] gap-x-1 py-0.5">
              <span className="text-slate-600">MAIL CLASS:</span>
              <span className="font-semibold text-slate-900 truncate">
                {tierLabels[selectedTier]}
              </span>
            </div>
            <div className="grid grid-cols-[76px_1fr] gap-x-1 py-0.5 border-t border-slate-300 mt-1 pt-1">
              <span className="text-slate-600">ADDRESS:</span>
              <span className="text-emerald-700 font-bold flex items-center">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1" />
                USPS VERIFIED
              </span>
            </div>
          </div>
        </div>

        {/* Formal Document Title */}
        <div className="mt-6 mb-4 border-b-2 border-slate-900 pb-2">
          <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-950">
            {doc.headerTitle}
          </h2>
        </div>

        {/* RE Subject Block */}
        <div className="bg-slate-100/90 border-l-4 border-sky-600 p-2.5 sm:p-3 mb-5 font-sans text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
          {doc.reLine}
        </div>

        {/* Salutation */}
        <div className="text-sm font-bold mb-4 font-serif flex flex-wrap items-center gap-1.5">
          <span>TO:</span>
          <button
            type="button"
            onClick={() => onTokenClick('recipientFormalName')}
            className={`inline-flex items-center px-1.5 py-0.5 rounded transition border text-left ${
              hasRecipientName
                ? 'bg-sky-50/90 border-sky-300 text-slate-950 hover:bg-amber-50 hover:border-amber-400'
                : 'bg-[#FEF3C7] border-[#D97706] text-[#92400E] font-mono text-xs uppercase'
            }`}
            title="Click to edit recipient name"
          >
            {hasRecipientName
              ? doc.recipientAddress.name
              : '[ REQUIRED: LANDLORD OR COMPANY NAME ]'}
          </button>
        </div>

        {/* Paragraphs with Interactive Fill-In Tags */}
        <div className="space-y-4 text-[13.5px] sm:text-[14.5px] leading-relaxed text-slate-900 text-justify">
          {doc.paragraphs.map((tokens, pIdx) => (
            <p key={`p-${pIdx}`} className="leading-relaxed">
              {tokens.map((token, tIdx) => {
                if (token.type === 'text') {
                  return <span key={`t-${pIdx}-${tIdx}`}>{token.content}</span>;
                }

                const isActive = !!token.key && token.key === activeFieldKey;

                if (!token.isFilled) {
                  // Clickable Amber Tag for unfilled blanks
                  return (
                    <button
                      key={`t-${pIdx}-${tIdx}`}
                      type="button"
                      onClick={() => token.key && onTokenClick(token.key)}
                      data-testid={`docusign-tag-${token.key}`}
                      className={`inline-flex items-center px-2 py-0.5 mx-1 font-mono text-[11px] font-bold uppercase rounded border transition-all duration-150 cursor-pointer shadow-sm ${
                        isActive
                          ? 'bg-amber-200 border-amber-600 text-amber-950 ring-2 ring-amber-500/50 scale-[1.02]'
                          : 'bg-[#FEF3C7] border-[#D97706] text-[#92400E] hover:bg-amber-200/80 hover:border-amber-700'
                      }`}
                      title={`Click to enter ${token.docusignTagLabel || token.key}`}
                    >
                      <span className="opacity-75 mr-1 text-[9px] font-sans">FILL IN:</span>
                      <span>{token.docusignTagLabel || token.key?.toUpperCase()}</span>
                    </button>
                  );
                }

                // Filled token: Interactive Sky-Blue pill so user clearly sees it is editable
                return (
                  <button
                    key={`t-${pIdx}-${tIdx}`}
                    type="button"
                    onClick={() => token.key && onTokenClick(token.key)}
                    className={`inline-flex items-center font-semibold px-1.5 py-0.2 mx-0.5 rounded border-b-2 transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-100 border-amber-600 text-slate-950 ring-2 ring-amber-400/50'
                        : 'bg-sky-50/90 border-sky-500 text-slate-950 hover:bg-amber-50 hover:border-amber-500'
                    }`}
                    title={`Click to change ${token.docusignTagLabel || token.key}`}
                  >
                    <span>{token.content}</span>
                  </button>
                );
              })}
            </p>
          ))}
        </div>

        {/* Signature Execution Block */}
        <div className="mt-8 pt-4">
          <div className="text-xs text-slate-700 font-sans mb-1">Respectfully submitted,</div>
          <button
            type="button"
            onClick={() => onTokenClick('senderFullName')}
            className="inline-block min-w-[260px] border-b border-slate-700 pb-1 my-1.5 text-left hover:bg-amber-50/70 rounded-t px-1 -ml-1 transition cursor-pointer"
            title="Click to enter or update your signature name"
          >
            <span
              className={`font-mono text-base font-bold tracking-wide ${
                isSignatureAdopted || hasSenderName
                  ? 'text-slate-950'
                  : 'text-amber-800 bg-[#FEF3C7] px-2 py-0.5 rounded border border-[#D97706] text-xs uppercase'
              }`}
            >
              {hasSenderName
                ? `/s/ ${doc.senderAddress.name}`
                : '[ CLICK TO SIGN YOUR FULL NAME ]'}
            </span>
          </button>
          <div className="text-[11px] font-sans text-slate-600">
            {hasSenderName ? doc.senderAddress.name : 'Sender'} &bull; Date:{' '}
            {doc.signatureBlock.executionDate} &bull; Docket ID: {doc.docketId}
          </div>
        </div>

        {/* Optional Enclosures Notation */}
        {doc.enclosuresLine && (
          <div className="mt-4 text-[11px] italic text-slate-600 font-sans">
            {doc.enclosuresLine}
          </div>
        )}
      </div>

      {/* Locked UPL Compliance Footer (Positioned at Bottom Margin) */}
      <div className="mt-10 pt-3 border-t border-slate-300 font-sans text-[9px] sm:text-[9.5px] text-slate-500 text-center leading-normal">
        {UPL_COMPLIANCE_FOOTER_TEXT(doc.docketId)}
      </div>
    </div>
  );
};
