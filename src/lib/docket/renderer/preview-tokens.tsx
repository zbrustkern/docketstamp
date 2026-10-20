'use client';

/**
 * DocuSign-Esque Interactive Document Token Preview Components
 *
 * Renders document paragraph tokens where:
 * - Unfilled variables appear as authoritative Amber DocuSign callout pills
 *   [ REQUIRED: DEPOSIT AMOUNT ] with thick left border and hover feedback.
 * - Clicking an unfilled or filled token automatically triggers onTokenClick(key)
 *   to snap the guided input drawer directly to that field.
 * - Filled variables render seamlessly within the formal Merriweather prose.
 *
 * Governing documents:
 * - docs/DESIGN_SYSTEM.md (§2, §3, §4)
 * - docs/DOCKETSTAMP_SPEC.md (§2)
 */

import React from 'react';
import { InterpolatedParagraphToken } from '../types';

export interface ParagraphTokensProps {
  tokens: InterpolatedParagraphToken[];
  onTokenClick?: (fieldKey: string) => void;
  activeFieldKey?: string;
  className?: string;
}

/**
 * Renders an individual token inside a document paragraph.
 */
export const DocumentTokenSpan: React.FC<{
  token: InterpolatedParagraphToken;
  onTokenClick?: (fieldKey: string) => void;
  isActive?: boolean;
}> = ({ token, onTokenClick, isActive }) => {
  if (token.type === 'text') {
    return <span>{token.content}</span>;
  }

  const { key, content, docusignTagLabel, isFilled } = token;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (key && onTokenClick) {
      onTokenClick(key);
    }
  };

  if (!isFilled) {
    return (
      <button
        type="button"
        onClick={handleClick}
        data-testid={`docusign-pill-${key}`}
        className={`inline-flex items-center px-2 py-0.5 mx-1 font-mono text-xs font-bold uppercase rounded-sm border-l-4 transition-all duration-150 shadow-sm cursor-pointer ${
          isActive
            ? 'bg-amber-200 border-amber-600 text-amber-950 ring-2 ring-amber-500/50 scale-[1.02]'
            : 'bg-amber-50 border-amber-500 text-amber-900 hover:bg-amber-100 hover:border-amber-600'
        }`}
        title={`Click to fill ${docusignTagLabel || key}`}
      >
        <span className="opacity-75 mr-1 font-sans text-[10px] tracking-wide">REQUIRED:</span>
        <span>{docusignTagLabel || key?.toUpperCase()}</span>
      </button>
    );
  }

  // Filled variable token: Crisp formatted text with subtle interactive hover
  return (
    <span
      onClick={handleClick}
      data-testid={`filled-token-${key}`}
      className={`inline-block font-medium border-b border-dotted cursor-pointer transition-colors ${
        isActive
          ? 'bg-sky-100/80 border-sky-600 text-slate-950 px-1 rounded-sm ring-1 ring-sky-400'
          : 'border-slate-400 text-slate-900 hover:bg-slate-100/70 hover:border-slate-600'
      }`}
      title={`Click to edit ${docusignTagLabel || key}`}
    >
      {content}
    </span>
  );
};

/**
 * Renders an entire paragraph composed of tokens.
 */
export const ParagraphTokensView: React.FC<ParagraphTokensProps> = ({
  tokens,
  onTokenClick,
  activeFieldKey,
  className = '',
}) => {
  return (
    <p className={`font-serif text-[15px] leading-relaxed text-slate-900 whitespace-pre-line my-4 ${className}`}>
      {tokens.map((token, idx) => (
        <DocumentTokenSpan
          key={`${token.key || 'txt'}-${idx}`}
          token={token}
          onTokenClick={onTokenClick}
          isActive={!!token.key && token.key === activeFieldKey}
        />
      ))}
    </p>
  );
};

/**
 * Clerk's Docket Stamp Top-Right Header Box
 */
export const ClerksDocketStampBlock: React.FC<{
  docketId: string;
  timestampUtc: string;
  serviceLevel: string;
  cassStatus?: string;
  className?: string;
}> = ({ docketId, timestampUtc, serviceLevel, cassStatus = 'ADDRESS VERIFICATION NOT CONFIRMED', className = '' }) => {
  const serviceLevelLabels: Record<string, string> = {
    first_class: 'USPS FIRST-CLASS MAIL®',
    certified: 'USPS CERTIFIED MAIL®',
    certified_return_receipt: 'USPS CERTIFIED MAIL® + RETURN RECEIPT',
  };

  const displayService = serviceLevelLabels[serviceLevel] || serviceLevel.toUpperCase();
  const verificationConfirmed = /VERIFIED|CONFIRMED/i.test(cassStatus)
    && !/NOT CONFIRMED|NOT VERIFIED/i.test(cassStatus);

  return (
    <div
      className={`border-2 border-slate-900 p-2.5 bg-slate-50/70 font-mono text-[10px] leading-tight text-slate-900 uppercase max-w-[280px] shadow-sm select-none ${className}`}
      data-testid="clerk-docket-stamp"
    >
      <div className="font-bold text-[10.5px] tracking-wider border-b border-slate-400 pb-1 mb-1 text-center text-slate-950">
        DOCKETSTAMP™ DISPATCH REGISTRY
      </div>
      <div className="flex justify-between py-0.5">
        <span className="text-slate-600">DOCKET ID:</span>
        <span className="font-bold text-slate-900">{docketId}</span>
      </div>
      <div className="flex justify-between py-0.5">
        <span className="text-slate-600">DISPATCH TIER:</span>
        <span className="font-semibold text-slate-900">{displayService}</span>
      </div>
      <div className="flex justify-between py-0.5">
        <span className="text-slate-600">REGISTRY UTC:</span>
        <span>{timestampUtc}</span>
      </div>
      <div className="flex justify-between items-center pt-1 border-t border-slate-300 mt-1">
        <span className="text-slate-600">STATUS:</span>
        <span className={`${verificationConfirmed ? 'text-emerald-700' : 'text-slate-600'} font-bold tracking-tight flex items-center`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${verificationConfirmed ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'}`} />
          {cassStatus}
        </span>
      </div>
    </div>
  );
};
