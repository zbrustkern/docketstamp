# SPRINT-0014 merge notes

## Planning lanes

User-requested GPT-6 Luna high asset and metadata planning lanes, run as runtime subagents with exact model overrides. This replaces the skill's default Claude/Astra CLI lanes at the user's direction and follows recent repository sprint convention. Coordinator retains the inherited model. No Gemini. The model resolver was read/run; it returned default inherit/Fable/Astra assignments before the explicit user override. Both Luna workers completed independent drafts and one peer critique each; neither authored implementation.

## Asset draft strengths

Clear reviewed-source handoff, static/versioned asset set, exact brand system, abstract paper illustration and data-free art, actual small-format QA and file ownership.

## Metadata draft strengths

Concrete route audit, nested metadata/image precedence, canonical aliases, private ID exposure, bot-visible acceptance criteria, and isolation from SPRINT-0013.

## Accepted critiques

Inventory and remove both stale `app/opengraph-image.png` and `app/twitter-image.png` after explicit replacement tags work. Use the real canonical registry slugs, not legacy alias filenames. Keep the authored square at 1080×1080. Validate actual bot-visible HTML, not source declarations. Keep small-scale readability criteria realistic. Maintain a real preview checkpoint and isolated release boundary.

## Rejected or narrowed suggestions

- Do not read every notice's `searchParams` solely for blanket query noindex. Static query-independent public metadata plus clean canonicals provides the needed preview privacy without unmeasured rendering changes. Private metadata fixes remain narrowly justified by observed identifier leakage and missing route robots metadata.
- Keep “Certified Mail available” as the already-approved homepage product-option wording, paired with self-help positioning and unchanged service/readiness gates. This adds no claim that every template is enabled or a mailing has occurred. No price is included.
- The proposed cancellation headline remains a preview of the approved customer action, paired immediately with “Prepare your cancellation letter.” It does not assert a completed cancellation. User can request wording revision at the checkpoint; no success guarantee is added.
- The square is a companion asset. Do not imply every social app will automatically pick it over the wide card.
- Do not add manifest/icon redesign, a policy fetch in image rendering, or a dynamic image service to this low-touch release.

## Interview and pending decisions

User was shown the real main PNG and asked (1) approve/revise direction and (2) shared-only versus letter-specific artwork. No answer has arrived yet; no approval is inferred. The synthesized sprint is ready for review, marked planned. If variants are selected, the recommended set covers the nine existing canonical notice types using the same finite layout and current approved actions.

## Final decisions

Versioned static cards, exact brand typography, generic illustration, explicit complete social metadata, truthful canonical/alias mapping, bounded private metadata cleanup, Luna asset/metadata/QA owners, staging then production with no repeated release permission once the preview checkpoint is resolved. Existing repo JSON ledger remains authoritative because the installed helper does not support it. Preserve older entries and all unrelated working changes.
