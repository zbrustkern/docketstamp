"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReportScope } from '@/lib/admin-console/reporting/compute';

type Metric = { value: number | null; unit: string; currency?: string; evidenceClass: string; completeness: string; watermark: string | null; numerator?: number | null; denominator?: number | null };
type Report = { generationId: string; asOf: string; scope: { environment?: string; displayTimezone: string; startUtc: string; endUtcExclusive: string }; watermark: string | null; metrics: Record<string, Metric>; quality?: { immatureSessions?: number; costCoverage?: number | null; spendCoverage?: number | null; flags?: string[] } };
type Range = "today" | "yesterday" | "7d" | "30d" | "custom";

function money(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined) return "Unavailable";
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value / 100);
}
function display(metric: Metric | undefined) {
  if (!metric || metric.value === null) return "Unavailable";
  if (metric.unit === "money_minor") return money(metric.value, metric.currency || "USD");
  if (metric.unit === "ratio") return `${(metric.value * 100).toFixed(1)}%`;
  return new Intl.NumberFormat().format(metric.value);
}
function evidenceLabel(metric?: Metric) {
  if (!metric) return "Not measured";
  const kind = metric.evidenceClass === "verified" ? "Verified" : metric.evidenceClass === "observed" ? "Observed" : metric.evidenceClass === "estimated" ? "Estimated" : "Unavailable";
  const freshness = metric.completeness === "stale" ? " · stale" : metric.completeness === "partial" ? " · partial" : "";
  return `${kind}${freshness}`;
}

export function ExecutiveReportingPanel() {
  const [range, setRange] = useState<Range>("7d");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [channel, setChannel] = useState("");
  const [channelChoices, setChannelChoices] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<ReportScope | null>(null);
  const [loadedSelection, setLoadedSelection] = useState('');
  const requestRevision = useRef(0);
  const selection = `${range}:${start}:${end}:${channel}`;
  const timezone = "America/Chicago";

  const load = useCallback(async () => {
    const revision = ++requestRevision.current;
    setReport(null); setScope(null);
    if (range === "custom" && (!start || !end || end < start)) {
      setError("Choose a valid start and end date.");
      return;
    }
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ range, timezone });
      if (channel) query.set("channel", channel);
      if (range === "custom") { query.set("start", start); query.set("end", end); }
      const response = await fetch(`/api/admin/console?${query}`, { cache: "no-store" });
      const body = await response.json();
      if (revision !== requestRevision.current) return;
      if (!response.ok) throw new Error(body.error || "Could not load the published report.");
      setReport(body.report || null); setScope(body.scope); setLoadedSelection(`${range}:${start}:${end}:${channel}`); setState(body.state || "not_measured");
      if (!channel && Array.isArray(body.report?.channels)) {
        setChannelChoices((prior) => [...new Set([...prior, ...body.report.channels.map((row: { key?: unknown }) => row.key).filter((key: unknown): key is string => typeof key === "string")])].sort());
      }
    } catch (cause) {
      if (revision === requestRevision.current) setError(cause instanceof Error ? cause.message : "Could not load the published report.");
    } finally { if (revision === requestRevision.current) setLoading(false); }
  }, [range, start, end, channel]);

  useEffect(() => { void load(); return () => { requestRevision.current += 1; }; }, [load]);
  const refreshReport = async () => {
    if (!scope || loading || loadedSelection !== selection) return;
    const revision = ++requestRevision.current;
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/console', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rebuild', scope, requestId: crypto.randomUUID(), reason: 'Refresh the selected operations report', dryRun: false, ...(report ? { expectedActive: report.generationId } : {}) }),
      });
      const body = await response.json();
      if (revision !== requestRevision.current) return;
      if (!response.ok) throw new Error(body.error || 'Could not refresh the report.');
      await load();
    } catch (cause) {
      if (revision === requestRevision.current) setError(cause instanceof Error ? cause.message : 'Could not refresh the report.');
    } finally { if (revision === requestRevision.current) setLoading(false); }
  };
  const localTime = (at: string) => new Date(at).toLocaleString(undefined, { timeZone: report?.scope.displayTimezone || timezone });
  const metrics = report?.metrics || {};
  const cards = useMemo(() => [
    ["Verified paid orders", "paidOrders"], ["Net collections", "netCollections"],
    ["Paid session conversion", "conversion"], ["Open paid mailings", "urgent"],
    ["Contribution before acquisition", "contributionBeforeAcquisition"],
    ["Acquisition spend", "acquisitionSpend"], ["Contribution after acquisition", "contributionAfterAcquisition"],
    ["Lob accepted", "accepted"],
  ] as const, []);

  return <section aria-labelledby="executive-report-title" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4 shadow-sm">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 id="executive-report-title" className="text-lg font-bold text-slate-900">Verified operations and contribution</h2>
        <p className="mt-1 text-xs text-slate-600">Published evidence only · calendar ranges use {timezone} · conversion cohort has a 7-day horizon.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Report date range">
        {(["today", "yesterday", "7d", "30d", "custom"] as const).map(value => <button key={value} onClick={() => setRange(value)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${range === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
          {value === "7d" ? "7 days" : value === "30d" ? "30 days" : value[0].toUpperCase() + value.slice(1)}
        </button>)}
      </div>
    </div>
    <button type="button" onClick={() => void refreshReport()} disabled={loading || !scope || loadedSelection !== selection} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
      {loading ? 'Loading report…' : 'Update report'}
    </button>
    {range === "custom" && <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs font-medium text-slate-700">Start date<input type="date" value={start} onChange={e => setStart(e.target.value)} className="mt-1 block rounded-md border border-slate-300 p-2" /></label>
      <label className="text-xs font-medium text-slate-700">End date<input type="date" value={end} onChange={e => setEnd(e.target.value)} className="mt-1 block rounded-md border border-slate-300 p-2" /></label>
      <button onClick={() => void load()} className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white" disabled={loading}>Apply range</button>
    </div>}
    <label className="text-xs font-medium text-slate-700">Acquisition channel
      <select value={channel} onChange={e => setChannel(e.target.value)} className="ml-2 rounded-md border border-slate-300 p-2">
        <option value="">All channels</option>
        {channelChoices.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {!error && !report && <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
      {loading || state === "loading" ? "Loading published report…" : "No published report exists for this range. An authorized projection-only rebuild is required before figures appear."}
    </div>}
    {report && <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, key]) => <article key={key} className="rounded-xl border border-slate-200 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{display(metrics[key])}</p>
          <p className="mt-1 text-[11px] text-slate-500">{evidenceLabel(metrics[key])}</p>
        </article>)}
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span>Environment: {report.scope.environment || "unknown"} · Range: {localTime(report.scope.startUtc)} – {localTime(report.scope.endUtcExclusive)} ({report.scope.displayTimezone})</span>
        <span>Source watermark: {report.watermark ? localTime(report.watermark) : "unavailable"} · Generated: {localTime(report.asOf)}</span>
      </div>
      {!!report.quality?.flags?.length && <p className="text-[11px] text-amber-800">Evidence notes: {report.quality.flags.join(", ")}</p>}
      <p className="text-[11px] text-slate-500">Collections are payment evidence, not accounting revenue. Contributions remain unavailable until complete cost and spend evidence is published.</p>
    </>}
  </section>;
}
