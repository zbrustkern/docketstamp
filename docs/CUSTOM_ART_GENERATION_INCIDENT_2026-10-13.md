# Custom artwork generation incident: evidence and builder handoff

**Investigated:** October 13, 2026, approximately 12:25–12:38 UTC.
**Severity:** Founder-designated P0; core custom-art purchase capability.
**Repository inspected:** `6b3776a`.
**Production revision inspected:** `sendmynotes-build-2026-10-13-005`, service
`sendmynotes`, project `sendmynotes-2a417`, region `us-central1`.
**Status:** Diagnosis complete for the supplied example. Restoration of the full
production customer journey is **not certified**. No code fix or deployment was
performed during this investigation.

## What is actually failing

There are multiple defects, rather than one demonstrated Google-wide outage:

1. **Dead primary model requests.** The deployed generator calls Imagen 3 models
   first. Production logs show both returning HTTP 404. Google lists
   `imagen-3.0-generate-002` as shut down November 10, 2025. Moving to Imagen 4
   would not be a durable repair: its Gemini API models shut down August 17, 2026.
   See [Google's deprecation schedule](https://ai.google.dev/gemini-api/docs/deprecations).
2. **The supplied castle request receives a provider policy refusal.** The actual
   app prompt wrapper plus the supplied subject returns an Interactions HTTP 400
   policy error. The generateContent fallback returns HTTP 200, no image, and
   `finishReason: PROHIBITED_CONTENT`. The raw subject without our wrapper also
   receives that finish reason. A generic original fairytale castle succeeds
   with the exact wrapper. This isolates a refusal associated with the example's
   subject wording; it does **not** establish which term triggers the provider's
   policy or that copyrighted references are the specific reason.
3. **Failure detection hides an important provider result.** The code treats
   HTTP 200 without an extracted image as another silent failed attempt. It does
   not record `finishReason` or return a specific policy-refusal state. After
   exhausting attempts, it substitutes a preset and returns HTTP 200 from the
   application API. The screenshot's “Ready-made design matched” is this fallback,
   not a custom image generation success.
4. **Credentials have deployment drift.** The inspected revision has a literal
   `GEMINI_API_KEY` environment value, despite the repository's secret binding.
   That deployed value passes Google's model-list check and successfully produces
   images. The separate `gemini-api-key` Secret Manager `latest` value fails a
   model-list check with `API_KEY_INVALID`. A deployment that switches back to that
   secret without repairing it can introduce a new authentication outage.

**Direct answer:** the active production credential works for the diagnostic
requests. An invalid managed secret exists, but it is not the active credential in
the inspected revision. The supplied failure is reproducibly a content-policy
refusal, compounded by obsolete model calls and incomplete response handling.
Do not report that changing the key alone fixes this incident.

## Sanitized evidence

Production log entries from revision `005`:

| Time, UTC | Request | Result |
| --- | --- | --- |
| 12:26:01 | `imagen-3.0-generate-002:predict` | HTTP 404: model not found or not supported for predict |
| 12:26:01 | `imagen-3.0-fast-generate-001:predict` | HTTP 404: model not found or not supported for predict |
| 12:26:08 | Interactions, `gemini-3.1-flash-image` | HTTP 400: prohibited content guidelines |
| 12:26:14 | Interactions, `gemini-2.5-flash-image` | HTTP 400: prohibited content guidelines |
| 12:26:18 | Interactions, `gemini-3.1-flash-lite-image` | HTTP 400: prohibited content guidelines |

Similar failures appear on revisions `003` and `004`. These log timestamps are
not proof that any particular entry belongs to the founder's screenshot: the
route currently lacks the correlation evidence needed to establish that.

Read-only credential checks:

| Credential/configuration | Result |
| --- | --- |
| Secret Manager `gemini-api-key`, `latest` | Read succeeded; Google model-list request HTTP 400, `API_KEY_INVALID` |
| Revision `005`, literal `GEMINI_API_KEY` | Google model-list request HTTP 200; available models include `gemini-nano-banana-2.1`, `gemini-3.1-flash-image`, and `gemini-2.5-flash-image` |
| Revision `005`, `NANO_BANANA_API_KEY` | References secret version 1; value is placeholder-like, not a verified functioning backup |

No credential values, hashes, or prefixes are included here. Notably, the active
credential does not have the conventional `AIza` shape but is accepted by Google.
**Do not implement a prefix-only rejection rule.** Provider validation is stronger
evidence than a key-shape heuristic. The investigator's ability to read secrets
does not prove the production runtime service account has Secret Manager access.

Six controlled, direct Google image requests used the active credential. They
did not call checkout, fulfillment, or the app's production cache-writing route.
Image payloads were examined only for image presence and discarded.

| Diagnostic request | HTTP | Image | Evidence |
| --- | --- | --- | --- |
| Current Nano Banana 2.1 Interactions; neutral original castle illustration | 200 | Yes | Current model/API and credential can generate |
| Existing Gemini 2.5 generateContent contract; same neutral subject | 200 | Yes | Existing request-field spelling is accepted in this test |
| Existing Gemini 3.1 Interactions; supplied castle subject with full app wrapper | 400 | No | Explicit provider policy refusal |
| Existing Gemini 2.5 generateContent; supplied subject with full wrapper | 200 | No | `finishReason: PROHIBITED_CONTENT` |
| Existing Gemini 2.5 generateContent; supplied subject alone | 200 | No | `finishReason: PROHIBITED_CONTENT` |
| Existing Gemini 2.5 generateContent; generic original castle with full wrapper | 200 | Yes | Wrapper alone is not a blanket blocker |

The supplied subject referenced Cinderella/Sleeping Beauty. The successful
generic comparison described an original fairytale castle, stars, and fireworks.
This comparison diagnoses the refusal; it is not a recommendation to evade
provider safeguards or silently change customers' requested subjects.

## Google's recent update: relevant, but not the entire root cause

Google released `gemini-nano-banana-2.1` on October 6, 2026 and deprecated
`gemini-3.1-flash-image` with **no shutdown date announced**. Deprecation alone
does not explain why the existing model fails for this subject. The deployed
code has not adopted the new primary model.
See [the release notes](https://ai.google.dev/gemini-api/docs/changelog) and
[current image-generation guide](https://ai.google.dev/gemini-api/docs/image-generation).

The Interactions request already uses `response_format`, matching Google's
current schema. Do not attribute the incident to the earlier migration from
`generation_config.image_config` without evidence. Existing generateContent
`response_modalities: ["IMAGE"]` also produced an image in our diagnostic test;
its spelling is not the demonstrated failure.

`api.nanobanana.ai` in the fallback is a separate endpoint from Google's
`generativelanguage.googleapis.com`. Google's Nano Banana model name does not
establish that third-party endpoint or its credential as a functioning backup.

## Required builder changes, in execution order

### 1. Repair provider result handling before declaring restoration

**Files:** `lib/nano-banana.ts`, `app/api/generate-cover/route.ts`,
`components/v3/CustomAiCommissionDrawer.tsx`.

- Use a discriminated result: generated image, policy refusal, temporary provider
  failure, configuration/authentication failure, or unexpected response. A preset
  recommendation is a separate result, never a generated-image success.
- Inspect provider error payloads, `promptFeedback`, candidate `finishReason`, and
  image presence even when HTTP status is 200. Record a sanitized diagnostic
  reason when a successful HTTP response contains no usable image.
- Stop the model cascade after an explicit policy refusal. Do not retry the same
  rejected content across providers to circumvent safeguards. Invite the customer
  to edit the request, preserving their text and occasion.
- Return an explicit application error/state for refusal, for example HTTP 422
  with `ART_REQUEST_BLOCKED`; provider outages can use HTTP 503 with
  `ART_PROVIDER_UNAVAILABLE`. Match the drawer to that contract. Do not display
  provider diagnostics, keys, or a vague “briefly resting” explanation for every
  failure category.
- Keep ready-made alternatives available with an explicit opt-in action. Do not
  attach a generated-art success state to an unrelated preset.
- Cache only actual generated images as generation successes. The current route
  saves fallback images into `image_cache_pool` as `AVAILABLE` without provenance.
  Add provider/model/result provenance. Identify affected historical records
  before excluding or migrating them; preserve legitimate generated assets.

### 2. Replace the obsolete model cascade with a supported primary

**File:** `lib/nano-banana.ts`.

- Remove the two Imagen 3 attempts. Do not replace them with retired Imagen 4
  models. Configure the primary model explicitly; the currently documented
  default is `gemini-nano-banana-2.1`.
- Use Google's supported Interactions image contract, which passed the direct
  diagnostic request. Example body:

```json
{
  "model": "gemini-nano-banana-2.1",
  "input": "A colorful illustration of an original fairytale castle under stars and fireworks. Flat digital artwork filling the frame.",
  "response_format": {
    "type": "image",
    "aspect_ratio": "3:4",
    "mime_type": "image/jpeg"
  }
}
```

Send it to `POST https://generativelanguage.googleapis.com/v1beta/interactions`
with `x-goog-api-key` and `Content-Type: application/json`. Decode the image from
the documented image output/steps, then run the existing A2 optimizer. Our actual
REST success contained `steps`; do not depend only on SDK convenience properties.

- Keep provider-native portrait geometry separate from the final A2 17:22 crop.
  Preserve the artwork-only source contract and consistent website card framing.
- Set explicit timeouts and one overall latency budget compatible with the route
  deadline. Retry only transient failures, with bounded backoff. Authentication,
  invalid request, unavailable model, and policy refusal need distinct handling.
- Remove the unverified third-party backup from the restoration claim. A real
  backup requires its own provider contract, credential, and tested availability.

### 3. Reconcile the managed secret and deployment configuration

**Files/configuration:** `apphosting.yaml`, App Hosting deployment environment,
Cloud Run revision environment, Secret Manager.

- Trace why the deployed revision has a literal value while the repository
  declares a managed-secret reference. Do not copy credentials into source,
  tickets, screenshots, shell arguments, or this document.
- Repair the managed secret through the authorized operator's secret-management
  process, validate it against Google, confirm runtime access, then deploy using
  a single authoritative secret binding. Verify the new revision's actual binding
  and a benign image request before redirecting traffic.
- Avoid returning to the invalid `latest` value merely to make YAML and runtime
  match. Keep the existing accepted credential available until the replacement
  path is proven.
- Normalize accidental surrounding whitespace/paired quotes consistently if
  supported, but do not substitute normalization for validation.
- Put the credential in the request header only. Remove `?key=...` from URLs to
  reduce accidental credential exposure in request/error logging.

### 4. Prevent unrelated work from blocking a valid image

**Files:** `lib/thematic-sentiment.ts`, `app/api/generate-cover/route.ts`.

- Update the obsolete `gemini-2.0-flash` / `gemini-1.5-flash` text-model list to an
  available supported model. These optional suggestions are separate from art.
- Bound their latency and use local starter suggestions on failure. The route's
  `Promise.all` waits for this optional work before returning the image.
- Ensure incident logging failures cannot erase a usable result or replace the
  original failure. Decide explicitly how cache-write failures are surfaced and
  recovered. Neither path was tested in the direct provider probes.
- Log correlation ID, revision, provider/model, duration, HTTP status, result kind,
  and sanitized finish reason. Do not put raw personal prompts in marketing
  telemetry. Keep incident metadata minimal and private.

## Acceptance evidence required from the builder

1. Automated provider-response fixtures exercise actual response parsing and
   routing: image in REST steps; generateContent inline image; HTTP 200 with
   `PROHIBITED_CONTENT`; empty successful response; invalid credential; 404;
   timeout; 429/503; and a storage/logging failure. Assert bounded attempts,
   correct customer state, and no false-success cache entry.
2. Prompt tests retain the artwork-only output contract. Existing
   `tests/artwork-harness.test.ts` checks prompt strings only; it cannot certify
   provider availability or route success.
3. A controlled production-route test with a benign original subject returns
   `isMock: false` and an actual new image. Verify decoded image bytes, optimizer
   output, cache provenance, and customer selection into the draft.
4. A refused request shows accurate guidance, preserves the request, and offers
   an explicitly separate ready-made choice. No repeated cross-provider refusal
   cascade and no fake “matched custom artwork” success.
5. Verify the browser drawer on mobile: loading, refusal, temporary outage, retry,
   selected image, return navigation, and note-step continuity. Do not certify
   this from a direct Google call alone.
6. Record the deployed commit/revision, managed-secret binding, successful benign
   route check, and refusal check in the release evidence. Inspect a representative
   generated image visually for paper/card mockups before approving print use.

No payments, supplier orders, production configuration changes, or app-cache
writes were made during this investigation. Google diagnostic image requests
were made; therefore this was not a provider-call-free audit. The tests establish
provider behavior for these samples, not overall uptime or conversion impact.
