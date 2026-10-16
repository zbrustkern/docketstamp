'use client';

/**
 * LivePaperSheet: High-Fidelity 8.5" x 11" Paper Document Preview
 *
 * Implements the physical document sheet preview on the Midnight Slate workspace:
 * - 8.5in x 11in proportional aspect ratio
 * - Top-right Clerk's Docket Stamp box with live ink stamp state
 * - Clear zone for USPS Certified Mail top banner
 * - Document Header and RE: Docket Block
 * - Interactive paragraph token rendering:
 *   - Unfilled tokens render as clickable Amber DocuSign action tags
 *   - Filled tokens render as crisp Merriweather typography
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

  return (
    <div
      className="relative w-full max-w-[850px] min-h-[1100px] bg-white text-slate-900 shadow-2xl rounded-sm border border-slate-300 p-8 sm:p-12 md:p-14 font-serif select-text flex flex-col justify-between overflow-hidden"
      data-testid="live-paper-sheet"
      style={{
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Top Banner & USPS Clear Zone (Simulated Top 1.80in Clear Zone) */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 pt-2">
          {/* Top-Left Return & Destination Preview Indicator */}
          <div className="text-[11px] font-mono text-slate-500 leading-tight">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              [ USPS TOP-FIRST-PAGE CLEAR ZONE: 1.80in ]
            </div>
            <div>
              <span className="font-semibold text-slate-700">FROM: </span>
              {doc.senderAddress.name || 'Tenant / Consumer Sender'}
            </div>
            <div className="text-slate-600 truncate max-w-[280px]">
              {doc.senderAddress.address_line1 || 'Address Line 1'}
              {doc.senderAddress.address_city && `, ${doc.senderAddress.address_city}`}
              {doc.senderAddress.address_state && `, ${doc.senderAddress.address_state}`}
            </div>
            <div className="mt-2">
              <span className="font-semibold text-slate-700">TO: </span>
              {doc.recipientAddress.name || 'Receiving Entity / Landlord'}
            </div>
            <div className="text-slate-600 truncate max-w-[280px]">
              {doc.recipientAddress.address_line1 || 'Address Line 1'}
              {doc.recipientAddress.address_city && `, ${doc.recipientAddress.address_city}`}
              {doc.recipientAddress.address_state && `, ${doc.recipientAddress.address_state}`}
            </div>
          </div>

          {/* Top-Right Clerk's Docket Stamp Box (Exact Section 3.3 Spec) */}
          <div
            className={`border-[1.5px] border-slate-900 p-3 bg-slate-50 font-mono text-[10px] leading-snug uppercase rounded-sm shadow-sm transition-all duration-300 w-full sm:w-[280px] ${
              isSignatureAdopted
                ? 'ring-2 ring-emerald-600/30 bg-emerald-50/40 border-slate-900'
                : 'border-slate-800'
            }`}
          >
            <div className="font-bold text-[10px] tracking-wider border-b border-slate-800 pb-1 mb-1.5 text-center text-slate-900 flex items-center justify-between">
              <span>OFFICIAL DISPATCH REGISTRY</span>
              {isSignatureAdopted && (
                <span className="text-[9px] px-1 bg-emerald-700 text-white font-bold rounded">STAMPED</span>
              )}
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-x-1 py-0.5">
              <span className="text-slate-600">DOCKET ID:</span>
              <span className="font-bold text-slate-950 font-mono tracking-tight">{doc.docketId}</span>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-x-1 py-0.5">
              <span className="text-slate-600">FILED UTC:</span>
              <span className="text-slate-800">{doc.clerkStamp.timestampUtc}</span>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-x-1 py-0.5">
              <span className="text-slate-600">DISPATCH:</span>
              <span className="font-semibold text-slate-900 truncate">
                {tierLabels[selectedTier]}
              </span>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-x-1 py-0.5 border-t border-slate-300 mt-1 pt-1">
              <span className="text-slate-600">ROUTING:</span>
              <span className="text-emerald-700 font-bold flex items-center">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1 animate-pulse" />
                {doc.clerkStamp.cassStatus || 'USPS CASS™ VERIFIED'}
              </span>
            </div>
          </div>
        </div>

        {/* Formal Document Title */}
        <div className="mt-8 mb-4 border-b-2 border-slate-900 pb-2">
          <h1 className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-950">
            {doc.headerTitle}
          </h1>
        </div>

        {/* RE Docket Subject Block */}
        <div className="bg-slate-100/90 border-l-4 border-sky-600 p-2.5 sm:p-3 mb-6 font-sans text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
          {doc.reLine}
        </div>

        {/* Salutation */}
        <div className="text-sm font-bold mb-4 font-serif">
          TO: {doc.recipientAddress.name || 'LANDLORD / MANAGEMENT ENTITY / DISPUTES DEPT.'}
        </div>

        {/* Paragraphs with Interactive DocuSign Amber Tags */}
        <div className="space-y-4 text-[13.5px] sm:text-[14.5px] leading-relaxed text-slate-900 text-justify">
          {doc.paragraphs.map((tokens, pIdx) => (
            <p key={`p-${pIdx}`} className="leading-relaxed">
              {tokens.map((token, tIdx) => {
                if (token.type === 'text') {
                  return <span key={`t-${pIdx}-${tIdx}`}>{token.content}</span>;
                }

                const isActive = !!token.key && token.key === activeFieldKey;

                if (!token.isFilled) {
                  // Clickable DocuSign-Style Amber Tag
                  return (
                    <button
                      key={`t-${pIdx}-${tIdx}`}
                      type="button"
                      onClick={() => token.key && onTokenClick(token.key)}
                      data-testid={`docusign-tag-${token.key}`}
                      className={`inline-flex items-center px-2 py-0.5 mx-1 font-mono text-[11px] font-bold uppercase rounded border transition-all duration-150 cursor-pointer shadow-sm ${
                        isActive
                          ? 'bg-amber-200 border-amber-600 text-amber-950 ring-2 ring-amber-500/50 scale-[1.03]'
                          : 'bg-[#FEF3C7] border-[#D97706] text-[#92400E] hover:bg-amber-100 hover:border-amber-600'
                      }`}
                      title={`Click to fill ${token.docusignTagLabel || token.key}`}
                    >
                      <span className="opacity-70 mr-1 text-[9px] font-sans">REQUIRED:</span>
                      <span>{token.docusignTagLabel || token.key?.toUpperCase()}</span>
                    </button>
                  );
                }

                // Filled token: Crisp styled variable
                return (
                  <span
                    key={`t-${pIdx}-${tIdx}`}
                    onClick={() => token.key && onTokenClick(token.key)}
                    className={`inline-block font-semibold px-0.5 border-b border-dotted cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-sky-100 border-sky-600 text-sky-950 ring-1 ring-sky-400 rounded-sm'
                        : 'border-slate-400 text-slate-950 hover:bg-slate-100 hover:border-slate-700'
                    }`}
                    title={`Click to edit ${token.docusignTagLabel || token.key}`}
                  >
                    {token.content}
                  </span>
                );
              })}
            </p>
          ))}
        </div>

        {/* Signature Execution Block */}
        <div className="mt-8 pt-4">
          <div className="text-xs text-slate-700 font-sans mb-1">Respectfully submitted,</div>
          <div className="inline-block min-w-[280px] border-b border-slate-700 pb-1 my-2">
            <span
              className={`font-mono text-base font-bold tracking-wide ${
                isSignatureAdopted ? 'text-slate-950' : 'text-slate-400 italic'
              }`}
            >
              {isSignatureAdopted
                ? doc.signatureBlock.formalSignature
                : '/s/ [Type Full Name in Drawer to Sign]'}
            </span>
          </div>
          <div className="text-[11px] font-sans text-slate-600">
            {doc.signatureBlock.signerName || 'Authorized Signer'} &bull; Date: {doc.signatureBlock.executionDate} &bull; Docket ID: {doc.docketId}
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
      <div className="mt-12 pt-3 border-t border-slate-300 font-sans text-[9px] sm:text-[9.5px] text-slate-500 text-center leading-normal">
        {UPL_COMPLIANCE_FOOTER_TEXT(doc.docketId)}
      </div>
    </div>
  );
};
