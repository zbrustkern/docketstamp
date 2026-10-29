"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportScope } from '@/lib/admin-console/reporting/compute';

type Metric = { value: number | null; unit: string; currency?: string; evidenceClass: string; completeness: string; watermark: string | null; numerator?: number | null; denominator?: number | null };
type JourneyStage = { name: string; observedSessions: number };
type ExceptionRow = { orderId: string; reason: string; priority: number; ageSeconds: number; evidenceRef: string };
type ChannelRow = { key: string; sessions: number; convertingSessions: number; paidOrders: number; netCollectionsMinor: number | null; spendMinor: number | null; contributionMinor: number | null; joinCoverage: number | null };
type EvidenceRow = Record<string, unknown>;
type TimelineEvidenceRow = EvidenceRow & {
  kind: string; at: unknown; id?: unknown; eventId?: unknown; eventName?: unknown;
  state?: unknown; amountMinor?: unknown; currency?: unknown; classification?: unknown;
  verification?: unknown; lobMode?: unknown; sessionId?: unknown;
};
type Report = {
  generationId: string;
  asOf: string;
  scope: { environment?: string; displayTimezone: string; startUtc: string; endUtcExclusive: string; classification?: string };
  watermark: string | null;
  sourceComplete: boolean;
  metrics: Record<string, Metric>;
  journey?: JourneyStage[];
  exceptions?: ExceptionRow[];
  channels?: ChannelRow[];
  postalStages?: { lobAccepted: number; mailed: number; inTransit: number; delivered: number; returned: number };
  quality?: {
    immatureSessions?: number;
    costCoverage?: number | null;
    spendCoverage?: number | null;
    classificationUnresolved?: number;
    unmatchedCaptures?: number;
    missingPrerequisites?: number;
    eligibleSessions?: number;
    excludedByClassification?: Record<string, { paidOrders: number; sessions: number }>;
    flags?: string[];
  };
};
type Range = "today" | "yesterday" | "7d" | "30d" | "custom";
type Classification = "customer" | "founder" | "employee" | "automated_test" | "unresolved";
type View = "overview" | "reconciliation";
type Evidence = { events: EvidenceRow[]; money: EvidenceRow[]; postal: EvidenceRow[]; exceptions: EvidenceRow[] };

const TIMEZONE = "America/Chicago";
const CLASSIFICATIONS: Array<{ value: Classification; label: string }> = [
  { value: "customer", label: "Customers" },
  { value: "founder", label: "Founder QA" },
  { value: "employee", label: "Employee QA" },
  { value: "automated_test", label: "Automated tests" },
  { value: "unresolved", label: "Unknown" },
];
const JOURNEY_STAGES = [
  ["entry_viewed", "Eligible visit"], ["workspace_viewed", "Workspace"],
  ["document_locked", "Document locked"], ["payment_form_ready", "Checkout ready"],
  ["payment_verified", "Verified paid"], ["fulfillment_accepted", "Lob accepted"],
] as const;

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
function shortId(value: unknown) {
  return typeof value === "string" ? value.slice(0, 14) : "Unknown";
}
function localTime(at: unknown, timezone = TIMEZONE) {
  if (typeof at !== "string" || !Number.isFinite(Date.parse(at))) return "Time unavailable";
  return new Date(at).toLocaleString(undefined, { timeZone: timezone });
}
function duration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
function friendlyFlag(flag: string) {
  const labels: Record<string, string> = {
    OBSERVED_BROWSER_COVERAGE_UNKNOWN: "Browser collection coverage is not independently measured",
    PROVIDER_RECONCILIATION_NOT_MEASURED: "Provider reconciliation coverage is not measured",
    LEGACY_RECORDS_NOT_BACKFILLED: "Older records are not backfilled",
    SOURCE_SCAN_PARTIAL: "Some source records could not be included",
    CHANNEL_ATTRIBUTION_INCOMPLETE: "Some paid orders do not have an acquisition join",
    IMMATURE_COHORT: "Some visits have not completed the 7 day conversion window",
    STALE_EVIDENCE: "Evidence has not refreshed recently",
    OPEN_OUTBOX_NOT_MEASURED: "Open fulfillment obligations could not be reconciled",
  };
  return labels[flag] || flag.replaceAll("_", " ").toLowerCase();
}

export function ExecutiveReportingPanel() {
  const [range, setRange] = useState<Range>("7d");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [channel, setChannel] = useState("");
  const [classification, setClassification] = useState<Classification>("customer");
  const [noticeId, setNoticeId] = useState("");
  const [tier, setTier] = useState("");
  const [entrySurface, setEntrySurface] = useState("");
  const [channelChoices, setChannelChoices] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<ReportScope | null>(null);
  const [loadedSelection, setLoadedSelection] = useState("");
  const [view, setView] = useState<View>("overview");
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [evidenceError, setEvidenceError] = useState("");
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const requestRevision = useRef(0);
  const selection = `${range}:${start}:${end}:${channel}:${classification}:${noticeId}:${tier}:${entrySurface}`;

  const load = useCallback(async () => {
    const revision = ++requestRevision.current;
    setReport(null); setScope(null); setEvidence(null); setEvidenceError("");
    if (range === "custom" && (!start || !end || end < start)) {
      setError("Choose a valid start and end date.");
      return;
    }
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ range, timezone: TIMEZONE, classification });
      if (channel) query.set("channel", channel);
      if (noticeId) query.set("noticeId", noticeId);
      if (tier) query.set("tier", tier);
      if (entrySurface) query.set("entrySurface", entrySurface);
      if (range === "custom") { query.set("start", start); query.set("end", end); }
      const response = await fetch(`/api/admin/console?${query}`, { cache: "no-store" });
      const body = await response.json();
      if (revision !== requestRevision.current) return;
      if (!response.ok) throw new Error(body.error || "Could not load the published report.");
      setReport(body.report || null); setScope(body.scope); setLoadedSelection(selection); setState(body.state || "not_measured");
      if (!channel && Array.isArray(body.report?.channels)) {
        setChannelChoices((prior) => [...new Set([...prior, ...body.report.channels.map((row: { key?: unknown }) => row.key).filter((key: unknown): key is string => typeof key === "string")])].sort());
      }
    } catch (cause) {
      if (revision === requestRevision.current) setError(cause instanceof Error ? cause.message : "Could not load the published report.");
    } finally { if (revision === requestRevision.current) setLoading(false); }
  }, [range, start, end, channel, classification, noticeId, tier, entrySurface, selection]);

  useEffect(() => { void load(); return () => { requestRevision.current += 1; }; }, [load]);

  const refreshReport = async () => {
    if (!scope || loading || loadedSelection !== selection) return;
    const revision = ++requestRevision.current;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/console", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rebuild", scope, requestId: crypto.randomUUID(), reason: "Refresh the selected operations report", dryRun: false, ...(report ? { expectedActive: report.generationId } : {}) }),
      });
      const body = await response.json();
      if (revision !== requestRevision.current) return;
      if (!response.ok) throw new Error(body.error || "Could not refresh the report.");
      await load();
    } catch (cause) {
      if (revision === requestRevision.current) setError(cause instanceof Error ? cause.message : "Could not refresh the report.");
    } finally { if (revision === requestRevision.current) setLoading(false); }
  };

  const loadEvidence = useCallback(async (generationId: string) => {
    setEvidenceLoading(true); setEvidenceError("");
    try {
      const kinds = ["events", "money", "postal", "exceptions"] as const;
      const responses = await Promise.all(kinds.map(kind => fetch(`/api/admin/console/evidence?generationId=${encodeURIComponent(generationId)}&kind=${kind}`, { cache: "no-store" })));
      const bodies = await Promise.all(responses.map(response => response.json()));
      const failed = responses.findIndex(response => !response.ok);
      if (failed >= 0) throw new Error(bodies[failed]?.error || "Private evidence is not available for this account.");
      const next = Object.fromEntries(kinds.map((kind, index) => [kind, Array.isArray(bodies[index]?.rows) ? bodies[index].rows : []])) as Evidence;
      setEvidence(next);
      const firstOrder = (next.exceptions[0]?.orderId || next.money.find(row => typeof row.orderId === "string")?.orderId || "") as string;
      setSelectedOrderId(current => current || firstOrder);
    } catch (cause) {
      setEvidenceError(cause instanceof Error ? cause.message : "Could not load reconciliation evidence.");
      setEvidence(null);
    } finally { setEvidenceLoading(false); }
  }, []);

  const openReconciliation = () => {
    setView("reconciliation");
    if (report && !evidence) void loadEvidence(report.generationId);
  };
  const local = (at: string) => localTime(at, report?.scope.displayTimezone || TIMEZONE);
  const metrics = report?.metrics || {};
  const journeyCount = (name: string) => report?.journey?.find(stage => stage.name === name)?.observedSessions || 0;
  const founderExclusion = report?.quality?.excludedByClassification?.founder;
  const exceptions = report?.exceptions || [];
  const evidenceOrderIds = evidence ? [...new Set([
    ...evidence.exceptions.map(row => row.orderId),
    ...evidence.money.map(row => row.orderId),
    ...evidence.postal.map(row => row.orderId),
  ].filter((value): value is string => typeof value === "string"))] : [];
  const orderTimeline: TimelineEvidenceRow[] = evidence && selectedOrderId ? ([
    ...evidence.events.filter(row => row.orderId === selectedOrderId).map(row => ({ ...row, kind: "event", at: row.occurredAt })),
    ...evidence.money.filter(row => row.orderId === selectedOrderId).map(row => ({ ...row, kind: "payment", at: row.effectiveAt })),
    ...evidence.postal.filter(row => row.orderId === selectedOrderId).map(row => ({ ...row, kind: "postal", at: row.occurredAt })),
  ].sort((a, b) => Date.parse(String(a.at || "")) - Date.parse(String(b.at || ""))) as TimelineEvidenceRow[]) : [];

  return <section aria-labelledby="executive-report-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f6f8fb] shadow-sm">
    <header className="border-b border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Decision dashboard · DocketStamp</p>
          <h2 id="executive-report-title" className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Experiment &amp; fulfillment</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Follow eligible visits through verified payment and postal outcomes. Each figure keeps its evidence level and missing joins visible.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Report view">
          <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === "overview" ? "bg-slate-950 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>Overview</button>
          <button type="button" aria-pressed={view === "reconciliation"} onClick={openReconciliation} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === "reconciliation" ? "bg-slate-950 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>Order reconciliation</button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-[11px] font-semibold text-slate-600">Period<select value={range} onChange={e => setRange(e.target.value as Range)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">{(["today", "yesterday", "7d", "30d", "custom"] as Range[]).map(value => <option key={value} value={value}>{value === "7d" ? "Last 7 days" : value === "30d" ? "Last 30 days" : value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
        <label className="text-[11px] font-semibold text-slate-600">Class<select value={classification} onChange={e => setClassification(e.target.value as Classification)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">{CLASSIFICATIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-[11px] font-semibold text-slate-600">Acquisition<select value={channel} onChange={e => setChannel(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="">All sources</option>{channelChoices.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-[11px] font-semibold text-slate-600">Notice ID<input value={noticeId} onChange={e => setNoticeId(e.target.value.trim())} placeholder="All notices" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 placeholder:text-slate-400" /></label>
        <label className="text-[11px] font-semibold text-slate-600">Mail tier<select value={tier} onChange={e => setTier(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="">All tiers</option><option value="first_class">First Class</option><option value="certified">Certified</option><option value="certified_return_receipt">Certified + return receipt</option></select></label>
      </div>
      {range === "custom" && <div className="mt-3 flex flex-wrap items-end gap-3"><label className="text-[11px] font-semibold text-slate-600">Start<input type="date" value={start} onChange={e => setStart(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white p-2 text-sm" /></label><label className="text-[11px] font-semibold text-slate-600">End<input type="date" value={end} onChange={e => setEnd(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white p-2 text-sm" /></label></div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="text-[11px] font-semibold text-slate-600">Entry surface<select value={entrySurface} onChange={e => setEntrySurface(e.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"><option value="">All surfaces</option><option value="home">Home</option><option value="notice_workspace">Notice page</option><option value="notice_directory">Notice directory</option><option value="company_directory">Company directory</option></select></label>
        <button type="button" onClick={() => void refreshReport()} disabled={loading || !scope || loadedSelection !== selection} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Refreshing…" : "Update report"}</button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    </header>

    {!error && !report && <div className="p-4 sm:p-6"><div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">{loading || state === "loading" ? "Loading published report…" : "No published report exists for these filters. Refresh an authorized projection to publish the selected evidence."}</div></div>}

    {report && view === "overview" && <div className="space-y-4 p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[["Eligible sessions", metrics.conversion?.denominator ?? report.quality?.eligibleSessions ?? null, "Observed entry joins"], ["Verified paid orders", metrics.paidOrders?.value, evidenceLabel(metrics.paidOrders)], ["Net collections", metrics.netCollections?.value, evidenceLabel(metrics.netCollections)], ["Paid mailings needing attention", metrics.urgent?.value, evidenceLabel(metrics.urgent)]] .map(([label, value, note]) => <article key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">{typeof value === "number" ? label === "Net collections" ? money(value) : new Intl.NumberFormat().format(value) : "Unavailable"}</p><p className="mt-1 text-[10px] text-slate-500">{String(note)}</p></article>)}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="journey-heading">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 id="journey-heading" className="text-sm font-bold text-slate-900">Customer journey</h3><p className="mt-1 text-xs text-slate-500">Unique sessions by observed milestone. Payment and fulfillment counts come from server/provider facts.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{CLASSIFICATIONS.find(item => item.value === classification)?.label}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {JOURNEY_STAGES.map(([name, label], index) => {
            const count = journeyCount(name);
            const previous = index === 0 ? Math.max(1, journeyCount("entry_viewed")) : journeyCount(JOURNEY_STAGES[index - 1][0]);
            const width = Math.min(100, previous ? count / previous * 100 : 0);
            return <article key={name} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="truncate text-[10px] font-semibold text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{count}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-700" style={{ width: `${width}%` }} /></div><p className="mt-1 text-[9px] text-slate-500">{index === 0 ? "entry cohort" : `${width.toFixed(0)}% of prior stage`}</p></article>;
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="fulfillment-heading">
        <div className="flex items-start justify-between gap-3"><div><h3 id="fulfillment-heading" className="text-sm font-bold text-slate-900">Fulfillment state</h3><p className="mt-1 text-xs text-slate-500">Lob acceptance, USPS mailing and delivery are separate evidence.</p></div><button type="button" onClick={openReconciliation} className="shrink-0 text-xs font-semibold text-teal-800 underline underline-offset-2">Reconcile orders</button></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{[["Accepted by Lob", report.postalStages?.lobAccepted], ["Mailed", report.postalStages?.mailed], ["In transit", report.postalStages?.inTransit], ["Delivered", report.postalStages?.delivered], ["Returned", report.postalStages?.returned]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-medium text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{typeof value === "number" ? value : "Unavailable"}</p></div>)}</div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="exceptions-heading">
          <div className="flex items-center justify-between gap-2"><div><h3 id="exceptions-heading" className="text-sm font-bold text-slate-900">Paid, not yet accepted</h3><p className="mt-1 text-xs text-slate-500">Uncertain submissions stay visible for reconciliation.</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${exceptions.length ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{exceptions.length ? `${exceptions.length} open` : "No open items"}</span></div>
          {exceptions.length ? <ul className="mt-3 divide-y divide-slate-100">{exceptions.slice(0, 6).map(item => <li key={`${item.orderId}:${item.evidenceRef}`} className="flex items-center justify-between gap-3 py-2"><div className="min-w-0"><p className="truncate font-mono text-[11px] font-semibold text-slate-800">{shortId(item.orderId)}</p><p className="mt-0.5 text-[10px] text-amber-800">{item.reason === "SUBMISSION_UNCERTAIN" ? "Provider result needs review" : "No Lob acceptance recorded"} · {duration(item.ageSeconds)}</p></div><button type="button" onClick={openReconciliation} className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-700">Inspect</button></li>)}</ul> : <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">No paid fulfillment exceptions in this report.</p>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="economics-heading">
          <div><h3 id="economics-heading" className="text-sm font-bold text-slate-900">Cost and acquisition coverage</h3><p className="mt-1 text-xs text-slate-500">Profit stays unavailable until actual costs and campaign spend cover the cohort.</p></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] text-slate-500">Actual order-cost coverage</p><p className="mt-1 text-base font-bold text-slate-900">{report.quality?.costCoverage === null || report.quality?.costCoverage === undefined ? "Unavailable" : `${Math.round(report.quality.costCoverage * 100)}%`}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] text-slate-500">Acquisition spend coverage</p><p className="mt-1 text-base font-bold text-slate-900">{report.quality?.spendCoverage === null || report.quality?.spendCoverage === undefined ? "Unavailable" : `${Math.round(report.quality.spendCoverage * 100)}%`}</p></div></div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs"><span className="text-slate-500">Before acquisition <b className="ml-1 text-slate-900">{display(metrics.contributionBeforeAcquisition)}</b></span><span className="text-slate-500">After acquisition <b className="ml-1 text-slate-900">{display(metrics.contributionAfterAcquisition)}</b></span></div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="sources-heading">
        <div><h3 id="sources-heading" className="text-sm font-bold text-slate-900">Acquisition sources</h3><p className="mt-1 text-xs text-slate-500">The original eligible entry determines the channel; unknown attribution stays in its own row.</p></div>
        {report.channels?.length ? <>
          <div className="mt-3 space-y-2 sm:hidden">
            {report.channels.map(row => <article key={row.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h4 className="break-words text-xs font-semibold text-slate-900">{row.key === "unknown" ? <span className="text-amber-800">Unknown attribution</span> : row.key}</h4>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
                <div><dt className="text-slate-500">Sessions</dt><dd className="mt-0.5 font-semibold text-slate-900">{row.sessions}</dd></div>
                <div><dt className="text-slate-500">Paid orders</dt><dd className="mt-0.5 font-semibold text-slate-900">{row.paidOrders}</dd></div>
                <div><dt className="text-slate-500">Collections</dt><dd className="mt-0.5 font-semibold text-slate-900">{money(row.netCollectionsMinor)}</dd></div>
                <div><dt className="text-slate-500">Spend</dt><dd className="mt-0.5 font-semibold text-slate-900">{money(row.spendMinor)}</dd></div>
                <div><dt className="text-slate-500">Join coverage</dt><dd className="mt-0.5 font-semibold text-slate-900">{row.joinCoverage === null ? "Unavailable" : `${Math.round(row.joinCoverage * 100)}%`}</dd></div>
              </dl>
            </article>)}
          </div>
          <div className="mt-3 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] text-left text-xs"><thead className="text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="pb-2 font-semibold">Source / campaign</th><th className="pb-2 font-semibold">Sessions</th><th className="pb-2 font-semibold">Paid orders</th><th className="pb-2 font-semibold">Collections</th><th className="pb-2 font-semibold">Spend</th><th className="pb-2 font-semibold">Join</th></tr></thead><tbody className="divide-y divide-slate-100">{report.channels.map(row => <tr key={row.key}><td className="py-2 pr-3 font-medium text-slate-800">{row.key === "unknown" ? <span className="text-amber-800">Unknown attribution</span> : row.key}</td><td className="py-2">{row.sessions}</td><td className="py-2">{row.paidOrders}</td><td className="py-2">{money(row.netCollectionsMinor)}</td><td className="py-2">{money(row.spendMinor)}</td><td className="py-2">{row.joinCoverage === null ? "Unavailable" : `${Math.round(row.joinCoverage * 100)}%`}</td></tr>)}</tbody></table>
          </div>
        </> : <p className="mt-3 py-4 text-xs text-slate-500">No eligible sessions in this scope.</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="health-heading">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 id="health-heading" className="text-sm font-bold text-slate-900">Evidence health</h3><p className="mt-1 text-xs text-slate-500">{report.sourceComplete ? "All queried sources completed within scope." : "The report is partial; investigate the missing source or join before deciding."}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${report.sourceComplete ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{report.sourceComplete ? "Complete scan" : "Partial scan"}</span></div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-500"><span>Environment: {report.scope.environment || "Unknown"}</span><span>Watermark: {report.watermark ? local(report.watermark) : "Unavailable"}</span><span>Generated: {local(report.asOf)}</span><span>Unresolved captures: {report.quality?.classificationUnresolved ?? 0}</span><span>Unmatched captures: {report.quality?.unmatchedCaptures ?? 0}</span><span>Missing stage prerequisites: {report.quality?.missingPrerequisites ?? 0}</span></div>
        {classification === "customer" && founderExclusion && (founderExclusion.paidOrders || founderExclusion.sessions) > 0 && <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-950">Founder QA excluded from customer totals: {founderExclusion.sessions} session{founderExclusion.sessions === 1 ? "" : "s"} and {founderExclusion.paidOrders} paid order{founderExclusion.paidOrders === 1 ? "" : "s"}.</p>}
        {!!report.quality?.flags?.length && <ul className="mt-3 grid grid-cols-1 gap-1 text-[10px] text-amber-900 sm:grid-cols-2">{report.quality.flags.map(flag => <li key={flag} className="rounded-md bg-amber-50 px-2.5 py-2">{friendlyFlag(flag)}</li>)}</ul>}
        <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] text-slate-500">Private evidence contains identifiers and status only. Letter text, addresses and payment secrets are excluded.</p>
      </section>
      <footer className="text-[10px] text-slate-500">Range: {local(report.scope.startUtc)} – {local(report.scope.endUtcExclusive)} ({report.scope.displayTimezone}) · 7 day conversion horizon · Collections are payment evidence, not accounting revenue.</footer>
    </div>}

    {report && view === "reconciliation" && <div className="space-y-4 p-4 sm:p-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="recon-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Private evidence view</p><h3 id="recon-heading" className="mt-1 text-lg font-bold text-slate-950">Order reconciliation</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">Follow one pseudonymous order across event milestones, Stripe facts and postal state. Provider acceptance never implies USPS mailing or delivery.</p></div><button type="button" onClick={() => void loadEvidence(report.generationId)} disabled={evidenceLoading} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{evidenceLoading ? "Loading evidence…" : "Reload evidence"}</button></div>
        {evidenceError && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{evidenceError}</p>}
        {evidenceLoading && <p className="mt-4 text-xs text-slate-500">Reading the selected report’s private evidence partitions…</p>}
        {evidence && <>
          <label className="mt-4 block text-[11px] font-semibold text-slate-600">Order reference<select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900">{evidenceOrderIds.length ? evidenceOrderIds.map(id => <option key={id} value={id}>{shortId(id)}</option>) : <option value="">No linked orders</option>}</select></label>
          {selectedOrderId && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap justify-between gap-2"><span className="font-mono text-[11px] font-bold text-slate-800">{shortId(selectedOrderId)}</span><span className="text-[10px] text-slate-500">Reference values only · no document content or postal address</span></div>
            {orderTimeline.length ? <ol className="mt-3 space-y-2">{orderTimeline.map((row, index) => <li key={`${String(row.id || row.eventId || index)}:${String(row.kind)}`} className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-700" /><div className="min-w-0 flex-1 border-b border-slate-200 pb-2"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-semibold capitalize text-slate-800">{String(row.eventName || row.state || row.kind).replaceAll("_", " ").replaceAll(".", " ")}</span><time className="text-[10px] text-slate-500">{localTime(row.at, report.scope.displayTimezone)}</time></div><p className="mt-1 text-[10px] text-slate-500">{row.kind === "payment" ? `${String(row.kind)} · ${money(typeof row.amountMinor === "number" ? row.amountMinor : null, typeof row.currency === "string" ? row.currency : "USD")} · ${String(row.classification || row.verification || "evidence")}` : row.kind === "postal" ? `${String(row.lobMode || "mode unknown")} · provider status evidence` : `Session ${shortId(row.sessionId)} · observed milestone`}</p></div></li>)}</ol> : <p className="mt-3 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">No linked event, payment or postal facts are available for this order in the selected report.</p>}
          </div>}
        </>}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="open-items-heading">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 id="open-items-heading" className="text-sm font-bold text-slate-900">Open fulfillment exceptions</h3><p className="mt-1 text-xs text-slate-500">Uncertain Lob outcomes require reconciliation before any resend.</p></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">{exceptions.length} open</span></div>
        {exceptions.length ? <ul className="mt-3 divide-y divide-slate-100">{exceptions.map(item => <li key={`${item.orderId}:${item.evidenceRef}`} className="flex flex-wrap items-center justify-between gap-2 py-2"><button type="button" onClick={() => setSelectedOrderId(item.orderId)} className="font-mono text-xs font-semibold text-slate-800 underline underline-offset-2">{shortId(item.orderId)}</button><span className="text-xs text-amber-800">{item.reason === "SUBMISSION_UNCERTAIN" ? "Submission outcome uncertain" : "Payment verified; Lob acceptance missing"} · {duration(item.ageSeconds)}</span><span className="font-mono text-[10px] text-slate-500">fact {shortId(item.evidenceRef)}</span></li>)}</ul> : <p className="mt-3 text-xs text-slate-600">No open paid fulfillment exception is included in this report.</p>}
      </section>
      <footer className="text-[10px] text-slate-500">Report generation {shortId(report.generationId)} · watermark {report.watermark ? local(report.watermark) : "unavailable"} · evidence is redacted and read-only.</footer>
    </div>}
  </section>;
}
