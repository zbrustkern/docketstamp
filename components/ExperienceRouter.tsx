"use client";

import React, { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { EntryPrototypeClient } from "@/app/preview/entry/client";
import { VendingMachineBuilder } from "@/components/VendingMachineBuilder";

export interface ExperienceRouterProps {
  initialIsV3: boolean;
  initialOccasion?: string;
  initialCoverUrl?: string;
  initialPrintedGreeting?: string;
  initialHandwrittenNote?: string;
  initialFontStyleId?: string;
  scenarioSlug?: string;
}

export function ExperienceRouter({
  initialIsV3,
  initialOccasion,
  initialCoverUrl,
  initialPrintedGreeting,
  initialHandwrittenNote,
  initialFontStyleId,
  scenarioSlug,
}: ExperienceRouterProps) {
  const searchParams = useSearchParams();

  const isV3 = useMemo(() => {
    // 1. Client query override check: ?v3=1 -> true, ?v3=0 -> false
    if (searchParams) {
      const v3Param = searchParams.get("v3");
      if (v3Param === "1" || v3Param === "true") return true;
      if (v3Param === "0" || v3Param === "false") return false;
    }
    // 2. Fallback to server-resolved feature flag state
    return initialIsV3;
  }, [searchParams, initialIsV3]);

  if (isV3) {
    return (
      <EntryPrototypeClient
        initialOccasion={initialOccasion}
        scenarioSlug={scenarioSlug}
      />
    );
  }

  return (
    <VendingMachineBuilder
      initialOccasion={initialOccasion}
      initialCoverUrl={initialCoverUrl}
      initialPrintedGreeting={initialPrintedGreeting}
      initialHandwrittenNote={initialHandwrittenNote}
      initialFontStyleId={initialFontStyleId}
      scenarioSlug={scenarioSlug}
    />
  );
}
