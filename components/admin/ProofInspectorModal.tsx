"use client";

import React, { useEffect, useState } from "react";
import { X, FileText, CheckCircle2, Clock, Truck, Copy, Check } from "lucide-react";
import { Order } from "@/lib/types";
import { resolvePostalProvenance, postalProviderLabel, type PostalProvenance } from "@/lib/admin/postal-reference";

interface ProofInspectorModalProps {
  orderId: string;
  onClose: () => void;
}

export function ProofInspectorModal({ orderId, onClose }: ProofInspectorModalProps) {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [postalProvenance, setPostalProvenance] = useState<PostalProvenance | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadProof() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/order-proof?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order || data);
          setPostalProvenance(data.postalProvenance || resolvePostalProvenance(data.order || data));
        }
      } catch (err) {
        console.error("Error loading order notice proof:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProof();
  }, [orderId]);

  const copyOrderId = () => {
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-950 text-sky-400 border border-sky-800 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-base text-white">Docket Instrument Inspector</h3>
                <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {orderId}
                </span>
                <button onClick={copyOrderId} className="text-slate-400 hover:text-white transition">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">USPS CASS standardized physical letter proof</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm font-mono">Loading docket instrument...</div>
          ) : order ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 text-xs font-mono space-y-1">
                <div>DOCKET ID: <span className="font-bold text-sky-400">{order.docketId || `DS-2026-${order.id.slice(-6).toUpperCase()}`}</span></div>
                <div>SERVICE LEVEL: <span className="font-bold text-white">{order.serviceLevel || "USPS CERTIFIED MAIL®"}</span></div>
                <div>STATUS: <span className="text-emerald-400 font-bold">{order.status}</span></div>
                {postalProvenance && <div>POSTAL PROVIDER: <span className="font-bold text-white">{postalProviderLabel(postalProvenance.provider)} ({postalProvenance.evidence})</span></div>}
                {postalProvenance?.provider === "lob" && order.lobTrackingNumber && (
                  <div>USPS TRACKING: <span className="font-bold text-white">{order.lobTrackingNumber}</span></div>
                )}
              </div>

              {/* Document Sheet Display */}
              <div className="p-6 bg-white text-slate-900 rounded-xl font-serif text-xs leading-relaxed space-y-3 shadow-inner border border-slate-300">
                <div className="font-mono text-[10px] text-slate-500 border-b border-slate-200 pb-1 flex justify-between">
                  <span>DOCKETSTAMP™ DISPATCH SPECIMEN</span>
                  <span>CASS STANDARDIZED</span>
                </div>
                <div className="font-bold text-sm text-slate-900">{order.printedMessage || "Formal Statutory Notice"}</div>
                <div className="whitespace-pre-wrap font-serif text-slate-800">{order.handwrittenNote || "Notice content"}</div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">Failed to load docket record.</div>
          )}
        </div>
      </div>
    </div>
  );
}
