"use client";

import React, { useState } from "react";
import {
  Target,
  Search,
  Activity,
} from "lucide-react";
import { AdminMetrics, Order } from "@/lib/types";

interface CampaignPerformanceWidgetProps {
  metrics: AdminMetrics | null;
  orders: Order[];
}

export function CampaignPerformanceWidget({ metrics, orders }: CampaignPerformanceWidgetProps) {
  const [search, setSearch] = useState("");

  const telemetry = metrics?.visitorTelemetry;
  const sessions = telemetry?.recentSessions || [];
  const sources = telemetry?.acquisitionSources || [];

  // Group orders by campaign / channel
  const campaignDataMap = new Map<
    string,
    {
      name: string;
      channel: string;
      recentSessionSample: number;
      addressReachedSample: number;
      recentOrderSample: number;
      unmatchedOrderSample: number;
      amountFieldSumDollars: number;
      landingPage?: string;
    }
  >();

  // These inputs are different bounded samples (50 recent sessions and 50 recent orders).
  // Display each sample separately; they are not a campaign cohort and cannot support rates.
  for (const s of sessions) {
    const campName = s.campaign || (s.gclid ? "Google Ads (Auto-Tagged)" : s.source ? `${s.source} / ${s.medium}` : "Direct / Organic");
    const channel = s.gclid || (s.source === "google" && s.medium === "cpc") ? "Google Ads" : s.medium === "organic" ? "Organic" : s.medium === "social" ? "Social" : "Direct";

    if (!campaignDataMap.has(campName)) {
      campaignDataMap.set(campName, {
        name: campName,
        channel,
        recentSessionSample: 0,
        addressReachedSample: 0,
        recentOrderSample: 0,
        unmatchedOrderSample: 0,
        amountFieldSumDollars: 0,
        landingPage: s.landingPath,
      });
    }

    const row = campaignDataMap.get(campName)!;
    row.recentSessionSample++;
    if (s.highestStep >= 3) {
      row.addressReachedSample++;
    }
  }

  // Keep the bounded recent-order sample separate from session evidence.
  for (const ord of orders) {
    if (
      ord.status === "PENDING_PAYMENT" ||
      ord.status === "FAILED" ||
      ord.status === "PAYMENT_VERIFICATION_FAILED" ||
      (ord.status === "QUEUED_FOR_FULFILLMENT" && !ord.stripePaymentId && (ord.amountInCents === undefined || ord.amountInCents <= 0))
    ) {
      continue;
    }
    const camp = ord.attribution?.utmCampaign || (ord.attribution?.gclid ? "Google Ads" : "Direct / Organic");
    const observedRevenueDollars =
      typeof ord.amountInCents === "number" && Number.isFinite(ord.amountInCents) && ord.amountInCents > 0
        ? ord.amountInCents / 100
        : 0;

    if (!campaignDataMap.has(camp)) {
      campaignDataMap.set(camp, {
        name: camp,
        channel: ord.attribution?.gclid ? "Google Ads" : "Direct",
        recentSessionSample: 0,
        addressReachedSample: 0,
        recentOrderSample: 0,
        unmatchedOrderSample: 0,
        amountFieldSumDollars: 0,
        landingPage: ord.attribution?.landingPath,
      });
    }
    const row = campaignDataMap.get(camp)!;
    row.recentOrderSample++;
    row.unmatchedOrderSample++;
    row.amountFieldSumDollars += observedRevenueDollars;
  }

  const rows = Array.from(campaignDataMap.values()).filter((r) => {
    if (!search) return true;
    return r.name.toLowerCase().includes(search.toLowerCase()) || r.channel.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 border border-stone-200 shadow-sm space-y-6">
      {/* HEADER & TAG HEALTH STATUS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Campaign Attribution Samples</span>
            </h2>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Interim Rollup &bull; Unverified Attribution
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
              Separate samples of up to 50 recent sessions and 50 recent orders. They are not a complete campaign cohort or a verified session-to-order join; amount fields are unreconciled.
          </p>
        </div>

        <span className="text-xs text-stone-500">Destination readiness is shown in Marketing Destinations; campaign rows are interim attribution samples.</span>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs font-semibold text-stone-700">
          Campaigns in Recent Samples ({rows.length})
        </span>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search campaign or channel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-stone-800"
          />
        </div>
      </div>

      {/* TABLE */}
      {rows.length === 0 ? (
        <div className="text-center py-10 bg-stone-50/60 rounded-2xl border border-stone-200 space-y-2">
          <Activity className="w-6 h-6 text-stone-400 mx-auto animate-pulse" />
          <p className="text-xs font-medium text-stone-700">Awaiting Ad Clicks &amp; Visitor Sessions</p>
          <p className="text-[11px] text-stone-500 max-w-md mx-auto">
              No campaign rows are present in the current recent samples. This does not establish zero campaign traffic or purchases.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-xs bg-white">
            <thead className="bg-stone-50/80 border-b border-stone-200 text-stone-400 text-[10px] uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3">Campaign / Source</th>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3 text-center">Recent Sessions (≤50)</th>
                <th className="py-2.5 px-3 text-center">Address Step in Sample</th>
                <th className="py-2.5 px-3 text-center">Recent Orders (≤50)</th>
                <th className="py-2.5 px-3 text-right">Session Conversion</th>
                <th className="py-2.5 px-3 text-right">Order Amount Field Sum</th>
                <th className="py-2.5 px-3 text-right">Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row, idx) => {
                return (
                  <tr key={idx} className="hover:bg-stone-50/50 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-semibold text-stone-900 block truncate max-w-[200px]" title={row.name}>
                        {row.name}
                      </span>
                      {row.landingPage && (
                        <span className="text-[10px] text-stone-400 font-mono truncate block max-w-[180px]">
                          {row.landingPage}
                        </span>
                      )}
                      {row.unmatchedOrderSample > 0 && (
                        <span className="text-[10px] text-amber-700 font-medium block">
                          Order/session joins unavailable
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.channel === "Google Ads"
                            ? "bg-blue-50 text-blue-800 border border-blue-200"
                            : "bg-stone-100 text-stone-700 border border-stone-200"
                        }`}
                      >
                        {row.channel}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-medium text-stone-700">
                      {row.recentSessionSample}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 font-semibold text-stone-800">
                        {row.addressReachedSample}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-xs ${
                          row.recentOrderSample > 0
                            ? "bg-amber-50 text-amber-900 border border-amber-200"
                            : "text-stone-400"
                        }`}
                      >
                        {row.recentOrderSample}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-stone-800">
                      Unavailable
                    </td>

                    <td className="py-3 px-3 text-right font-semibold text-stone-900">
                      ${row.amountFieldSumDollars.toFixed(2)}
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-stone-500">
                      Unavailable
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
