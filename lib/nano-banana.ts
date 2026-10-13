import { CARD_PRESETS, CardPreset } from "./card-presets";
import { optimizeCoverImage } from "./image-optimizer";
import { PRODUCT_FORMAT } from "./product-facts";

export interface GenerateCoverParams {
  prompt: string;
  occasion?: string;
}

export interface GenerateCoverResult {
  imageUrl: string;
  prompt: string;
  occasion: string;
  isMock: boolean;
  aspectRatio: string;
  provider?: "gemini_imagen" | "nano_banana" | "preset_fallback";
  error?: string;
}

/**
 * Universal extractor for image data returned by Google GenAI APIs
 * Handles Interactions API, generateContent, and legacy prediction response shapes.
 */
function extractImageDataUrl(data: any): string | null {
  if (!data) return null;

  // 1. Direct output_image in modern Interactions API
  const directImage = data.output_image || data.outputImage;
  if (directImage?.data) {
    const mime = directImage.mime_type || directImage.mimeType || "image/png";
    return `data:${mime};base64,${directImage.data}`;
  }

  // 2. Steps in Interactions API
  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      const contentList = step.content || step.model_output?.content || step.modelOutputStep?.content;
      if (Array.isArray(contentList)) {
        for (const item of contentList) {
          const imgObj = item.image_content || item.imageContent || (item.type === "image" ? item : null);
          const base64 = imgObj?.data || item.data;
          if (base64) {
            const mime = imgObj?.mime_type || imgObj?.mimeType || item.mime_type || "image/png";
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
        const mime = out.mime_type || out.mimeType || "image/png";
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
            const mime = inline.mimeType || inline.mime_type || "image/png";
            return `data:${mime};base64,${inline.data}`;
          }
        }
      }
    }
  }

  // 5. Predictions in legacy Imagen predict API
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
 * AI Image Generator Client
 * 1. Google Gemini (Interactions API / generateContent with gemini-3.1-flash-image / gemini-2.5-flash-image)
 * 2. Nano Banana API (via NANO_BANANA_API_KEY)
 * 3. Fallback: Curated Aster & Blanche 5:7 boutique presets
 */
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

export async function generateCoverArt(params: GenerateCoverParams): Promise<GenerateCoverResult> {
  const geminiApiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env["gemini-api-key"];
  const nanoApiKey = process.env.NANO_BANANA_API_KEY;
  const prompt = params.prompt.trim();
  const occasion = params.occasion || "Just Because";
  const aspectRatio = PRODUCT_FORMAT.aspectRatioFront.ratioString;

  const refinedPrompt = buildRefinedPrompt(prompt, occasion);

  const errors: string[] = [];

  // 1. Google Gemini / Imagen Native Image Generation
  if (geminiApiKey) {
    // Strategy 1: Google Imagen 3 Predict API (Official Google AI Studio Imagen 3 models)
    const imagenModels = [
      "imagen-3.0-generate-002",
      "imagen-3.0-fast-generate-001",
    ];

    for (const model of imagenModels) {
      try {
        const predictUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${geminiApiKey}`;
        const response = await fetch(predictUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiApiKey,
          },
          body: JSON.stringify({
            instances: [{ prompt: refinedPrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: "3:4",
              outputMimeType: "image/jpeg",
              personGeneration: "ALLOW_ADULT",
              negativePrompt: ANTI_MOCKUP_NEGATIVE_PROMPT,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const dataUrl = extractImageDataUrl(data);
          if (dataUrl) {
            console.log(`[Google Imagen] Successfully generated artwork via ${model}`);
            const optimizedUrl = await optimizeCoverImage(dataUrl);
            return {
              imageUrl: optimizedUrl,
              prompt,
              occasion,
              isMock: false,
              aspectRatio,
              provider: "gemini_imagen",
            };
          }
        } else {
          const errText = await response.text();
          let parsedMsg = errText;
          try {
            const parsed = JSON.parse(errText);
            parsedMsg = parsed.error?.message || errText;
          } catch {}
          console.warn(`[Google Imagen ${model}] API error (${response.status}):`, parsedMsg);
          errors.push(`Imagen ${model} (${response.status}): ${parsedMsg}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Google Imagen ${model}] Exception:`, msg);
        errors.push(`Imagen ${model} network error: ${msg}`);
      }
    }

    // Strategy 2: Modern Interactions API (Google GenAI recommended standard)
    const interactionModels = [
      "gemini-3.1-flash-image",
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-lite-image",
    ];

    for (const model of interactionModels) {
      try {
        const interactionUrl = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${geminiApiKey}`;
        const response = await fetch(interactionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiApiKey,
          },
          body: JSON.stringify({
            model,
            input: refinedPrompt,
            response_format: {
              type: "image",
              aspect_ratio: "3:4",
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const dataUrl = extractImageDataUrl(data);
          if (dataUrl) {
            console.log(`[Google Gemini] Successfully generated artwork via Interactions API using ${model}`);
            const optimizedUrl = await optimizeCoverImage(dataUrl);
            return {
              imageUrl: optimizedUrl,
              prompt,
              occasion,
              isMock: false,
              aspectRatio,
              provider: "gemini_imagen",
            };
          }
        } else {
          const errText = await response.text();
          let parsedMsg = errText;
          try {
            const parsed = JSON.parse(errText);
            parsedMsg = parsed.error?.message || errText;
          } catch {}
          console.warn(`[Google Interactions ${model}] API error (${response.status}):`, parsedMsg);
          errors.push(`Interactions ${model} (${response.status}): ${parsedMsg}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Google Interactions ${model}] Exception:`, msg);
        errors.push(`Interactions ${model} network error: ${msg}`);
      }
    }

    // Strategy B: generateContent with IMAGE response modalities
    const contentModels = [
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-image",
    ];

    for (const model of contentModels) {
      try {
        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const response = await fetch(generateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiApiKey,
          },
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

        if (response.ok) {
          const data = await response.json();
          const dataUrl = extractImageDataUrl(data);
          if (dataUrl) {
            console.log(`[Google Gemini] Successfully generated artwork via generateContent using ${model}`);
            const optimizedUrl = await optimizeCoverImage(dataUrl);
            return {
              imageUrl: optimizedUrl,
              prompt,
              occasion,
              isMock: false,
              aspectRatio,
              provider: "gemini_imagen",
            };
          }
        } else {
          const errText = await response.text();
          let parsedMsg = errText;
          try {
            const parsed = JSON.parse(errText);
            parsedMsg = parsed.error?.message || errText;
          } catch {}
          console.warn(`[Google generateContent ${model}] API error (${response.status}):`, parsedMsg);
          errors.push(`generateContent ${model} (${response.status}): ${parsedMsg}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Google generateContent ${model}] Exception:`, msg);
        errors.push(`generateContent ${model} network error: ${msg}`);
      }
    }
  } else {
    errors.push("GEMINI_API_KEY environment variable was not found in runtime container");
  }

  // 2. Nano Banana API (if configured)
  if (nanoApiKey && !nanoApiKey.includes("your_nano_banana_api_key_here")) {
    try {
      const response = await fetch("https://api.nanobanana.ai/v1/images/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${nanoApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: refinedPrompt,
          negative_prompt: ANTI_MOCKUP_NEGATIVE_PROMPT,
          aspect_ratio: "3:4", // Provider-native portrait canvas; optimizer applies A2 crop.
          width: 1275,
          height: 1700,
          format: "png",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const imageUrl = data.image_url || data.data?.[0]?.url || data.url;
        if (imageUrl) {
          const optimizedUrl = await optimizeCoverImage(imageUrl);
          return {
            imageUrl: optimizedUrl,
            prompt,
            occasion,
            isMock: false,
            aspectRatio,
            provider: "nano_banana",
          };
        }
      }
      console.warn("[Nano Banana] API returned error or empty response.");
    } catch (error) {
      console.error("[Nano Banana] Failed to call generation API:", error);
    }
  }

  // 3. Fallback: Curated Aster & Blanche 5:7 boutique card presets (No Pollinations)
  const matchedByOccasion = CARD_PRESETS.find(
    (p) => p.occasion.toLowerCase() === occasion.toLowerCase()
  );

  const matchedByPrompt = CARD_PRESETS.find((p) =>
    prompt.toLowerCase().split(" ").some((word) => word.length > 3 && p.prompt.toLowerCase().includes(word))
  );

  const selectedPreset: CardPreset = matchedByPrompt || matchedByOccasion || CARD_PRESETS[0];
  const presetImageUrl = selectedPreset.imageUrl;

  return {
    imageUrl: presetImageUrl,
    prompt,
    occasion,
    isMock: true,
    aspectRatio,
    provider: "preset_fallback",
    error: errors.join(" | "),
  };
}
