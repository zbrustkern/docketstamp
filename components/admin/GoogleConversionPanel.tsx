'use client';

import { useCallback, useEffect, useState } from 'react';

type Row = { kind: string | null; id: string | null; orderId: string | null; status: string | null; attempts: number; diagnosticCodes: string[]; createdAt: string | null; submittedAt: string | null; processingAcceptedAt: string | null; attributedAt: string | null; clickExpiresAt: string | null; nextAttemptAt: string | null };
type Status = { environment: string; exportEnabled: boolean; apiEnabled: boolean; destinationVerified: boolean; rows: Row[]; truncated: boolean; message: string };

export function GoogleConversionPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [repairOrderId, setRepairOrderId] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/google-conversions', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error('Conversion diagnostics are unavailable for this account.');
      setStatus(body); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load conversion diagnostics.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const exportCsv = async () => {
    if (!status?.exportEnabled || !selected.length) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/admin/google-conversions/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: crypto.randomUUID(), reason: 'Operator requested eligible DocketStamp conversions for separately authorized manual upload', orderIds: selected }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(typeof body.error === 'string' ? body.error.replaceAll('_', ' ').toLowerCase() : 'Export was not prepared.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'docketstamp-google-conversions.csv';
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSelected([]); setNotice('CSV prepared. This is not an upload or confirmation of Google acceptance. Keep the file private and delete it after the reviewed upload.');
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Export outcome is uncertain. Review delivery state before trying again.'); await load(); }
    finally { setBusy(false); }
  };
  const repair = async () => {
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/admin/google-conversions/repair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: crypto.randomUUID(), reason: 'Operator requested repair of missing conversion queue evidence', orderId: repairOrderId.trim() }) });
      const body = await response.json();
      if (!response.ok) throw new Error('Queue repair requires a verified live customer payment. No Google request was sent.');
      setNotice('Queue evidence checked. No Google request was sent.'); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Queue repair could not be confirmed.'); }
    finally { setBusy(false); }
  };
  return <section aria-labelledby="google-delivery-title" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 id="google-delivery-title" className="text-sm font-bold text-slate-900">Google purchase reporting</h3><p className="mt-1 text-xs text-slate-600">Verified purchases, eligible exports, processing acceptance and attribution are separate stages.</p></div>
      <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700">Refresh conversion status</button>
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : !status ? <p className="mt-3 text-sm text-slate-600">Loading conversion status…</p> : <>
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">{status.message}</p>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-700"><span>CSV export: <b>{status.exportEnabled ? 'Available' : 'Held'}</b></span><span>API delivery: <b>{status.apiEnabled ? 'Enabled' : 'Off'}</b></span><span>Environment: <b>{status.environment}</b></span></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs text-slate-700"><caption className="mb-2 text-left text-slate-500">{status.truncated ? 'Sample of 50 delivery records; this is not a complete conversion count.' : `${status.rows.length} delivery records. Test and staging payments are excluded.`}</caption>
        <thead><tr className="border-b border-slate-200"><th className="py-2 pr-3">Order</th><th className="py-2 pr-3">Delivery state</th><th className="py-2 pr-3">Attempts</th><th className="py-2 pr-3">Google evidence</th><th className="py-2">Reason</th></tr></thead>
        <tbody>{status.rows.map(row => <tr key={row.id} className="border-b border-slate-100"><td className="py-2 pr-3"><label className="inline-flex items-center gap-2"><input type="checkbox" aria-label={`Select conversion ${row.orderId}`} disabled={!status.exportEnabled || !row.orderId || row.kind !== 'google_offline_conversion' || busy} checked={selected.includes(row.orderId || '')} onChange={e => setSelected(prior => e.target.checked ? [...prior, row.orderId!] : prior.filter(id => id !== row.orderId))} /><span className="font-mono">{row.orderId?.slice(0, 18) || 'Unknown'}</span></label></td><td className="py-2 pr-3">{row.status?.replaceAll('_', ' ') || 'Unknown'}</td><td className="py-2 pr-3">{row.attempts}</td><td className="py-2 pr-3">{row.attributedAt ? 'Attributed' : row.processingAcceptedAt ? 'Processing accepted; attribution unconfirmed' : row.submittedAt ? 'Submitted; processing unconfirmed' : 'Not submitted'}</td><td className="py-2">{row.diagnosticCodes.map(code => code.replaceAll('_', ' ').toLowerCase()).join('; ') || '—'}</td></tr>)}</tbody>
      </table></div>
      <button type="button" disabled={busy || !status.exportEnabled || !selected.length} onClick={() => void exportCsv()} className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? 'Preparing CSV…' : 'Download eligible conversions CSV'}</button>
    </>}
    {status?.environment === 'production' && <details className="mt-4 text-xs"><summary>Repair missing queue evidence</summary><p className="my-2 text-slate-600">Uses an existing verified payment. This does not send data to Google.</p><label>Order ID<input className="ml-2 rounded border p-2" value={repairOrderId} onChange={e => setRepairOrderId(e.target.value)} /></label><button className="ml-2 rounded border px-3 py-2 disabled:opacity-40" disabled={busy || !/^[A-Za-z0-9_-]{1,128}$/.test(repairOrderId.trim())} onClick={() => void repair()}>Check queue evidence</button></details>}
    {notice && <p role="status" className="mt-3 text-xs text-slate-700">{notice}</p>}
  </section>;
}
