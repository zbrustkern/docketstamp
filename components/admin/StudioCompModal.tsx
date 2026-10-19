"use client";

import React, { useState } from "react";
import { X, FileText, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { MailingAddress } from "@/lib/types";

interface StudioCompModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function StudioCompModal({ onClose, onSuccess }: StudioCompModalProps) {
  const [noticeTitle, setNoticeTitle] = useState("Tenant Notice of Intent to Vacate");
  const [noticeBody, setNoticeBody] = useState(
    "Please accept this formal written instrument as official notice pursuant to state tenancy law that the tenant will surrender possession on November 30, 2026."
  );
  const [compReason, setCompReason] = useState("Administrative / Testing");

  const [recipient, setRecipient] = useState<MailingAddress>({
    firstName: "Property",
    lastName: "Manager",
    street1: "100 Main St, Suite 400",
    street2: "",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    country: "US",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/dispatch-comp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printedMessage: noticeTitle,
          handwrittenNote: noticeBody,
          recipientAddress: recipient,
          reason: compReason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to dispatch administrative notice");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Dispatch error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 rounded-2xl max-w-xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-700">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-950 text-sky-400 border border-sky-800 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">Administrative Notice Dispatch (Held in S0)</h3>
              <p className="text-xs text-amber-300">Gated pending S3-T02 canonical template &amp; guardrail contract</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
          <div className="p-3 bg-amber-950/60 border border-amber-700/80 text-amber-200 rounded-lg space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Execution Held in Sprint S0 (Restoration Target: S3-T02)</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Direct studio comp dispatch is temporarily gated so free/comp notices cannot bypass canonical template rendering, NAICS 713940 non-fitness guardrails, CASS validation, or immutable <code className="font-mono">frozen_html_payload</code> snapshot creation.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 text-red-300 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="font-mono text-slate-300 block mb-1">Notice Title / Instrument Type</label>
            <input
              type="text"
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              required
            />
          </div>

          <div>
            <label className="font-mono text-slate-300 block mb-1">Notice Formal Text</label>
            <textarea
              rows={4}
              value={noticeBody}
              onChange={(e) => setNoticeBody(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-serif"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-slate-300 block mb-1">Recipient Name</label>
              <input
                type="text"
                value={`${recipient.firstName} ${recipient.lastName}`}
                onChange={(e) => {
                  const parts = e.target.value.split(" ");
                  setRecipient({ ...recipient, firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" });
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="font-mono text-slate-300 block mb-1">Street Address</label>
              <input
                type="text"
                value={recipient.street1}
                onChange={(e) => setRecipient({ ...recipient, street1: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-mono text-slate-300 block mb-1">City</label>
              <input
                type="text"
                value={recipient.city}
                onChange={(e) => setRecipient({ ...recipient, city: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="font-mono text-slate-300 block mb-1">State</label>
              <input
                type="text"
                value={recipient.state}
                onChange={(e) => setRecipient({ ...recipient, state: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="font-mono text-slate-300 block mb-1">ZIP</label>
              <input
                type="text"
                value={recipient.zip}
                onChange={(e) => setRecipient({ ...recipient, zip: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-white font-bold flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? "Dispatching..." : "Dispatch Test Notice"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
