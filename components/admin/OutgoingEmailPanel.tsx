"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw, Send } from 'lucide-react';

type HistoryItem = {
  requestId: string;
  recipient: string;
  subject: string;
  status: 'pending' | 'accepted' | 'rejected' | 'uncertain';
  providerId: string | null;
  createdAt: string;
};

const statusLabel: Record<HistoryItem['status'], string> = {
  pending: 'Processing; outcome not yet confirmed',
  accepted: 'Accepted by Resend; delivery not confirmed',
  rejected: 'Rejected by Resend',
  uncertain: 'Outcome uncertain; check provider before retrying',
};

export function OutgoingEmailPanel() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [environment, setEnvironment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/outbound-email', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error('Could not load sent history.');
      setHistory(data.history || []);
      setEnvironment(data.environment || '');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load sent history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/outbound-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: crypto.randomUUID(), to, subject, message }),
      });
      const data = await response.json();
      if (response.status === 429) throw new Error('The hourly send limit has been reached. Try again later.');
      if (data.error === 'OUTBOUND_EMAIL_NOT_CONFIGURED') throw new Error('Sending is unavailable because the server is not configured.');
      if (data.error === 'OUTBOUND_EMAIL_INPUT_INVALID') throw new Error('Check the recipient, subject, and message lengths.');
      if (data.error === 'OUTBOUND_EMAIL_REQUEST_CONFLICT') throw new Error('This request ID was already used for different content. Refresh the page before trying again.');
      if (!response.ok && data.status !== 'rejected') throw new Error('The send outcome is uncertain. Check Sent history and the Resend dashboard before trying again.');
      if (data.status === 'accepted') {
        setNotice(`Resend accepted the message${data.providerId ? ` (ID ${data.providerId})` : ''}. This does not confirm delivery.`);
        setTo(''); setSubject(''); setMessage('');
      } else if (data.status === 'rejected') {
        setError('Resend rejected the message. Review the destination and provider status before submitting a new request.');
      } else {
        setError('The outcome is uncertain. Check Sent history and the Resend dashboard before trying again.');
      }
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The message could not be sent.');
      await loadHistory();
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" aria-labelledby="outgoing-email-title">
      <div>
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-sky-100 p-2.5 text-sky-800"><Mail className="h-5 w-5" /></span>
          <div>
            <h1 id="outgoing-email-title" className="text-xl font-bold text-stone-900">Outgoing email</h1>
            <p className="text-sm text-stone-600">Admin correspondence via Resend{environment ? ` · ${environment}` : ''}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 space-y-1">
        <p><strong>External email:</strong> this sends a real message. For routine verification, use Resend’s designated test recipient. Verify the recipient and text before sending correspondence to Lob or anyone else.</p>
        <p>From: Zeke at DocketStamp &lt;zeke@docketstamp.com&gt; · Replies go to zeke@docketstamp.com.</p>
        <p>Reply forwarding has not been verified. Do not rely on replies until forwarding is confirmed.</p>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7 shadow-sm space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-800">
            To
            <input required type="email" autoComplete="email" maxLength={254} value={to} onChange={(e) => setTo(e.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
          </label>
          <label className="block text-sm font-medium text-stone-800">
            Subject
            <input required maxLength={160} value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
          </label>
        </div>
        <label className="block text-sm font-medium text-stone-800">
          Message <span className="font-normal text-stone-500">(plain text, up to 12,000 characters)</span>
          <textarea required maxLength={12000} rows={10} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-stone-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
        </label>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <div className="flex justify-end">
          <button disabled={sending || !to.trim() || !subject.trim() || !message.trim()} type="submit" className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Send className="h-4 w-4" /> {sending ? 'Submitting…' : 'Send email'}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-7 shadow-sm" aria-labelledby="outgoing-email-history-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="outgoing-email-history-title" className="font-bold text-stone-900">Recent send history</h2>
            <p className="text-xs text-stone-500">Only this environment · most recent 30 requests</p>
          </div>
          <button type="button" onClick={() => void loadHistory()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {loading ? <p className="py-4 text-sm text-stone-500">Loading history…</p> : history.length === 0 ? <p className="py-4 text-sm text-stone-500">No email requests recorded in this environment.</p> : (
          <ul className="divide-y divide-stone-100">
            {history.map((item) => (
              <li key={item.requestId} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto] sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-900">{item.subject}</p>
                  <p className="truncate text-stone-600">To: {item.recipient}</p>
                  {item.providerId && <p className="truncate text-xs text-stone-500">Resend ID: {item.providerId}</p>}
                </div>
                <div className="sm:text-right">
                  <p className={`text-xs font-semibold ${item.status === 'accepted' ? 'text-emerald-800' : item.status === 'uncertain' || item.status === 'pending' ? 'text-amber-800' : 'text-rose-800'}`}>{statusLabel[item.status]}</p>
                  <time className="text-xs text-stone-500" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
