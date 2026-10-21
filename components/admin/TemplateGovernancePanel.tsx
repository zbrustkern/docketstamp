"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { US_STATE_CODES } from "@/src/lib/docket/template-policy";
import type {
  AdminTemplateCatalogEntry,
  AdminTemplatesResponse,
  GeoRule,
  GlobalTemplatePolicy,
  ReviewStatus,
  TemplateSettings,
  TemplateSource,
} from "@/src/lib/docket/template-policy";

type DraftReview = { status: ReviewStatus; reviewer: string; reviewBy: string; evidenceUrl: string; notes: string };
type MutationBody = Record<string, unknown>;
type PendingMutation = { body: MutationBody; requestId: string };

const card = "rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm";
const input = "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-stone-100";
const button = "inline-flex min-h-10 items-center justify-center rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton = "inline-flex min-h-10 items-center justify-center rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseStates(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map((state) => state.trim().toUpperCase()).filter(Boolean))];
}

function invalidStateTokens(value: string): string[] {
  const allowed = new Set<string>(US_STATE_CODES);
  return [...new Set(value.split(/[\s,]+/).map((state) => state.trim().toUpperCase()).filter((state) => state && !allowed.has(state)))];
}

function describeGeoRule(rule: GeoRule): string {
  if (rule.mode === "all") return "all jurisdictions";
  const states = rule.states.length ? rule.states.join(", ") : "none";
  return rule.mode === "allowlist" ? `only ${states}` : `all except ${states}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function safeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function effectiveLabel(entry: AdminTemplateCatalogEntry, global: GlobalTemplatePolicy, revision: number): { label: string; tone: string } {
  if (!global.enabled) return { label: "Global hold", tone: "bg-rose-100 text-rose-800" };
  if (!entry.policy.enabled) return { label: "Paused", tone: "bg-rose-100 text-rose-800" };
  if (entry.policy.review.status === "hold") return { label: "Review hold", tone: "bg-rose-100 text-rose-800" };
  if ((global.requireCurrentReview || entry.policy.requireCurrentReview) && !entry.reviewCurrent) {
    return { label: "Review required", tone: "bg-amber-100 text-amber-900" };
  }
  if (!entry.availability.available) return { label: entry.availability.reason || "Restricted", tone: "bg-amber-100 text-amber-900" };
  if (entry.policy.review.status === "in_review") return { label: "In review", tone: "bg-amber-100 text-amber-900" };
  if (entry.policy.review.status === "unreviewed") return revision === 0
    ? { label: "Legacy default · unreviewed", tone: "bg-stone-100 text-stone-700" }
    : { label: "Unreviewed · policy active", tone: "bg-amber-100 text-amber-900" };
  if (!entry.reviewCurrent) return { label: "Review stale · policy active", tone: "bg-amber-100 text-amber-900" };
  return { label: "Available under current policy", tone: "bg-emerald-100 text-emerald-800" };
}

function GeoRuleEditor({ title, idPrefix, validationKey, description, rule, onChange, onValidityChange, disabled }: {
  idPrefix: string;
  validationKey: string;
  title: string; description: string; rule: GeoRule; onChange: (next: GeoRule) => void; disabled: boolean;
  onValidityChange: (key: string, invalid: boolean) => void;
}) {
  const id = `${idPrefix}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-mode`;
  const statesValue = rule.states.join(", ");
  const [rawStates, setRawStates] = useState(statesValue);
  const invalidStates = rule.mode === "all" ? [] : invalidStateTokens(rawStates);
  useEffect(() => { setRawStates(statesValue); }, [statesValue]);
  useEffect(() => { onValidityChange(validationKey, invalidStates.length > 0); }, [validationKey, invalidStates.length, onValidityChange]);
  return (
    <fieldset className="rounded-xl border border-stone-200 p-3 sm:p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-semibold text-stone-900">{title}</legend>
      <p className="text-xs leading-5 text-stone-600">{description}</p>
      <label htmlFor={id} className="mt-3 block text-xs font-semibold text-stone-700">Rule</label>
      <select id={id} className={input} value={rule.mode} onChange={(event) => {
        const mode = event.target.value as GeoRule["mode"];
        if (mode === "all") {
          setRawStates("");
          onValidityChange(validationKey, false);
          onChange({ mode, states: [] });
        } else onChange({ ...rule, mode });
      }}>
        <option value="all">All jurisdictions</option>
        <option value="allowlist">Only listed jurisdictions</option>
        <option value="blocklist">All except listed jurisdictions</option>
      </select>
      <label htmlFor={`${id}-states`} className="mt-3 block text-xs font-semibold text-stone-700">State codes</label>
      <textarea
        id={`${id}-states`}
        className={`${input} min-h-20 resize-y font-mono text-xs`}
        value={rawStates}
        disabled={disabled || rule.mode === "all"}
        onChange={(event) => setRawStates(event.target.value)}
        onBlur={() => { if (invalidStates.length === 0) onChange({ ...rule, states: parseStates(rawStates) }); }}
        placeholder="CA, NC, DC"
        aria-invalid={invalidStates.length > 0}
        aria-describedby={`${id}-help${invalidStates.length ? ` ${id}-error` : ""}`}
      />
      <p id={`${id}-help`} className="mt-1 text-[11px] leading-4 text-stone-500">
        Enter USPS state codes and DC. An empty allowlist blocks every jurisdiction; “All jurisdictions” ignores this list.
      </p>
      {invalidStates.length > 0 && <p id={`${id}-error`} className="text-xs font-medium text-rose-800" role="alert">Unknown state code{invalidStates.length > 1 ? "s" : ""}: {invalidStates.join(", ")}. Use a two-letter state code or DC.</p>}
    </fieldset>
  );
}

function SourceEditor({ sources, disabled, onChange }: { sources: TemplateSource[]; disabled: boolean; onChange: (sources: TemplateSource[]) => void }) {
  const update = (index: number, patch: Partial<TemplateSource>) => onChange(sources.map((source, i) => i === index ? { ...source, ...patch } : source));
  return (
    <section className="space-y-3" aria-labelledby="template-sources-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="template-sources-heading" className="text-sm font-semibold text-stone-900">Source records</h3>
          <p className="text-xs text-stone-600">Source type describes provenance; it does not make this letter an official government form.</p>
        </div>
        <button type="button" className={button} disabled={disabled} onClick={() => onChange([...sources, { kind: "original", title: "Original content", url: "", jurisdiction: "", retrievedAt: new Date().toISOString().slice(0, 10), reuseStatus: "unverified", notes: "" }])}>Add source</button>
      </div>
      {sources.length === 0 && <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">No source record added. Existing content is not automatically classified as an official template.</p>}
      {sources.map((source, index) => (
        <fieldset key={`${index}-${source.kind}`} className="grid gap-3 rounded-xl border border-stone-200 p-3 sm:grid-cols-2" disabled={disabled}>
          <legend className="px-1 text-xs font-semibold text-stone-600">Source {index + 1}</legend>
          <label className="text-xs font-semibold text-stone-700">Source kind
            <select className={input} value={source.kind} onChange={(event) => update(index, { kind: event.target.value as TemplateSource["kind"] })}>
              <option value="original">Original content</option><option value="official_guidance">Official guidance</option><option value="official_sample">Official sample</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-stone-700">Title<input className={input} maxLength={160} value={source.title} onChange={(event) => update(index, { title: event.target.value })} /></label>
          <label className="text-xs font-semibold text-stone-700 sm:col-span-2">Source URL<input className={input} type="url" maxLength={1000} value={source.url} onChange={(event) => update(index, { url: event.target.value })} placeholder={source.kind === "original" ? "Optional for original content" : "https://…"} /></label>
          {safeHttpUrl(source.url) && <p className="-mt-2 break-all text-xs sm:col-span-2"><a className="text-sky-800 underline" href={safeHttpUrl(source.url) || undefined} target="_blank" rel="noreferrer">Open source: {source.title || source.url}</a></p>}
          <label className="text-xs font-semibold text-stone-700">Jurisdiction<input className={input} maxLength={100} value={source.jurisdiction} onChange={(event) => update(index, { jurisdiction: event.target.value })} placeholder="Federal, CA, etc." /></label>
          <label className="text-xs font-semibold text-stone-700">Retrieved date<input className={input} type="date" value={source.retrievedAt.slice(0, 10)} onChange={(event) => update(index, { retrievedAt: event.target.value })} /></label>
          <label className="text-xs font-semibold text-stone-700">Reproduction status
            <select className={input} value={source.reuseStatus} onChange={(event) => update(index, { reuseStatus: event.target.value as TemplateSource["reuseStatus"] })}>
              <option value="unverified">Unverified</option><option value="permitted">Permitted</option><option value="restricted">Restricted</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-stone-700 sm:col-span-2">Notes<textarea className={`${input} min-h-16`} maxLength={1000} value={source.notes} onChange={(event) => update(index, { notes: event.target.value })} /></label>
          <div className="sm:col-span-2"><button type="button" className="text-xs font-semibold text-rose-700 underline" disabled={disabled} onClick={() => onChange(sources.filter((_, i) => i !== index))}>Remove source record</button></div>
        </fieldset>
      ))}
    </section>
  );
}

export function TemplateGovernancePanel() {
  const [data, setData] = useState<AdminTemplatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [policyFresh, setPolicyFresh] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [globalDraft, setGlobalDraft] = useState<GlobalTemplatePolicy | null>(null);
  const [templateDraft, setTemplateDraft] = useState<TemplateSettings | null>(null);
  const [reviewDraft, setReviewDraft] = useState<DraftReview | null>(null);
  const [recordReview, setRecordReview] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<PendingMutation | null>(null);
  const [invalidGeoRules, setInvalidGeoRules] = useState<Record<string, boolean>>({});
  const [editorResetEpoch, setEditorResetEpoch] = useState(0);

  const updateGeoValidity = useCallback((key: string, invalid: boolean) => {
    setInvalidGeoRules((current) => current[key] === invalid ? current : { ...current, [key]: invalid });
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setPolicyFresh(false);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/console/templates", { cache: "no-store" });
      const payload = await response.json() as AdminTemplatesResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || `Could not load template policy (${response.status}).`);
      setData(payload);
      setPolicyFresh(true);
      setEditorResetEpoch((epoch) => epoch + 1);
      setPending(null);
      setInvalidGeoRules({});
      setGlobalDraft(clone(payload.policy.global));
      setSelectedSlug((current) => payload.templates.some((item) => item.slug === current) ? current : payload.templates[0]?.slug || "");
      setTemplateDraft((current) => {
        const first = payload.templates[0];
        return first ? clone({ enabled: first.policy.enabled, requireCurrentReview: first.policy.requireCurrentReview, residence: first.policy.residence, property: first.policy.property, sources: first.policy.sources }) : current;
      });
      setReviewDraft(null);
      setRecordReview(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Template policy is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]); // stable initial load; explicit refresh handles newer revisions

  const selected = data?.templates.find((entry) => entry.slug === selectedSlug) || null;
  const canWrite = Boolean(data?.canManage && policyFresh);
  const visibleTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.templates || [];
    return (data?.templates || []).filter((entry) => [entry.title, entry.slug, entry.category].some((value) => value.toLowerCase().includes(needle)));
  }, [data, query]);

  useEffect(() => {
    if (!selected) { setTemplateDraft(null); setReviewDraft(null); return; }
    setTemplateDraft(clone({ enabled: selected.policy.enabled, requireCurrentReview: selected.policy.requireCurrentReview, residence: selected.policy.residence, property: selected.policy.property, sources: selected.policy.sources }));
    setReviewDraft({ status: selected.policy.review.status, reviewer: selected.policy.review.reviewer, reviewBy: selected.policy.review.reviewBy?.slice(0, 10) || "", evidenceUrl: selected.policy.review.evidenceUrl, notes: selected.policy.review.notes });
    setRecordReview(false);
    // Keep a conflict/permission result visible when its reload replaces data.
    setPending(null);
    setEditorResetEpoch((epoch) => epoch + 1);
  }, [selectedSlug, data]);

  const discardDrafts = () => {
    if (!data) return;
    setGlobalDraft(clone(data.policy.global));
    if (selected) {
      setTemplateDraft(clone({ enabled: selected.policy.enabled, requireCurrentReview: selected.policy.requireCurrentReview, residence: selected.policy.residence, property: selected.policy.property, sources: selected.policy.sources }));
      setReviewDraft({ status: selected.policy.review.status, reviewer: selected.policy.review.reviewer, reviewBy: selected.policy.review.reviewBy?.slice(0, 10) || "", evidenceUrl: selected.policy.review.evidenceUrl, notes: selected.policy.review.notes });
    }
    setRecordReview(false);
    setReason("");
    setSaveError("");
    setPending(null);
    setEditorResetEpoch((epoch) => epoch + 1);
  };

  const submit = async (bodyWithoutRequestId: MutationBody, confirmation: string) => {
    if (!data || !data.canManage) return;
    if (!policyFresh) { setSaveError("Reload the current policy successfully before saving."); return; }
    if (reason.trim().length < 8) { setSaveError("Enter a reason of at least 8 characters before saving."); return; }
    if (pending && JSON.stringify({ ...pending.body, requestId: undefined }) !== JSON.stringify(bodyWithoutRequestId)) {
      setSaveError("A previous save has an uncertain result. Retry that exact save or reload current policy before changing it.");
      return;
    }
    const requestId = crypto.randomUUID();
    const next = pending?.body && JSON.stringify({ ...pending.body, requestId: undefined }) === JSON.stringify(bodyWithoutRequestId)
      ? pending
      : { body: { ...bodyWithoutRequestId, requestId }, requestId };
    // Keep body.requestId identical to the idempotency key across an uncertain retry.
    next.body.requestId = next.requestId;
    if (!window.confirm(confirmation)) return;
    setPending(next);
    setSaving(true);
    setSaveError("");
    setSaveNotice("");
    try {
      const response = await fetch("/api/admin/console/templates", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next.body), cache: "no-store",
      });
      const result = await response.json() as { success?: boolean; revision?: number; auditId?: string; duplicate?: boolean; code?: string; error?: string };
      if (response.status === 409) {
        setPending(null);
        await reload();
        setSaveError("Policy changed since this panel loaded. Current policy has been reloaded; review it before making another change.");
        return;
      }
      if (response.status >= 400 && response.status < 500) {
        setPending(null);
        const message = result.error || result.code || `Request rejected (${response.status}).`;
        if (response.status === 401 || response.status === 403) {
          await reload();
          throw new Error(`${message} Permission or sign-in may need attention. Policy was refreshed; recheck access before retrying.`);
        }
        throw new Error(message);
      }
      if (!response.ok || !result.success) throw new Error(result.error || result.code || `Save failed (${response.status}).`);
      setPending(null);
      setReason("");
      setSaveNotice(`Saved policy revision ${result.revision ?? ""}. Audit reference: ${result.auditId || "recorded"}.${result.duplicate ? " This was a confirmed retry." : ""}`);
      await reload();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save outcome is unknown. Retry this exact change to reuse its request ID.");
    } finally {
      setSaving(false);
    }
  };

  const saveGlobal = () => {
    if (!data || !globalDraft) return;
    const body = { action: "set_global", expectedRevision: data.policy.revision, reason: reason.trim(), global: globalDraft };
    void submit(body, `Proposed global change at revision ${data.policy.revision}: service ${globalDraft.enabled ? "enabled" : "held"}; current review ${globalDraft.requireCurrentReview ? "required" : "not required"}; residence ${describeGeoRule(globalDraft.residence)}; property/matter ${describeGeoRule(globalDraft.property)}. Apply this to new preparation/staging and locks committed after the update? Locks committed first remain unchanged and may continue through payment and dispatch.`);
  };

  const saveTemplate = () => {
    if (!data || !selected || !templateDraft) return;
    const body: MutationBody = { action: "set_template", slug: selected.slug, expectedRevision: data.policy.revision, expectedContentDigest: selected.contentDigest, reason: reason.trim(), settings: templateDraft };
    if (recordReview && reviewDraft) body.review = { ...reviewDraft, reviewBy: reviewDraft.reviewBy || null };
    const reviewStatus = recordReview && reviewDraft ? reviewDraft.status : selected.policy.review.status;
    const reviewBy = recordReview && reviewDraft ? reviewDraft.reviewBy || "missing" : formatDate(selected.policy.review.reviewBy);
    void submit(body, `Proposed change for “${selected.title}” at revision ${data.policy.revision}: template ${templateDraft.enabled ? "enabled" : "paused"}; review ${reviewStatus}${reviewStatus === "approved" ? `, review by ${reviewBy}` : ""}; current review ${templateDraft.requireCurrentReview ? "required" : "not required"}; residence ${describeGeoRule(templateDraft.residence)}; property/matter ${describeGeoRule(templateDraft.property)}; ${templateDraft.sources.length} source record(s). Apply? Review records are operator evidence, not legal clearance. This affects new preparation/staging and locks committed after the update; locks committed first remain unchanged and may continue through payment and dispatch.`);
  };

  if (loading && !data) return <div className={card} role="status">Loading template governance…</div>;
  if (loadError && !data) return <div className={card} role="alert"><p className="font-semibold text-rose-800">Template policy could not be loaded.</p><p className="mt-1 text-sm text-stone-700">{loadError}</p><button type="button" className={`${button} mt-3`} onClick={() => void reload()}>Retry</button></div>;
  if (!data || !globalDraft) return null;

  return (
    <div className="space-y-5" data-testid="template-governance-panel">
      <header className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-sky-800">Template governance · {data.policy.environment}</p><h1 className="mt-1 text-xl font-bold text-stone-950">Templates &amp; coverage</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">Availability policy controls new preparation and checkout. Review records are operator evidence, not a legal opinion or clearance.</p></div>
          <button type="button" className={button} onClick={() => void reload()} disabled={loading || saving}>Reload policy</button>
        </div>
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><strong>Cutoff:</strong> changes apply to new preparation/staging and checkout locks committed after the update. A lock committed first is grandfathered, including its later Stripe intent/payment and dispatch. This control does not cancel intents, refund charges, stop paid dispatch, or rewrite frozen letters.</div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600"><span className="rounded-full bg-stone-100 px-2.5 py-1">Policy revision {data.policy.revision}</span><span className="rounded-full bg-stone-100 px-2.5 py-1">Updated {formatDate(data.policy.updatedAt)}</span>{data.policy.revision === 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-900">Migration defaults · not a saved policy</span>}</div>
      </header>

      {loadError && <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900" role="alert"><p><strong>Policy refresh failed.</strong> Showing stale revision {data.policy.revision}; all policy writes are disabled until a successful reload.</p><p className="mt-1">{loadError}</p><button type="button" className="mt-2 text-xs font-bold underline" onClick={() => void reload()} disabled={loading || saving}>Retry policy refresh</button></div>}

      {saveError && <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900" role="alert"><p>{saveError}</p>{pending && <button type="button" className="mt-2 text-xs font-bold underline" disabled={saving || !data.canManage} onClick={() => void submit({ ...pending.body, requestId: undefined }, "Retry the exact previously confirmed policy change with the same request ID?")}>Retry exact save</button>}</div>}
      {saveNotice && <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{saveNotice}</p>}

      <section className={card} aria-labelledby="global-policy-heading">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="global-policy-heading" className="text-base font-bold">Global availability</h2><p className="mt-1 text-xs text-stone-600">A global restriction cannot be overridden by a template rule.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">Effective for all templates</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex min-h-11 items-start gap-2 rounded-lg bg-stone-50 p-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-stone-900" checked={globalDraft.enabled} disabled={!canWrite || saving} onChange={(event) => setGlobalDraft({ ...globalDraft, enabled: event.target.checked })} /><span><strong>Service enabled</strong><span className="mt-0.5 block text-xs text-stone-600">Turn off to hold all new template preparation and locks.</span></span></label>
          <label className="flex min-h-11 items-start gap-2 rounded-lg bg-stone-50 p-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-stone-900" checked={globalDraft.requireCurrentReview} disabled={!canWrite || saving} onChange={(event) => setGlobalDraft({ ...globalDraft, requireCurrentReview: event.target.checked })} /><span><strong>Require current review</strong><span className="mt-0.5 block text-xs text-stone-600">Blocks templates without an approved, current review record.</span></span></label>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2"><GeoRuleEditor key={`global-residence:${editorResetEpoch}`} idPrefix="global-residence" validationKey="global-residence" onValidityChange={updateGeoValidity} title="Consumer residence" description="Explicit state where the sender resides; never inferred from IP or recipient address." rule={globalDraft.residence} disabled={!canWrite || saving} onChange={(residence) => setGlobalDraft({ ...globalDraft, residence })} /><GeoRuleEditor key={`global-property:${editorResetEpoch}`} idPrefix="global-property" validationKey="global-property" onValidityChange={updateGeoValidity} title="Property / matter state" description="Applies only to templates whose policy uses a property or matter location." rule={globalDraft.property} disabled={!canWrite || saving} onChange={(property) => setGlobalDraft({ ...globalDraft, property })} /></div>
        {!data.canManage && <p className="mt-3 rounded-lg bg-stone-100 p-3 text-xs text-stone-700">Read-only access. Your current role cannot change template policy.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"><label className="text-xs font-semibold text-stone-700">Reason for this policy change<textarea className={`${input} min-h-16`} maxLength={500} value={reason} disabled={!canWrite || saving} onChange={(event) => setReason(event.target.value)} placeholder="Why is this global policy changing?" /></label><button type="button" className={button} disabled={!data.canManage || saving} onClick={discardDrafts}>Discard edits</button><button type="button" className={primaryButton} disabled={!canWrite || saving || !reason.trim() || invalidGeoRules["global-residence"] || invalidGeoRules["global-property"]} onClick={saveGlobal}>{saving ? "Saving…" : "Save global policy"}</button></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.8fr)]">
        <div className={`${card} min-w-0`}>
          <div className="flex items-center justify-between gap-2"><h2 className="text-base font-bold">Compiled templates</h2><span className="text-xs text-stone-500">{data.templates.length}</span></div>
          <label htmlFor="template-search" className="mt-3 block text-xs font-semibold text-stone-700">Search by title, slug, or category</label><input id="template-search" className={input} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates" />
          <ul className="mt-3 space-y-2" aria-label="Template catalog">{visibleTemplates.map((entry) => { const status = effectiveLabel(entry, data.policy.global, data.policy.revision); return <li key={entry.slug}><button type="button" disabled={saving || Boolean(pending)} className={`w-full rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${selectedSlug === entry.slug ? "border-sky-600 bg-sky-50 ring-1 ring-sky-200" : "border-stone-200 hover:bg-stone-50"}`} aria-pressed={selectedSlug === entry.slug} onClick={() => { setSelectedSlug(entry.slug); setReason(""); setSaveNotice(""); }}><span className="block font-semibold text-stone-900">{entry.title}</span><span className="mt-0.5 block break-all font-mono text-[10px] text-stone-500">{entry.slug}</span><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.tone}`}>{status.label}</span></button></li>; })}</ul>
          {visibleTemplates.length === 0 && <p className="mt-3 text-sm text-stone-600">No templates match this search.</p>}
        </div>

        {selected && templateDraft && reviewDraft && <div className="space-y-5">
          <section className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-stone-500">{selected.category}</p><h2 className="mt-1 text-lg font-bold">{selected.title}</h2><p className="mt-1 break-all font-mono text-xs text-stone-500">{selected.slug}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${effectiveLabel(selected, data.policy.global, data.policy.revision).tone}`}>{effectiveLabel(selected, data.policy.global, data.policy.revision).label}</span></div>
            <dl className="mt-4 grid gap-2 rounded-xl bg-stone-50 p-3 text-xs sm:grid-cols-2"><div><dt className="font-semibold text-stone-600">Content digest</dt><dd className="mt-1 break-all font-mono text-[10px]">{selected.contentDigest}</dd></div><div><dt className="font-semibold text-stone-600">Review status</dt><dd className="mt-1">{selected.policy.review.status} · {selected.reviewCurrent ? "current" : "not current"}</dd></div><div><dt className="font-semibold text-stone-600">Reviewed by / date</dt><dd className="mt-1">{selected.policy.review.reviewer || "Not recorded"} · {formatDate(selected.policy.review.reviewedAt)}</dd></div><div><dt className="font-semibold text-stone-600">Review by</dt><dd className="mt-1">{formatDate(selected.policy.review.reviewBy)}</dd></div><div className="sm:col-span-2"><dt className="font-semibold text-stone-600">Review evidence</dt><dd className="mt-1 break-all">{safeHttpUrl(selected.policy.review.evidenceUrl) ? <a href={safeHttpUrl(selected.policy.review.evidenceUrl) || undefined} target="_blank" rel="noreferrer" className="text-sky-800 underline">{selected.policy.review.evidenceUrl}</a> : selected.policy.review.evidenceUrl || "No evidence reference"}</dd></div>{selected.policy.review.notes && <div className="sm:col-span-2"><dt className="font-semibold text-stone-600">Review notes</dt><dd className="mt-1 whitespace-pre-wrap">{selected.policy.review.notes}</dd></div>}</dl>
            {selected.policy.review.status === "approved" && !selected.reviewCurrent && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">Approval record is stale, expired, or incomplete for the current compiled content. It is not counted as current review.</p>}
            <details className="mt-4 rounded-xl border border-stone-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Read-only compiled letter and fields</summary><p className="mt-2 text-xs text-stone-600">This is the current deterministic source. It cannot be edited here. The mandatory UPL footer is shown exactly as configured.</p><h3 className="mt-4 text-sm font-bold">Printed heading</h3><p className="mt-1 text-sm">{selected.documentHeaderTitle}</p><h3 className="mt-4 text-sm font-bold">Subject line template</h3><p className="mt-1 break-words font-mono text-xs">{selected.reLineTemplate}</p><h3 className="mt-4 text-sm font-bold">Body paragraphs</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6">{selected.bodyParagraphs.map((paragraph, index) => <li key={`${index}-${paragraph.slice(0, 12)}`} className="break-words">{paragraph}</li>)}</ol><h3 className="mt-4 text-sm font-bold">Fields and fixed options</h3><ul className="mt-2 space-y-2">{selected.fields.map((field) => <li key={field.key} className="rounded-lg bg-stone-50 p-2.5 text-xs"><strong>{field.label}</strong><span className="ml-2 font-mono text-stone-500">{field.key} · {field.inputType}{field.maxLength ? ` · max ${field.maxLength}` : ""}</span>{field.helperText && <p className="mt-1 text-stone-600">{field.helperText}</p>}{field.options && <ul className="mt-1 list-disc pl-5">{field.options.map((option) => <li key={option.value}>{option.label} <span className="break-all font-mono text-stone-500">({option.value})</span></li>)}</ul>}</li>)}</ul><h3 className="mt-4 text-sm font-bold">Mandatory UPL compliance footer</h3><p className="mt-1 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5">{data.complianceFooter}</p></details>
          </section>

          <section className={card}>
            <h2 className="text-base font-bold">Template availability and review</h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">Approval is a recorded review status; it never enables a paused template or certifies legal suitability.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="flex items-start gap-2 rounded-lg bg-stone-50 p-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-stone-900" checked={templateDraft.enabled} disabled={!canWrite || saving} onChange={(event) => setTemplateDraft({ ...templateDraft, enabled: event.target.checked })} /><span><strong>Template enabled</strong><span className="mt-0.5 block text-xs text-stone-600">Allow new work when all other policy checks pass.</span></span></label><label className="flex items-start gap-2 rounded-lg bg-stone-50 p-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-stone-900" checked={templateDraft.requireCurrentReview} disabled={!canWrite || saving} onChange={(event) => setTemplateDraft({ ...templateDraft, requireCurrentReview: event.target.checked })} /><span><strong>Require current review</strong><span className="mt-0.5 block text-xs text-stone-600">Blocks unreviewed, stale, or expired records for this template.</span></span></label></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2"><GeoRuleEditor key={`template-residence:${selectedSlug}:${editorResetEpoch}`} idPrefix="template-residence" validationKey={`template-residence:${selectedSlug}`} onValidityChange={updateGeoValidity} title="Consumer residence" description="Required only when this rule restricts jurisdictions." rule={templateDraft.residence} disabled={!canWrite || saving} onChange={(residence) => setTemplateDraft({ ...templateDraft, residence })} /><GeoRuleEditor key={`template-property:${selectedSlug}:${editorResetEpoch}`} idPrefix="template-property" validationKey={`template-property:${selectedSlug}`} onValidityChange={updateGeoValidity} title="Property / matter state" description={selected.category === "tenant" ? "Applies to the tenant property state, never the recipient's mailing state." : "Only enforced for tenant templates."} rule={templateDraft.property} disabled={!canWrite || saving || selected.category !== "tenant"} onChange={(property) => setTemplateDraft({ ...templateDraft, property })} /></div>
            <div className="mt-4"><SourceEditor sources={templateDraft.sources} disabled={!canWrite || saving} onChange={(sources) => setTemplateDraft({ ...templateDraft, sources })} /></div>
            <fieldset className="mt-5 rounded-xl border border-sky-200 bg-sky-50/60 p-3 sm:p-4" disabled={!canWrite || saving}>
              <legend className="px-1 text-sm font-semibold text-stone-900">Record a review update</legend>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-sky-800" checked={recordReview} onChange={(event) => setRecordReview(event.target.checked)} /><span><strong>Explicitly update review record</strong><span className="mt-0.5 block text-xs text-stone-600">If unchecked, existing review metadata is preserved. Recording “approved” is not a legal opinion.</span></span></label>
              {recordReview && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-stone-700">Review status<select className={input} value={reviewDraft.status} onChange={(event) => setReviewDraft({ ...reviewDraft, status: event.target.value as ReviewStatus })}><option value="unreviewed">Unreviewed</option><option value="in_review">In review</option><option value="approved">Approved · operator-recorded</option><option value="hold">Hold</option></select></label><label className="text-xs font-semibold text-stone-700">Reviewer<input className={input} maxLength={120} value={reviewDraft.reviewer} onChange={(event) => setReviewDraft({ ...reviewDraft, reviewer: event.target.value })} placeholder="Name or role" /></label><label className="text-xs font-semibold text-stone-700">Review by date<input className={input} type="date" value={reviewDraft.reviewBy} onChange={(event) => setReviewDraft({ ...reviewDraft, reviewBy: event.target.value })} /></label><label className="text-xs font-semibold text-stone-700">Evidence URL<input className={input} type="url" maxLength={1000} value={reviewDraft.evidenceUrl} onChange={(event) => setReviewDraft({ ...reviewDraft, evidenceUrl: event.target.value })} placeholder="https://…" /></label><label className="text-xs font-semibold text-stone-700 sm:col-span-2">Review notes<textarea className={`${input} min-h-20`} maxLength={1000} value={reviewDraft.notes} onChange={(event) => setReviewDraft({ ...reviewDraft, notes: event.target.value })} /></label><p className="sm:col-span-2 text-xs text-stone-600">Reviewed time, actor, and content digest are recorded by the server when saved.</p></div>}
            </fieldset>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"><label className="text-xs font-semibold text-stone-700">Reason for this template change<textarea className={`${input} min-h-16`} maxLength={500} value={reason} disabled={!canWrite || saving} onChange={(event) => setReason(event.target.value)} placeholder="Why is this template policy or review record changing?" /></label><button type="button" className={button} disabled={!data.canManage || saving} onClick={discardDrafts}>Discard edits</button><button type="button" className={primaryButton} disabled={!canWrite || saving || !reason.trim() || invalidGeoRules[`template-residence:${selectedSlug}`] || invalidGeoRules[`template-property:${selectedSlug}`]} onClick={saveTemplate}>{saving ? "Saving…" : "Save template policy"}</button></div>
          </section>
        </div>}
      </section>

      <section className={card} aria-labelledby="template-audit-heading"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 id="template-audit-heading" className="text-base font-bold">Recent policy changes</h2><p className="text-xs text-stone-600">Bounded audit history from the current environment.</p></div><span className="text-xs text-stone-500">{data.recentChanges.length} recent records</span></div>{data.recentChanges.length === 0 ? <p className="mt-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-600">No policy changes recorded.</p> : <ol className="mt-3 divide-y divide-stone-100">{data.recentChanges.map((change) => <li key={change.auditId} className="grid gap-1 py-3 text-xs sm:grid-cols-[1fr_1fr_2fr]"><span className="font-semibold text-stone-900">{change.action} · {change.targetId}</span><span className="text-stone-600">{change.actorId} · {formatDate(change.occurredAt)}</span><span className="break-words text-stone-600">{change.reason}</span></li>)}</ol>}</section>
    </div>
  );
}
