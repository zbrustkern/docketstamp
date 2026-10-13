import { CARD_PRESETS, CardPreset } from "./card-presets";
import { optimizeCoverImage } from "./image-optimizer";
import { PRODUCT_FORMAT } from "./product-facts";

export type GenerateArtResultKind =
  | "success"
  | "policy_refusal"
  | "provider_unavailable"
  | "auth_error"
  | "unexpected_error";

export interface GenerateCoverParams {
  prompt: string;
  occasion?: string;
}

export interface GenerateCoverResult {
  kind: GenerateArtResultKind;
  imageUrl?: string;
  prompt: string;
  occasion: string;
  isMock: boolean;
  aspectRatio: string;
  provider?: string;
  model?: string;
  error?: string;
  userMessage?: string;
  refusalDetails?: {
    blockReason?: string;
    finishReason?: string;
    suggestion?: string;
  };
  presetRecommendation?: CardPreset;
}

export type ProviderResultKind =
  | "success"
  | "policy_refusal"
  | "auth_error"
  | "model_not_found"
  | "provider_unavailable"
  | "unexpected_error";

export interface ParsedProviderResult {
  kind: ProviderResultKind;
  imageDataUrl?: string;
  finishReason?: string;
  blockReason?: string;
  errorMessage?: string;
  statusCode: number;
}

/**
 * Universal extractor for image data returned by Google GenAI APIs
 * Handles Interactions API, generateContent, and prediction response shapes.
 */
export function extractImageDataUrl(data: any): string | null {
  if (!data) return null;

  // 1. Direct output_image / outputImage in modern Interactions API
  const directImage = data.output_image || data.outputImage;
  if (directImage?.data) {
    const mime = directImage.mime_type || directImage.mimeType || "image/jpeg";
    return `data:${mime};base64,${directImage.data}`;
  }

  // 2. Steps in Interactions API
  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      // Check direct image on step
      const directStepImg = step.image_content || step.imageContent || step.image;
      if (directStepImg?.data) {
        const mime = directStepImg.mime_type || directStepImg.mimeType || "image/jpeg";
        return `data:${mime};base64,${directStepImg.data}`;
      }
      if (step.data && typeof step.data === "string") {
        const mime = step.mime_type || step.mimeType || "image/jpeg";
        return `data:${mime};base64,${step.data}`;
      }

      // Check step contents
      const contentList =
        step.content || step.model_output?.content || step.modelOutputStep?.content;
      if (Array.isArray(contentList)) {
        for (const item of contentList) {
          const imgObj =
            item.image_content || item.imageContent || (item.type === "image" ? item : null);
          const base64 = imgObj?.data || item.data;
          if (base64) {
            const mime = imgObj?.mime_type || imgObj?.mimeType || item.mime_type || "image/jpeg";
            return `data:${mime};base64,${base64}`;
          }
        }
      }
    }
  }

  // 3. Outputs array in Interactions API
  if (Array.isArray(data.outputs)) {
    for (const out of data.outputs) {
      const base64 = out.data || out.image?.data;
      if (base64) {
        const mime = out.mime_type || out.mimeType || "image/jpeg";
        return `data:${mime};base64,${base64}`;
      }
    }
  }

  // 4. GenerateContent candidates parts with inlineData
  if (Array.isArray(data.candidates)) {
    for (const candidate of data.candidates) {
      const parts = candidate.content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          const inline = part.inlineData || part.inline_data;
          if (inline?.data) {
            const mime = inline.mimeType || inline.mime_type || "image/jpeg";
            return `data:${mime};base64,${inline.data}`;
          }
        }
      }
    }
  }

  // 5. Predictions in legacy prediction response
  if (Array.isArray(data.predictions)) {
    const pred = data.predictions[0];
    const base64 = pred?.bytesBase64Encoded || pred?.image?.bytesBase64Encoded;
    if (base64) {
      const mime = pred?.mimeType || "image/jpeg";
      return `data:${mime};base64,${base64}`;
    }
  }

  return null;
}

/**
 * Checks if an error string or status represents a content policy / safety refusal.
 */
function isPolicyRefusalText(text: string): boolean {
  return /\b(prohibited content|safety guidelines|safety policy|content policy|safety ratings|blocked content|policy violation|PROHIBITED_CONTENT|SAFETY|BLOCKLIST|SPII|RECITATION)\b/i.test(
    text
  );
}

/**
 * Parses and classifies an Interactions API response.
 */
export function parseInteractionsResponse(
  statusCode: number,
  data: any,
  rawText?: string
): ParsedProviderResult {
  const errMsg =
    data?.error?.message ||
    data?.message ||
    (typeof rawText === "string" ? rawText : "");

  if (statusCode === 200) {
    // 1. Check top-level finish reasons
    const finishReason =
      data?.finishReason || data?.finish_reason || data?.steps?.[0]?.finish_reason;
    if (
      finishReason &&
      ["PROHIBITED_CONTENT", "SAFETY", "BLOCKLIST", "SPII", "RECITATION"].includes(
        finishReason
      )
    ) {
      return {
        kind: "policy_refusal",
        finishReason,
        statusCode: 200,
      };
    }

    // 2. Extract image
    const imageDataUrl = extractImageDataUrl(data);
    if (imageDataUrl) {
      return {
        kind: "success",
        imageDataUrl,
        statusCode: 200,
      };
    }

    // 3. 200 with no image and no explicit finish reason
    return {
      kind: "unexpected_error",
      errorMessage: "Interactions API 200 returned no usable image data.",
      statusCode: 200,
    };
  }

  // HTTP 400: Check if it's a content-policy refusal (e.g. prohibited content guidelines)
  if (statusCode === 400) {
    if (isPolicyRefusalText(errMsg)) {
      return {
        kind: "policy_refusal",
        finishReason: "PROHIBITED_CONTENT",
        errorMessage: errMsg,
        statusCode: 400,
      };
    }
    return {
      kind: "unexpected_error",
      errorMessage: errMsg || "Invalid request (400)",
      statusCode: 400,
    };
  }

  // HTTP 401 or 403: Authentication or permission error
  if (statusCode === 401 || statusCode === 403) {
    if (isPolicyRefusalText(errMsg)) {
      return {
        kind: "policy_refusal",
        finishReason: "PROHIBITED_CONTENT",
        errorMessage: errMsg,
        statusCode,
      };
    }
    return {
      kind: "auth_error",
      errorMessage: errMsg || "Authentication failure",
      statusCode,
    };
  }

  // HTTP 404: Model not found or deprecated
  if (statusCode === 404) {
    return {
      kind: "model_not_found",
      errorMessage: errMsg || "Model not found (404)",
      statusCode: 404,
    };
  }

  // HTTP 429 or 5xx: Transient provider outage or rate limit
  if (statusCode === 429 || statusCode >= 500) {
    return {
      kind: "provider_unavailable",
      errorMessage: errMsg || `Provider service unavailable (${statusCode})`,
      statusCode,
    };
  }

  return {
    kind: "unexpected_error",
    errorMessage: errMsg || `Unexpected provider status ${statusCode}`,
    statusCode,
  };
}

/**
 * Parses and classifies a generateContent API response.
 */
export function parseGenerateContentResponse(
  statusCode: number,
  data: any,
  rawText?: string
): ParsedProviderResult {
  const errMsg =
    data?.error?.message ||
    data?.message ||
    (typeof rawText === "string" ? rawText : "");

  if (statusCode === 200) {
    // 1. Check promptFeedback block reason
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      return {
        kind: "policy_refusal",
        blockReason,
        finishReason: blockReason,
        statusCode: 200,
      };
    }

    // 2. Check candidate finish reason
    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    if (
      finishReason &&
      ["PROHIBITED_CONTENT", "SAFETY", "BLOCKLIST", "SPII", "RECITATION"].includes(
        finishReason
      )
    ) {
      return {
        kind: "policy_refusal",
        finishReason,
        statusCode: 200,
      };
    }

    // 3. Extract image
    const imageDataUrl = extractImageDataUrl(data);
    if (imageDataUrl) {
      return {
        kind: "success",
        imageDataUrl,
        statusCode: 200,
      };
    }

    // 4. 200 with no image
    return {
      kind: "unexpected_error",
      finishReason,
      errorMessage: "generateContent API 200 returned no usable image parts.",
      statusCode: 200,
    };
  }

  if (statusCode === 400) {
    if (isPolicyRefusalText(errMsg)) {
      return {
        kind: "policy_refusal",
        finishReason: "PROHIBITED_CONTENT",
        errorMessage: errMsg,
        statusCode: 400,
      };
    }
    return {
      kind: "unexpected_error",
      errorMessage: errMsg || "Invalid request (400)",
      statusCode: 400,
    };
  }

  if (statusCode === 401 || statusCode === 403) {
    if (isPolicyRefusalText(errMsg)) {
      return {
        kind: "policy_refusal",
        finishReason: "PROHIBITED_CONTENT",
        errorMessage: errMsg,
        statusCode,
      };
    }
    return {
      kind: "auth_error",
      errorMessage: errMsg || "Authentication failure",
      statusCode,
    };
  }

  if (statusCode === 404) {
    return {
      kind: "model_not_found",
      errorMessage: errMsg || "Model not found (404)",
      statusCode: 404,
    };
  }

  if (statusCode === 429 || statusCode >= 500) {
    return {
      kind: "provider_unavailable",
      errorMessage: errMsg || `Provider service unavailable (${statusCode})`,
      statusCode,
    };
  }

  return {
    kind: "unexpected_error",
    errorMessage: errMsg || `Unexpected provider status ${statusCode}`,
    statusCode,
  };
}

/**
 * Strips meta-references to cards, mockups, or paper borders from prompts
 * so the AI model generates the artwork itself rather than a picture of a card.
 */
export function sanitizeArtPrompt(rawPrompt: string): string {
  const cleaned = rawPrompt
    .replace(/\b(5:7\s+)?greeting\s+cards?(\s+cover)?(\s+art|\s+design|\s+portrait)?\b/gi, "")
    .replace(/\b(card\s+cover(\s+art)?|card\s+art|card\s+design|card\s+mockup|card\s+portrait|card\s+illustration)\b/gi, "")
    .replace(/\b(cover\s+art|cover\s+design|cover\s+illustration)\b/gi, "")
    .replace(/\b(?:on|printed on|painted on|drawn on)\s+(?:(?:rough|textured|cream|white|archival|cotton|deckled|watercolor|watercolour)\s+)*(?:paper|cardstock|canvas)\b/gi, "")
    .replace(/\b(?:(?:rough|textured|cream|white|archival|cotton|deckled|watercolor|watercolour)\s+)+(?:paper|cardstock)\b/gi, "")
    .replace(/\b(deckled[- ]edge\s+paper|paper\s+mockup|stationery\s+mockup|stationery\s+set|paper\s+texture|paper\s+grain|paper\s+edges?|paper\s+borders?|folded\s+card|cardstock|embossing|debossing)\b/gi, "")
    .replace(/\b(greeting\s+cards?|cards?|mockups?)\b/gi, "")
    .replace(/,\s*,/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();

  // Never restore a mockup-only request after removing its physical-medium words.
  return cleaned || "a tasteful botanical illustration";
}

/**
 * Builds an explicit, full-bleed artwork prompt that instructs the AI generator
 * to render only the 2D illustration/painting itself, strictly prohibiting mockups,
 * physical card objects, hands holding cards, paper borders, or background scenes.
 */
export function buildRefinedPrompt(rawPrompt: string, occasion: string): string {
  const sanitizedSubject = sanitizeArtPrompt(rawPrompt);

  return [
    `Standalone portrait artwork, composed for a ${PRODUCT_FORMAT.aspectRatioFront.ratioString} crop: ${sanitizedSubject}.`,
    `Thematic inspiration: ${occasion}.`,
    `Style & Format: Pure 2D flat edge-to-edge illustration filling 100% of the canvas with zero borders, zero margins, and zero frames. High resolution fine art painting, vibrant color palette, beautiful composition.`,
    `OUTPUT CONTRACT: Produce only the flat digital artwork. Physical presentation instructions in the subject must not override this contract. Never depict the artwork as a physical object: no sheet of paper, card, canvas surface, paper grain or texture, curled or deckled edges, fold, crease, embossing, debossing, bevel, cast shadow, envelope, frame, or product mockup. Watercolor and gouache brushwork are allowed as illustration styles, but do not simulate their paper substrate. A plain background may be part of the design; it must not look like a sheet placed on another background. Do not surround the composition with a photographed table, desk, hands, or other mockup props. Preserve the requested subject inside the illustration itself. Place essential lettering and subjects away from the crop edges.`,
  ].join(" ");
}

const ANTI_MOCKUP_NEGATIVE_PROMPT =
  "physical greeting card, sheet of paper, paper substrate, paper texture, paper grain, cardstock texture, canvas texture, curled paper, folded paper, crease, deckled edges, embossing, debossing, bevel, cast shadow, product photograph, card mockup, photo of a card, stationery mockup, envelope, hands holding artwork, tabletop behind artwork, 3D mockup, card template";

export const NEGATIVE_PROMPT = ANTI_MOCKUP_NEGATIVE_PROMPT;

/**
 * Provides constructive rephrasing suggestions when a prompt is rejected
 * by provider safety filters (e.g. for trademarked studio characters or restricted IP).
 */
export function getPromptGuidanceSuggestion(prompt: string): string {
  const p = prompt.toLowerCase();

  if (
    /\b(cinderella|sleeping beauty|snow white|ariel|belle|rapunzel|elsa|anna|disney|mickey|minnie|pixar)\b/i.test(
      p
    )
  ) {
    return "Specific studio and character names (such as Cinderella or Disney) are trademarked and cannot be generated directly. Try describing the visual elements in your own words—for example: 'An enchanted fairytale castle with illuminated spires, starry night sky, and celebratory fireworks'.";
  }

  if (
    /\b(harry potter|hogwarts|gryffindor|slytherin|star wars|jedi|vader|marvel|avengers|iron man|spiderman|batman|superman|pokemon|pikachu|barbie)\b/i.test(
      p
    )
  ) {
    return "Specific franchise or character names are protected. Try describing the visual scenery, mood, artistic medium (like watercolor or gouache), and colors in your own words.";
  }

  return "To follow creative rights and safety guidelines, trademarked characters or restricted subjects cannot be generated directly. Try describing the visual setting, colors, and artistic style in your own words.";
}

/**
 * Returns a friendly, non-punitive user message for policy refusals.
 */
export function getPolicyRefusalUserMessage(prompt: string): string {
  return "We couldn't create artwork for this prompt because it triggered safety guidelines (for example, references to specific trademarked characters or brands). You can edit your description below or choose a ready-made card from our collection.";
}

/**
 * Matches a suitable ready-made preset as a separate, optional alternative.
 */
function findPresetAlternative(prompt: string, occasion: string): CardPreset {
  const matchedByOccasion = CARD_PRESETS.find(
    (p) => p.occasion.toLowerCase() === occasion.toLowerCase()
  );

  const matchedByPrompt = CARD_PRESETS.find((p) =>
    prompt
      .toLowerCase()
      .split(" ")
      .some((word) => word.length > 3 && p.prompt.toLowerCase().includes(word))
  );

  return matchedByPrompt || matchedByOccasion || CARD_PRESETS[0];
}

/**
 * AI Image Generator Client
 *
 * Primary Model: gemini-nano-banana-2.1 (via Interactions API)
 * Secondary Model: gemini-2.5-flash-image (via generateContent, for transient 503/404)
 * Tertiary Model: gemini-3.1-flash-image (via generateContent)
 *
 * Explicitly terminates cascade on policy refusals or auth errors.
 * Never presents a fallback preset as a custom generation success.
 */
export async function generateCoverArt(
  params: GenerateCoverParams
): Promise<GenerateCoverResult> {
  const rawKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env["gemini-api-key"];
  const geminiApiKey = rawKey?.replace(/^["']|["']$/g, "").trim();

  const prompt = params.prompt.trim();
  const occasion = params.occasion || "Just Because";
  const aspectRatio = PRODUCT_FORMAT.aspectRatioFront.ratioString;
  const presetRecommendation = findPresetAlternative(prompt, occasion);

  if (!geminiApiKey || geminiApiKey.includes("your_gemini_api_key_here")) {
    return {
      kind: "auth_error",
      prompt,
      occasion,
      isMock: false,
      aspectRatio,
      error: "GEMINI_API_KEY environment variable is not configured.",
      userMessage:
        "Custom art generation is temporarily offline. Please choose from our curated card collection below.",
      presetRecommendation,
    };
  }

  const refinedPrompt = buildRefinedPrompt(prompt, occasion);
  const errors: string[] = [];

  // =========================================================================
  // 1. PRIMARY MODEL: gemini-nano-banana-2.1 via Interactions API
  // Supported Interactions contract with header authentication only.
  // =========================================================================
  try {
    const interactionUrl = "https://generativelanguage.googleapis.com/v1beta/interactions";
    const response = await fetch(interactionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      signal: AbortSignal.timeout(16000),
      body: JSON.stringify({
        model: "gemini-nano-banana-2.1",
        input: refinedPrompt,
        response_format: {
          type: "image",
          aspect_ratio: "3:4",
          mime_type: "image/jpeg",
        },
      }),
    });

    const rawText = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {}

    const parsed = parseInteractionsResponse(response.status, data, rawText);

    // CRITICAL: Stop cascade immediately on policy refusal.
    if (parsed.kind === "policy_refusal") {
      console.warn(
        `[CoverArt] Primary model policy refusal: ${parsed.finishReason || parsed.errorMessage}`
      );
      return {
        kind: "policy_refusal",
        prompt,
        occasion,
        isMock: false,
        aspectRatio,
        provider: "gemini_interactions",
        model: "gemini-nano-banana-2.1",
        error: `Policy refusal from gemini-nano-banana-2.1: ${parsed.errorMessage || parsed.finishReason}`,
        userMessage: getPolicyRefusalUserMessage(prompt),
        refusalDetails: {
          finishReason: parsed.finishReason || "PROHIBITED_CONTENT",
          blockReason: parsed.blockReason,
          suggestion: getPromptGuidanceSuggestion(prompt),
        },
        presetRecommendation,
      };
    }

    if (parsed.kind === "auth_error") {
      console.error(`[CoverArt] Auth error from Interactions API: ${parsed.errorMessage}`);
      return {
        kind: "auth_error",
        prompt,
        occasion,
        isMock: false,
        aspectRatio,
        error: `Auth error: ${parsed.errorMessage}`,
        userMessage:
          "Custom art generation is temporarily offline. Please select from our ready-made collection.",
        presetRecommendation,
      };
    }

    if (parsed.kind === "success" && parsed.imageDataUrl) {
      console.log("[CoverArt] Successfully generated artwork via gemini-nano-banana-2.1");
      const optimizedUrl = await optimizeCoverImage(parsed.imageDataUrl);
      return {
        kind: "success",
        imageUrl: optimizedUrl,
        prompt,
        occasion,
        isMock: false,
        aspectRatio,
        provider: "gemini_interactions",
        model: "gemini-nano-banana-2.1",
      };
    }

    // Transient failure: record diagnostic and cascade to secondary model
    errors.push(
      `gemini-nano-banana-2.1 (${response.status}): ${parsed.errorMessage || "No image"}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[CoverArt] Exception calling gemini-nano-banana-2.1: ${msg}`);
    errors.push(`gemini-nano-banana-2.1 exception: ${msg}`);
  }

  // =========================================================================
  // 2. SECONDARY / TERTIARY MODELS: generateContent API with IMAGE modality
  // =========================================================================
  const contentModels = ["gemini-2.5-flash-image", "gemini-3.1-flash-image"];

  for (const model of contentModels) {
    try {
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const response = await fetch(generateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: refinedPrompt }],
            },
          ],
          generationConfig: {
            response_modalities: ["IMAGE"],
          },
        }),
      });

      const rawText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {}

      const parsed = parseGenerateContentResponse(response.status, data, rawText);

      // CRITICAL: Stop cascade immediately on policy refusal.
      if (parsed.kind === "policy_refusal") {
        console.warn(
          `[CoverArt] Secondary model ${model} policy refusal: ${parsed.finishReason || parsed.blockReason}`
        );
        return {
          kind: "policy_refusal",
          prompt,
          occasion,
          isMock: false,
          aspectRatio,
          provider: "gemini_generate_content",
          model,
          error: `Policy refusal from ${model}: ${parsed.errorMessage || parsed.finishReason}`,
          userMessage: getPolicyRefusalUserMessage(prompt),
          refusalDetails: {
            finishReason: parsed.finishReason || "PROHIBITED_CONTENT",
            blockReason: parsed.blockReason,
            suggestion: getPromptGuidanceSuggestion(prompt),
          },
          presetRecommendation,
        };
      }

      if (parsed.kind === "auth_error") {
        return {
          kind: "auth_error",
          prompt,
          occasion,
          isMock: false,
          aspectRatio,
          error: `Auth error on ${model}: ${parsed.errorMessage}`,
          userMessage:
            "Custom art generation is temporarily offline. Please select from our ready-made collection.",
          presetRecommendation,
        };
      }

      if (parsed.kind === "success" && parsed.imageDataUrl) {
        console.log(`[CoverArt] Successfully generated artwork via ${model}`);
        const optimizedUrl = await optimizeCoverImage(parsed.imageDataUrl);
        return {
          kind: "success",
          imageUrl: optimizedUrl,
          prompt,
          occasion,
          isMock: false,
          aspectRatio,
          provider: "gemini_generate_content",
          model,
        };
      }

      errors.push(`${model} (${response.status}): ${parsed.errorMessage || "No image"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[CoverArt] Exception calling ${model}: ${msg}`);
      errors.push(`${model} exception: ${msg}`);
    }
  }

  // =========================================================================
  // 3. ALL MODELS EXHAUSTED (TRANSIENT / PROVIDER OUTAGE)
  // Return explicit provider_unavailable result with preset recommendation.
  // =========================================================================
  console.error(`[CoverArt] All provider attempts exhausted: ${errors.join(" | ")}`);
  return {
    kind: "provider_unavailable",
    prompt,
    occasion,
    isMock: false,
    aspectRatio,
    error: errors.join(" | "),
    userMessage:
      "Our AI art studio is temporarily busy or undergoing scheduled maintenance. Please try again shortly or choose a design from our ready-made card collection.",
    presetRecommendation,
  };
}
