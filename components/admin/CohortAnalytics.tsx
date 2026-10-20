"use client";

import React from "react";
import { FileText } from "lucide-react";
import { AdminMetrics } from "@/lib/types";

export function CohortAnalytics({ metrics }: { metrics: AdminMetrics | null }) {
  if (!metrics) return null;
  const categories = metrics.noticeCategoryPopularity || [];
  return (
    <section className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-100">
        <div>
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-600" />Notice category and cohort</h3>
          <p className="text-xs text-stone-400">Paid orders grouped by canonical notice metadata. Historical card orders remain separate; unmapped records stay unknown.</p>
        </div>
        <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">Explicit metadata</span>
      </div>
      {categories.length === 0 ? <p className="text-xs text-stone-400 py-4 text-center">No categorized paid orders recorded yet.</p> : (
        <div className="space-y-3">
          {categories.map((item) => (
            <div key={`${item.cohort}:${item.category}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-stone-800 font-semibold">{item.category}</span>
                <span className="text-stone-500 font-mono">{item.count} orders ({item.percentage}%)</span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${item.cohort === "notice" ? "bg-indigo-600" : item.cohort === "legacy_card" ? "bg-amber-500" : "bg-stone-400"}`} style={{ width: `${Math.max(item.percentage, 4)}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
