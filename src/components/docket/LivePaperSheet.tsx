'use client';

import React, { useEffect, useRef, useState } from 'react';
import { InterpolatedDocument, MailTierId } from '@/lib/docket/types';
import { UPL_COMPLIANCE_FOOTER_TEXT } from '@/lib/docket/guardrails';
import { PHYSICAL_LAYOUT, physicalLayoutCss } from '@/lib/docket/renderer/physical-layout';

export interface LivePaperSheetProps {
  doc: InterpolatedDocument;
  onTokenClick: (fieldKey: string) => void;
  activeFieldKey?: string | null;
  isSignatureAdopted?: boolean;
  selectedTier?: MailTierId;
  verificationStatus?: import('@/lib/docket/types').AddressVerificationStatus;
}

function placeholderFor(key?: string): string {
  const label = (key || 'required value').replace(/([A-Z])/g, ' $1').toUpperCase().trim();
  return `[${label}]`;
}

function AddressBlock({
  label,
  address,
  fieldKey,
  onTokenClick,
  activeFieldKey,
}: {
  label: string;
  address: InterpolatedDocument['senderAddress'];
  fieldKey: string;
  onTokenClick: (fieldKey: string) => void;
  activeFieldKey?: string | null;
}) {
  const addressText = [
    address.name || '[NAME]',
    address.company,
    address.address_line1 || '[ADDRESS]',
    address.address_line2,
    [address.address_city, address.address_state, address.address_zip].filter(Boolean).join(', '),
  ].filter(Boolean);
  return (
    <div className={`postal-address postal-address-${label.toLowerCase()}`}>
      <button type="button" className={`editable-address${activeFieldKey === fieldKey ? ' is-active' : ''}`} onClick={() => onTokenClick(fieldKey)} aria-label={`Edit ${label.toLowerCase()} mailing address`}>
        {addressText.map((line, index) => <React.Fragment key={`${label}-${index}`}>{index > 0 && <br />}{line}</React.Fragment>)}
      </button>
    </div>
  );
}

export const LivePaperSheet: React.FC<LivePaperSheetProps> = ({
  doc,
  onTokenClick,
  activeFieldKey,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const updateScale = () => {
      const availableWidth = wrapper.clientWidth || PHYSICAL_LAYOUT.page.cssWidth;
      const availableHeight = Math.max(240, window.innerHeight - 220);
      setScale(Math.max(0.2, Math.min(1, availableWidth / PHYSICAL_LAYOUT.page.cssWidth, availableHeight / PHYSICAL_LAYOUT.page.cssHeight)));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(wrapper);
    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  const scaledWidth = PHYSICAL_LAYOUT.page.cssWidth * scale;
  const scaledHeight = PHYSICAL_LAYOUT.page.cssHeight * scale;

  return (
    <div
      ref={wrapperRef}
      className="relative mx-auto w-full max-w-[850px]"
      style={{ height: `${scaledHeight}px` }}
      data-testid="live-paper-sheet-frame"
    >
      <style>{physicalLayoutCss(false)}</style>
      <article
        className="paper-page"
        data-testid="live-paper-sheet"
        aria-label={`Letter preview: ${doc.headerTitle}`}
        style={{ left: `calc(50% - ${scaledWidth / 2}px)`, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute' }}
      >
        <AddressBlock label="Sender" address={doc.senderAddress} fieldKey="senderFullAddress" onTokenClick={onTokenClick} activeFieldKey={activeFieldKey} />
        <AddressBlock label="Recipient" address={doc.recipientAddress} fieldKey="recipientFullAddress" onTokenClick={onTokenClick} activeFieldKey={activeFieldKey} />

        <aside className="docket-stamp-box" aria-label="Preparation record">
          <div className="docket-stamp-header">DOCKETSTAMP™ PREPARATION RECORD</div>
          <div><strong>DOCKET ID:</strong> {doc.docketId}</div>
          <div><strong>PREPARED UTC:</strong> {doc.clerkStamp.timestampUtc}</div>
          <div><strong>MAILING SERVICE:</strong> {tierLabel(doc.clerkStamp.serviceLevel)}</div>
          <div><strong>ADDRESS STATUS:</strong> {doc.clerkStamp.cassStatus || 'ADDRESS VERIFICATION NOT CONFIRMED'}</div>
        </aside>

        <section className="letter-body-container">
          <h1 className="doc-header-title">{doc.headerTitle}</h1>
          <div className="re-docket-block">{doc.reLine}</div>
          <div className="salutation">TO: {doc.recipientAddress.name || '[RECIPIENT NAME]'}</div>
          <div className="letter-paragraphs">
            {doc.paragraphs.map((tokens, paragraphIndex) => (
              <p className="paragraph" key={`paragraph-${paragraphIndex}`}>
                {tokens.map((token, tokenIndex) => {
                  if (token.type === 'text') return <span key={`token-${paragraphIndex}-${tokenIndex}`} style={{ whiteSpace: 'pre-line' }}>{token.content}</span>;
                  const key = token.key || '';
                  const active = key === activeFieldKey;
                  const content = token.isFilled ? token.content : placeholderFor(key);
                  return (
                    <button
                      key={`token-${paragraphIndex}-${tokenIndex}`}
                      type="button"
                      className={`editable-token ${token.isFilled ? 'editable-token-filled' : 'editable-token-empty'}${active ? ' is-active' : ''}`}
                      onClick={() => key && onTokenClick(key)}
                      aria-label={`Edit ${token.docusignTagLabel || key}`}
                      title={`Edit ${token.docusignTagLabel || key}`}
                      data-testid={`docusign-tag-${key}`}
                    >
                      {content}
                    </button>
                  );
                })}
              </p>
            ))}
          </div>
          <div className="signature-block">
            <div style={{ fontSize: '9pt' }}>Sincerely,</div>
            <button
              type="button"
              className={`signature-line editable-address${activeFieldKey === 'senderFullName' ? ' is-active' : ''}`}
              onClick={() => onTokenClick('senderFullName')}
              aria-label="Edit typed signature"
            >
              {doc.signatureBlock.formalSignature}
            </button>
            <div style={{ fontSize: '8pt', color: '#475569', fontFamily: PHYSICAL_LAYOUT.sans }}>
              {doc.signatureBlock.signerName} &bull; Executed on {doc.signatureBlock.executionDate} &bull; Docket ID: {doc.docketId}
            </div>
          </div>
          {doc.enclosuresLine && <div style={{ marginTop: '10px', fontSize: '8.5pt', fontStyle: 'italic', color: '#475569' }}>{doc.enclosuresLine}</div>}
        </section>

        <footer className="compliance-footer">{UPL_COMPLIANCE_FOOTER_TEXT(doc.docketId)}</footer>
      </article>
    </div>
  );
};

function tierLabel(tier: MailTierId): string {
  const labels: Record<MailTierId, string> = {
    first_class: 'USPS FIRST-CLASS MAIL®',
    certified: 'USPS CERTIFIED MAIL®',
    certified_return_receipt: 'USPS CERTIFIED + RETURN RECEIPT',
  };
  return labels[tier];
}
