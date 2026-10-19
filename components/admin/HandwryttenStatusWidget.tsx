"use client";

import React from "react";
import { Truck } from "lucide-react";

export function LobStatusWidget() {
  return (
    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-950 text-amber-400 border border-amber-800 flex items-center justify-center flex-shrink-0">
          <Truck className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white font-mono">Lob USPS Dispatch Gateway</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono bg-amber-950 text-amber-300 border-amber-800">
              Provider state unknown • No probe
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            USPS CASS™ address verification:{" "}
            <span className="text-amber-300 font-semibold">Unverified (No Recent Health Probe)</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
        <div className="text-right">
          <div className="text-[10px] uppercase font-mono text-slate-400">Service Scope</div>
          <div className="text-xs font-bold text-amber-300 font-mono">Available evidence: none</div>
        </div>
      </div>
    </div>
  );
}
export const HandwryttenStatusWidget = LobStatusWidget;
