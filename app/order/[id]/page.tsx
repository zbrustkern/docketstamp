"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  PenTool,
  Mail,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  User as UserIcon,
  Lock,
  FileText,
  MapPin,
  Feather,
} from "lucide-react";
import { Order } from "@/lib/types";
import { getOrderHistoryPresentation } from "@/lib/account/order-history";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { trackGoogleAdsPurchase } from "@/lib/google-ads";
import { trackMetaPurchase } from "@/lib/meta-ads";

export default function OrderStatusPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const { user, saveAddress } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  // Auto-sync recipient address to user's address book if logged in or after claiming account
  useEffect(() => {
    if (user && order?.recipientAddress && order.recipientAddress.street1) {
      saveAddress({
        firstName: order.recipientAddress.firstName,
        lastName: order.recipientAddress.lastName,
        street1: order.recipientAddress.street1,
        street2: order.recipientAddress.street2,
        city: order.recipientAddress.city,
        state: order.recipientAddress.state,
        zip: order.recipientAddress.zip,
        country: order.recipientAddress.country,
        label: `${order.recipientAddress.firstName}'s Address`,
      }).catch((err) => console.warn("Notice syncing address book on order page:", err));
    }
  }, [user, order?.id]);

  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;
    const fetchOrder = async () => {
      try {
        const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const tokenFromUrl = urlParams?.get("token") || urlParams?.get("viewToken");
        if (tokenFromUrl && typeof window !== "undefined") {
          try {
            sessionStorage.setItem(`order_token_${orderId}`, tokenFromUrl);
            // Bearer token hygiene: strip sensitive tokens from URL history to prevent leaking into Referer headers or analytics
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("token");
            cleanUrl.searchParams.delete("viewToken");
            const newSearch = cleanUrl.searchParams.toString();
            window.history.replaceState({}, "", cleanUrl.pathname + (newSearch ? `?${newSearch}` : ""));
          } catch {
            // ignore storage/history errors in restricted sandboxes
          }
        }
        const tokenFromStorage = typeof window !== "undefined" ? sessionStorage.getItem(`order_token_${orderId}`) : null;
        const activeToken = tokenFromUrl || tokenFromStorage;

        const endpoint = activeToken
          ? `/api/orders/${orderId}?token=${encodeURIComponent(activeToken)}`
          : `/api/orders/${orderId}`;

        const headers: HeadersInit = {};
        if (!activeToken && user) {
          headers.Authorization = `Bearer ${await user.getIdToken()}`;
        }
        const res = await fetch(endpoint, { headers });
        if (!res.ok) {
          throw new Error("Order not found or still processing.");
        }
        const data = await res.json();
        if (data.order && !data.order.isRedacted && data.order.status === "PENDING_PAYMENT" && typeof window !== "undefined") {
          const paymentIntentId = urlParams?.get("payment_intent") || data.order.stripePaymentId;
          if (paymentIntentId) {
            try {
              const confirmRes = await fetch("/api/checkout/confirm-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId,
                  paymentIntentId,
                }),
              });
              if (confirmRes.ok) {
                const confirmData = await confirmRes.json();
                if (confirmData.success && confirmData.status) {
                  data.order.status = confirmData.status;
                  data.order.lobLetterId = confirmData.lobLetterId;
                }
              }
            } catch (cErr) {
              console.warn("Notice during order page auto-confirmation:", cErr);
            }
          }
        }

        if (isMounted) {
          setOrder(data.order);
          setLoading(false);

          if (data.order && !data.order.isRedacted && data.order.status !== "PENDING_PAYMENT") {
            trackGoogleAdsPurchase({
              orderId: data.order.id,
              amountInCents: data.order.finalAmountInCents ?? data.order.amountInCents,
              customerEmail: data.order.customerEmail,
              itemName: "DocketStamp notice dispatch",
              itemCategory: "notice",
            });
            trackMetaPurchase({
              orderId: data.order.id,
              value: (data.order.finalAmountInCents ?? data.order.amountInCents) / 100,
              customerEmail: data.order.customerEmail,
              customerName: data.order.returnAddress?.firstName
                ? `${data.order.returnAddress.firstName} ${data.order.returnAddress.lastName || ""}`.trim()
                : undefined,
              recipientCity: data.order.recipientAddress?.city,
              recipientState: data.order.recipientAddress?.state,
              recipientZip: data.order.recipientAddress?.zip,
              itemName: "DocketStamp notice dispatch",
              itemCategory: "notice",
            });
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error loading order");
          setLoading(false);
        }
      }
    };

    fetchOrder();
    // Poll every 5s if order is still pending
    const interval = setInterval(fetchOrder, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orderId, user]);

  const handleOwnerAccess = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setOwnerLoading(true);
    setOwnerError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      const data = await res.json();
      if (!res.ok || !data.order || data.order.isRedacted) {
        setOwnerError(data.error || "Sign in with the verified account that owns this order.");
      } else {
        setOrder(data.order);
      }
    } catch {
      setOwnerError("Could not verify account access. Please try again.");
    } finally {
      setOwnerLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center animate-bounce shadow-lg shadow-amber-600/25 mb-4">
          <PenTool className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold font-serif text-stone-900 mb-2">
          Loading order record…
        </h2>
        <p className="text-sm text-stone-500">Retrieving the stored order details.</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-lg max-w-md w-full">
          <h2 className="text-lg font-bold text-stone-900 mb-2">Order Notice</h2>
          <p className="text-sm text-stone-600 mb-6">{error || "Could not locate this order."}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-black transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const history = getOrderHistoryPresentation(order);

  return (
    <div className="min-h-screen bg-[#0F172A] pb-20 text-slate-100">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-[#0F172A]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Start a Notice</span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/account"
                className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 transition"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>My Account</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition cursor-pointer"
              >
                Save Order to Account
              </button>
            )}
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Order Reference</span>
              <span className="font-mono text-xs text-stone-700">{order.id}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* ACCOUNT CLAIM BANNER IF GUEST */}
        {!user && (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Feather className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900">Keep this order in your account</h4>
                <p className="text-xs text-stone-600">
                  Sign in to view your account and keep saved recipient addresses together.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition flex-shrink-0 cursor-pointer shadow-sm"
            >
              Create or sign in
            </button>
          </div>
        )}
        {/* ORDER RECORD SUMMARY */}
        <section className="rounded-3xl border border-slate-700 bg-slate-900 p-6 sm:p-8 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-300 flex items-center justify-center shrink-0"><FileText className="w-5 h-5" /></div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-white">{history.recordKind}</h1>
              <p className="text-sm text-slate-300 mt-1">This page shows order details and postal evidence recorded for this reference. Missing or conflicting provider data is shown as unknown.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-slate-200">{history.statusLabel}</span>
            <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-slate-200">{history.providerLabel}</span>
            {order.customerEmail && <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-slate-200">Order email: {order.customerEmail}</span>}
          </div>
          {history.postal.evidence === "conflict" && <p className="text-xs text-amber-200">Postal identifiers conflict. No provider-specific tracking lookup is shown for this record.</p>}
        </section>

        {/* POSTAL EVIDENCE */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <ShieldCheck className="w-4 h-4 text-sky-300" />
            <h2 className="text-base font-bold text-white">Postal evidence</h2>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-slate-400">Provider</dt><dd className="mt-1 text-slate-100">{history.providerLabel}</dd></div>
            <div><dt className="text-xs text-slate-400">Provider status</dt><dd className="mt-1 text-slate-100">{history.providerStatus}</dd></div>
            <div><dt className="text-xs text-slate-400">Provider reference</dt><dd className="mt-1 font-mono text-slate-100 break-all">{history.providerReference || "Not available"}</dd></div>
            <div><dt className="text-xs text-slate-400">Recorded mailed date</dt><dd className="mt-1 text-slate-100">{history.mailedDate}</dd></div>
            <div><dt className="text-xs text-slate-400">Docket reference</dt><dd className="mt-1 font-mono text-slate-100 break-all">{history.docketReference}</dd></div>
            <div><dt className="text-xs text-slate-400">Recorded service level</dt><dd className="mt-1 text-slate-100">{history.serviceLevel}</dd></div>
          </dl>
          {history.trackingNumber && <p className="text-sm text-slate-200">Tracking number: <span className="font-mono">{history.trackingNumber}</span></p>}
          {history.trackingUrl && <a href={history.trackingUrl} target="_blank" rel="noreferrer" className="min-h-11 inline-flex items-center gap-2 rounded-xl border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-950 focus:outline-none focus:ring-2 focus:ring-sky-400">Open provider tracking <ExternalLink className="w-4 h-4" /></a>}
        </section>

        {/* PRIVACY UNLOCK BANNER IF REDACTED */}
        {order.isRedacted && (
          <div className="bg-stone-900 text-white rounded-3xl p-6 border border-stone-800 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <span>Private Details Protected</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans">
                    Zero-Trust Privacy
                  </span>
                </h3>
                <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                  Private details are protected. Open the secure order link from your receipt, or sign in with the verified account that owns this order.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOwnerAccess}
              disabled={ownerLoading}
              className="min-h-11 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              {ownerLoading ? "Checking account…" : user ? "View details with my account" : "Sign in to view details"}
            </button>
            {ownerError && <p role="alert" className="text-sm text-rose-300 font-medium">{ownerError}</p>}
          </div>
        )}

        {/* STORED ORDER DETAILS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2"><FileText className="w-4 h-4 text-sky-300" />Stored order details</h2>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-slate-400">Order reference</dt><dd className="mt-1 font-mono text-slate-100 break-all">{order.id}</dd></div>
              <div><dt className="text-xs text-slate-400">Created</dt><dd className="mt-1 text-slate-100">{order.createdAt ? new Date(order.createdAt).toLocaleString() : "Not available"}</dd></div>
              <div><dt className="text-xs text-slate-400">Payment amount recorded</dt><dd className="mt-1 text-slate-100">{Number.isFinite(order.amountInCents) ? `$${(order.amountInCents / 100).toFixed(2)}` : "Not available"}</dd></div>
              {order.fulfillmentError && <div><dt className="text-xs text-rose-300">Processing note</dt><dd className="mt-1 text-rose-100">{order.fulfillmentError}</dd></div>}
            </dl>
          </div>

          {order.isRedacted ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 flex items-start gap-3 text-sm text-slate-300"><Lock className="w-5 h-5 text-amber-300 shrink-0" /><p>Recipient and return-address details are hidden until order verification succeeds.</p></div>
          ) : (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-5">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2"><Mail className="w-4 h-4 text-sky-300" />Recipient address recorded</h2>
                <address className="not-italic rounded-xl bg-slate-800 p-3.5 text-sm text-slate-200 space-y-1">
                  <p className="font-semibold text-white">{order.recipientAddress.firstName} {order.recipientAddress.lastName}</p>
                  <p>{order.recipientAddress.street1}</p>
                  {order.recipientAddress.street2 && <p>{order.recipientAddress.street2}</p>}
                  <p>{order.recipientAddress.city}, {order.recipientAddress.state} {order.recipientAddress.zip}</p>
                </address>
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-300" />Return address recorded</h2>
                <address className="not-italic rounded-xl bg-slate-800 p-3.5 text-sm text-slate-200 space-y-1">
                  <p className="font-semibold text-white">{order.returnAddress.firstName} {order.returnAddress.lastName}</p>
                  <p>{order.returnAddress.street1}</p>
                  {order.returnAddress.street2 && <p>{order.returnAddress.street2}</p>}
                  <p>{order.returnAddress.city}, {order.returnAddress.state} {order.returnAddress.zip}</p>
                </address>
              </div>
            </div>
          )}
        </section>

        {/* Action Button */}
        <div className="text-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-xl shadow-sky-600/20 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-sky-100" />
            <span>Start a Notice</span>
          </Link>
        </div>
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultEmail={order.customerEmail}
      />
    </div>
  );
}
