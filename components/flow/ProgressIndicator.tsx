"use client";

import React from "react";
import { Check } from "lucide-react";

export type FlowStep = "card" | "note" | "address" | "pay";

interface ProgressIndicatorProps {
  currentStep: FlowStep;
}

interface StepConfig {
  key: FlowStep;
  label: string;
  number: number;
}

const STEPS: StepConfig[] = [
  { key: "card", label: "Card", number: 1 },
  { key: "note", label: "Note", number: 2 },
  { key: "address", label: "Address", number: 3 },
  { key: "pay", label: "Pay", number: 4 },
];

export function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <nav aria-label="Order progress" className="w-full bg-white border-b border-stone-100 py-2.5 px-4">
      <div className="max-w-2xl mx-auto">
        <ol className="flex items-center justify-between gap-1 sm:gap-2">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <li
                key={step.key}
                aria-current={isCurrent ? "step" : undefined}
                className="flex items-center gap-1.5 flex-1 min-w-0"
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition-colors ${
                    isCompleted
                      ? "bg-emerald-700 text-white"
                      : isCurrent
                      ? "bg-stone-900 text-white ring-2 ring-stone-900/20"
                      : "bg-stone-200 text-stone-600"
                  }`}
                  aria-hidden="true"
                >
                  {isCompleted ? <Check className="w-3 h-3 stroke-[3]" /> : step.number}
                </div>
                <span
                  className={`text-xs font-medium truncate ${
                    isCurrent
                      ? "text-stone-900 font-semibold"
                      : isCompleted
                      ? "text-stone-700"
                      : "text-stone-400"
                  }`}
                >
                  {step.label}
                </span>

                {/* Connector line between steps */}
                {index < STEPS.length - 1 && (
                  <div
                    className={`h-[2px] flex-1 min-w-[8px] mx-1 transition-colors ${
                      index < currentIndex ? "bg-emerald-600" : "bg-stone-200"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
