# SPRINT-0014 Luna Lane A — Share Asset and Design Implementation

**Status:** Draft for coordinator synthesis; implementation is gated on the user preview checkpoint  
**Run:** `2026-10-22-share-previews`  
**Scope owner:** Luna asset lane  
**Handoff source:** `.delivery/runs/2026-10-22-share-previews/design/` (coordinator-created preview art)

## Objective

Replace the obsolete SendMyNotes social artwork with a deterministic, branded DocketStamp image set that remains legible in social cards and small link previews. Deliver the 1200×630 master, a separately composed square, and a small set of route-focused variants using only abstract document artwork. Do not start implementation until the user has reviewed the coordinator's concrete preview and resolved the open visual-direction / route-variant question in `SPRINT-0014-INTENT.md`.

## Authority and constraints

- The Master Build Specification and Agentic Expansion Specification, including their SPRINT-0011 copy and SPRINT-0012 availability addenda, remain authoritative. The SPRINT-0014 intent defines this specific share-image direction.
- Use the established DocketStamp mark and palette: DS monogram, JetBrains Mono wordmark, midnight `#0F172A`, slate `#1E293B` / `#334155`, white, registry blue `#0284C7`, and amber `#FEF3C7` / `#D97706`. Use Merriweather for the principal headline and Inter for supporting copy. Inspect the current mark/art source before reproducing it; do not approximate the wordmark or invent a new seal.
- Approved lead copy: **“Make it formal.”** and **“We’ll print and mail it.”** Supporting words may describe preparation, review, and available USPS mailing. Include a concise self-help / not-a-law-firm statement. No legal outcome, delivery, cancellation, universal availability, government, court, or attorney-review claims. No initial price display.
- The paper/envelope motif is editorial illustration only: abstract rules and a few amber field marks, with no invented legal prose, real postal barcode, address, docket ID, tracking mark, company logo, or actual order record. Do not render example data or reuse an actual user's document.
- Preserve all six system invariants. This lane changes image assets and metadata presentation only; it does not touch letter templates/rendering, policy, checkout, payment, snapshot, dispatch, or credentials.
- Every public preview must use deterministic static bytes at an explicitly versioned URL. Metadata must include accurate dimensions, MIME type, and descriptive alt text. Do not put stage IDs, query parameters, customer/recipient information, personal fields, or order data in the image, title, description, or canonical URL.

## Bounded implementation

1. **Review and adopt the approved handoff.** Inspect all candidate files under `.delivery/runs/2026-10-22-share-previews/design/`, identify the approved wide and square masters, and record filenames, dimensions, export settings, and the approval/checkpoint reference in run evidence. If the checkpoint chooses a shared-only design, keep route artwork shared; if it selects focused examples, continue with the three variants below. Do not silently redraw or rebrand an approved direction.
2. **Produce a small static set.** Export a 1200×630 PNG master and deliberate 1200×1200 square companion. If route variants are approved, create focused wide variants for `/notices/written-contract-and-policy-cancellation-letter`, `/notices/fcra-credit-bureau-written-dispute-letter`, and `/notices/security-deposit-return-demand-letter`. These illustrate the action with neutral abstract marks or an approved action label only; they do not imply that a route/template is enabled or available. Prefer a shared artwork system and real variants over a single image with text clipped/cropped to square.
3. **Name and version assets.** Save immutable outputs under `public/` using a new stable version namespace, e.g. `/share/v1/docketstamp-home.png`, `/share/v1/docketstamp-square.png`, and route-keyed sibling files. Keep filenames stable once referenced; a material art change increments the version path. Convert the legacy `public/og-image.png` and `.jpg` references in the integration change only after new assets are ready. Keep unrelated app icons and source artwork unchanged.
4. **Integrate metadata after asset readiness.** Provide asset paths and art-specific alt text to the metadata lane/coordinator. The root page can use the master; the square is available for contexts that actually request a square image. Route metadata should use `generateMetadata`/shared helper inputs derived from the canonical notice registry and approved route map. Preserve parent Open Graph/Twitter values when child metadata is composed; explicitly include image fields on each intended route. Canonical aliases resolve to the canonical route and therefore its same approved variant. Unknown slugs do not get a fabricated route variant. Keep `/companies` and other generic directory surfaces on the shared master unless the checkpoint authorizes more.

## Handoff contract

The coordinator's `.delivery/runs/2026-10-22-share-previews/design/` directory is the source of reviewed visual direction, not a public runtime directory. After checkpoint approval, copy or export the approved art into the versioned `public/share/v1/` paths, retain the handoff files unchanged, and record a simple manifest mapping source file → public output → dimensions/MIME → intended metadata routes. Send the manifest and route mapping to the metadata implementation lane. The asset lane does not edit metadata files unless the coordinator explicitly consolidates both lanes into one isolated writer.

## Acceptance and QA

- Wide image is exactly 1200×630, square is exactly 1200×1200, and any route variants match the wide dimensions. Every committed URL resolves to the intended stable bytes and declares matching `image/png` (or `image/jpeg` if approved/exported accordingly), dimensions, and alt text.
- Inspect images at full size and at compact link-preview scale (e.g. 600×315, 300×157, and 120×120). Headline, DS mark, workflow meaning, and self-help disclosure remain readable at the intended crop; no element is clipped, awkwardly wrapped, or dependent on tiny copy. Square composition is independently balanced.
- Brand review confirms the current exact mark, palette, and type hierarchy. Artwork remains abstract and privacy-safe. Search image pixels/visible text for addresses, personal data, stage/order IDs, invented legal text, postal barcodes, recipient brands, and government/court insignia.
- Image variants use only approved copy and do not imply service availability, legal effect, completed mailing, tracking proof, or guaranteed cancellation. Route title/description remain based on canonical approved metadata and contain no user/query data.
- Inspect rendered bot-facing metadata for home, `/companies`, each selected canonical notice route, and its supported alias routes. Verify correct canonical URL, OG/Twitter image URL, image dimensions/type/alt, and no nested metadata replacement dropping images. Also inspect an unknown route, a query-prefilled route, and a staged URL: metadata stays neutral and contains no query/stage/customer details.
- Confirm the legacy SendMyNotes image is no longer referenced by active root/social metadata. Preserve old files if other consumers still need them; remove/replace only after reference audit.
- Record focused image-dimension/byte checks, route metadata inspection, screenshots at small-card scale, and the source→output manifest in the run evidence. The independent QA lane verifies the final integrated tree; asset lane does not claim hosted/staging/production scraper proof.

## Out of scope and release boundary

No production implementation or release occurs before the design checkpoint. This lane performs no deployment, social posting, external communication, live purchase, mailing, or unrelated dirty-worktree cleanup. Later staging and production work follows the parent sprint's release plan and uses its isolated current baseline; public hosted proof must compare served asset bytes and bot-visible metadata after release.
