"use client";

import { useEffect, useState } from "react";

type Status = {
  environment: string;
  google: { enabled: boolean; reason: string; configured: string[] };
  meta: { enabled: boolean; reason: string; configured: boolean };
  status: string;
};

export function MarketingDestinationsWidget() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/admin/marketing-destinations", { cache: "no-store" })
      .then(async (res) => res.ok ? res.json() as Promise<Status> : null)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-slate-100" aria-label="Marketing destination status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider">Marketing destinations</h2>
        <span className="text-[10px] font-mono text-slate-400">{status?.environment || "status unavailable"} · config only, no live probe</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
        <div className="rounded-lg border border-slate-700 p-3">
          <b>Google</b>: {status?.google.enabled ? "Enabled (verified configuration)" : `Disabled (${status?.google.reason || "status unavailable"})`}
          {status?.google.enabled && <p className="mt-1 text-slate-400">Configured: {status.google.configured.join(", ") || "none"}</p>}
        </div>
        <div className="rounded-lg border border-slate-700 p-3">
          <b>Meta</b>: {status?.meta.enabled ? "Enabled (verified configuration)" : `Disabled (${status?.meta.reason || "status unavailable"})`}
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">Vendor tags still require explicit visitor marketing consent. No destination ID is shown here.</p>
    </section>
  );
}
