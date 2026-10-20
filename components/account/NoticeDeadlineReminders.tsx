"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { NOTICE_REMINDER_LEAD_TIME_OPTIONS, type NoticeDeadlineReminderV1 } from "@/lib/reminder-contract";
import { buildNoticePrefillUrl } from "@/lib/account/notice-prefill";
import type { SavedAddress, MailingAddress } from "@/lib/types";

interface NoticeOption { slug: string; title: string }
interface ReminderResponse {
  reminders?: NoticeDeadlineReminderV1[];
  delivery?: { status?: string; enabled?: boolean; message?: string };
  error?: string;
}
interface Props {
  notices: NoticeOption[];
  savedAddresses: SavedAddress[];
  sender?: MailingAddress | null;
}

const statusText: Record<string, string> = {
  scheduled: "Saved",
  claimed: "Processing",
  sent: "Email sent",
  failed: "Email delivery failed after retries. You can edit the reminder or opt out.",
  opted_out: "Opted out",
  expired: "Past deadline; reminder expired",
};

export function NoticeDeadlineReminders({ notices, savedAddresses, sender }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<NoticeDeadlineReminderV1[]>([]);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [noticeSlug, setNoticeSlug] = useState(notices[0]?.slug || "");
  const [recipientId, setRecipientId] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [label, setLabel] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState<number>(7);
  const [consent, setConsent] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    setDeliveryEnabled(false);
    setDeliveryMessage("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/reminders", { headers: { Authorization: `Bearer ${token}` } });
      const data = (await res.json()) as ReminderResponse;
      if (!res.ok) throw new Error(data.error || "Could not load notice reminders.");
      setItems(Array.isArray(data.reminders) ? data.reminders : []);
      setDeliveryEnabled(data.delivery?.enabled === true);
      setDeliveryMessage(typeof data.delivery?.message === "string" ? data.delivery.message : "");
    } catch (cause) {
      setDeliveryEnabled(false);
      setError(cause instanceof Error ? cause.message : "Could not load notice reminders.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    void load();
  }, [load]);

  const activeItems = useMemo(() => items.filter((item) => item.status !== "opted_out"), [items]);
  const selectedRecipient = savedAddresses.find((address) => address.id === recipientId);

  function resetForm() {
    setEditingId(null);
    setDeadlineDate("");
    setLabel("");
    setConsent(false);
  }

  function edit(item: NoticeDeadlineReminderV1) {
    setEditingId(item.id);
    setDeadlineDate(item.deadlineDate);
    setTimezone(item.timezone);
    setLabel(item.label);
    setNoticeSlug(item.noticeSlug);
    setLeadTimeDays(item.leadTimeDays);
    setConsent(false);
    document.getElementById("notice-reminder-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!user) throw new Error("Sign in to manage notice reminders.");
      const token = await user.getIdToken();
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          deadlineDate,
          timezone,
          label: label.trim(),
          noticeSlug,
          consent: true,
          leadTimeDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save this reminder.");
      resetForm();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this reminder.");
    } finally {
      setSaving(false);
    }
  }

  async function optOut(item: NoticeDeadlineReminderV1) {
    setError("");
    try {
      if (!user) throw new Error("Sign in to manage notice reminders.");
      const token = await user.getIdToken();
      const res = await fetch(`/api/reminders?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not opt out of this reminder.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not opt out of this reminder.");
    }
  }

  const noticeTitle = (slug: string) => notices.find((notice) => notice.slug === slug)?.title || "Saved notice";

  return (
    <section aria-labelledby="deadline-reminders-heading" className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-5">
      <div>
        <h2 id="deadline-reminders-heading" className="text-xl font-serif font-bold text-stone-900">One-time notice deadline reminders</h2>
        <p className="text-sm text-stone-600 mt-1">Choose a specific deadline and notice. Historical birthdays and occasions are not used as legal deadlines.</p>
        <p role="status" className={`text-sm mt-2 ${deliveryEnabled ? "text-emerald-800" : "text-amber-800"}`}>
          {deliveryEnabled ? "The server reports reminder delivery as enabled. This page does not send email." : "Email delivery is not enabled yet. Saved reminders will not send email until delivery is configured."}
        </p>
        {deliveryMessage && <p className="text-xs text-stone-600">{deliveryMessage}</p>}
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      <form id="notice-reminder-form" onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-stone-50 p-4">
        <label className="text-sm font-medium text-stone-700">Notice
          <select required value={noticeSlug} onChange={(event) => setNoticeSlug(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
            {notices.map((notice) => <option key={notice.slug} value={notice.slug}>{notice.title}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-stone-700">Deadline date
          <input type="date" required value={deadlineDate} onChange={(event) => setDeadlineDate(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </label>
        <label className="text-sm font-medium text-stone-700">Reminder label
          <input required maxLength={120} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="For example, response deadline" className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </label>
        <label className="text-sm font-medium text-stone-700">Time zone
          <input required value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="America/Chicago" className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </label>
        <label className="text-sm font-medium text-stone-700">Lead time
          <select value={leadTimeDays} onChange={(event) => setLeadTimeDays(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
            {NOTICE_REMINDER_LEAD_TIME_OPTIONS.map((days) => <option key={days} value={days}>{days === 0 ? "On the deadline" : `${days} day${days === 1 ? "" : "s"} before`}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-stone-700">Prefill recipient for review (optional)
          <select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">Choose later</option>
            {savedAddresses.map((address) => <option key={address.id} value={address.id}>{address.firstName} {address.lastName} — {address.city}, {address.state}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2 flex items-start gap-2 text-sm text-stone-700">
          <input required type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 rounded border-stone-300 text-sky-700 focus:ring-sky-500" />
          <span>I explicitly request a one-time reminder for this notice deadline at the selected lead time.</span>
        </label>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <button disabled={saving} type="submit" className="min-h-11 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2">{saving ? "Saving…" : editingId ? "Save changes" : "Save reminder"}</button>
          {editingId && <button type="button" onClick={resetForm} className="min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-sky-500">Cancel edit</button>}
          {selectedRecipient && noticeSlug && <Link className="min-h-11 inline-flex items-center rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500" href={buildNoticePrefillUrl({ noticeSlug, recipient: selectedRecipient, sender })}>Review selected notice</Link>}
        </div>
      </form>

      <div aria-live="polite" className="space-y-3">
        {loading ? <p className="text-sm text-stone-500">Loading saved reminders…</p> : activeItems.length === 0 ? <p className="text-sm text-stone-500">No one-time notice reminders are saved.</p> : activeItems.map((item) => (
          <article key={item.id} className="rounded-2xl border border-stone-200 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-stone-900">{item.label}</h3>
              <p className="text-sm text-stone-600">{noticeTitle(item.noticeSlug)} · Deadline {item.deadlineDate} · {item.timezone} · {item.leadTimeDays === 0 ? "on deadline" : `${item.leadTimeDays} days before`}</p>
              <p className="text-xs text-stone-500 mt-1">{statusText[item.status] || "Status unavailable"}{item.status === "failed" && item.lastError ? `: ${item.lastError}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={buildNoticePrefillUrl({ noticeSlug: item.noticeSlug, sender })} className="min-h-10 inline-flex items-center rounded-lg border border-sky-200 px-3 py-2 text-sm font-medium text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500">Review notice</Link>
              {["scheduled", "failed"].includes(item.status) && <button type="button" onClick={() => edit(item)} className="min-h-10 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-sky-500">Edit</button>}
              {["scheduled", "failed", "claimed"].includes(item.status) && <button type="button" onClick={() => void optOut(item)} className="min-h-10 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500">Opt out</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
