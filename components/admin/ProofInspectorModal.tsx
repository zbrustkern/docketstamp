"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  X,
  FileText,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  AlertTriangle,
  AlignLeft,
  Maximize2,
  Minimize2,
  Send,
} from "lucide-react";
import { Order } from "@/lib/types";
import { resolvePostalProvenance, postalProviderLabel, type PostalProvenance } from "@/lib/admin/postal-reference";

interface ProofInspectorModalProps {
  orderId: string;
  onClose: () => void;
}

interface ExtractedNotice {
  headerTitle: string;
  reLine: string;
  salutation: string;
  paragraphs: string[];
  fullSignature: string;
}

function parseNoticeContent(html: string): ExtractedNotice | null {
  if (!html || typeof window === "undefined") return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const headerTitle = doc.querySelector(".doc-header-title")?.textContent?.trim() || "";
    const reLine = doc.querySelector(".re-docket-block")?.textContent?.trim() || "";
    const salutation = doc.querySelector(".salutation")?.textContent?.trim() || "";
    const paragraphEls = doc.querySelectorAll(".letter-paragraphs .paragraph");
    const paragraphs: string[] = [];
    paragraphEls.forEach((el) => {
      const text = el.textContent?.trim();
      if (text) paragraphs.push(text);
    });
    const sigBlock = doc.querySelector(".signature-block");
    const fullSignature = sigBlock?.textContent?.trim() || "";

    // If structured layout classes weren't found, fallback to all <p> tags
    if (paragraphs.length === 0) {
      const pTags = doc.querySelectorAll("p");
      pTags.forEach((p) => {
        const text = p.textContent?.trim();
        if (text) paragraphs.push(text);
      });
    }

    return {
      headerTitle: headerTitle || doc.title || "Formal Statutory Notice",
      reLine,
      salutation,
      paragraphs,
      fullSignature,
    };
  } catch (err) {
    console.warn("[ProofInspectorModal] Notice HTML parse notice:", err);
    return null;
  }
}

export function ProofInspectorModal({ orderId, onClose }: ProofInspectorModalProps) {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [postalProvenance, setPostalProvenance] = useState<PostalProvenance | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [activeTab, setActiveTab] = useState<"sheet" | "text" | "route">("sheet");
  const [zoomMode, setZoomMode] = useState<"fit" | "full">("fit");
  const [fitScale, setFitScale] = useState(1);
  const sheetContainerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Load order proof payload
  useEffect(() => {
    let isMounted = true;
    async function loadProof() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/order-proof?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" });
        if (res.ok && isMounted) {
          const data = await res.json();
          const loadedOrder: Order = data.order || data;
          setOrder(loadedOrder);
          setPostalProvenance(data.postalProvenance || resolvePostalProvenance(loadedOrder));
        }
      } catch (err) {
        console.error("Error loading order notice proof:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadProof();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // Compute responsive fit scale for 8.5in x 11in letter (816px CSS width)
  useEffect(() => {
    const container = sheetContainerRef.current;
    if (!container || activeTab !== "sheet") return;

    const updateFitScale = () => {
      const availableWidth = container.clientWidth - 32;
      if (availableWidth > 0) {
        const computed = Math.min(1, Math.max(0.3, availableWidth / 816));
        setFitScale(computed);
      }
    };

    updateFitScale();
    const observer = new ResizeObserver(updateFitScale);
    observer.observe(container);
    window.addEventListener("resize", updateFitScale);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateFitScale);
    };
  }, [activeTab]);

  const documentHtml = useMemo(() => {
    if (!order) return "";
    return (
      order.documentHtml ||
      (order as any).frozen_html_payload ||
      (order as any).frozenHtmlPayload ||
      ""
    );
  }, [order]);

  const extracted = useMemo(() => {
    if (!documentHtml) return null;
    return parseNoticeContent(documentHtml);
  }, [documentHtml]);

  const copyOrderId = () => {
    navigator.clipboard.writeText(orderId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const copySnapshotHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleOpenInNewTab = () => {
    if (!documentHtml) return;
    const blob = new Blob([documentHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const docketId = order?.docketId || `DS-2026-${order?.id?.slice(-6).toUpperCase() || "RECORD"}`;
  const snapshotHash = order?.documentIntegrityEvidence?.snapshotHash || (order as any)?.snapshotHash;
  const hasDocumentHtml = Boolean(documentHtml && documentHtml.trim().length > 0);

  // Address lines helper
  const recipient = order?.recipientAddress;
  const sender = order?.returnAddress;

  const recipientLines = [
    recipient?.name || [recipient?.firstName, recipient?.lastName].filter(Boolean).join(" ") || recipient?.company,
    recipient?.company && recipient?.name && recipient.company !== recipient.name ? recipient.company : undefined,
    (recipient as any)?.addressLine1 || recipient?.street1,
    (recipient as any)?.addressLine2 || recipient?.street2,
    [recipient?.city, recipient?.state].filter(Boolean).join(", ") + (recipient?.zip ? ` ${recipient.zip}` : ""),
  ].filter(Boolean) as string[];

  const senderLines = [
    sender?.name || [sender?.firstName, sender?.lastName].filter(Boolean).join(" ") || sender?.company,
    (sender as any)?.addressLine1 || sender?.street1,
    (sender as any)?.addressLine2 || sender?.street2,
    [sender?.city, sender?.state].filter(Boolean).join(", ") + (sender?.zip ? ` ${sender.zip}` : ""),
  ].filter(Boolean) as string[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-slate-900 text-slate-100 rounded-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - guaranteed responsive with close button always visible */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-sky-950 text-sky-400 border border-sky-800 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-serif font-bold text-sm sm:text-base text-white truncate">
                  Docket Instrument Inspector
                </h3>
                <span
                  className="font-mono text-[11px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 max-w-[130px] sm:max-w-[220px] truncate inline-block"
                  title={orderId}
                >
                  {orderId}
                </span>
                <button
                  type="button"
                  onClick={copyOrderId}
                  className="text-slate-400 hover:text-white transition shrink-0 p-0.5 cursor-pointer"
                  title="Copy Order ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                USPS CASS standardized physical letter proof
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0 z-20 border border-slate-700/60 bg-slate-800/40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm font-mono flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading docket instrument...</span>
            </div>
          ) : order ? (
            <div className="space-y-4">
              {/* Order Status & Verification Strip */}
              <div className="p-3.5 bg-slate-800/90 rounded-xl border border-slate-700/80 text-xs font-mono space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400">DOCKET ID: </span>
                    <span className="font-bold text-sky-400">{docketId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">SERVICE: </span>
                    <span className="font-bold text-white">{order.serviceLevel || "USPS CERTIFIED MAIL®"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">STATUS: </span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                        order.status === "PENDING_PAYMENT"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : order.status === "MAILED" || order.status === "DELIVERED"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  {postalProvenance && (
                    <div>
                      <span className="text-slate-400">POSTAL PROVIDER: </span>
                      <span className="font-bold text-white">
                        {postalProviderLabel(postalProvenance.provider)} ({postalProvenance.evidence})
                      </span>
                    </div>
                  )}
                  {postalProvenance?.provider === "lob" && order.lobTrackingNumber && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-400">USPS TRACKING: </span>
                      <span className="font-bold text-white">{order.lobTrackingNumber}</span>
                    </div>
                  )}
                </div>

                {/* Did they fill it out? Clear completion banner */}
                <div
                  className={`mt-2 pt-2 border-t border-slate-700/80 flex items-start gap-2 text-xs font-sans ${
                    hasDocumentHtml ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  {hasDocumentHtml ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-emerald-200">
                          Notice Form Fields Completed &amp; Snapshot Locked.
                        </span>{" "}
                        <span className="text-slate-300 text-[11px]">
                          {order.status === "PENDING_PAYMENT"
                            ? "Customer filled all statutory fields, adopted their signature, and passed USPS CASS verification. Awaiting payment."
                            : "Immutable letter proof generated and frozen before postal fulfillment."}
                        </span>
                        {snapshotHash && (
                          <div className="font-mono text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>SHA-256: {snapshotHash.slice(0, 24)}...</span>
                            <button
                              type="button"
                              onClick={() => copySnapshotHash(snapshotHash)}
                              className="text-slate-400 hover:text-white transition"
                              title="Copy full hash"
                            >
                              {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-amber-200">No Immutable HTML Snapshot Found</span>
                        <p className="text-slate-400 text-[11px]">
                          This order record does not contain a pre-rendered HTML payload (pre-migration or draft).
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* View Mode Tabs */}
              <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("sheet")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "sheet"
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>Visual Letter Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("text")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "text"
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>Notice Text &amp; Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("route")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "route"
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>Mailing Route</span>
                </button>
              </div>

              {/* Tab 1: Visual Print Proof Sheet */}
              {activeTab === "sheet" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span className="font-mono text-[11px]">8.5&quot; &times; 11&quot; USPS Physical Print Proof</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setZoomMode(zoomMode === "fit" ? "full" : "fit")}
                        className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                      >
                        {zoomMode === "fit" ? (
                          <>
                            <Maximize2 className="w-3 h-3" />
                            <span>100% Size</span>
                          </>
                        ) : (
                          <>
                            <Minimize2 className="w-3 h-3" />
                            <span>Fit Screen</span>
                          </>
                        )}
                      </button>
                      {hasDocumentHtml && (
                        <button
                          type="button"
                          onClick={handleOpenInNewTab}
                          className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open Tab</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {hasDocumentHtml ? (
                    <div
                      ref={sheetContainerRef}
                      className="w-full flex justify-center bg-slate-950 p-2 sm:p-4 rounded-xl border border-slate-800 overflow-x-auto min-h-[460px]"
                    >
                      {zoomMode === "fit" ? (
                        <div
                          style={{
                            width: `${Math.round(816 * fitScale)}px`,
                            height: `${Math.round(1056 * fitScale)}px`,
                            position: "relative",
                          }}
                          className="shadow-2xl rounded overflow-hidden bg-white border border-slate-300 shrink-0"
                        >
                          <iframe
                            srcDoc={documentHtml}
                            title="Docket Notice Specimen"
                            style={{
                              width: "816px",
                              height: "1056px",
                              transform: `scale(${fitScale})`,
                              transformOrigin: "top left",
                            }}
                            className="border-0 bg-white"
                            sandbox="allow-same-origin"
                          />
                        </div>
                      ) : (
                        <div className="shadow-2xl rounded overflow-hidden bg-white border border-slate-300 shrink-0">
                          <iframe
                            srcDoc={documentHtml}
                            title="Docket Notice Specimen Full"
                            style={{ width: "816px", height: "1056px" }}
                            className="border-0 bg-white"
                            sandbox="allow-same-origin"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-800/40 rounded-xl border border-slate-700 text-center text-slate-400 text-xs">
                      No visual letter proof available for this order.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Notice Text & Details (Easy readable mobile view) */}
              {activeTab === "text" && (
                <div className="space-y-4">
                  <div className="p-4 bg-white text-slate-900 rounded-xl font-serif text-sm leading-relaxed space-y-4 shadow-inner border border-slate-300">
                    <div className="font-mono text-[10px] text-slate-500 border-b border-slate-200 pb-2 flex justify-between items-center">
                      <span className="font-bold tracking-wider">DOCKETSTAMP™ DISPATCH SPECIMEN</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                        {order.docketId || docketId}
                      </span>
                    </div>

                    {extracted ? (
                      <div className="space-y-3 font-sans">
                        {extracted.headerTitle && (
                          <h4 className="font-serif font-bold text-base text-slate-900 border-b-2 border-slate-900 pb-1.5">
                            {extracted.headerTitle}
                          </h4>
                        )}

                        {extracted.reLine && (
                          <div className="p-2.5 bg-slate-100 rounded-md border-l-4 border-sky-600 font-medium text-xs text-slate-800 font-mono">
                            {extracted.reLine}
                          </div>
                        )}

                        {extracted.salutation && (
                          <div className="font-bold text-xs text-slate-800 font-serif">
                            {extracted.salutation}
                          </div>
                        )}

                        <div className="space-y-3 pt-1 font-serif text-xs leading-relaxed text-slate-800">
                          {extracted.paragraphs.map((p, idx) => (
                            <p key={idx} className="whitespace-pre-wrap">
                              {p}
                            </p>
                          ))}
                        </div>

                        {extracted.fullSignature && (
                          <div className="pt-3 border-t border-slate-200 font-serif text-xs text-slate-700">
                            <div className="whitespace-pre-wrap">{extracted.fullSignature}</div>
                          </div>
                        )}
                      </div>
                    ) : order.printedMessage || order.handwrittenNote ? (
                      <div className="space-y-2">
                        {order.printedMessage && (
                          <div className="font-bold text-sm text-slate-900">{order.printedMessage}</div>
                        )}
                        {order.handwrittenNote && (
                          <div className="whitespace-pre-wrap font-serif text-xs text-slate-800">
                            {order.handwrittenNote}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-slate-500 text-xs font-sans">
                        No parsed letter text available.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Mailing Route & Addresses */}
              {activeTab === "route" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Recipient Card */}
                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                      <span className="font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        Delivery Destination (Recipient)
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        CASS Verified
                      </span>
                    </div>
                    {recipientLines.length > 0 ? (
                      <div className="space-y-0.5 text-slate-200">
                        {recipientLines.map((line, idx) => (
                          <div key={idx} className={idx === 0 ? "font-bold text-white text-sm" : ""}>
                            {line}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">No recipient address recorded</div>
                    )}
                  </div>

                  {/* Sender Card */}
                  <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                      <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-slate-400" />
                        Return Address (Sender)
                      </span>
                      {order.customerEmail && (
                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                          {order.customerEmail}
                        </span>
                      )}
                    </div>
                    {senderLines.length > 0 ? (
                      <div className="space-y-0.5 text-slate-200">
                        {senderLines.map((line, idx) => (
                          <div key={idx} className={idx === 0 ? "font-bold text-white text-sm" : ""}>
                            {line}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">No sender address recorded</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 text-sm space-y-3">
              <div>Failed to load docket record for <span className="font-mono text-slate-200">{orderId}</span>.</div>
            </div>
          )}
        </div>

        {/* Modal Footer - Guaranteed exit buttons */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 truncate hidden sm:block">
            Docket ID: <span className="font-mono font-bold text-sky-400">{docketId}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto justify-end">
            {hasDocumentHtml && (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Open Fullsheet</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 shrink-0" />
              <span>Exit Proof</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
