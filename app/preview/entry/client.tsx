"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { CARD_PRESETS, OCCASIONS, CardPreset } from "@/lib/card-presets";
import { useDraft, AddressDraft } from "@/lib/draft";
import {
  FlowHeader,
  ProgressIndicator,
  ActionBar,
  EntryCardStep,
  FlowStep,
} from "@/components/flow";
import { Step2NoteComposition, HANDWRITING_STYLES } from "@/components/v3/Step2NoteComposition";
import { Step3EnvelopeAddressing, AddressData } from "@/components/v3/Step3EnvelopeAddressing";
import { Step4ReviewAndPayment, AppliedDiscountInfo } from "@/components/v3/Step4ReviewAndPayment";
import { Step5Confirmation } from "@/components/v3/Step5Confirmation";
import { CustomAiCommissionDrawer } from "@/components/v3/CustomAiCommissionDrawer";
import { evaluateCheckoutInitTransition } from "@/lib/payment-mode";
import { extractRecipientName, extractSenderName } from "@/components/v3/TargetPurchaseExperience";
import { trackEvent } from "@/lib/telemetry";
import {
  trackGA4ViewItem,
  trackGA4BeginCheckout,
  trackGA4AddShippingInfo,
  trackGA4AddPaymentInfo,
} from "@/lib/google-ads";
import {
  trackMetaViewContent,
  trackMetaAddToCart,
  trackMetaCustomizeProduct,
  trackMetaInitiateCheckout,
  trackMetaAddPaymentInfo,
} from "@/lib/meta-ads";
import { getStoredAttribution } from "@/components/AttributionTracker";
import { useAuth } from "@/context/AuthContext";
import { AlertCircle } from "lucide-react";

export function EntryPrototypeClient() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const occasionParam = searchParams.get("occasion") || undefined;
  const presetParam = searchParams.get("preset") || undefined;

  // Resolve contextual preselection if specified
  const initialPreset = useMemo(() => {
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
    experienceVersion: "candidate_v1",
    initialPresetId: initialPreset?.id,
    initialPresetTitle: initialPreset?.title,
    initialPresetUrl: initialPreset?.imageUrl,
  });

  // Current active step
  const [step, setStep] = useState<FlowStep>("card");
  const [isOrderConfirmed, setIsOrderConfirmed] = useState(false);

  // Custom AI drawer state
  const [isCustomAiOpen, setIsCustomAiOpen] = useState(false);

  // Salutation and signoff helper state (for note step auto-sync)
  const [salutation, setSalutation] = useState("Dear Eleanor,");
  const [signOff, setSignOff] = useState("Warmly, Thomas");

  // Address editing state (bridged with draft)
  const [recipient, setRecipient] = useState<AddressData>({
    fullName: "Eleanor Vance",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
  });

  const [sender, setSender] = useState<AddressData>({
    fullName: "Thomas Miller",
    street1: "",
    city: "",
    state: "",
    zip: "",
  });

  const [userCustomizedRecipientName, setUserCustomizedRecipientName] = useState(false);
  const [userCustomizedSenderName, setUserCustomizedSenderName] = useState(false);

  // Payment & checkout state
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [isMockCheckout, setIsMockCheckout] = useState(false);
  const [isFreeOrder, setIsFreeOrder] = useState(false);
  const [amountInCents, setAmountInCents] = useState(900);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscountInfo | null>(null);
  const [checkoutInitError, setCheckoutInitError] = useState<string | null>(null);
  const [isInitializingCheckout, setIsInitializingCheckout] = useState(false);

  // Pre-fill user email if authenticated
  useEffect(() => {
    if (user?.email && !customerEmail) {
      setCustomerEmail(user.email);
    }
  }, [user, customerEmail]);

  // Sync draft to local state once loaded
  useEffect(() => {
    if (!isLoaded) return;

    if (!draft.selectedDesign && initialPreset) {
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

    if (draft.recipient) {
      setRecipient({
        fullName: draft.recipient.name || "Eleanor Vance",
        street1: draft.recipient.addressLine1 || "",
        street2: draft.recipient.addressLine2 || "",
        city: draft.recipient.city || "",
        state: draft.recipient.state || "",
        zip: draft.recipient.zip || "",
      });
    }

    if (draft.sender) {
      setSender({
        fullName: draft.sender.name || "Thomas Miller",
        street1: draft.sender.addressLine1 || "",
        city: draft.sender.city || "",
        state: draft.sender.state || "",
        zip: draft.sender.zip || "",
      });
    }
  }, [isLoaded, draft.selectedDesign, draft.recipient, draft.sender, initialPreset, dispatch]);

  // Telemetry on initial load
  useEffect(() => {
    trackEvent("session_start", 1, { experience: "candidate_v1" });
    trackGA4ViewItem({
      itemId: CARD_PRESETS[0].id,
      itemName: CARD_PRESETS[0].title,
      price: 9.0,
      itemCategory: CARD_PRESETS[0].occasion,
    });
    trackMetaViewContent({
      contentId: CARD_PRESETS[0].id,
      contentName: CARD_PRESETS[0].title,
      contentCategory: CARD_PRESETS[0].occasion,
      value: 9.0,
    });
  }, []);

  // Current selected card details
  const currentCard = useMemo(() => {
    if (draft.selectedDesign) {
      return {
        imageUrl: draft.selectedDesign.imageUrl,
        title: draft.selectedDesign.title,
        presetId: draft.selectedDesign.presetId,
        occasion: occasionParam || CARD_PRESETS[0].occasion,
      };
    }
    return {
      imageUrl: CARD_PRESETS[0].imageUrl,
      title: CARD_PRESETS[0].title,
      presetId: CARD_PRESETS[0].id,
      occasion: CARD_PRESETS[0].occasion,
    };
  }, [draft.selectedDesign, occasionParam]);

  // Active handwriting font
  const activeFont = useMemo(() => {
    const styleId = draft.note.style || "hwDavid";
    return HANDWRITING_STYLES.find((f) => f.id === styleId) || HANDWRITING_STYLES[0];
  }, [draft.note.style]);

  // Handle card selection from grid
  const handleSelectPreset = (preset: CardPreset) => {
    dispatch({
      type: "SELECT_DESIGN",
      payload: {
        presetId: preset.id,
        imageUrl: preset.imageUrl,
        title: preset.title,
        source: "preset",
        accepted: false,
      },
    });

    trackEvent("cover_preset_selected", 1, {
      presetId: preset.id,
      title: preset.title,
      occasion: preset.occasion,
    });
  };

  // Handle Custom AI generation selection
  const handleSelectCustomCover = (art: { imageUrl: string; prompt: string; occasion: string }) => {
    dispatch({
      type: "SELECT_DESIGN",
      payload: {
        imageUrl: art.imageUrl,
        title: `Custom: ${art.prompt.slice(0, 30)}...`,
        source: "custom",
        accepted: true,
      },
    });

    trackMetaCustomizeProduct({
      customizationType: "AI Art Generated",
      occasion: art.occasion,
      contentName: `Custom: ${art.prompt.slice(0, 30)}`,
    });
  };

  // Auto-sync Salutation -> Recipient Full Name
  const handleSalutationChange = (newSalutation: string) => {
    setSalutation(newSalutation);
    if (!userCustomizedRecipientName) {
      const extracted = extractRecipientName(newSalutation);
      if (extracted) {
        setRecipient((prev) => ({ ...prev, fullName: extracted }));
        dispatch({
          type: "UPDATE_RECIPIENT",
          payload: {
            name: extracted,
            addressLine1: recipient.street1,
            addressLine2: recipient.street2,
            city: recipient.city,
            state: recipient.state,
            zip: recipient.zip,
          },
        });
      }
    }
  };

  // Auto-sync Sign-Off -> Sender Full Name
  const handleSignOffChange = (newSignOff: string) => {
    setSignOff(newSignOff);
    if (!userCustomizedSenderName) {
      const extracted = extractSenderName(newSignOff);
      if (extracted) {
        setSender((prev) => ({ ...prev, fullName: extracted }));
        dispatch({
          type: "UPDATE_SENDER",
          payload: {
            name: extracted,
            addressLine1: sender.street1,
            city: sender.city,
            state: sender.state,
            zip: sender.zip,
          },
        });
      }
    }
  };

  // Handle note body change
  const handleBodyNoteChange = (newText: string) => {
    dispatch({
      type: "UPDATE_NOTE",
      payload: { text: newText },
    });
    trackEvent("inside_note_edited", 2, {
      charCount: newText.length,
      hasContent: newText.trim().length > 0,
    });
  };

  // Handle handwriting style change
  const handleFontStyleChange = (newFontId: string) => {
    dispatch({
      type: "UPDATE_NOTE",
      payload: { style: newFontId },
    });
    trackEvent("font_style_selected", 2, { fontId: newFontId });
  };

  // Handle recipient address updates
  const handleUpdateRecipient = (field: keyof AddressData, value: string) => {
    if (field === "fullName") {
      setUserCustomizedRecipientName(true);
    }
    const updated = { ...recipient, [field]: value };
    setRecipient(updated);

    const mapped: AddressDraft = {
      name: updated.fullName,
      addressLine1: updated.street1,
      addressLine2: updated.street2,
      city: updated.city,
      state: updated.state,
      zip: updated.zip,
      country: "USA",
    };
    dispatch({ type: "UPDATE_RECIPIENT", payload: mapped });
  };

  // Handle sender address updates
  const handleUpdateSender = (field: keyof AddressData, value: string) => {
    if (field === "fullName") {
      setUserCustomizedSenderName(true);
    }
    const updated = { ...sender, [field]: value };
    setSender(updated);

    const mapped: AddressDraft = {
      name: updated.fullName,
      addressLine1: updated.street1,
      city: updated.city,
      state: updated.state,
      zip: updated.zip,
      country: "USA",
    };
    dispatch({ type: "UPDATE_SENDER", payload: mapped });
  };

  // Navigation handlers
  const handleStepTransition = (nextStep: FlowStep) => {
    if (nextStep === "note") {
      if (!draft.selectedDesign) {
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
        dispatch({ type: "ACCEPT_DESIGN" });
      }

      // Default body note if empty
      if (!draft.note.text.trim()) {
        const defaultNote =
          initialPreset?.defaultHandwrittenNote || CARD_PRESETS[0].defaultHandwrittenNote;
        dispatch({ type: "UPDATE_NOTE", payload: { text: defaultNote } });
      }

      trackEvent("card_completed", 1, {
        presetId: draft.selectedDesign?.presetId,
        cardType: draft.selectedDesign?.source || "preset",
      });
      trackMetaAddToCart({
        contentId: currentCard.presetId || "card",
        contentName: currentCard.title,
        value: 9.0,
      });
    } else if (nextStep === "address") {
      trackEvent("note_completed", 2, {
        charCount: draft.note.text.length,
        fontId: draft.note.style || "hwDavid",
      });
      trackGA4BeginCheckout({
        itemId: currentCard.presetId || "card",
        itemName: currentCard.title,
        price: 9.0,
      });
      trackMetaInitiateCheckout({
        contentName: currentCard.title,
        value: 9.0,
      });
    }

    setStep(nextStep);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Initialize PaymentIntent when advancing from address to pay
  const initializeCheckout = async (overrideDiscountCode?: string) => {
    setCheckoutInitError(null);
    setIsInitializingCheckout(true);

    try {
      const fullHandwrittenMessage = [salutation, draft.note.text, signOff]
        .filter(Boolean)
        .join("\n\n");

      const recParts = recipient.fullName.trim().split(/\s+/);
      const recipientFirstName = recParts[0] || "Friend";
      const recipientLastName = recParts.slice(1).join(" ") || "";

      const senderParts = sender.fullName.trim().split(/\s+/);
      const senderFirstName = senderParts[0] || "Friend";
      const senderLastName = senderParts.slice(1).join(" ") || "";

      const discountCodeToUse =
        overrideDiscountCode !== undefined
          ? overrideDiscountCode
          : appliedDiscount?.code;

      const res = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: currentCard.occasion,
          frontImageUrl: currentCard.imageUrl,
          printedMessage: "",
          handwrittenNote: fullHandwrittenMessage,
          fontStyleId: draft.note.style || "hwDavid",
          recipientAddress: {
            firstName: recipientFirstName,
            lastName: recipientLastName,
            street1: recipient.street1,
            street2: recipient.street2 || undefined,
            city: recipient.city,
            state: recipient.state,
            zip: recipient.zip,
            country: "USA",
          },
          returnAddress: {
            firstName: senderFirstName,
            lastName: senderLastName,
            street1: sender.street1,
            city: sender.city,
            state: sender.state,
            zip: sender.zip,
            country: "USA",
          },
          customerEmail,
          userId: user?.uid,
          discountCode: discountCodeToUse,
          attribution: getStoredAttribution() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initialize payment gateway.");
      }

      const decision = evaluateCheckoutInitTransition(true);
      if (!decision.canAdvance) {
        throw new Error(decision.errorMessage || "Unable to proceed to payment.");
      }

      setOrderId(data.orderId);
      setClientSecret(data.clientSecret);
      if (data.publishableKey) {
        setPublishableKey(data.publishableKey);
      }
      setIsMockCheckout(Boolean(data.isMock));
      setIsFreeOrder(Boolean(data.isFree));
      setAmountInCents(data.finalAmountInCents ?? data.amountInCents ?? 900);
      setCheckoutInitError(null);

      trackEvent("address_completed", 3, {
        hasReturnAddress: Boolean(sender.street1 && sender.city),
      });
      trackGA4AddShippingInfo({
        itemId: currentCard.presetId || "card",
        itemName: currentCard.title,
        price: 9.0,
        shippingTier: "USPS First Class",
      });
      trackGA4AddPaymentInfo({
        itemId: currentCard.presetId || "card",
        itemName: currentCard.title,
        price: 9.0,
        paymentType: "card",
      });
      trackMetaAddPaymentInfo({
        contentName: currentCard.title,
        value: 9.0,
        paymentType: "card",
      });

      setStep("pay");
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to connect to payment processor. Please try again.";
      console.warn("Notice initializing checkout intent:", msg);
      evaluateCheckoutInitTransition(false);
      setCheckoutInitError(msg);
    } finally {
      setIsInitializingCheckout(false);
    }
  };

  // Promo code validation
  const handleApplyDiscount = async (code: string) => {
    try {
      const res = await fetch("/api/discount/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        return { success: false, error: data.error || "Invalid promo code." };
      }

      setAppliedDiscount(data);
      setIsFreeOrder(Boolean(data.isFree));
      setAmountInCents(data.finalAmountInCents ?? 900);
      dispatch({ type: "SET_DISCOUNT_CODE", payload: data.code });

      await initializeCheckout(data.code);
      return { success: true };
    } catch {
      return { success: false, error: "Unable to apply promo code." };
    }
  };

  const handleRemoveDiscount = async () => {
    setAppliedDiscount(null);
    setIsFreeOrder(false);
    setAmountInCents(900);
    dispatch({ type: "SET_DISCOUNT_CODE", payload: null });
    await initializeCheckout("");
  };

  // Payment success handler
  const handlePaymentSuccess = (completedOrderId: string) => {
    setOrderId(completedOrderId);
    setIsOrderConfirmed(true);
    trackEvent("payment_succeeded", 4, { orderId: completedOrderId });
  };

  // Send another card handler
  const handleSendAnotherCard = () => {
    clearDraft();
    setIsOrderConfirmed(false);
    setStep("card");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Check if address is valid for advancing
  const isAddressValid = Boolean(
    recipient.fullName.trim() &&
      recipient.street1.trim() &&
      recipient.city.trim() &&
      recipient.state.trim() &&
      recipient.zip.trim().length >= 5 &&
      sender.fullName.trim() &&
      sender.street1.trim() &&
      sender.city.trim() &&
      sender.state.trim() &&
      sender.zip.trim().length >= 5
  );

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

  // Render Post-Purchase Confirmation (Step 5)
  if (isOrderConfirmed) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col antialiased">
        <FlowHeader showClearDraft={false} onClearDraft={clearDraft} />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
          <Step5Confirmation
            orderId={orderId}
            cardTitle={currentCard.title}
            cardUrl={currentCard.imageUrl}
            occasion={currentCard.occasion}
            salutation={salutation}
            bodyNote={draft.note.text}
            signOff={signOff}
            fontClass={activeFont.fontClass}
            recipient={recipient}
            sender={sender}
            customerEmail={customerEmail}
            amountInCents={amountInCents}
            onSendAnotherCard={handleSendAnotherCard}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-stone-900 flex flex-col antialiased">
      {/* 1. COMPACT SENDMYNOTES FLOW HEADER */}
      <FlowHeader showClearDraft={true} onClearDraft={clearDraft} />

      {/* 2. PROGRESS INDICATOR: CARD / NOTE / ADDRESS / PAY */}
      <ProgressIndicator currentStep={step} />

      {/* 3. STEP CONTENT */}
      <main className="flex-1 w-full">
        {step === "card" && (
          <EntryCardStep
            selectedDesign={draft.selectedDesign}
            onSelectDesign={handleSelectPreset}
            onAcceptAndContinue={() => handleStepTransition("note")}
            initialOccasion={occasionParam}
            onOpenCustomArt={() => setIsCustomAiOpen(true)}
          />
        )}

        {step === "note" && (
          <div className="max-w-4xl mx-auto px-4 py-6 pb-32">
            <Step2NoteComposition
              salutation={salutation}
              onChangeSalutation={handleSalutationChange}
              bodyNote={draft.note.text}
              onChangeBodyNote={handleBodyNoteChange}
              signOff={signOff}
              onChangeSignOff={handleSignOffChange}
              fontStyleId={draft.note.style || "hwDavid"}
              onChangeFontStyleId={handleFontStyleChange}
              occasion={currentCard.occasion}
              onBack={() => setStep("card")}
              onContinue={() => handleStepTransition("address")}
            />
          </div>
        )}

        {step === "address" && (
          <div className="max-w-4xl mx-auto px-4 py-6 pb-32 space-y-4">
            {checkoutInitError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-4 text-xs text-rose-900 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{checkoutInitError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => initializeCheckout()}
                  disabled={isInitializingCheckout}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-semibold rounded-lg text-xs transition cursor-pointer shrink-0"
                >
                  {isInitializingCheckout ? "Connecting..." : "Retry"}
                </button>
              </div>
            )}
            <Step3EnvelopeAddressing
              recipient={recipient}
              onChangeRecipient={handleUpdateRecipient}
              sender={sender}
              onChangeSender={handleUpdateSender}
              fontClass={activeFont.fontClass}
              onBack={() => setStep("note")}
              onContinue={() => initializeCheckout()}
            />
          </div>
        )}

        {step === "pay" && (
          <div className="max-w-4xl mx-auto px-4 py-6 pb-32">
            <Step4ReviewAndPayment
              cardTitle={currentCard.title}
              cardUrl={currentCard.imageUrl}
              salutation={salutation}
              bodyNote={draft.note.text}
              signOff={signOff}
              fontClass={activeFont.fontClass}
              recipient={recipient}
              sender={sender}
              customerEmail={customerEmail}
              onChangeCustomerEmail={setCustomerEmail}
              orderId={orderId}
              clientSecret={clientSecret}
              publishableKey={publishableKey}
              isMock={isMockCheckout}
              isFree={isFreeOrder}
              onApplyDiscount={handleApplyDiscount}
              onRemoveDiscount={handleRemoveDiscount}
              appliedDiscount={appliedDiscount}
              onPaymentSuccess={handlePaymentSuccess}
              onBack={() => setStep("address")}
            />
          </div>
        )}
      </main>

      {/* 4. PERSISTENT BOTTOM ACTION BAR (Steps 1 to 3) */}
      {step !== "pay" && (
        <ActionBar
          priceDisplay="$9 total"
          priceSubtext="USPS mailing included"
          primaryLabel={
            step === "card"
              ? "Write your note"
              : step === "note"
              ? "Next: Address"
              : "Next: Review & Pay"
          }
          isLoading={isInitializingCheckout}
          isDisabled={
            (step === "note" && !draft.note.text.trim()) ||
            (step === "address" && !isAddressValid)
          }
          onPrimaryClick={() => {
            if (step === "card") {
              handleStepTransition("note");
            } else if (step === "note") {
              handleStepTransition("address");
            } else if (step === "address") {
              initializeCheckout();
            }
          }}
          secondaryAction={
            step !== "card" ? (
              <button
                type="button"
                onClick={() => {
                  if (step === "note") setStep("card");
                  if (step === "address") setStep("note");
                }}
                className="text-xs text-stone-600 hover:text-stone-900 font-medium px-3 py-2 rounded-lg hover:bg-stone-100 transition cursor-pointer"
              >
                {step === "note" ? "Change card" : "Edit note"}
              </button>
            ) : undefined
          }
        />
      )}

      {/* 5. CUSTOM AI COMMISSION DRAWER */}
      <CustomAiCommissionDrawer
        isOpen={isCustomAiOpen}
        onClose={() => setIsCustomAiOpen(false)}
        onSelectCover={handleSelectCustomCover}
        currentOccasion={currentCard.occasion}
      />
    </div>
  );
}
