"use client";

import React, { useState } from "react";
import { Truck, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";

export function HandwryttenStatusWidget() {
  const [isTestMode] = useState(process.env.NODE_ENV !== "production");

  return (
    <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-950 text-sky-400 border border-sky-800 flex items-center justify-center flex-shrink-0">
          <Truck className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white font-mono">Lob USPS Dispatch Gateway</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                isTestMode
                  ? "bg-amber-950 text-amber-400 border-amber-800"
                  : "bg-emerald-950 text-emerald-400 border-emerald-800"
              }`}
            >
              {isTestMode ? "Sandbox Simulation" : "Live Production Dispatch"}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            USPS CASS™ Address Verification: <span className="text-emerald-400 font-semibold">Active &bull; Operational</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
        <div className="text-right">
          <div className="text-[10px] uppercase font-mono text-slate-400">Postal Services</div>
          <div className="text-xs font-bold text-sky-400 font-mono">First-Class &bull; Certified &bull; ERR</div>
        </div>
      </div>
    </div>
  );
}
