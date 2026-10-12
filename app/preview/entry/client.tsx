"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { CARD_PRESETS, CardPreset } from "@/lib/card-presets";
import { useDraft } from "@/lib/draft";
import {
  FlowHeader,
  ProgressIndicator,
  ActionBar,
  EntryCardStep,
  FlowStep,
} from "@/components/flow";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export function EntryPrototypeClient() {
  const searchParams = useSearchParams();
  const occasionParam = searchParams.get("occasion") || undefined;
  const presetParam = searchParams.get("preset") || undefined;

  // Resolve contextual preselection if specified
  const initialPreset = React.useMemo(() => {
    if (presetParam) {
      return CARD_PRESETS.find((p) => p.id === presetParam);
    }
    if (occasionParam) {
      return CARD_PRESETS.find(
        (p) => p.occasion.toLowerCase() === occasionParam.toLowerCase()
      );
    }
    return undefined;
  }, [presetParam, occasionParam]);

  const { draft, dispatch, clearDraft, isLoaded } = useDraft({
    experienceVersion: "prototype_s1",
    initialPresetId: initialPreset?.id,
    initialPresetTitle: initialPreset?.title,
    initialPresetUrl: initialPreset?.imageUrl,
  });

  const [step, setStep] = useState<FlowStep>("card");

  // If initial preset is resolved and draft has no card, select it (not accepted yet)
  useEffect(() => {
    if (isLoaded && !draft.selectedDesign && initialPreset) {
      dispatch({
        type: "SELECT_DESIGN",
        payload: {
          presetId: initialPreset.id,
          imageUrl: initialPreset.imageUrl,
          title: initialPreset.title,
          source: "preset",
          accepted: false,
        },
      });
    }
  }, [isLoaded, draft.selectedDesign, initialPreset, dispatch]);

  // Handle card selection from grid
  const handleSelectPreset = (preset: CardPreset) => {
    dispatch({
      type: "SELECT_DESIGN",
      payload: {
        presetId: preset.id,
        imageUrl: preset.imageUrl,
        title: preset.title,
        source: "preset",
        accepted: false, // Tapping selects without advancing
      },
    });
  };

  // Handle CTA "Write your note"
  const handleWriteNote = () => {
    if (!draft.selectedDesign) {
      // Default fallback to first preset if none selected
      const fallback = CARD_PRESETS[0];
      dispatch({
        type: "SELECT_DESIGN",
        payload: {
          presetId: fallback.id,
          imageUrl: fallback.imageUrl,
          title: fallback.title,
          source: "preset",
          accepted: true,
        },
      });
    } else {
      // Accept contextual selection
      dispatch({ type: "ACCEPT_DESIGN" });
    }

    // TODO: Lane B schema - track 'card_completed' once merged
    setStep("note");
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-emerald-700 rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-stone-500">
            Initializing draft...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-stone-900 flex flex-col antialiased">
      {/* 1. COMPACT SENDMYNOTES HEADER */}
      <FlowHeader showClearDraft={true} onClearDraft={clearDraft} />

      {/* 2. PROGRESS INDICATOR: CARD / NOTE / ADDRESS / PAY */}
      <ProgressIndicator currentStep={step} />

      {/* 3. STEP CONTENT */}
      <main className="flex-1 w-full">
        {step === "card" ? (
          <EntryCardStep
            selectedDesign={draft.selectedDesign}
            onSelectDesign={handleSelectPreset}
            onAcceptAndContinue={handleWriteNote}
            initialOccasion={occasionParam}
          />
        ) : (
          /* Prototype Placeholder for Step 2: Note (Coming in S2) */
          <div className="max-w-md mx-auto px-4 py-8 space-y-6 pb-32">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2.5 text-emerald-800">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <h2 className="text-base font-semibold font-serif">
                  Step 1 Complete: Card Confirmed
                </h2>
              </div>

              {draft.selectedDesign && (
                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs">
                  <div className="relative w-14 aspect-[17/22] rounded-md overflow-hidden bg-stone-100 shrink-0">
                    <Image
                      src={draft.selectedDesign.imageUrl}
                      alt={draft.selectedDesign.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-900 truncate">
                      {draft.selectedDesign.title}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      Selection Accepted: {draft.selectedDesign.accepted ? "Yes" : "No"}
                    </p>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Draft Revision: #{draft.draftRevision} (Saved to sessionStorage)
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-emerald-900 leading-relaxed">
                Step 2 (Note Composition with natural handwriting editor and undoable starters) is scheduled for Sprint 2.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep("card")}
              className="w-full flex items-center justify-center gap-2 text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 font-medium text-sm py-3 px-4 rounded-xl min-h-[44px] transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to change card design</span>
            </button>
          </div>
        )}
      </main>

      {/* 4. PERSISTENT BOTTOM ACTION BAR */}
      <ActionBar
        priceDisplay="$9 total"
        priceSubtext="USPS mailing included"
        primaryLabel={step === "card" ? "Write your note" : "Next: Address (S2)"}
        isDisabled={step === "note"}
        onPrimaryClick={step === "card" ? handleWriteNote : () => {}}
      />
    </div>
  );
}
