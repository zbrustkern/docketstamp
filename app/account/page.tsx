"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  BookOpen,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  LogOut,
  MapPin,
  ExternalLink,
  Edit2,
  Feather,
  Upload,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Order, SavedAddress, MailingAddress } from "@/lib/types";
import { AuthModal } from "@/components/AuthModal";
import { ContactImportModal } from "@/components/ContactImportModal";
import { ParsedContact } from "@/lib/contact-parser";
import { NoticeDeadlineReminders } from "@/components/account/NoticeDeadlineReminders";
import { ALL_NOTICE_CARTRIDGES } from "@/src/lib/docket/notices";
import { NoticePrefillChooser } from "@/components/account/NoticePrefillChooser";
import { getOrderHistoryPresentation } from "@/lib/account/order-history";

export default function AccountDashboardPage() {
  const {
    user,
    account,
    loading: authLoading,
    signOut,
    refreshAccount,
    saveAddress,
    saveAddressesBulk,
    deleteAddress,
    updateDefaultReturnAddress,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<"orders" | "addresses">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Address Modal State
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);

  // Contact Bulk Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState("");
  const [returnAddressMessage, setReturnAddressMessage] = useState("");

  // Return Address Edit State
  const [isEditingReturn, setIsEditingReturn] = useState(false);
  const [returnForm, setReturnForm] = useState<MailingAddress>({
    firstName: "",
    lastName: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "USA",
  });

  // Auth Modal State (if not logged in)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (account?.defaultReturnAddress) {
      setReturnForm(account.defaultReturnAddress);
    }
  }, [account]);

  // Fetch past orders for this customer
  useEffect(() => {
    if (!user) {
      setOrdersLoading(false);
      return;
    }

    const fetchOrders = async () => {
      setOrdersLoading(true);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(
          `/api/account?uid=${user.uid}&email=${encodeURIComponent(user.email || "")}`,
          {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
          await refreshAccount();
        }
      } catch (err) {
        console.error("Failed to load customer orders:", err);
      } finally {
        setOrdersLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  const handleBulkImport = async (contactsToImport: ParsedContact[]) => {
    setAccountError("");
    try {
      await saveAddressesBulk(contactsToImport);
    } catch (cause) {
      setAccountError(cause instanceof Error ? cause.message : "Could not import contacts.");
      return;
    }
    await refreshAccount();
    setImportSuccessMessage(
      `Successfully imported ${contactsToImport.length} contact${
        contactsToImport.length === 1 ? "" : "s"
      } to your address book!`
    );
    setTimeout(() => setImportSuccessMessage(null), 6000);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center animate-bounce shadow-lg shadow-amber-600/25 mb-4">
          <Feather className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold font-serif text-stone-900 mb-2">Loading Account...</h2>
      </div>
    );
  }

  // Not Logged In View
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-stone-200 shadow-xl max-w-md w-full space-y-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-600 flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-stone-900 mb-2">DocketStamp Registry Account</h1>
            <p className="text-sm text-stone-500">
              Sign in to view your notice dispatch history, tracking dockets, and verified recipient contacts.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-3 bg-stone-900 hover:bg-black text-white text-sm font-semibold rounded-2xl shadow-md transition cursor-pointer"
            >
              Sign In / Create Account
            </button>
            <Link
              href="/"
              className="inline-block text-xs font-semibold text-stone-500 hover:text-stone-800 transition"
            >
              &larr; Return to Registry
            </Link>
          </div>
        </div>

        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-24 text-stone-900">
      {/* HEADER */}
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20 hover:bg-sky-700 transition"
            >
              <ShieldCheck className="w-5 h-5 text-sky-100" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-lg sm:text-xl font-bold text-stone-900">
                  DocketStamp
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-200">
                  Registry Account
                </span>
              </div>
              <p className="text-xs text-stone-500">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Draft New Notice</span>
            </Link>

            <button
              onClick={() => signOut()}
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* TABS SWITCHER */}
        <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "orders"
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Order History</span>
            <span className="text-xs opacity-75 font-mono">({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("addresses")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "addresses"
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Address Book</span>
            <span className="text-xs opacity-75 font-mono">
              ({account?.savedAddresses.length || 0})
            </span>
          </button>
        </div>

        {/* TAB 1: ORDER HISTORY */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900">Notice records and dockets</h2>
                <p className="text-xs text-stone-500">Review notice records and any available dispatch evidence.</p>
              </div>

              <Link
                href="/"
                className="inline-flex sm:hidden items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Notice</span>
              </Link>
            </div>

            {ordersLoading ? (
              <div className="p-12 text-center text-stone-400 text-sm">Loading your filing dockets...</div>
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 border border-stone-200 text-center space-y-4 max-w-lg mx-auto">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-stone-900">No notices dispatched yet</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Review a supported notice template and enter your factual details. Available postal options and any dispatch confirmation are shown in the notice workflow.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-sky-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-sky-700 transition"
                >
                  <FileText className="w-4 h-4" />
                  <span>Draft Your First Notice</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {orders.map((order) => {
                  const isScheduled = !!order.scheduledSendDate;
                  const history = getOrderHistoryPresentation(order);

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition space-y-4"
                    >
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 flex-shrink-0 flex items-center justify-center"><FileText className="w-5 h-5" /></div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                isScheduled
                                  ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                  : "bg-stone-50 text-stone-800 border-stone-200"
                              }`}
                            >
                              {isScheduled
                                ? "Scheduled"
                                : "Recorded"}
                            </span>
                            <span className="text-[10px] font-mono text-stone-400">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-stone-900 truncate">{history.recordKind}{order.noticeType || order.noticeId ? ` · ${order.noticeType || order.noticeId}` : ""}</h3>
                          <p className="text-[11px] text-stone-500 truncate">
                            {order.recipientAddress?.firstName} {order.recipientAddress?.lastName}
                          </p>
                          <p className="text-[10px] text-stone-500">{history.providerLabel}</p>

                          {order.scheduledSendDate && (
                            <div className="flex items-center gap-1 text-[11px] text-indigo-700 font-medium pt-1">
                              <Calendar className="w-3 h-3" />
                              <span>Send: {order.scheduledSendDate}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                        <Link
                          href={`/order/${order.id}`}
                          className="font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1"
                        >
                          <span>Tracker</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>

                        <span className="text-[11px] text-stone-500">Record details</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ADDRESS BOOK */}
        {activeTab === "addresses" && (
          <div className="space-y-8">
            {/* SUCCESS BANNER FROM BULK IMPORT */}
            {accountError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{accountError}</p>}
            {importSuccessMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-200/90 text-emerald-900 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{importSuccessMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImportSuccessMessage(null)}
                  className="text-stone-400 hover:text-stone-700 cursor-pointer p-1"
                >
                  &times;
                </button>
              </div>
            )}

            {/* SAVED RECIPIENTS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-serif font-bold text-stone-900">
                    Saved Recipient Addresses
                  </h2>
                  <p className="text-xs text-stone-500">
                    Use a saved address to prefill the recipient fields of a supported notice review.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl border border-stone-200 transition cursor-pointer"
                    title="Import contacts from CSV, vCard (.vcf), or spreadsheet"
                  >
                    <Upload className="w-3.5 h-3.5 text-stone-600" />
                    <span>Import Contacts</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingAddress(null);
                      setIsAddressModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Contact</span>
                  </button>
                </div>
              </div>

              {!account?.savedAddresses || account.savedAddresses.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 border border-stone-200 text-center space-y-3 max-w-md mx-auto">
                  <BookOpen className="w-8 h-8 mx-auto text-stone-400" />
                  <h3 className="text-sm font-bold text-stone-900">No saved recipient addresses</h3>
                  <p className="text-xs text-stone-500">
                    Save recipient addresses to prefill a notice review. Imported occasion dates remain historical contact details.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      onClick={() => setIsImportModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 text-stone-700 text-xs font-semibold rounded-xl hover:bg-stone-200 transition cursor-pointer border border-stone-200 shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-stone-600" />
                      <span>Import CSV / vCard</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingAddress(null);
                        setIsAddressModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700 transition cursor-pointer shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add First Contact</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {account.savedAddresses.map((addr) => {
                      const legacyOccasion = addr.occasionMonth && addr.occasionDay
                        ? `Historical occasion on file: ${addr.occasionMonth}/${addr.occasionDay}${addr.occasionYear ? `/${addr.occasionYear}` : ""}. This does not create a deadline reminder.`
                        : "";

                      return (
                        <div key={addr.id} className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">{addr.label || "Recipient"}</span>
                              <button type="button" onClick={async () => { if (!window.confirm(`Delete ${addr.firstName} ${addr.lastName} from your address book?`)) return; setAccountError(""); try { await deleteAddress(addr.id); } catch (cause) { setAccountError(cause instanceof Error ? cause.message : "Could not delete this contact."); } }} className="text-stone-400 hover:text-rose-600 transition p-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-lg" title="Delete contact" aria-label={`Delete ${addr.firstName} ${addr.lastName}`}><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                            <h3 className="text-sm font-bold text-stone-900 pt-1">{addr.firstName} {addr.lastName}</h3>
                            <p className="text-xs text-stone-600">{addr.street1}</p>
                            {addr.street2 && <p className="text-xs text-stone-600">{addr.street2}</p>}
                            <p className="text-xs text-stone-600">{addr.city}, {addr.state} {addr.zip}</p>
                            {legacyOccasion && <p className="pt-2 text-[11px] text-stone-500">{legacyOccasion}</p>}
                          </div>
                          <div className="pt-2 border-t border-stone-100 flex flex-col gap-3">
                            <NoticePrefillChooser recipient={addr} sender={account?.defaultReturnAddress} notices={ALL_NOTICE_CARTRIDGES} />
                            <div className="flex items-center justify-between">
                              <button type="button" onClick={() => { setEditingAddress(addr); setIsAddressModalOpen(true); }} className="min-h-10 text-stone-600 hover:text-stone-900 flex items-center gap-1 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-lg px-2"><Edit2 className="w-3 h-3" /><span>Edit address</span></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Gentle Footer Import Link */}
                  <div className="p-4 bg-stone-50/80 rounded-2xl border border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-stone-800">Have an address book in Apple Contacts, Google, or Excel?</span>
                        <p className="text-[11px] text-stone-500">Bulk-import names, addresses, and historical occasion metadata. Imports never create deadline reminders.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(true)}
                      className="px-3.5 py-1.5 bg-white hover:bg-stone-100 text-stone-800 text-xs font-semibold rounded-xl border border-stone-200 transition cursor-pointer shrink-0 shadow-2xs"
                    >
                      Import Contacts &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            <NoticeDeadlineReminders
              notices={ALL_NOTICE_CARTRIDGES.map(({ slug, title }) => ({ slug, title }))}
              savedAddresses={account?.savedAddresses || []}
              sender={account?.defaultReturnAddress}
            />

            {/* DEFAULT RETURN ADDRESS */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-stone-500" />
                    Default Return Address
                  </h3>
                  <p className="text-xs text-stone-500">
                    Pre-fills sender details when preparing a notice.
                  </p>
                </div>

                {!isEditingReturn && (
                  <button
                    onClick={() => setIsEditingReturn(true)}
                    className="text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition"
                  >
                    {account?.defaultReturnAddress ? "Edit Return Address" : "Set Return Address"}
                  </button>
                )}
              </div>

              {isEditingReturn ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setReturnAddressMessage("");
                    try {
                      await updateDefaultReturnAddress(returnForm);
                      setIsEditingReturn(false);
                      setReturnAddressMessage("Return address saved.");
                    } catch (cause) {
                      setReturnAddressMessage(cause instanceof Error ? cause.message : "Could not save return address.");
                    }
                  }}
                  className="space-y-4 max-w-xl"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        required
                        value={returnForm.firstName}
                        onChange={(e) =>
                          setReturnForm((prev) => ({ ...prev, firstName: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        required
                        value={returnForm.lastName}
                        onChange={(e) =>
                          setReturnForm((prev) => ({ ...prev, lastName: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      required
                      value={returnForm.street1}
                      onChange={(e) =>
                        setReturnForm((prev) => ({ ...prev, street1: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        required
                        value={returnForm.city}
                        onChange={(e) =>
                          setReturnForm((prev) => ({ ...prev, city: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={2}
                        value={returnForm.state}
                        onChange={(e) =>
                          setReturnForm((prev) => ({
                            ...prev,
                            state: e.target.value.toUpperCase(),
                          }))
                        }
                        className="w-full px-2 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-center uppercase"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        required
                        value={returnForm.zip}
                        onChange={(e) =>
                          setReturnForm((prev) => ({ ...prev, zip: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition"
                    >
                      Save Return Address
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingReturn(false)}
                      className="px-4 py-2 text-xs text-stone-500 hover:text-stone-800 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : account?.defaultReturnAddress ? (
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 text-xs space-y-1 max-w-md">
                  <p className="font-bold text-stone-800">
                    {account.defaultReturnAddress.firstName} {account.defaultReturnAddress.lastName}
                  </p>
                  <p className="text-stone-600">{account.defaultReturnAddress.street1}</p>
                  {account.defaultReturnAddress.street2 && (
                    <p className="text-stone-600">{account.defaultReturnAddress.street2}</p>
                  )}
                  <p className="text-stone-600">
                    {account.defaultReturnAddress.city}, {account.defaultReturnAddress.state}{" "}
                    {account.defaultReturnAddress.zip}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-stone-400 italic">No default return address set yet.</p>
              )}
              {returnAddressMessage && <p role="status" className="text-sm text-stone-700">{returnAddressMessage}</p>}
            </div>
          </div>
        )}
      </main>

      {/* ADD / EDIT CONTACT MODAL */}
      {isAddressModalOpen && (
        <ContactModal
          initialAddress={editingAddress}
          onClose={() => setIsAddressModalOpen(false)}
          onSave={async (savedData) => {
            await saveAddress(savedData);
            setIsAddressModalOpen(false);
          }}
        />
      )}

      {/* BULK CONTACT IMPORT MODAL */}
      <ContactImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleBulkImport}
      />
    </div>
  );
}

function ContactModal({
  initialAddress,
  onClose,
  onSave,
}: {
  initialAddress: SavedAddress | null;
  onClose: () => void;
  onSave: (data: Omit<SavedAddress, "id"> & { id?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    id: initialAddress?.id,
    label: initialAddress?.label || "Friend",
    firstName: initialAddress?.firstName || "",
    lastName: initialAddress?.lastName || "",
    street1: initialAddress?.street1 || "",
    street2: initialAddress?.street2 || "",
    city: initialAddress?.city || "",
    state: initialAddress?.state || "",
    zip: initialAddress?.zip || "",
    country: "USA",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      await onSave({
        ...form,
        ...(initialAddress?.occasionType ? { occasionType: initialAddress.occasionType } : {}),
        ...(initialAddress?.occasionTitle ? { occasionTitle: initialAddress.occasionTitle } : {}),
        ...(initialAddress?.occasionMonth ? { occasionMonth: initialAddress.occasionMonth } : {}),
        ...(initialAddress?.occasionDay ? { occasionDay: initialAddress.occasionDay } : {}),
        ...(initialAddress?.occasionYear ? { occasionYear: initialAddress.occasionYear } : {}),
        ...(initialAddress?.remindMe !== undefined ? { remindMe: initialAddress.remindMe } : {}),
        ...(initialAddress?.remindDaysBefore ? { remindDaysBefore: initialAddress.remindDaysBefore } : {}),
      });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Could not save this contact.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h3 className="text-base font-bold text-stone-900 font-serif">
            {initialAddress ? "Edit Contact" : "Add New Contact"}
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer p-1">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
              Relationship / Label (e.g. Mom, Best Friend, Client)
            </label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              placeholder="Mom"
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                First Name
              </label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                Last Name
              </label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
              Street Address
            </label>
            <input
              type="text"
              required
              value={form.street1}
              onChange={(e) => setForm((p) => ({ ...p, street1: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
              Apt, Suite (Optional)
            </label>
            <input
              type="text"
              value={form.street2}
              onChange={(e) => setForm((p) => ({ ...p, street2: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">City</label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">State</label>
              <input
                type="text"
                required
                maxLength={2}
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                className="w-full px-2 py-2 text-sm bg-stone-50 border border-stone-300 rounded-xl text-center uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">ZIP</label>
              <input
                type="text"
                required
                value={form.zip}
                onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {initialAddress?.occasionMonth && initialAddress?.occasionDay && <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">Historical occasion metadata ({initialAddress.occasionMonth}/{initialAddress.occasionDay}{initialAddress.occasionYear ? `/${initialAddress.occasionYear}` : ""}) is retained as contact data only. It will not create a notice deadline reminder.</p>}
          {saveError && <p role="alert" className="text-sm text-rose-800">{saveError}</p>}

          <div className="flex items-center gap-2 pt-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {saving ? "Saving..." : "Save Contact"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs text-stone-500 hover:text-stone-800 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
