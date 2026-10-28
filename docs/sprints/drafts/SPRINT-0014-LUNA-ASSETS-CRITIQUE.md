# SPRINT-0014 Luna Asset Lane — Cross-Critique of Metadata Draft

**Reviewed:** `docs/sprints/drafts/SPRINT-0014-LUNA-METADATA-DRAFT.md`  
**Scope:** Asset/preview integration, privacy, release isolation

## What is strong

The draft correctly gates implementation on the user preview, keeps availability separate from metadata, calls out alias canonicalization and nested Open Graph replacement, and gives concrete bot-visible acceptance checks. Its SPRINT-0013 allowlist is especially useful: preserve the baseline fingerprint record and ensure the isolated release candidate contains only reviewed SPRINT-0014 paths.

The coordinator previews are distinct compositions: the wide and cancellation images are 1200×630; the square is intentionally composed at 1080×1080. Keep that exact approved square size if approved; do not require 1200×1200 or treat it as a crop. The cancellation variant currently says “Cancel a service. Put it in writing.” Consider the SPRINT-0011-safe action “Send a cancellation notice” (or the canonical chooser wording “Cancel a service or policy in writing”) unless the user approves the current wording at the preview checkpoint; avoid implying the service is already canceled.

## Required corrections before synthesis

1. **Complete the Next image-convention inventory.** The repo contains both `app/opengraph-image.png` and `app/twitter-image.png`. The draft notices Twitter but omits the Open Graph convention file from findings and its expected write set. Inspect both files' bytes and verify the generated head/route metadata precedence with the installed Next version. Decide explicitly whether each is retained, replaced with approved versioned art, or removed after reference/metadata audit. Also inventory the root metadata references to `public/og-image.png` and the stale sibling JPG. A stale convention output must not survive as an alternate declared social image.
2. **Avoid accidental dynamic rendering for query robots.** The blanket rule “any query-bearing preparation route” implies `generateMetadata` must read `searchParams` for every notice request, which can turn otherwise static/cached notice pages into request-time rendering. Query values are already omitted from metadata today, and clean canonicals can consolidate query variants. Before adding that runtime dependency, decide whether the privacy requirement truly needs query-specific `noindex`. Prefer keeping clean public notice metadata stable and query-independent; apply `noindex` only to explicitly sensitive/stage contexts if the framework can do so without broad rendering changes, or ask the coordinator to approve the measured static-rendering tradeoff. In every case, never echo query names/values, stage tokens, or prefilled personal data into metadata.
3. **Keep adjacent privacy fixes bounded and evidence-led.** Removing docket IDs from `/docket/[docketId]` title/description and adding noindex to identity-bearing routes may fit the stated privacy intent, but those edits broaden the metadata lane. Confirm current rendered HTML actually leaks identifiers or lacks required robots directives; include only the smallest fixes supported by that evidence. Avoid adding new layouts for account/admin if existing metadata/headers already provide the needed protection. Do not change route behavior, auth, or customer flows.
4. **Respect the checkpoint as a real gate.** The user has seen the preview and approval/scope is still pending. Keep all implementation, asset copying into `public/`, release preparation, and deployment on hold until that decision arrives. Current run-directory mockups are design evidence, not public outputs or proof of approval.

## Integration and release notes

Use the asset lane's eventual manifest as the single mapping from approved source image to immutable public URL, dimensions, MIME type, alt text, and routes. The current square preview is 1080×1080, and the intentional layout is important at thumbnail size. Require correct tags for the files actually chosen by metadata precedence, not just the tags the app code appears to declare.

The existing dirty checkout contains SPRINT-0013 letter-library work. Keep it untouched and out of the SPRINT-0014 release candidate: do not stage, copy, cherry-pick, or deploy its files or docs. Recheck the recorded baseline fingerprints and compare the final release allowlist before staging. Historical deployment evidence is context only; determine the actual release baseline when the checkpoint is resolved.
