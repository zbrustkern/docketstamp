'use client';

/**
 * CheckoutModal: USPS Service Tier Selection & Stripe Payment Execution
 *
 * Implements Section 2 (3-Tier Pricing Model) and Section 3 of docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md:
 * - Tier 1: Standard First-Class ($12.95)
 * - Tier 2: USPS Certified Mail® ($19.95)
 * - Tier 3: USPS Certified Mail® + Return Receipt ($27.95)
 * - Collects customer notification email & initiates Stripe PaymentIntent via /api/docket/lock-and-intent
 */

import React, { useState } from 'react';
import { MailTierId, InterpolatedDocument } from '@/lib/docket/types';
import { DOCKET_PRICING_TIERS } from '@/lib/docket/notices';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: InterpolatedDocument;
  selectedTier: MailTierId;
  onSelectTier: (tier: MailTierId) => void;
  userValues: Record<string, string>;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  doc,
  selectedTier,
  onSelectTier,
  userValues,
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTierMeta = DOCKET_PRICING_TIERS[selectedTier];

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address for delivery notifications.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: doc.noticeDefinition.slug,
          userValues,
          tier: selectedTier,
          customerEmail: email,
          docketId: doc.docketId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize secure checkout session.');
      }

      // If clientSecret is returned, redirect to checkout or order confirmation
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.orderId && data.clientSecret) {
        // Redirect to order page or embedded checkout
        window.location.href = `/order/${data.orderId}?secret=${data.clientSecret}&tok=${data.viewToken}`;
      } else {
        throw new Error('Unexpected response from checkout server.');
      }
    } catch (err: any) {
      console.error('[Checkout Error]', err);
      setErrorMessage(err.message || 'An error occurred preparing payment.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-lg max-w-lg w-full p-6 shadow-2xl relative my-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-mono"
        >
          &times;
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="text-[11px] font-mono text-sky-400 font-bold uppercase tracking-wider mb-1">
            DOCKET RECORD: {doc.docketId}
          </div>
          <h2 className="text-xl font-bold text-white">
            Select USPS Dispatch Service Level
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Choose your physical postal transmission tier. All notices are printed on commercial HP Indigo digital presses and deposited directly into the USPS mailstream via Lob.
          </p>
        </div>

        {/* 3 USPS Service Tiers (Section 2) */}
        <div className="space-y-3 mb-6">
          {(Object.keys(DOCKET_PRICING_TIERS) as MailTierId[]).map((tierId) => {
            const meta = DOCKET_PRICING_TIERS[tierId];
            const isSelected = selectedTier === tierId;
            const isRecommended = doc.noticeDefinition.recommendedTier === tierId;

            return (
              <div
                key={tierId}
                onClick={() => onSelectTier(tierId)}
                className={`p-3.5 rounded-md border cursor-pointer transition relative ${
                  isSelected
                    ? 'bg-slate-800/90 border-sky-500 ring-2 ring-sky-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tier"
                      checked={isSelected}
                      onChange={() => onSelectTier(tierId)}
                      className="text-sky-600 focus:ring-sky-500"
                    />
                    <span className="font-bold text-sm text-slate-100">{meta.name}</span>
                  </div>
                  <span className="font-mono font-bold text-base text-sky-400">
                    {meta.formattedPrice}
                  </span>
                </div>

                <p className="text-xs text-slate-400 pl-6 leading-relaxed">
                  {meta.description}
                </p>

                {isRecommended && (
                  <span className="absolute top-2 right-16 text-[9px] font-mono bg-sky-950 text-sky-300 border border-sky-800 px-1.5 py-0.5 rounded uppercase font-bold">
                    RECOMMENDED
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Email & Checkout Form */}
        <form onSubmit={handleProceedToPayment} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-200 block mb-1">
              Tracking & Dispatch Notification Email
            </label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-500"
            />
            <span className="text-[10px] text-slate-400 block mt-1">
              USPS tracking number, acceptance scan proof, and certificate of mailing will be dispatched to this address.
            </span>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-700 rounded text-xs text-rose-200">
              {errorMessage}
            </div>
          )}

          {/* Compliance & Summary */}
          <div className="p-3 bg-slate-950/60 rounded border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Selected Document:</span>
              <span className="font-semibold text-slate-200">{doc.noticeDefinition.title}</span>
            </div>
            <div className="flex justify-between">
              <span>Total USPS Fulfillment:</span>
              <span className="font-bold text-white font-mono">{currentTierMeta.formattedPrice}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded text-xs font-bold uppercase tracking-wider font-mono transition"
            >
              Back to Review
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-3 rounded text-xs font-bold uppercase tracking-wider font-mono transition shadow-lg flex items-center justify-center gap-1.5"
            >
              {isLoading ? (
                <span>Locking Docket...</span>
              ) : (
                <span>Pay {currentTierMeta.formattedPrice} & Dispatch →</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
