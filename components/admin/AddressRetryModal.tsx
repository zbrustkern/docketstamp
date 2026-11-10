"use client";

import React, { useState } from "react";
import { X, RefreshCw, MapPin, AlertTriangle } from "lucide-react";
import { Order } from "@/lib/types";

interface AddressRetryModalProps {
  order: Order;
  incidentId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddressRetryModal({ order, incidentId, onClose, onSuccess }: AddressRetryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmedAddress, setConfirmedAddress] = useState(false);
  const recipient = order.recipientAddress;
  const addressLines = [
    [recipient.firstName, recipient.lastName].filter(Boolean).join(" "),
    recipient.street1,
    recipient.street2,
    [recipient.city, recipient.state, recipient.zip].filter(Boolean).join(", "),
  ].filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedAddress) {
      setError("Confirm the displayed frozen recipient address before retrying.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/retry-fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          requestId: crypto.randomUUID(),
          reason: incidentId
            ? `Operator reviewed incident ${incidentId} and requested a safe retry of the frozen postal order snapshot`
            : "Operator confirmed the frozen recipient address and requested a safe postal retry",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.status === "uncertain"
          ? "The postal provider outcome is uncertain. Review the recorded attempt before any further retry."
          : data.error || `Postal retry was not completed${data.status ? ` (${data.status})` : ""}.`);
        return;
      }

      const status = data.status || "completed";
      const message = status === "simulated"
        ? "Retry was simulated in this environment; no physical mailing was initiated."
        : `Postal retry result: ${status}. Provider acceptance confirms receipt of the request, not delivery.`;
      alert(`${message}${data.providerLetterId ? ` Reference: ${data.providerLetterId}.` : ""}${data.followupAction ? `\n${data.followupAction}` : ""}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(`Error executing retry: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-stone-900">Review frozen address &amp; retry</h3>
              <p className="text-xs text-stone-400 font-mono">{order.id}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close address review" className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>The paid order address is immutable</span>
            </div>
            <p className="text-[11px] text-amber-900/90 leading-relaxed">
              This action can retry the existing frozen postal snapshot only. It does not edit the recipient address or the letter. Confirm the address below before retrying.
            </p>
          </div>

          <section aria-label="Frozen recipient address" className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-800">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Frozen recipient address</h4>
            {addressLines.length ? addressLines.map((line, index) => <p key={`${index}-${line}`}>{line}</p>) : <p className="text-stone-500">Address unavailable</p>}
          </section>

          <label className="flex items-start gap-2 rounded-xl border border-stone-200 p-3 text-xs text-stone-700">
            <input type="checkbox" checked={confirmedAddress} onChange={(event) => setConfirmedAddress(event.target.checked)} className="mt-0.5" />
            <span>I reviewed the frozen address and want to retry the existing postal dispatch.</span>
          </label>

          {error && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3.5 py-2 text-xs font-semibold rounded-xl text-stone-600 hover:bg-stone-100 transition">Cancel</button>
            <button type="submit" disabled={loading || !confirmedAddress} className="px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 hover:bg-black text-white transition disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Checking retry…" : "Retry frozen address"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
