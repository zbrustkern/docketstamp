"use client";

import React, { useState, useMemo } from "react";
import {
  PenTool,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  Undo2,
} from "lucide-react";
import { OCCASION_MESSAGE_BANK, MessageInspiration } from "@/lib/card-presets";
import { Sheet } from "@/components/flow/Sheet";
import { CardPreview } from "@/components/CardPreview";

export interface HandwritingStyle {
  id: string;
  name: string;
  fontClass: string;
  description: string;
  sample: string;
}

export const HANDWRITING_STYLES: HandwritingStyle[] = [
  {
    id: "hwDavid",
    name: "Casual David",
    fontClass: "font-hwDavid",
    description: "Clean, natural everyday print with effortless charm.",
    sample: "Wishing you a wonderful day and a happy year ahead!",
  },
  {
    id: "hwKate",
    name: "Carefree Kate",
    fontClass: "font-hwKate",
    description: "Graceful, rounded cursive with flowing warmth.",
    sample: "Wishing you a wonderful day and a happy year ahead!",
  },
  {
    id: "hwAdam",
    name: "Executive Adam",
    fontClass: "font-hwAdam",
    description: "Strong upright architectural lettering.",
    sample: "Wishing you a wonderful day and a happy year ahead!",
  },
  {
    id: "hwChase",
    name: "Charming Chase",
    fontClass: "font-hwChase",
    description: "Expressive, stylish modern handwriting.",
    sample: "Wishing you a wonderful day and a happy year ahead!",
  },
];

interface Step2NoteCompositionProps {
  salutation: string;
  onChangeSalutation: (val: string) => void;
  bodyNote: string;
  onChangeBodyNote: (val: string) => void;
  signOff: string;
  onChangeSignOff: (val: string) => void;
  fontStyleId: string;
  onChangeFontStyleId: (id: string) => void;
  occasion: string;
  onBack: () => void;
  onContinue: () => void;
  hideFixedActionBar?: boolean;
  cardTitle?: string;
  cardUrl?: string;
}

export function Step2NoteComposition({
  salutation,
  onChangeSalutation,
  bodyNote,
  onChangeBodyNote,
  signOff,
  onChangeSignOff,
  fontStyleId,
  onChangeFontStyleId,
  occasion,
  onBack,
  onContinue,
  hideFixedActionBar = false,
  cardTitle,
  cardUrl,
}: Step2NoteCompositionProps) {
  // Handwriting style drawer state
  const [isFontSheetOpen, setIsFontSheetOpen] = useState(false);

  // Card preview sheet state for mobile
  const [isPreviewCardOpen, setIsPreviewCardOpen] = useState(false);

  // Inspiration drawer state
  const [isInspirationOpen, setIsInspirationOpen] = useState(false);
  const [selectedToneTab, setSelectedToneTab] = useState<"Warm" | "Heartfelt" | "Playful" | "Literary">("Warm");

  // Confirmation before replacing text
  const [pendingInspiration, setPendingInspiration] = useState<string | null>(null);

  // Undo memory for starter insertion
  const [previousBodyNote, setPreviousBodyNote] = useState<string | null>(null);

  // Active font object
  const currentFont = useMemo(() => {
    return HANDWRITING_STYLES.find((f) => f.id === fontStyleId) || HANDWRITING_STYLES[0];
  }, [fontStyleId]);

  // Combined letter text for character measurement
  const fullText = useMemo(() => {
    return [salutation, bodyNote, signOff].filter(Boolean).join("\n\n");
  }, [salutation, bodyNote, signOff]);

  const charCount = fullText.length;
  const MAX_CHARS = 450;
  const WARN_CHARS = 400;
  const isApproachingLimit = charCount >= WARN_CHARS && charCount < MAX_CHARS;
  const isAtLimit = charCount >= MAX_CHARS;

  // Retrieve message bank for occasion
  const messageBank: MessageInspiration[] = useMemo(() => {
    return OCCASION_MESSAGE_BANK[occasion] || OCCASION_MESSAGE_BANK["Birthday"] || [];
  }, [occasion]);

  // Filter messages by selected tone tab
  const filteredMessages = useMemo(() => {
    if (selectedToneTab === "Warm") {
      return messageBank.filter((m) => m.tone === "warm");
    }
    if (selectedToneTab === "Heartfelt") {
      return messageBank.filter((m) => m.tag === "Heartfelt" || m.tone === "warm");
    }
    if (selectedToneTab === "Playful") {
      return messageBank.filter((m) => m.tone === "funny" || m.tag === "Playful");
    }
    if (selectedToneTab === "Literary") {
      return messageBank.filter((m) => m.tone === "poetic" || m.tag === "Literary");
    }
    return messageBank;
  }, [messageBank, selectedToneTab]);

  const handleInspirationClick = (text: string) => {
    if (bodyNote.trim() && bodyNote.trim() !== text.trim()) {
      setPendingInspiration(text);
    } else {
      applyInspirationText(text);
    }
  };

  const applyInspirationText = (text: string) => {
    setPreviousBodyNote(bodyNote);
    const projectedCombined = [salutation, text, signOff].filter(Boolean).join("\n\n");
    if (projectedCombined.length > MAX_CHARS) {
      const allowedBodyLen = MAX_CHARS - (salutation.length + signOff.length + 4);
      onChangeBodyNote(text.slice(0, Math.max(10, allowedBodyLen)));
    } else {
      onChangeBodyNote(text);
    }
    setPendingInspiration(null);
  };

  const handleUseStarter = (starterText: string) => {
    setPreviousBodyNote(bodyNote);
    applyInspirationText(starterText);
  };

  const handleUndoStarter = () => {
    if (previousBodyNote !== null) {
      onChangeBodyNote(previousBodyNote);
      setPreviousBodyNote(null);
    }
  };

  // Enforce 450 character hard cap when typing in body
  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newBody = e.target.value;
    const projectedCombined = [salutation, newBody, signOff].filter(Boolean).join("\n\n");

    if (projectedCombined.length <= MAX_CHARS) {
      onChangeBodyNote(newBody);
    } else {
      const allowedBodyLen = MAX_CHARS - (salutation.length + signOff.length + (salutation ? 2 : 0) + (signOff ? 2 : 0));
      if (allowedBodyLen > 0) {
        onChangeBodyNote(newBody.slice(0, allowedBodyLen));
      }
    }
  };

  return (
    <div className="space-y-6 pb-28 md:pb-12">
      {/* STEP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h1 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
              Write your note
            </h1>
          </div>
          <p className="text-xs text-stone-600">
            Your words, written in real pen ink.
          </p>
        </div>

        {/* Back navigation button */}
        <button
          type="button"
          onClick={onBack}
          className="self-start sm:self-auto px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-lg shadow-2xs hover:bg-stone-50 transition flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Change card</span>
        </button>
      </div>

      {/* MAIN LAYOUT: SIDE-BY-SIDE ON DESKTOP, STACKED ON MOBILE */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
        {/* COMPOSITION FORM (Left Column) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#FAF8F5] rounded-2xl p-4 sm:p-6 border border-stone-200 shadow-xs space-y-4">
            {/* 1. Salutation / Recipient Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Greeting (optional)
              </label>
              <input
                type="text"
                value={salutation}
                onChange={(e) => {
                  const val = e.target.value;
                  const projected = [val, bodyNote, signOff].filter(Boolean).join("\n\n");
                  if (projected.length <= MAX_CHARS) {
                    onChangeSalutation(val);
                  }
                }}
                placeholder="e.g. Dear Eleanor,"
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs font-sans"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                We&apos;ll carry this name into the address step.
              </p>
            </div>

            {/* 2. Message Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                  Your message
                </label>
                <span className="text-[11px] text-stone-500 font-medium">
                  Style: {currentFont.name}
                </span>
              </div>

              {/* 1-Tap Suggested Starter Chip */}
              {!bodyNote.trim() && messageBank[0] && (
                <div className="mb-2.5 flex items-center justify-between gap-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-950 shadow-2xs">
                  <div className="min-w-0">
                    <span className="font-semibold block text-[10px] uppercase tracking-wider text-emerald-800">
                      Suggested starter ({occasion}):
                    </span>
                    <span className="italic truncate block text-stone-700 mt-0.5">
                      &ldquo;{messageBank[0].handwritten}&rdquo;
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUseStarter(messageBank[0].handwritten)}
                    className="shrink-0 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
                  >
                    Use this starter
                  </button>
                </div>
              )}

              {/* Undo chip if starter just used */}
              {previousBodyNote !== null && (
                <div className="mb-2 flex items-center justify-between bg-stone-100 rounded-lg px-3 py-1.5 text-xs text-stone-700">
                  <span>Starter applied</span>
                  <button
                    type="button"
                    onClick={handleUndoStarter}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </button>
                </div>
              )}

              <div className="relative rounded-2xl border border-stone-300 overflow-hidden bg-white shadow-2xs">
                {/* Lined stationery ruling effect */}
                <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(transparent_31px,#94A3B8_32px)] bg-[length:100%_32px]" />

                <textarea
                  rows={6}
                  value={bodyNote}
                  onChange={handleBodyChange}
                  placeholder="Write your note from the heart..."
                  className="w-full p-4 sm:p-5 bg-transparent relative z-10 text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-base sm:text-lg leading-[32px] tracking-normal resize-y min-h-[170px] font-sans"
                />
              </div>

              {/* Character count and limit warning directly under textarea */}
              <div className="mt-1.5 flex items-center justify-between text-xs text-stone-500">
                <div>
                  {isAtLimit ? (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Message limit reached (450 characters)
                    </span>
                  ) : isApproachingLimit ? (
                    <span className="text-amber-700 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Getting close to the message limit
                    </span>
                  ) : null}
                </div>
                <div className="font-mono text-stone-500 font-medium ml-auto">
                  <span className={isAtLimit ? "text-rose-600 font-bold" : isApproachingLimit ? "text-amber-700 font-bold" : "text-stone-700"}>
                    {charCount}
                  </span>
                  <span> / {MAX_CHARS} characters</span>
                </div>
              </div>
            </div>

            {/* 3. Closing & Sign-off Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Sign-off / Your name
              </label>
              <input
                type="text"
                value={signOff}
                onChange={(e) => {
                  const val = e.target.value;
                  const projected = [salutation, bodyNote, val].filter(Boolean).join("\n\n");
                  if (projected.length <= MAX_CHARS) {
                    onChangeSignOff(val);
                  }
                }}
                placeholder="e.g. Warmly, Thomas"
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs font-sans"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                We&apos;ll use your name on the envelope.
              </p>
            </div>
          </div>

          {/* COMPACT CONTROLS ROW: HANDWRITING SELECTOR & MOBILE PREVIEW BUTTON */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl p-4 border border-stone-200/90 shadow-2xs">
            {/* Collapsed Handwriting Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500">Handwriting:</span>
              <button
                type="button"
                onClick={() => setIsFontSheetOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-900 font-medium text-xs transition cursor-pointer"
              >
                <span className="font-semibold">{currentFont.name}</span>
                <span className="text-stone-500">· Change</span>
              </button>
            </div>

            {/* Mobile "Preview your card" Button */}
            <button
              type="button"
              onClick={() => setIsPreviewCardOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-xs border border-emerald-200/70 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-700" />
              <span>Preview your card</span>
            </button>
          </div>

          {/* SUBORDINATE INSPIRATION DRAWER */}
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setIsInspirationOpen(!isInspirationOpen)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-stone-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-800">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-stone-800 block">
                    Need a little inspiration?
                  </span>
                  <span className="text-[11px] text-stone-500">
                    Browse suggested messages for {occasion}.
                  </span>
                </div>
              </div>
              {isInspirationOpen ? (
                <ChevronUp className="w-4 h-4 text-stone-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-400" />
              )}
            </button>

            {isInspirationOpen && (
              <div className="p-4 pt-1 border-t border-stone-100 bg-[#FAF8F5] space-y-3">
                {/* Tone filter tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(["Warm", "Heartfelt", "Playful", "Literary"] as const).map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setSelectedToneTab(tone)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 ${
                        selectedToneTab === tone
                          ? "bg-stone-900 text-white shadow-xs"
                          : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>

                {/* Message ideas */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {filteredMessages.length === 0 ? (
                    <p className="text-xs text-stone-500 py-3 text-center">
                      Select another tone tab to view messages for {occasion}.
                    </p>
                  ) : (
                    filteredMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleInspirationClick(msg.handwritten)}
                        className="p-3 bg-white hover:bg-amber-50/70 border border-stone-200/80 hover:border-amber-300 rounded-xl transition cursor-pointer group space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-[10px] text-stone-400 font-medium">
                          <span className="uppercase tracking-wider text-emerald-800 font-semibold">
                            {msg.tag || selectedToneTab}
                          </span>
                          <span className="text-emerald-700 opacity-0 group-hover:opacity-100 transition font-semibold">
                            Click to use →
                          </span>
                        </div>
                        <p className={`text-sm text-stone-800 leading-relaxed ${currentFont.fontClass}`}>
                          &ldquo;{msg.handwritten}&rdquo;
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* INKING NOTICE CALLOUT */}
          <div className="p-3.5 bg-stone-100/70 rounded-2xl border border-stone-200/70 flex items-start gap-2.5">
            <PenTool className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
            <p className="text-xs text-stone-600 leading-relaxed">
              <strong className="text-stone-900 font-semibold">Real Pen Inking:</strong>{" "}
              All interior text is written with real ballpoint pen ink—never printed digital imitation fonts or toner.
            </p>
          </div>
        </div>

        {/* DESKTOP SIDE-BY-SIDE CARD PREVIEW (Right Column) */}
        <div className="hidden lg:block lg:col-span-5 sticky top-24 space-y-3">
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                Card Preview
              </span>
              <span className="text-[11px] text-stone-500">
                {cardTitle || "Folded Greeting Card"}
              </span>
            </div>
            <CardPreview
              coverUrl={cardUrl || ""}
              printedGreeting={salutation}
              handwrittenNote={[bodyNote, signOff].filter(Boolean).join("\n\n")}
              fontStyleId={fontStyleId}
              occasion={occasion}
              currentStep={2}
            />
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL BEFORE REPLACING USER TEXT */}
      {pendingInspiration && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-stone-200">
            <div className="flex items-center gap-2.5 text-stone-900">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <h3 className="font-serif font-bold text-base text-stone-900">
                Replace your existing note?
              </h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              You have already written text in your note. Using this message will replace what you typed.
            </p>
            <div className="p-3 bg-stone-50 rounded-xl text-xs text-stone-700 italic border border-stone-200 line-clamp-3">
              &ldquo;{pendingInspiration}&rdquo;
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingInspiration(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
              >
                Keep my note
              </button>
              <button
                type="button"
                onClick={() => applyInspirationText(pendingInspiration)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition cursor-pointer"
              >
                Use this message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HANDWRITING STYLE SELECTION SHEET */}
      <Sheet
        isOpen={isFontSheetOpen}
        onClose={() => setIsFontSheetOpen(false)}
        title="Handwriting"
        description="Choose how your note looks."
      >
        <div className="space-y-3">
          {HANDWRITING_STYLES.map((style) => {
            const isSelected = fontStyleId === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => {
                  onChangeFontStyleId(style.id);
                  setIsFontSheetOpen(false);
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-600/20 shadow-xs"
                    : "bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-stone-900">
                    {style.name}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                <p className={`text-base text-stone-800 my-1 truncate ${style.fontClass}`}>
                  {style.sample}
                </p>

                <p className="text-[11px] text-stone-500 mt-0.5">
                  {style.description}
                </p>
              </button>
            );
          })}
        </div>
      </Sheet>

      {/* MOBILE CARD PREVIEW SHEET */}
      <Sheet
        isOpen={isPreviewCardOpen}
        onClose={() => setIsPreviewCardOpen(false)}
        title="Card Preview"
        description={cardTitle || "Folded Greeting Card"}
      >
        <div className="py-2">
          <CardPreview
            coverUrl={cardUrl || ""}
            printedGreeting={salutation}
            handwrittenNote={[bodyNote, signOff].filter(Boolean).join("\n\n")}
            fontStyleId={fontStyleId}
            occasion={occasion}
            currentStep={2}
          />
        </div>
      </Sheet>

      {/* DESKTOP ADVANCE BAR */}
      <div className="hidden md:flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 text-stone-600 hover:text-stone-900 text-sm font-semibold flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>← Back to card</span>
        </button>

        <button
          type="button"
          onClick={onContinue}
          className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <span>Add mailing address →</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* MOBILE STICKY BOTTOM ACTION BAR */}
      {!hideFixedActionBar && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/90 p-3 shadow-lg flex items-center justify-between gap-3 safe-area-inset-bottom">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 text-stone-600 hover:text-stone-900 text-xs font-semibold flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Card</span>
          </button>

          <div className="text-center">
            <span className="text-[11px] font-mono text-stone-500">
              {charCount}/{MAX_CHARS}
            </span>
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>Add mailing address →</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
