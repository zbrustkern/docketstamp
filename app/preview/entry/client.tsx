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
import { trackEvent, getSessionId } from "@/lib/telemetry";
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

export interface EntryPrototypeClientProps {
  initialOccasion?: string;
  initialPresetId?: string;
  scenarioSlug?: string;
}

export function EntryPrototypeClient({
  initialOccasion,
  initialPresetId,
  scenarioSlug,
}: EntryPrototypeClientProps = {}) {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const occasionParam = initialOccasion || searchParams?.get("occasion") || undefined;
  const presetParam = initialPresetId || searchParams?.get("preset") || undefined;

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
  const [salutation, setSalutation] = useState("");
  const [signOff, setSignOff] = useState("");

  // Address editing state (bridged with draft)
  const [recipient, setRecipient] = useState<AddressData>({
    fullName: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
  });

  const [sender, setSender] = useState<AddressData>({
    fullName: "",
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
  const [viewToken, setViewToken] = useState<string | null>(null);
  const [fulfillmentStatus, setFulfillmentStatus] = useState<string | null>(null);
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

  // Sync draft to local state once loaded and verify any completed order server-side
  useEffect(() => {
    if (!isLoaded) return;

    if (draft.completed) {
      // Recover checkout identity from storage and verify with server
      const savedOrderId =
        (typeof window !== "undefined"
          ? sessionStorage.getItem("smn_completed_order_id") ||
            sessionStorage.getItem("smn_checkout_order_id")
          : null) || "";
      const savedViewToken =
        (typeof window !== "undefined"
          ? sessionStorage.getItem("smn_completed_view_token") ||
            (savedOrderId ? sessionStorage.getItem(`order_token_${savedOrderId}`) : null)
          : null) || null;

      if (savedOrderId) {
        setOrderId(savedOrderId);
        if (savedViewToken) setViewToken(savedViewToken);

        // Verify order on server before presenting confirmation
        fetch(`/api/orders/${savedOrderId}${savedViewToken ? `?token=${encodeURIComponent(savedViewToken)}` : ""}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.order && data.order.status !== "PENDING_PAYMENT") {
              setFulfillmentStatus(data.order.status);
              setIsOrderConfirmed(true);
            } else {
              // Not paid on server — never treat a client completed bit as proof of payment!
              setIsOrderConfirmed(false);
              dispatch({ type: "SET_STEP", payload: "pay" });
              setStep("pay");
            }
          })
          .catch(() => {
            setIsOrderConfirmed(false);
          });
      } else {
        // No order identity found — do not certify completed
        setIsOrderConfirmed(false);
      }
    } else if (draft.currentStep && draft.currentStep !== "confirmation") {
      setStep(draft.currentStep as FlowStep);
    }

    if (!draft.selectedDesign && initialPreset) {
      dispatch({
        type: "SELECT_DESIGN",
        payload: {
          presetId: initialPreset.id,
          imageUrl: initialPreset.imageUrl,
          title: initialPreset.title,
          occasion: initialPreset.occasion,
          source: "preset",
          accepted: false,
        },
      });
    }

    if (draft.note.salutation !== undefined && draft.note.salutation !== "") {
      setSalutation(draft.note.salutation);
    }
    if (draft.note.signOff !== undefined && draft.note.signOff !== "") {
      setSignOff(draft.note.signOff);
    }

    if (draft.recipient) {
      setRecipient({
        fullName: draft.recipient.name || "",
        street1: draft.recipient.addressLine1 || "",
        street2: draft.recipient.addressLine2 || "",
        city: draft.recipient.city || "",
        state: draft.recipient.state || "",
        zip: draft.recipient.zip || "",
      });
      if (draft.recipient.name) {
        setUserCustomizedRecipientName(true);
      }
    }

    if (draft.sender) {
      setSender({
        fullName: draft.sender.name || "",
        street1: draft.sender.addressLine1 || "",
        city: draft.sender.city || "",
        state: draft.sender.state || "",
        zip: draft.sender.zip || "",
      });
      if (draft.sender.name) {
        setUserCustomizedSenderName(true);
      }
    }
  }, [
    isLoaded,
    draft.completed,
    draft.currentStep,
    draft.selectedDesign,
    draft.note.salutation,
    draft.note.signOff,
    draft.recipient,
    draft.sender,
    initialPreset,
    dispatch,
  ]);

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
      const presetMatch = CARD_PRESETS.find((p) => p.id === draft.selectedDesign?.presetId);
      const occasion =
        draft.selectedDesign.occasion ||
        presetMatch?.occasion ||
        (draft.selectedDesign.source === "preset"
          ? CARD_PRESETS.find((p) => p.title === draft.selectedDesign?.title)?.occasion
          : undefined) ||
        occasionParam ||
        CARD_PRESETS[0].occasion;

      return {
        imageUrl: draft.selectedDesign.imageUrl,
        title: draft.selectedDesign.title,
        presetId: draft.selectedDesign.presetId,
        occasion,
      };
    }
    const defaultPreset = initialPreset || CARD_PRESETS[0];
    return {
      imageUrl: defaultPreset.imageUrl,
      title: defaultPreset.title,
      presetId: defaultPreset.id,
      occasion: defaultPreset.occasion,
    };
  }, [draft.selectedDesign, initialPreset, occasionParam]);

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
        occasion: preset.occasion,
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

  // Handle Custom AI generation selection (Finding 8: never transmit customer prompt to Meta)
  const handleSelectCustomCover = (art: { imageUrl: string; prompt: string; occasion: string }) => {
    dispatch({
      type: "SELECT_DESIGN",
      payload: {
        imageUrl: art.imageUrl,
        title: "Custom Artwork Card",
        occasion: art.occasion,
        source: "custom",
        accepted: true,
      },
    });

    trackMetaCustomizeProduct({
      customizationType: "AI Art Generated",
      occasion: art.occasion,
      contentName: "Custom Artwork Card",
    });
  };

  // Auto-sync Salutation -> Recipient Full Name and persist to draft
  const handleSalutationChange = (newSalutation: string) => {
    setSalutation(newSalutation);
    dispatch({ type: "UPDATE_NOTE", payload: { salutation: newSalutation } });
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

  // Auto-sync Sign-Off -> Sender Full Name and persist to draft
  const handleSignOffChange = (newSignOff: string) => {
    setSignOff(newSignOff);
    dispatch({ type: "UPDATE_NOTE", payload: { signOff: newSignOff } });
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
        const fallback = initialPreset || CARD_PRESETS[0];
        dispatch({
          type: "SELECT_DESIGN",
          payload: {
            presetId: fallback.id,
            imageUrl: fallback.imageUrl,
            title: fallback.title,
            occasion: fallback.occasion,
            source: "preset",
            accepted: true,
          },
        });
      } else {
        dispatch({ type: "ACCEPT_DESIGN" });
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
    dispatch({ type: "SET_STEP", payload: nextStep });
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
          sessionId: getSessionId(),
          experienceVersion: draft.experienceVersion || "candidate_v1",
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
      if (data.viewToken) {
        setViewToken(data.viewToken);
      }
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("smn_checkout_order_id", data.orderId);
          if (data.viewToken) {
            sessionStorage.setItem("smn_checkout_view_token", data.viewToken);
            sessionStorage.setItem(`order_token_${data.orderId}`, data.viewToken);
          }
        } catch {
          // ignore
        }
      }
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

      setStep("pay");
      dispatch({ type: "SET_STEP", payload: "pay" });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      let msg =
        err instanceof Error
          ? err.message
          : "Unable to connect to payment processor. Please try again.";
      if (
        msg.includes("configured in production") ||
        msg.includes("secret key") ||
        msg.includes("Stripe live") ||
        msg.includes("Stripe test")
      ) {
        msg =
          "We are temporarily experiencing difficulty connecting to our secure payment gateway. Our studio team has been notified. Please retry in a moment.";
      }
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

  // Payment success handler (server records verified telemetry)
  const handlePaymentSuccess = (
    completedOrderId: string,
    returnedViewToken?: string | null,
    status?: string | null
  ) => {
    setOrderId(completedOrderId);
    const finalToken = returnedViewToken || viewToken;
    if (finalToken) {
      setViewToken(finalToken);
    }
    if (status) {
      setFulfillmentStatus(status);
    }
    setIsOrderConfirmed(true);
    dispatch({ type: "MARK_COMPLETED" });

    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("smn_completed_order_id", completedOrderId);
        if (finalToken) {
          sessionStorage.setItem("smn_completed_view_token", finalToken);
          sessionStorage.setItem(`order_token_${completedOrderId}`, finalToken);
        }
      } catch {
        // ignore
      }
    }
  };

  // Reset entire flow handler for "Clear draft" and "Send another card"
  const resetEntireFlow = () => {
    clearDraft();
    setIsOrderConfirmed(false);
    setStep("card");
    setSalutation("");
    setSignOff("");
    setRecipient({
      fullName: "",
      street1: "",
      street2: "",
      city: "",
      state: "",
      zip: "",
    });
    setSender({
      fullName: "",
      street1: "",
      city: "",
      state: "",
      zip: "",
    });
    setUserCustomizedRecipientName(false);
    setUserCustomizedSenderName(false);
    setOrderId("");
    setViewToken(null);
    setFulfillmentStatus(null);
    setClientSecret(null);
    setPublishableKey(null);
    setIsMockCheckout(false);
    setIsFreeOrder(false);
    setAmountInCents(900);
    setAppliedDiscount(null);
    setCheckoutInitError(null);

    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("smn_checkout_order_id");
        sessionStorage.removeItem("smn_checkout_view_token");
        sessionStorage.removeItem("smn_completed_order_id");
        sessionStorage.removeItem("smn_completed_view_token");
      } catch {
        // ignore
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Auto-resume checkout intent on pay-step refresh if not already initialized
  useEffect(() => {
    if (
      isLoaded &&
      step === "pay" &&
      !clientSecret &&
      !isInitializingCheckout &&
      !checkoutInitError &&
      !isOrderConfirmed
    ) {
      initializeCheckout();
    }
  }, [isLoaded, step, clientSecret, isInitializingCheckout, checkoutInitError, isOrderConfirmed]);

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
        <FlowHeader showClearDraft={false} onClearDraft={resetEntireFlow} />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
          <Step5Confirmation
            orderId={orderId}
            viewToken={viewToken}
            fulfillmentStatus={fulfillmentStatus || undefined}
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
            onSendAnotherCard={resetEntireFlow}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-stone-900 flex flex-col antialiased">
      {/* 1. COMPACT SENDMYNOTES FLOW HEADER */}
      <FlowHeader showClearDraft={true} onClearDraft={resetEntireFlow} />

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
              hideFixedActionBar={true}
              salutation={salutation}
              onChangeSalutation={handleSalutationChange}
              bodyNote={draft.note.text}
              onChangeBodyNote={handleBodyNoteChange}
              signOff={signOff}
              onChangeSignOff={handleSignOffChange}
              fontStyleId={draft.note.style || "hwDavid"}
              onChangeFontStyleId={handleFontStyleChange}
              occasion={currentCard.occasion}
              onBack={() => {
                setStep("card");
                dispatch({ type: "SET_STEP", payload: "card" });
              }}
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
              hideFixedActionBar={true}
              recipient={recipient}
              onChangeRecipient={handleUpdateRecipient}
              sender={sender}
              onChangeSender={handleUpdateSender}
              fontClass={activeFont.fontClass}
              onBack={() => {
                setStep("note");
                dispatch({ type: "SET_STEP", payload: "note" });
              }}
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
              onBack={() => {
                setStep("address");
                dispatch({ type: "SET_STEP", payload: "address" });
              }}
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
                  if (step === "note") {
                    setStep("card");
                    dispatch({ type: "SET_STEP", payload: "card" });
                  }
                  if (step === "address") {
                    setStep("note");
                    dispatch({ type: "SET_STEP", payload: "note" });
                  }
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
