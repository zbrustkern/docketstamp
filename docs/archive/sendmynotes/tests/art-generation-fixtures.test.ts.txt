import assert from "node:assert/strict";
import {
  parseInteractionsResponse,
  parseGenerateContentResponse,
  extractImageDataUrl,
  getPromptGuidanceSuggestion,
  getPolicyRefusalUserMessage,
  generateCoverArt,
  buildRefinedPrompt,
  sanitizeArtPrompt,
} from "../lib/nano-banana";
import { POST as handleGenerateCoverRoute } from "../app/api/generate-cover/route";
import { NextRequest } from "next/server";

async function runFixtureTests() {
  console.log("=================================================");
  console.log("🎨 RUNNING ART GENERATION PROVIDER FIXTURE TESTS");
  console.log("=================================================\n");

  let passed = 0;
  function pass(label: string) {
    console.log(`✅ PASS: ${label}`);
    passed++;
  }

  // ---------------------------------------------------------------------------
  // 1. Interactions API Response Parsing Fixtures
  // ---------------------------------------------------------------------------
  console.log("--- 1. Testing Interactions API Response Parsing Fixtures ---");

  // A. Image in REST steps
  const interactionsWithSteps = {
    steps: [
      {
        content: [
          {
            type: "image",
            image_content: {
              data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
              mime_type: "image/png",
            },
          },
        ],
      },
    ],
  };
  const res1 = parseInteractionsResponse(200, interactionsWithSteps);
  assert.equal(res1.kind, "success");
  assert.ok(res1.imageDataUrl?.startsWith("data:image/png;base64,"));
  pass("Interactions response: extracted image from REST steps");

  // B. Direct output_image in Interactions response
  const interactionsWithDirect = {
    output_image: {
      data: "AQIDBA==",
      mime_type: "image/jpeg",
    },
  };
  const res2 = parseInteractionsResponse(200, interactionsWithDirect);
  assert.equal(res2.kind, "success");
  assert.equal(res2.imageDataUrl, "data:image/jpeg;base64,AQIDBA==");
  pass("Interactions response: extracted direct output_image");

  // C. HTTP 200 with PROHIBITED_CONTENT finish reason
  const interactionsProhibited = {
    finishReason: "PROHIBITED_CONTENT",
    steps: [],
  };
  const res3 = parseInteractionsResponse(200, interactionsProhibited);
  assert.equal(res3.kind, "policy_refusal");
  assert.equal(res3.finishReason, "PROHIBITED_CONTENT");
  pass("Interactions response: HTTP 200 with PROHIBITED_CONTENT flagged as policy_refusal");

  // D. HTTP 200 empty response
  const resEmpty = parseInteractionsResponse(200, { steps: [] });
  assert.equal(resEmpty.kind, "unexpected_error");
  pass("Interactions response: HTTP 200 empty response flagged as unexpected_error");

  // E. HTTP 400 with prohibited content guidelines (Incident replication)
  const interactions400 = {
    error: {
      code: 400,
      message: "Request contains prohibited content guidelines violation.",
      status: "INVALID_ARGUMENT",
    },
  };
  const res400 = parseInteractionsResponse(400, interactions400);
  assert.equal(res400.kind, "policy_refusal");
  assert.equal(res400.finishReason, "PROHIBITED_CONTENT");
  pass("Interactions response: HTTP 400 prohibited content error classified as policy_refusal");

  // F. HTTP 401 invalid credential
  const interactions401 = {
    error: { code: 401, message: "API key not valid. Please pass a valid API key." },
  };
  const res401 = parseInteractionsResponse(401, interactions401);
  assert.equal(res401.kind, "auth_error");
  pass("Interactions response: HTTP 401 invalid credential classified as auth_error");

  // G. HTTP 404 model not found
  const interactions404 = {
    error: { code: 404, message: "models/imagen-3.0-generate-002 not found" },
  };
  const res404 = parseInteractionsResponse(404, interactions404);
  assert.equal(res404.kind, "model_not_found");
  pass("Interactions response: HTTP 404 model not found classified as model_not_found");

  // H. HTTP 429 & 503 provider unavailable
  const res429 = parseInteractionsResponse(429, { error: { message: "Resource exhausted" } });
  assert.equal(res429.kind, "provider_unavailable");
  const res503 = parseInteractionsResponse(503, { error: { message: "Service Unavailable" } });
  assert.equal(res503.kind, "provider_unavailable");
  pass("Interactions response: HTTP 429 & 503 classified as provider_unavailable");

  // ---------------------------------------------------------------------------
  // 2. generateContent API Response Parsing Fixtures
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Testing generateContent API Response Parsing Fixtures ---");

  // A. Candidate with inlineData
  const generateContentSuccess = {
    candidates: [
      {
        content: {
          parts: [
            {
              inlineData: {
                data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                mimeType: "image/png",
              },
            },
          ],
        },
      },
    ],
  };
  const genRes1 = parseGenerateContentResponse(200, generateContentSuccess);
  assert.equal(genRes1.kind, "success");
  assert.ok(genRes1.imageDataUrl?.startsWith("data:image/png;base64,"));
  pass("generateContent response: extracted inlineData image");

  // B. promptFeedback with blockReason
  const generateContentBlocked = {
    promptFeedback: {
      blockReason: "SAFETY",
      safetyRatings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", probability: "HIGH" }],
    },
  };
  const genRes2 = parseGenerateContentResponse(200, generateContentBlocked);
  assert.equal(genRes2.kind, "policy_refusal");
  assert.equal(genRes2.finishReason, "SAFETY");
  pass("generateContent response: promptFeedback blockReason flagged as policy_refusal");

  // C. Candidate with finishReason: PROHIBITED_CONTENT
  const generateContentCandidateProhibited = {
    candidates: [
      {
        finishReason: "PROHIBITED_CONTENT",
        content: { parts: [] },
      },
    ],
  };
  const genRes3 = parseGenerateContentResponse(200, generateContentCandidateProhibited);
  assert.equal(genRes3.kind, "policy_refusal");
  assert.equal(genRes3.finishReason, "PROHIBITED_CONTENT");
  pass("generateContent response: candidate finishReason PROHIBITED_CONTENT flagged as policy_refusal");

  // D. Candidate with finishReason: SAFETY
  const generateContentSafety = {
    candidates: [
      {
        finishReason: "SAFETY",
        content: { parts: [] },
      },
    ],
  };
  const genRes4 = parseGenerateContentResponse(200, generateContentSafety);
  assert.equal(genRes4.kind, "policy_refusal");
  assert.equal(genRes4.finishReason, "SAFETY");
  pass("generateContent response: candidate finishReason SAFETY flagged as policy_refusal");

  // E. HTTP 400 prohibited content error
  const genRes400 = parseGenerateContentResponse(400, {
    error: { message: "prohibited content guidelines violation" },
  });
  assert.equal(genRes400.kind, "policy_refusal");
  pass("generateContent response: HTTP 400 prohibited content classified as policy_refusal");

  // F. HTTP 403 API_KEY_INVALID
  const genRes403 = parseGenerateContentResponse(403, {
    error: { message: "API_KEY_INVALID" },
  });
  assert.equal(genRes403.kind, "auth_error");
  pass("generateContent response: HTTP 403 API_KEY_INVALID classified as auth_error");

  // ---------------------------------------------------------------------------
  // 3. User Guidance & Prompt Suggestions
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Testing Policy Guidance Suggestions ---");

  const cinderellaTip = getPromptGuidanceSuggestion("A Cinderella and Sleeping Beauty castle with fireworks");
  assert.ok(cinderellaTip.includes("Cinderella") || cinderellaTip.includes("fairytale"));
  assert.ok(cinderellaTip.toLowerCase().includes("describ"));
  pass("Guidance: Cinderella/Disney prompt produces specific fairytale rephrasing suggestion");

  const marvelTip = getPromptGuidanceSuggestion("Iron Man and Spider-Man at a birthday party");
  assert.ok(marvelTip.includes("protected") || marvelTip.includes("trademarked"));
  pass("Guidance: Marvel prompt produces character/franchise protection advice");

  const policyMsg = getPolicyRefusalUserMessage("Cinderella castle");
  assert.ok(policyMsg.includes("safety guidelines"));
  assert.ok(!policyMsg.includes("Aster & Blanche"));
  pass("Guidance: Policy refusal user message is friendly, truthful, and non-punitive");

  // ---------------------------------------------------------------------------
  // 4. Bounded Cascade & Policy Refusal Stoppage Test
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Testing Bounded Cascade & Immediate Refusal Stoppage ---");

  // Backup original global fetch
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  const calledUrls: string[] = [];

  try {
    // Mock fetch that simulates primary model returning 400 prohibited content guidelines
    globalThis.fetch = (async (url: any, init: any) => {
      fetchCallCount++;
      calledUrls.push(String(url));
      return {
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: {
              code: 400,
              message: "Request contains prohibited content guidelines violation.",
              status: "INVALID_ARGUMENT",
            },
          }),
      } as any;
    }) as any;

    process.env.GEMINI_API_KEY = "test_valid_diagnostic_key";

    const blockedResult = await generateCoverArt({
      prompt: "A Cinderella / sleeping beauty style castle with fireworks",
      occasion: "Birthday",
    });

    // ASSERTION: Cascade MUST STOP IMMEDIATELY! Do not retry on secondary models!
    assert.equal(fetchCallCount, 1, "Immediate cascade stoppage: exactly 1 provider call made on policy refusal");
    pass("Cascade stoppage: exactly 1 provider call made; no cross-provider retry loop");

    assert.equal(blockedResult.kind, "policy_refusal");
    assert.equal(blockedResult.imageUrl, undefined, "Refused request does not return a false imageUrl");
    assert.equal(blockedResult.isMock, false, "Refused request is NOT labeled as mock success");
    assert.ok(blockedResult.refusalDetails?.suggestion, "Provides actionable suggestion");
    assert.ok(blockedResult.presetRecommendation, "Provides separate ready-made recommendation");
    pass("Policy refusal result has no false imageUrl and attaches separate preset recommendation");

    // Test secondary model fallback on transient 404 (model retired)
    fetchCallCount = 0;
    calledUrls.length = 0;
    globalThis.fetch = (async (url: any, init: any) => {
      fetchCallCount++;
      const urlStr = String(url);
      calledUrls.push(urlStr);
      if (urlStr.includes("interactions")) {
        // Primary returns 404 (e.g. decommissioned model)
        return {
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ error: { message: "Model not found" } }),
        } as any;
      }
      // Secondary returns 200 with 1x1 png image
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                        mimeType: "image/png",
                      },
                    },
                  ],
                },
              },
            ],
          }),
      } as any;
    }) as any;

    const fallbackSuccess = await generateCoverArt({
      prompt: "Fairytale castle on starry night",
      occasion: "Birthday",
    });

    assert.equal(fetchCallCount, 2, "Transient 404 correctly fell back to secondary model (2 calls)");
    assert.equal(fallbackSuccess.kind, "success");
    assert.ok(fallbackSuccess.imageUrl?.startsWith("data:image/jpeg;base64,"));
    assert.equal(fallbackSuccess.model, "gemini-2.5-flash-image");
    pass("Transient 404 cascaded cleanly to secondary model and succeeded");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
  }

  // ---------------------------------------------------------------------------
  // 5. Route Contract: HTTP 422 for Refusal & Non-punitive Rate Limit
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Testing Route Contract: HTTP 422 & Rate Limiting ---");

  try {
    globalThis.fetch = (async (url: any, init: any) => {
      return {
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: {
              code: 400,
              message: "Request contains prohibited content guidelines violation.",
              status: "INVALID_ARGUMENT",
            },
          }),
      } as any;
    }) as any;

    process.env.GEMINI_API_KEY = "test_valid_diagnostic_key";

    const mockReq = new NextRequest("https://sendmynotes.com/api/generate-cover", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "192.0.2.42",
      },
      body: JSON.stringify({
        prompt: "A Cinderella / sleeping beauty style castle with fireworks",
        occasion: "Birthday",
      }),
    });

    const routeResp = await handleGenerateCoverRoute(mockReq);
    assert.equal(routeResp.status, 422, "Route returns HTTP 422 Unprocessable Entity on policy refusal");
    const routeData = await routeResp.json();
    assert.equal(routeData.code, "ART_REQUEST_BLOCKED");
    assert.ok(routeData.message);
    assert.ok(routeData.suggestion);
    assert.ok(routeData.presetRecommendation);
    assert.equal(routeData.remaining, 5, "Customer rate limit quota is not penalized on policy refusal");
    pass("Route returns HTTP 422 ART_REQUEST_BLOCKED with separate preset and unpenalized quota");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
  }

  console.log("\n=================================================");
  console.log(`🎉 ALL ${passed} ART GENERATION FIXTURE TESTS PASSED`);
  console.log("=================================================\n");
}

runFixtureTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
